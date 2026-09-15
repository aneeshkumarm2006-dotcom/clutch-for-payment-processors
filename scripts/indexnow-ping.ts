import { loadEnv } from "./loadEnv";

loadEnv();

/**
 * Manual + CI IndexNow submitter.
 *
 *   npm run indexnow:ping -- /blog/my-post /processor/stripe
 *   npm run indexnow:ping -- --all                       # every URL in the sitemap
 *   npm run indexnow:ping -- --all --dry-run             # print, submit nothing
 *   npm run indexnow:ping -- --sitemap-diff .indexnow/sitemap.json
 *
 * The first two are for a human: a backfill after wiring the key up, or a nudge
 * for pages that shipped as code rather than through the panel. The third is what
 * `.github/workflows/indexnow.yml` runs — it submits only the URLs that are new
 * or whose `<lastmod>` moved since the snapshot file, then rewrites the snapshot.
 *
 * `--site` exists because `.env.local` points `NEXT_PUBLIC_SITE_URL` at
 * localhost. Without it a laptop run would try to submit `http://localhost:3000`
 * URLs, which IndexNow rejects (and should). The script refuses a local host
 * outright rather than sending a request that cannot work.
 *
 * Everything routes through `submitIndexNow` in `lib/indexnow.ts`, with
 * `allowOutsideProduction` set: a CI runner and a laptop are neither, yet both
 * submit genuine production URLs. See that file for the protocol details.
 */

const argv = process.argv.slice(2);

const flagValue = (name: string): string | undefined => {
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};

const ALL = argv.includes("--all");
const DRY_RUN = argv.includes("--dry-run");
const SITEMAP_DIFF = flagValue("--sitemap-diff");
const SITE_OVERRIDE = flagValue("--site");
/** Submit everything on the very first diff run instead of only seeding the snapshot. */
const FIRST_RUN_SUBMIT = argv.includes("--first-run-submit");

/**
 * `lib/seo.ts` reads `NEXT_PUBLIC_SITE_URL` once, at module load, so `--site`
 * has to land in the environment BEFORE that module is evaluated.
 *
 * A plain `import` cannot give that guarantee: imports hoist, so `lib/seo` would
 * be evaluated before this line ran and `--site` would be silently ignored (it
 * was, on the first run of this script — every path came back pointing at
 * localhost). The other scripts get away with the same shape only because
 * `lib/db` reads `MONGODB_URI` inside a function rather than at module scope.
 * Hence the dynamic imports inside `main()` below: they are load-bearing.
 */
if (SITE_OVERRIDE) process.env.NEXT_PUBLIC_SITE_URL = SITE_OVERRIDE;

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** `<loc>` → `<lastmod>` (empty string when the entry carries no date). */
type SitemapSnapshot = Record<string, string>;

const tag = (xml: string, name: string): string | undefined =>
  new RegExp(`<${name}>\\s*([^<]+?)\\s*</${name}>`, "i").exec(xml)?.[1];

/**
 * Parse `<url>` entries out of a sitemap. Handles a sitemap index too by
 * recursing into its children: Next emits a single file today, but a site that
 * outgrows 50k URLs gets an index without warning anyone.
 */
async function fetchSitemap(url: string, depth = 0): Promise<SitemapSnapshot> {
  const res = await fetch(url, { headers: { "User-Agent": "indexnow-ping/1.0" } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  const xml = await res.text();

  if (/<sitemapindex/i.test(xml) && depth < 3) {
    const children = [...xml.matchAll(/<sitemap\b[\s\S]*?<\/sitemap>/gi)]
      .map((m) => tag(m[0], "loc"))
      .filter((l): l is string => Boolean(l));
    const out: SitemapSnapshot = {};
    for (const child of children) Object.assign(out, await fetchSitemap(child, depth + 1));
    return out;
  }

  const snapshot: SitemapSnapshot = {};
  for (const match of xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)) {
    const loc = tag(match[0], "loc");
    if (loc) snapshot[loc] = tag(match[0], "lastmod") ?? "";
  }
  return snapshot;
}

function readSnapshot(path: string): SitemapSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as SitemapSnapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(path: string, snapshot: SitemapSnapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  // Deferred on purpose — see the `--site` note above.
  const { SITE_URL, absoluteUrl } = await import("@/lib/seo");
  const { submitIndexNow, toSubmittableUrl } = await import("@/lib/indexnow");

  let site: URL;
  try {
    site = new URL(SITE_URL);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid URL: ${SITE_URL}`);
  }

  // A local host can serve the sitemap but can never be the `host` of a valid
  // submission, so catching it here beats a wall of 422s.
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(site.hostname)) {
    throw new Error(
      `Refusing to submit ${site.origin}. Pass the production site, e.g. ` +
        `npm run indexnow:ping -- --all --site https://www.example.com`,
    );
  }

  if (!process.env.INDEXNOW_KEY && !DRY_RUN) {
    throw new Error("INDEXNOW_KEY is not set. Add it to .env.local (see .env.example).");
  }

  let urls: string[];
  let snapshotToWrite: { path: string; data: SitemapSnapshot } | null = null;

  if (SITEMAP_DIFF) {
    const path = resolve(process.cwd(), SITEMAP_DIFF);
    const previous = readSnapshot(path);
    const current = await fetchSitemap(absoluteUrl("/sitemap.xml"));
    const total = Object.keys(current).length;
    if (!total) throw new Error("Sitemap contained no <url> entries. Refusing to write a snapshot.");

    snapshotToWrite = { path, data: current };

    if (!previous) {
      // No snapshot means the cache was empty — a first run, or an eviction.
      // Submitting the whole sitemap on every eviction would look like a
      // publisher spamming the protocol, so the baseline is seeded silently and
      // the next push submits a real diff. `--first-run-submit` overrides.
      // eslint-disable-next-line no-console
      console.log(`[indexnow] No previous snapshot at ${SITEMAP_DIFF}. Seeding ${total} URLs.`);
      if (!FIRST_RUN_SUBMIT) {
        if (!DRY_RUN) writeSnapshot(path, current);
        return;
      }
      urls = Object.keys(current);
    } else {
      urls = Object.keys(current).filter((loc) => previous[loc] !== current[loc]);
      const added = urls.filter((loc) => !(loc in previous)).length;
      // eslint-disable-next-line no-console
      console.log(
        `[indexnow] Sitemap: ${total} URLs, ${added} new, ${urls.length - added} with a changed lastmod.`,
      );
    }
  } else if (ALL) {
    const current = await fetchSitemap(absoluteUrl("/sitemap.xml"));
    urls = Object.keys(current);
    // eslint-disable-next-line no-console
    console.log(`[indexnow] Sitemap: ${urls.length} URLs.`);
  } else {
    urls = argv.filter((a) => !a.startsWith("--") && a !== SITE_OVERRIDE && a !== SITEMAP_DIFF);
    if (!urls.length) {
      throw new Error(
        "Nothing to submit. Pass URLs or paths, --all, or --sitemap-diff <snapshot.json>.",
      );
    }
  }

  if (!urls.length) {
    // eslint-disable-next-line no-console
    console.log("[indexnow] Nothing new to submit.");
    if (snapshotToWrite && !DRY_RUN) writeSnapshot(snapshotToWrite.path, snapshotToWrite.data);
    return;
  }

  if (DRY_RUN) {
    const submittable = urls.map(toSubmittableUrl).filter((u): u is string => u !== null);
    // eslint-disable-next-line no-console
    console.log(
      `[indexnow] DRY RUN — would submit ${new Set(submittable).size} of ${urls.length} URLs:`,
    );
    for (const url of new Set(submittable)) {
      // eslint-disable-next-line no-console
      console.log(`  ${url}`);
    }
    return;
  }

  const result = await submitIndexNow(urls, { allowOutsideProduction: true });
  // eslint-disable-next-line no-console
  console.log(
    `[indexnow] Submitted ${result.submitted}, skipped ${result.skipped}` +
      `${result.reason ? ` (${result.reason})` : ""}.` +
      `${result.batches.length ? ` Responses: ${result.batches.map((b) => b.status).join(", ")}.` : ""}`,
  );

  const failed = result.batches.some((b) => b.status !== 200 && b.status !== 202);
  if (failed || result.reason) process.exitCode = 1;

  // Only advance the snapshot on a clean submission. Recording URLs that were
  // rejected would mean they are never retried — the next run would see them as
  // unchanged and skip them forever.
  if (snapshotToWrite && !failed && !result.reason) {
    writeSnapshot(snapshotToWrite.path, snapshotToWrite.data);
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[indexnow] ", (err as Error).message);
  process.exit(1);
});
