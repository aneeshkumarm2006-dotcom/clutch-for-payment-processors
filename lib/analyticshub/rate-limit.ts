import type { ConfigStore } from "./config-store";
import { KEYS, getJSON, setJSON } from "./config-store";

/**
 * lib/analyticshub/rate-limit.ts — login throttle for the single owner account.
 *
 * Unlike the app's in-memory `lib/rate-limit.ts` (per-instance, resets on cold
 * start), this window lives in the config store so it is DURABLE across serverless
 * instances — a brute-forcer can't dodge it by hitting a fresh lambda. Spec: 8
 * failed attempts per 15 minutes, keyed by client IP.
 */

const LIMIT = 8;
const WINDOW_MS = 15 * 60 * 1000;

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // seconds until the window resets (for Retry-After)
}

/** Is this IP currently allowed to attempt a login? (Does not increment.) */
export async function checkLoginRate(
  store: ConfigStore,
  ip: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const win = await getJSON<Window>(store, KEYS.loginRate(ip));
  if (!win || now >= win.resetAt) return { ok: true, retryAfter: 0 };
  if (win.count >= LIMIT) {
    return { ok: false, retryAfter: Math.ceil((win.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Record a failed attempt, opening or extending the current window. */
export async function recordFailedLogin(
  store: ConfigStore,
  ip: string,
  now: number = Date.now(),
): Promise<void> {
  const key = KEYS.loginRate(ip);
  const win = await getJSON<Window>(store, key);
  if (!win || now >= win.resetAt) {
    await setJSON(store, key, { count: 1, resetAt: now + WINDOW_MS } satisfies Window);
    return;
  }
  await setJSON(store, key, { count: win.count + 1, resetAt: win.resetAt } satisfies Window);
}

/** Clear the window after a successful login. */
export async function clearLoginRate(store: ConfigStore, ip: string): Promise<void> {
  await store.delete(KEYS.loginRate(ip));
}

/** Best-effort client IP from proxy headers (mirrors lib/rate-limit.ts). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export const LOGIN_LIMIT = LIMIT;
export const LOGIN_WINDOW_MS = WINDOW_MS;
