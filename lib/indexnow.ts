import { NOINDEX_ROUTES, SITE_URL, absoluteUrl } from "@/lib/seo";

/**
 * IndexNow (https://www.indexnow.org) — tell Bing, Yandex, Naver, Seznam and Yep
 * the moment a URL is published, changed or removed, instead of waiting for the
 * next crawl. Google does NOT participate; its discovery still comes from the
 * sitemap. Bing is the point: it is the retrieval layer behind ChatGPT Search,
 * so time-to-index there is time-to-citation.
 *
 * The protocol is one unauthenticated POST. Ownership is proved by hosting a
 * text file at `https://<host>/<key>.txt` whose entire body is the key, which is
 * why `INDEXNOW_KEY` is public by design and lives next to a committed
 * `public/<key>.txt`. Both halves must agree or every submission 403s.
 *
 * Three rules this module exists to enforce:
 *
 *   1. Production only. A preview deployment shares the production key but
 *      serves different content; submitting from one asks Bing to recrawl real
 *      URLs on the strength of a build nobody shipped.
 *   2. Never throw, never block. A ping is a side effect of a publish, not part
 *      of it — an IndexNow outage must not turn a successful save into a 500 or
 *      add latency to the editor request. Everything here is try/caught and
 *      fire-and-forget.
 *   3. Only canonical, indexable URLs. Submitting a noindexed or query-stringed
 *      URL asks an engine to index a page that tells it not to, the same
 *      contradiction the sitemap indexable filters exist to avoid.
 *
 * `pingIndexNow` is the request-path entry point (void, fire-and-forget).
 * `submitIndexNow` is the awaitable one, for scripts and CI that want a result.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** Protocol cap. Larger payloads are rejected outright, so chunk before sending. */
const MAX_URLS_PER_REQUEST = 10_000;

/** A slow endpoint must not hold a serverless function open indefinitely. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The key is a-z A-Z 0-9 and dashes, 8 to 128 chars. Validated here rather than
 * at the endpoint because a malformed key is indistinguishable from a missing
 * key file in the response (both 403), and one warning naming the real cause is
 * worth more than a run of mystery 403s in the logs.
 */
const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

/**
 * Surfaces that are never content, mirroring the `disallow` list in
 * `app/robots.ts`. Kept as a local copy on purpose: `app/robots.ts` is a Next
 * route module, and importing a route into a lib to read one array would drag
 * route semantics into every caller. If that list changes, change this one too.
 */
const PRIVATE_PREFIXES = ["/admin", "/seoteam", "/analyticshub", "/api/"] as const;

export interface IndexNowResult {
  /** URLs accepted by at least one batch request. */
  submitted: number;
  /** URLs dropped before sending (duplicate, cross-origin, noindex, malformed). */
  skipped: number;
  /** One entry per HTTP request made. `status` is `"error"` when fetch itself failed. */
  batches: { urls: number; status: number | "error" }[];
  /** Set when nothing was sent, naming which guard stopped it. */
  reason?: string;
}

const emptyResult = (reason: string): IndexNowResult => ({
  submitted: 0,
  skipped: 0,
  batches: [],
  reason,
});

/**
 * Normalise one input into a canonical, submittable absolute URL, or `null`.
 *
 * Accepts a site-relative path or an absolute URL, so callers can pass whichever
 * they already hold. Everything else is dropped:
 *
 *   - a different origin (not ours to submit, and 422s)
 *   - a query string or fragment (`/compare?ids=a,b` is the noindexed shape of a
 *     page whose canonical is `/compare`; a fragment is not a separate URL)
 *   - a force-noindexed route (`NOINDEX_ROUTES`) or a private surface
 *
 * A trailing slash is stripped (except on the root) so `/blog` and `/blog/` are
 * one entry rather than two submissions of the same page.
 */
export function toSubmittableUrl(input: string): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;

  let siteOrigin: string;
  try {
    siteOrigin = new URL(SITE_URL).origin;
  } catch {
    return null;
  }

  let url: URL;
  try {
    url = new URL(absoluteUrl(raw));
  } catch {
    return null;
  }

  if (url.origin !== siteOrigin) return null;
  if (url.search || url.hash) return null;

  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  if (NOINDEX_ROUTES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(p))) return null;

  url.pathname = path;
  return url.toString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Submit URLs and report what happened. Awaitable — this is what
 * `scripts/indexnow-ping.ts` and the CI workflow call.
 *
 * `allowOutsideProduction` is the deliberate escape hatch for those two callers:
 * a manual backfill runs from a laptop and a workflow runs on a GitHub runner,
 * neither of which is `VERCEL_ENV=production`, yet both submit genuine
 * production URLs. The request path never sets it.
 */
export async function submitIndexNow(
  urls: string | string[],
  opts: { allowOutsideProduction?: boolean } = {},
): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return emptyResult("INDEXNOW_KEY is not set");
  if (!KEY_PATTERN.test(key)) {
    // eslint-disable-next-line no-console
    console.warn("[indexnow] INDEXNOW_KEY is malformed (need 8 to 128 chars of a-z A-Z 0-9 and -).");
    return emptyResult("INDEXNOW_KEY is malformed");
  }

  if (!opts.allowOutsideProduction && process.env.VERCEL_ENV !== "production") {
    return emptyResult(
      `skipped outside production (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`,
    );
  }

  const input = Array.isArray(urls) ? urls : [urls];
  const urlList = [...new Set(input.map(toSubmittableUrl).filter((u): u is string => u !== null))];
  const skipped = input.length - urlList.length;
  if (!urlList.length) return { ...emptyResult("no submittable URLs"), skipped };

  let host: string;
  let keyLocation: string;
  try {
    const site = new URL(SITE_URL);
    host = site.hostname;
    keyLocation = `${site.origin}/${key}.txt`;
  } catch {
    return emptyResult("NEXT_PUBLIC_SITE_URL is not a valid URL");
  }

  const batches: IndexNowResult["batches"] = [];
  let submitted = 0;

  for (const batch of chunk(urlList, MAX_URLS_PER_REQUEST)) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, key, keyLocation, urlList: batch }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      batches.push({ urls: batch.length, status: res.status });

      // 200 accepted, 202 accepted pending key validation. Everything else is a
      // problem, and the two that mean "the setup is wrong, every ping from now
      // on fails the same way" are logged as errors rather than warnings.
      if (res.status === 200 || res.status === 202) {
        submitted += batch.length;
      } else if (res.status === 403 || res.status === 422) {
        // eslint-disable-next-line no-console
        console.error(
          `[indexnow] ${res.status} rejected ${batch.length} URLs. ` +
            `${
              res.status === 403
                ? "Key file invalid or missing"
                : "URLs do not match host, or key mismatch"
            }: check ${keyLocation} is reachable and contains exactly the key.`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[indexnow] ${res.status} from endpoint for ${batch.length} URLs.`);
      }
    } catch (err) {
      batches.push({ urls: batch.length, status: "error" });
      // eslint-disable-next-line no-console
      console.warn("[indexnow] submission failed (non-fatal):", (err as Error).message);
    }
  }

  return { submitted, skipped, batches };
}

/**
 * Vercel `waitUntil`, read off the request context without taking a dependency
 * on `@vercel/functions`.
 *
 * A floating promise in a serverless function is only as alive as the invocation
 * that started it: once the response is returned the runtime is free to freeze
 * the instance, and an in-flight ping dies with it. `waitUntil` keeps the
 * invocation open for it without making the response wait. When the symbol is
 * not there (local dev, `next start`, any other host) the promise simply floats,
 * which is what the process does anyway.
 */
function runInBackground(work: Promise<unknown>): void {
  try {
    const ctx = (
      globalThis as unknown as Record<symbol, { get?: () => { waitUntil?: unknown } | undefined }>
    )[Symbol.for("@vercel/request-context")];
    const waitUntil = ctx?.get?.()?.waitUntil;
    if (typeof waitUntil === "function") {
      (waitUntil as (p: Promise<unknown>) => void)(work);
      return;
    }
  } catch {
    // Fall through to letting the promise float.
  }
  void work;
}

/**
 * Fire-and-forget ping for the write paths. Returns immediately.
 *
 * Deliberately `void`: an API route must not be able to await this by accident,
 * because the day IndexNow is slow is the day every publish in the admin takes
 * ten seconds. Failures are swallowed and logged; the GitHub workflow re-submits
 * from the sitemap diff on the next deploy, so a dropped ping self-heals.
 */
export function pingIndexNow(urls: string | string[]): void {
  try {
    runInBackground(
      submitIndexNow(urls).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn("[indexnow] ping failed (non-fatal):", (err as Error).message);
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[indexnow] ping could not be scheduled (non-fatal):", (err as Error).message);
  }
}
