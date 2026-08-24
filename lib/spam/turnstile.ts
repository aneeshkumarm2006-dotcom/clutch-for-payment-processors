import { ApiError } from "@/lib/api";

/**
 * lib/spam/turnstile.ts — Cloudflare Turnstile, wired as an ENV-VAR-ONLY switch.
 *
 * Nothing changes until the keys exist:
 *
 *   TURNSTILE_SECRET_KEY unset → `verifyTurnstile` is a no-op. Every form keeps
 *                                working exactly as it does today.
 *   TURNSTILE_SECRET_KEY set   → a valid token is REQUIRED on every public POST.
 *
 * The site key is served from `/api/spam/config` rather than baked into page
 * markup, so adding it needs no code edit, no rebuild of generated pages, and
 * no change to anything golden-file tested.
 *
 * This is the ONE check that does not fail open. A captcha that waves traffic
 * through whenever its own verifier is unreachable is not a captcha. Everything
 * else in `lib/spam/` degrades to "allow" on error; this degrades to "refuse".
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Public site key, or `null` when Turnstile is not configured. */
export function turnstileSiteKey(): string | null {
  const key = process.env.TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

/** True once the secret exists — i.e. verification is enforced. */
export function turnstileEnforced(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

interface SiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify a token. No-op while unconfigured; throws `ApiError(400)` otherwise.
 *
 * A server-side check cannot tell a WRONG site key from a MISSING token — both
 * arrive here as "no token" — so a browser test is the only proof the keys are
 * genuinely valid. See the deploy notes.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return; // inert until the keys are added

  if (!token) {
    throw new ApiError(400, "Please complete the verification check and try again.");
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  let data: SiteVerifyResponse;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // Don't let a hung Cloudflare hold the whole serverless function open.
      signal: AbortSignal.timeout(8_000),
    });
    data = (await res.json()) as SiteVerifyResponse;
  } catch {
    // Deliberately NOT fail-open. See the file header.
    throw new ApiError(503, "Verification is temporarily unavailable. Please try again shortly.");
  }

  if (!data.success) {
    // eslint-disable-next-line no-console
    console.warn("[turnstile] verification failed:", data["error-codes"]);
    throw new ApiError(400, "Verification failed. Please try again.");
  }
}
