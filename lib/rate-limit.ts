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

/**
 * Collapse an IP to its network neighbourhood: /24 for IPv4, /48 for IPv6.
 *
 * A per-address cap is free to evade — a rented /24 supplies 256 "different"
 * IPs for pennies, and one rotating subnet is exactly what a flood looks like
 * from the inside. Capping the neighbourhood is what makes rotation cost money.
 *
 * Returns `null` for an address we could not parse, so the caller can skip the
 * neighbourhood check rather than lump every unknown caller into one bucket and
 * throttle real people behind an unusual proxy.
 */
export function networkKey(ip: string): string | null {
  const addr = ip.trim().toLowerCase();
  if (!addr || addr === "unknown") return null;

  // IPv4 (also the ::ffff:1.2.3.4 form some proxies emit) → /24.
  const v4 = addr.startsWith("::ffff:") ? addr.slice(7) : addr;
  const v4Parts = v4.split(".");
  if (v4Parts.length === 4 && v4Parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) {
    return `${v4Parts[0]}.${v4Parts[1]}.${v4Parts[2]}.0/24`;
  }

  // IPv6 → /48, i.e. the first three hextets. Expand a single "::" run first.
  if (addr.includes(":")) {
    const [head = "", tail = ""] = addr.split("::");
    const headParts = head.split(":").filter(Boolean);
    const tailParts = tail.split(":").filter(Boolean);
    const missing = 8 - headParts.length - tailParts.length;
    const full = addr.includes("::")
      ? [...headParts, ...Array(Math.max(0, missing)).fill("0"), ...tailParts]
      : addr.split(":");
    if (full.length !== 8) return null;
    return `${full[0]}:${full[1]}:${full[2]}::/48`;
  }

  return null;
}

/**
 * The neighbourhood limit: deliberately a much longer window than the per-IP
 * one. A single visitor sending five enquiries in a minute is impatient; forty
 * from one /24 in an hour is a rented subnet.
 */
export const NETWORK_LIMIT = 40;
export const NETWORK_WINDOW_MS = 60 * 60 * 1000;
