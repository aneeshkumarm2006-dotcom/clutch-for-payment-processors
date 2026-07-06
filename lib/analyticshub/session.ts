import { b64url, fromB64url, hmacSign, hmacVerify } from "./crypto";

/**
 * lib/analyticshub/session.ts — the hub's own login session, independent of
 * NextAuth (/admin) and the shared-password scheme (/seoteam). Single owner.
 *
 * A session is a signed token `base64url(JSON{exp}) "." base64url(HMAC-SHA256)`,
 * keyed by the MAC key HKDF-derived from `ANALYTICSHUB_SECRET_KEY` (see crypto.ts).
 * We verify the signature in constant time (crypto.timingSafeEqual) and then the
 * expiry, so an expired-but-valid token is still rejected.
 */

export const HUB_COOKIE = "analyticshub_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (spec)

/** Mint a signed session token valid for `ttlMs`. */
export function signSession(ttlMs: number = SESSION_TTL_MS, now: number = Date.now()): string {
  const payloadB64 = b64url(Buffer.from(JSON.stringify({ exp: now + ttlMs })));
  return `${payloadB64}.${hmacSign(payloadB64)}`;
}

/** Verify a session token's signature AND expiry. */
export function verifySession(token: string | undefined | null, now: number = Date.now()): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!hmacVerify(payloadB64, sigB64)) return false;
  try {
    const payload = JSON.parse(fromB64url(payloadB64).toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" && now < payload.exp;
  } catch {
    return false;
  }
}

/** Cookie attributes shared by set (login/setup) and clear (logout). */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Strip Secure off in dev so login works over http://localhost (matches the
    // repo's seoteam pattern). Prod is always https on Vercel.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
