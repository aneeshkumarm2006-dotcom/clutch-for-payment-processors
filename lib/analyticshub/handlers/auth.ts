import { z } from "zod";
import type { Ctx } from "./context";
import { jsonResponse, errorResponse } from "./http";
import { KEYS, getJSON, setJSON } from "../config-store";
import { validateSecret, scryptHash, scryptVerify } from "../crypto";
import { signSession, sessionCookieOptions, SESSION_MAX_AGE_SECONDS, HUB_COOKIE } from "../session";
import { serializeCookie } from "./http";
import { checkLoginRate, recordFailedLogin, clearLoginRate, clientIp } from "../rate-limit";

/**
 * lib/analyticshub/handlers/auth.ts — first-run setup, login/logout, and the
 * project + password mutations. This is the hub's whole auth surface; it uses the
 * scrypt/HMAC primitives in crypto.ts and the durable login limiter.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  primaryColor: z.string().regex(HEX, "Use a 6-digit hex color like #6D28D9."),
  accentColor: z.string().regex(HEX, "Use a 6-digit hex color like #8B5CF6."),
});

export interface Project {
  name: string;
  primaryColor: string;
  accentColor: string;
}

const DEFAULT_PROJECT: Project = {
  name: "PayCompare",
  primaryColor: "#6D28D9", // electric violet — the brand's one accent
  accentColor: "#8B5CF6",
};

function sessionCookie(): string {
  return serializeCookie(HUB_COOKIE, signSession(), sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
}

function clearedCookie(): string {
  return serializeCookie(HUB_COOKIE, "", sessionCookieOptions(0));
}

/** Best-effort auto-detected project identity from the host SiteSettings (DB). */
async function detectProject(): Promise<Project> {
  try {
    const [{ default: connect }, { SiteSettings }] = await Promise.all([
      import("@/lib/db"),
      import("@/models/SiteSettings"),
    ]);
    await connect();
    const s = await SiteSettings.findOne({ key: "singleton" }).lean();
    return {
      name: s?.siteName || DEFAULT_PROJECT.name,
      primaryColor: s?.primaryColor && HEX.test(s.primaryColor) ? s.primaryColor : DEFAULT_PROJECT.primaryColor,
      accentColor: DEFAULT_PROJECT.accentColor,
    };
  } catch {
    return DEFAULT_PROJECT;
  }
}

function oauthAvailable(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

// ---------------------------------------------------------------------------
// GET /status — the single source of truth for the client shell
// ---------------------------------------------------------------------------
export async function statusHandler(ctx: Ctx): Promise<Response> {
  const secret = validateSecret();

  // DB / password probe. Any throw here means the store is unreachable — name it.
  let setupComplete = false;
  let dbOk = true;
  let dbMessage: string | undefined;
  if (secret.ok) {
    try {
      const pw = await ctx.store.get(KEYS.password);
      setupComplete = pw != null;
    } catch (err) {
      dbOk = false;
      dbMessage =
        (err as Error).message ||
        "Could not reach the database. Check MONGODB_URI and that the database is running.";
    }
  }

  // Connection states (best-effort; never throws).
  const sources: Record<string, string> = {
    ga4: "not_connected",
    gsc: "not_connected",
    meta: "not_connected",
    gads: "not_connected",
    leads: "connected", // internal source — always available
  };
  let project: Project | null = null;
  if (secret.ok && dbOk) {
    try {
      const google = await getJSON<{ status?: string; propertyId?: string; siteUrl?: string }>(ctx.store, KEYS.google);
      if (google) {
        const reconnect = google.status === "reconnect_needed";
        if (google.propertyId) sources.ga4 = reconnect ? "reconnect_needed" : "connected";
        if (google.siteUrl) sources.gsc = reconnect ? "reconnect_needed" : "connected";
      }
      const meta = await getJSON<{ status?: string; accountId?: string }>(ctx.store, KEYS.meta);
      if (meta?.accountId) sources.meta = meta.status === "reconnect_needed" ? "reconnect_needed" : "connected";
      const gads = await getJSON<{ status?: string; customerId?: string }>(ctx.store, KEYS.gads);
      if (gads?.customerId) sources.gads = gads.status === "reconnect_needed" ? "reconnect_needed" : "connected";
      project = await getJSON<Project>(ctx.store, KEYS.project);
    } catch {
      /* leave defaults */
    }
  }

  // Visual-verification stub (ANALYTICSHUB_STUB=1) — reflect canned connections.
  if (process.env.ANALYTICSHUB_STUB === "1") {
    const { STUB_SOURCES } = await import("../sources/stub");
    Object.assign(sources, STUB_SOURCES);
  }

  const errors: string[] = [];
  if (!secret.ok) errors.push(secret.message!);
  if (!dbOk && dbMessage) errors.push(dbMessage);

  return jsonResponse({
    ok: secret.ok && dbOk,
    setupComplete,
    authed: ctx.authed,
    project: project ?? (setupComplete ? DEFAULT_PROJECT : await detectProject()),
    projectIsDetected: project == null,
    sources,
    oauthAvailable: oauthAvailable(),
    secret: {
      ok: secret.ok,
      reason: secret.reason,
      message: secret.message,
      decodedLength: secret.decodedLength,
    },
    db: { ok: dbOk, message: dbMessage },
    errors,
  });
}

// ---------------------------------------------------------------------------
// POST /setup — first claim (only allowed when no password exists yet)
// ---------------------------------------------------------------------------
const setupSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
    project: projectSchema.optional(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export async function setupHandler(ctx: Ctx): Promise<Response> {
  const secret = validateSecret();
  if (!secret.ok) return errorResponse(secret.message!, 400);

  // First-claim guard.
  try {
    const existing = await ctx.store.get(KEYS.password);
    if (existing != null) {
      return errorResponse("Setup is already complete. Sign in instead.", 409);
    }
  } catch (err) {
    return errorResponse((err as Error).message || "Database unreachable.", 503);
  }

  const parsed = setupSchema.safeParse(ctx.body);
  if (!parsed.success) {
    return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  }

  await ctx.store.set(KEYS.password, scryptHash(parsed.data.password));
  if (parsed.data.project) await setJSON(ctx.store, KEYS.project, parsed.data.project);

  return jsonResponse({ ok: true }, { cookies: [sessionCookie()] });
}

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
const loginSchema = z.object({ password: z.string().min(1, "Enter your password.") });

export async function loginHandler(ctx: Ctx): Promise<Response> {
  const ip = clientIp(ctx.req);
  const rate = await checkLoginRate(ctx.store, ip);
  if (!rate.ok) {
    return jsonResponse(
      { error: `Too many attempts. Try again in ${Math.ceil(rate.retryAfter / 60)} minute(s).` },
      { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
    );
  }

  const parsed = loginSchema.safeParse(ctx.body);
  if (!parsed.success) {
    return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  }

  let stored: string | null;
  try {
    stored = await ctx.store.get(KEYS.password);
  } catch (err) {
    return errorResponse((err as Error).message || "Database unreachable.", 503);
  }
  if (stored == null) {
    return errorResponse("No account yet — complete first-run setup.", 400);
  }

  if (!scryptVerify(parsed.data.password, stored)) {
    await recordFailedLogin(ctx.store, ip);
    return errorResponse("Incorrect password.", 401);
  }

  await clearLoginRate(ctx.store, ip);
  return jsonResponse({ ok: true }, { cookies: [sessionCookie()] });
}

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------
export async function logoutHandler(): Promise<Response> {
  return jsonResponse({ ok: true }, { cookies: [clearedCookie()] });
}

// ---------------------------------------------------------------------------
// POST /project (auth) — save project identity
// ---------------------------------------------------------------------------
export async function projectHandler(ctx: Ctx): Promise<Response> {
  const parsed = projectSchema.safeParse(ctx.body);
  if (!parsed.success) {
    return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  }
  await setJSON(ctx.store, KEYS.project, parsed.data);
  return jsonResponse({ ok: true, project: parsed.data });
}

// ---------------------------------------------------------------------------
// POST /password (auth) — change password
// ---------------------------------------------------------------------------
const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export async function passwordHandler(ctx: Ctx): Promise<Response> {
  const parsed = passwordSchema.safeParse(ctx.body);
  if (!parsed.success) {
    return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  }
  const stored = await ctx.store.get(KEYS.password);
  if (stored == null || !scryptVerify(parsed.data.current, stored)) {
    return errorResponse("Current password is incorrect.", 401, { current: ["Current password is incorrect."] });
  }
  await ctx.store.set(KEYS.password, scryptHash(parsed.data.next));
  return jsonResponse({ ok: true });
}
