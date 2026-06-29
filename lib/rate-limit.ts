/**
 * lib/rate-limit.ts — anti-spam primitives for the public POST endpoints
 * (PRD §11 / §9.6: "Public POSTs are open but rate-limited + honeypot-protected").
 *
 * Two intentionally-tiny pieces:
 *
 *   - `rateLimit(key, …)` — a fixed-window in-memory counter keyed by client IP.
 *   - `isBot(body)`       — checks the form's honeypot field.
 *
 * CAVEAT: the counter lives in module memory, so it is per-instance and resets on
 * cold start. On a single long-lived Node server that's enough to blunt naive
 * floods; on multi-instance/serverless it's best-effort. A shared store (Redis /
 * Upstash) is the production upgrade — swap the Map for that without touching
 * callers. Logged in NOTES.md.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (for a Retry-After header / message). */
  retryAfter: number;
}

/**
 * Allow `limit` hits per `windowMs` for a given key. Returns `{ ok }` plus the
 * seconds remaining when blocked.
 */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };

}

/**
 * Best-effort client IP from the proxy headers Vercel/most hosts set. Falls back
 * to a constant so the limiter still groups unknown callers together.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Honeypot check. The public forms render a visually-hidden, `autocomplete="off"`
 * text input that humans never see; bots that fill every field trip it. We accept
 * the request at the route (to not reveal the trap) but skip persistence.
 */
export const HONEYPOT_FIELD = "companyWebsite";

export function isBot(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD];
  return typeof v === "string" && v.trim().length > 0;
}
