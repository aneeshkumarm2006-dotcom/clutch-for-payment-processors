/**
 * lib/analyticshub/handlers/http.ts — framework-light HTTP helpers.
 *
 * The dispatcher deals in the Web `Request`/`Response` primitives (not
 * `NextResponse`) so it can be unit-tested with a plain `new Request(...)` and no
 * Next import. The catch-all route just forwards the real request to `handle()`.
 * Every JSON response is `no-store` + `noindex` (the hub is never cacheable or
 * crawlable).
 */

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  // Accept either case — session.ts uses the lowercase Next-style form, and
  // browsers treat the SameSite attribute case-insensitively.
  sameSite?: "Lax" | "Strict" | "None" | "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

interface JsonInit {
  status?: number;
  cookies?: string[];
  headers?: Record<string, string>;
}

export function jsonResponse(data: unknown, init: JsonInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  for (const c of init.cookies ?? []) headers.append("set-cookie", c);
  return new Response(JSON.stringify(data), { status: init.status ?? 200, headers });
}

/** `{ error }` (+ optional `fieldErrors`) — mirrors the repo's lib/api.ts shape. */
export function errorResponse(
  message: string,
  status = 400,
  fieldErrors?: Record<string, string[]>,
  cookies?: string[],
): Response {
  return jsonResponse(
    fieldErrors ? { error: message, fieldErrors } : { error: message },
    { status, cookies },
  );
}

export function redirectResponse(location: string, cookies?: string[]): Response {
  const headers = new Headers({ location, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" });
  for (const c of cookies ?? []) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

/** The origin of the current request, honoring Vercel's forwarding headers. */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
