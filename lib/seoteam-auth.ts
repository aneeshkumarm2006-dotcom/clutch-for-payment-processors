/**
 * Edge-safe session signing/verification for the /seoteam dashboard (shared
 * password scheme). This module is imported by BOTH the Edge `middleware.ts` and
 * Node route handlers, so it must use ONLY Web Crypto + TextEncoder + btoa/atob —
 * no `node:crypto`, no `next/headers`, no `mongoose` (or the Edge bundle breaks).
 *
 * A session is a signed token `base64url(JSON{exp}) "." base64url(HMAC-SHA256)`
 * keyed by `SESSION_SECRET`. `crypto.subtle.verify` is the constant-time
 * primitive — we never hand-roll a string comparison of the signature.
 */

export const SEO_COOKIE = "seoteam_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // ~7 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length > 0 ? s : null;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey | null> {
  const secret = getSecret();
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Sign a fresh session token valid for `ttlMs`. Returns null if SESSION_SECRET is unset. */
export async function signSession(ttlMs: number = SESSION_TTL_MS): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const payloadB64 = bytesToB64url(encoder.encode(JSON.stringify({ exp: Date.now() + ttlMs })));
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

/** Verify a session token's signature AND expiry (constant-time). */
export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const key = await getKey();
  if (!key) return false;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let sigBytes: Uint8Array;
  try {
    sigBytes = b64urlToBytes(sigB64);
  } catch {
    return false;
  }

  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadB64));
  if (!ok) return false;

  try {
    const payload = JSON.parse(decoder.decode(b64urlToBytes(payloadB64))) as { exp?: unknown };
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}
