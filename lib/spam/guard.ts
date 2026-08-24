import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { BlockedSubmission, SubmissionFingerprint } from "@/models";
import { ApiError } from "@/lib/api";
import {
  NETWORK_LIMIT,
  NETWORK_WINDOW_MS,
  clientIp,
  isBot,
  networkKey,
  rateLimit,
} from "@/lib/rate-limit";
import { OWN_HOSTS, classifySubmission } from "./classify";
import { FORM_SPECS, str, toSpamInput } from "./fields";
import { fingerprintPayload } from "./fingerprint";
import type { ISpamMeta } from "@/models/spamMeta";
import type { SpamFormKind, SpamResult } from "./types";
import { verifyTurnstile } from "./turnstile";

/**
 * lib/spam/guard.ts — the one entry point every public POST route calls.
 *
 * Owns the parts of spam handling that need I/O: rate limits, the duplicate
 * window, the Turnstile check, and writing a rejection to the bin. The scoring
 * itself lives in `classify.ts` and stays pure.
 *
 * FAIL OPEN, EVERYWHERE EXCEPT THE CAPTCHA. If Mongo blips, the duplicate
 * lookup, the fingerprint write and even the bin write all degrade to "let it
 * through" rather than "drop it". A form that loses real enquiries when a
 * dependency hiccups is worse than one that occasionally lets a bot through.
 *
 * The one place that does NOT fail open is Turnstile: a captcha that waves
 * traffic through when its own verifier is unreachable is not a captcha. It is
 * also inert until the secret is set, so it cannot break anything before the
 * keys exist.
 *
 * REJECTION IS CONDITIONAL ON THE BIN. If the bin write fails, the verdict is
 * downgraded to `quarantine` and the submission is persisted normally. A hard
 * reject with nothing behind it is exactly the failure this whole design
 * exists to prevent.
 */

/**
 * Our own hosts, widened with whatever this deployment is actually serving from,
 * so a preview or a renamed domain still recognises itself in a message body and
 * still whitelists internal senders. Computed once at module load.
 */
const ownHosts: readonly string[] = (() => {
  const hosts = new Set<string>(OWN_HOSTS);
  try {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) {
      const h = new URL(configured).hostname.toLowerCase().replace(/^www\./, "");
      // localhost in dev would whitelist nothing useful and match nothing real.
      if (h && h !== "localhost" && h.includes(".")) hosts.add(h);
    }
  } catch {
    /* a malformed NEXT_PUBLIC_SITE_URL just means the static list stands */
  }
  return [...hosts];
})();

/**
 * A throwaway ObjectId-shaped string for the rejection response.
 *
 * The success STATUS being identical is not enough on its own: a real success
 * answers `{ ok: true, id: "<ObjectId>" }`, so a rejection that answered
 * `{ ok: true }` would be trivially distinguishable and tell a bot exactly which
 * of its payloads got through. No client reads this value.
 */
export function decoyId(): string {
  return randomBytes(12).toString("hex");
}

/** Field the client stamps with `Date.now()` when the form renders. */
export const RENDER_STAMP_FIELD = "formRenderedAt";
/** Field carrying the Cloudflare Turnstile token, when the widget is active. */
export const TURNSTILE_FIELD = "turnstileToken";

export interface GuardOutcome {
  /**
   * `true` when the payload was rejected and binned. The route must answer with
   * its NORMAL success status and write nothing: the bot sees success, so it
   * neither retries nor adapts.
   */
  blocked: boolean;
  /** Verdict metadata to store on the document. Absent when blocked. */
  meta?: ISpamMeta;
  /**
   * `false` for a quarantined submission: it is stored and categorised, but
   * never emailed. Notifying on quarantine would defeat the whole point.
   */
  notify: boolean;
  result: SpamResult;
}

/**
 * Run every public-submission check. Throws `ApiError(429)` when a rate limit
 * trips and `ApiError(400)` when Turnstile is enforced and the token fails —
 * both of which the caller's existing `handleApiError` already renders.
 */
export async function guardSubmission(args: {
  form: SpamFormKind;
  req: Request;
  raw: Record<string, unknown>;
  /** Signed-in admins skip everything; they are trusted. */
  isAdmin?: boolean;
}): Promise<GuardOutcome> {
  const { form, req, raw } = args;
  const spec = FORM_SPECS[form];

  if (args.isAdmin) {
    return {
      blocked: false,
      notify: true,
      result: { verdict: "allow", score: 0, category: "clean", reasons: [] },
    };
  }

  const ip = clientIp(req);
  const network = networkKey(ip);

  // --- Rate limits ----------------------------------------------------------
  // Per address, then per neighbourhood over a much longer window. The second
  // one is what makes a rented /24 cost money instead of being free evasion.
  const perIp = rateLimit(`${form}:${ip}`, 5, 60_000);
  if (!perIp.ok) {
    throw new ApiError(429, "You're sending requests too fast. Please try again in a minute.");
  }
  if (network) {
    const perNetwork = rateLimit(`${form}:net:${network}`, NETWORK_LIMIT, NETWORK_WINDOW_MS);
    if (!perNetwork.ok) {
      throw new ApiError(429, "Too many submissions from your network. Please try again later.");
    }
  }

  // --- Turnstile ------------------------------------------------------------
  // Inert until TURNSTILE_SECRET_KEY is set. Does NOT fail open.
  await verifyTurnstile(str(raw[TURNSTILE_FIELD]), ip);

  // --- Assemble the classifier's input --------------------------------------
  let renderAgeMs: number | undefined;
  const stamp = raw[RENDER_STAMP_FIELD];
  if (typeof stamp === "number" && Number.isFinite(stamp)) {
    renderAgeMs = Date.now() - stamp;
  } else if (typeof stamp === "string" && /^\d+$/.test(stamp)) {
    renderAgeMs = Date.now() - Number(stamp);
  }

  // --- Duplicate window (fails open) ---------------------------------------
  const fingerprint = fingerprintPayload(spec.fingerprintFields.map((f) => str(raw[f])));
  let isDuplicate = false;
  if (fingerprint) {
    try {
      await connectToDatabase();
      isDuplicate = !!(await SubmissionFingerprint.exists({ fingerprint }));
    } catch {
      isDuplicate = false; // datastore blip → never invent a reason to filter
    }
  }

  const result = classifySubmission(
    toSpamInput(form, raw, {
      honeypot: isBot(raw),
      renderAgeMs,
      isDuplicate,
      ownHosts,
    }),
  );

  // Record the fingerprint for every verdict — a rejected flood still has to
  // count towards the window, or the second copy looks like the first.
  if (fingerprint && !isDuplicate) {
    try {
      await SubmissionFingerprint.create({ fingerprint, form });
    } catch {
      /* best-effort */
    }
  }

  const reasons = result.reasons.map((r) => r.label);
  const codes = result.reasons.map((r) => r.code);

  if (result.verdict === "reject") {
    const binned = await binSubmission({
      form,
      payload: raw,
      result,
      ip,
      network,
      fingerprint,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    if (binned) return { blocked: true, notify: false, result };
    // The bin is unreachable. Rejecting anyway would destroy the submission
    // with no record, so downgrade: store it, flag it, don't email it.
    return {
      blocked: false,
      notify: false,
      result: { ...result, verdict: "quarantine" },
      meta: buildMeta("quarantine", result, reasons, codes, fingerprint, ip, network),
    };
  }

  return {
    blocked: false,
    notify: result.verdict === "allow",
    result,
    meta: buildMeta(result.verdict, result, reasons, codes, fingerprint, ip, network),
  };
}

function buildMeta(
  verdict: "allow" | "quarantine",
  result: SpamResult,
  reasons: string[],
  codes: string[],
  fingerprint: string | null,
  ip: string,
  network: string | null,
): ISpamMeta {
  return {
    verdict,
    score: result.score,
    category: result.category,
    reasons,
    codes,
    fingerprint: fingerprint ?? undefined,
    ip,
    network: network ?? undefined,
    classifiedAt: new Date(),
  };
}

/** Copy a rejection to the 30-day bin. Returns false if it could not be stored. */
async function binSubmission(args: {
  form: SpamFormKind;
  payload: Record<string, unknown>;
  result: SpamResult;
  ip: string;
  network: string | null;
  fingerprint: string | null;
  userAgent?: string;
}): Promise<boolean> {
  try {
    await connectToDatabase();
    await BlockedSubmission.create({
      form: args.form,
      payload: args.payload,
      score: args.result.score,
      category: args.result.category,
      reasons: args.result.reasons.map((r) => r.label),
      codes: args.result.reasons.map((r) => r.code),
      ip: args.ip,
      network: args.network ?? undefined,
      userAgent: args.userAgent,
      fingerprint: args.fingerprint ?? undefined,
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[spam] could not write to the blocked bin — downgrading to quarantine:", err);
    return false;
  }
}
