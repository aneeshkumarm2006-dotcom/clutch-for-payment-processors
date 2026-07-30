/**
 * Indexing-request sheet export.
 *
 * Emits one TSV row per public URL on the site, ready to paste into Google
 * Sheets for a manual "Request indexing" pass in Search Console:
 *
 *   Page name | URL | Index or not | Keywords | Meta tag | Meta desc
 *
 * The meta copy is NOT re-derived here. Every row calls the route's own
 * `generateMetadata()` against the live database, so the sheet shows exactly
 * what Next renders — including PageSeo overrides, the `| Payment Processor
 * Guide` title template, and the verbatim-title rule for hand-written meta
 * titles. Param lists come from each route's `generateStaticParams()` where it
 * has one, so a new processor / post / landing page appears with no edit here.
 *
 * Usage:
 *   npx tsx scripts/export-index-sheet.ts            # TSV to stdout
 *   npx tsx scripts/export-index-sheet.ts --json
 *   SITE_URL=https://example.com npx tsx scripts/export-index-sheet.ts
 */

import { loadEnv } from "./loadEnv";

loadEnv();

// The sheet must carry PRODUCTION URLs, not localhost. `lib/seo.ts` reads this
// at module load, so it has to be set before any page module is imported.
process.env.NEXT_PUBLIC_SITE_URL =
  process.env.SITE_URL ?? "https://paymentprocessingguide.com";

// `React.cache()` is injected by the Next runtime and absent from React 18 under
// plain Node. `lib/settings.ts` and friends call it at module scope, so shim it
// to the identity wrapper (no request-scoped memoisation needed for a one-shot).
const React = require("react");
if (typeof React.cache !== "function") React.cache = (fn: unknown) => fn;

// `server-only` throws on import outside Next's server bundle. Everything here IS
// server code, so pre-seed the module cache with the no-op it resolves to inside Next.
try {
  const id = require.resolve("server-only");
  require.cache[id] = { id, filename: id, loaded: true, exports: {} } as never;
} catch {
  // Not installed — nothing to neutralise.
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL;
const TITLE_SUFFIX = " | Payment Processor Guide";

type Meta = {
  title?: string | { absolute?: string; default?: string };
  description?: string;
  keywords?: string | string[];
  robots?: { index?: boolean; follow?: boolean };
  alternates?: { canonical?: string };
};

interface Row {
  name: string;
  url: string;
  index: string;
  keywords: string;
  metaTitle: string;
  metaDesc: string;
  status: string;
}

const rows: Row[] = [];

/**
 * Paths that 308 to somewhere else via `seo.redirectTo`. The redirect fires in the
 * page body (`applySeoRedirect`), not in `generateMetadata`, so a redirecting URL
 * still returns perfectly good-looking meta copy here. Without this lookup the
 * sheet would invite an indexing request for a URL that never renders.
 */
const redirects = new Map<string, string>();

async function loadRedirects() {
  const { default: mongoose } = await import("mongoose");
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI as string);
  }
  const db = mongoose.connection.db;
  if (!db) return;
  const sources: { collection: string; prefix: string }[] = [
    { collection: "processors", prefix: "/processor/" },
    { collection: "categories", prefix: "/category/" },
    { collection: "blogposts", prefix: "/blog/" },
  ];
  for (const { collection, prefix } of sources) {
    const docs = await db
      .collection(collection)
      .find({ "seo.redirectTo": { $nin: [null, ""] } })
      .project({ slug: 1, "seo.redirectTo": 1 })
      .toArray();
    for (const d of docs) {
      redirects.set(`${prefix}${String(d.slug)}`, String((d as any).seo.redirectTo));
    }
  }
  // PageSeo records can redirect a bare route or a landing path too.
  const ps = await db
    .collection("pageseos")
    .find({ "seo.redirectTo": { $nin: [null, ""] } })
    .project({ path: 1, "seo.redirectTo": 1 })
    .toArray();
  for (const d of ps) {
    redirects.set(String(d.path), String((d as any).seo.redirectTo));
  }
}

/** Title as it renders in the `<title>` tag, applying the layout template. */
function resolveTitle(title: Meta["title"]): string {
  if (!title) return "";
  if (typeof title === "string") return title + TITLE_SUFFIX;
  if (title.absolute) return title.absolute;
  if (title.default) return title.default;
  return "";
}

/** Strip tabs/newlines so a cell can never break the TSV grid. */
const cell = (v: string) => (v ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** Turn a slug into a readable label: `stripe-vs-paypal` -> `Stripe vs paypal`. */
function humanize(slug: string): string {
  const s = slug.replace(/[-/]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function record(
  mod: Record<string, unknown>,
  opts: { path: string; name: string; params?: Record<string, string> },
) {
  const gen = mod.generateMetadata as
    | ((a: { params?: unknown; searchParams?: unknown }) => Meta | Promise<Meta>)
    | undefined;

  let meta: Meta;
  if (typeof gen === "function") {
    meta = await gen({ params: opts.params ?? {}, searchParams: {} });
  } else {
    meta = (mod.metadata as Meta) ?? {};
  }

  const kw = meta.keywords;
  const r = meta.robots;
  const redirectTo = redirects.get(opts.path);
  const status = redirectTo
    ? `308 redirect to ${redirectTo} — do not submit`
    : r?.index === false
      ? "noindex — do not submit"
      : r?.index === undefined && r?.follow === undefined
        ? "Indexable" // no robots directive emitted; Google's default is index,follow
        : `index=${r?.index}, follow=${r?.follow}`;

  rows.push({
    name: opts.name,
    url: `${SITE}${opts.path}`,
    // Every row ships as "No" per the current request — flip these in the sheet
    // as each URL is actually submitted.
    index: "No",
    keywords: Array.isArray(kw) ? kw.join(", ") : (kw ?? ""),
    metaTitle: resolveTitle(meta.title),
    metaDesc: meta.description ?? "",
    status,
  });
}

async function main() {
  await loadRedirects();

  // --- Static public pages -------------------------------------------------
  const STATIC: { mod: string; path: string; name: string }[] = [
    { mod: "../app/(public)/page", path: "/", name: "Home" },
    { mod: "../app/(public)/processors/page", path: "/processors", name: "Processor directory" },
    { mod: "../app/(public)/compare/page", path: "/compare", name: "Compare" },
    { mod: "../app/(public)/blog/page", path: "/blog", name: "Blog index" },
    { mod: "../app/(public)/glossary/page", path: "/glossary", name: "Glossary index" },
    { mod: "../app/(public)/for-processors/page", path: "/for-processors", name: "For processors" },
    { mod: "../app/(public)/methodology/page", path: "/methodology", name: "Methodology" },
    { mod: "../app/(public)/about/page", path: "/about", name: "About" },
    { mod: "../app/(public)/contact/page", path: "/contact", name: "Contact" },
    { mod: "../app/(public)/privacy/page", path: "/privacy", name: "Privacy policy" },
    { mod: "../app/(public)/terms/page", path: "/terms", name: "Terms of service" },
    { mod: "../app/(public)/search/page", path: "/search", name: "Search" },
    { mod: "../app/(public)/write-review/page", path: "/write-review", name: "Write a review" },
  ];

  for (const s of STATIC) {
    const mod = await import(s.mod);
    await record(mod, { path: s.path, name: s.name });
  }

  // --- Processor profiles + their reviews pages ---------------------------
  const processorMod = await import("../app/(public)/processor/[slug]/page");
  const processorParams: { slug: string }[] = await processorMod.generateStaticParams();
  const reviewsMod = await import("../app/(public)/processor/[slug]/reviews/page");
  const writeReviewMod = await import("../app/(public)/write-review/[slug]/page");

  for (const p of processorParams) {
    await record(processorMod, {
      path: `/processor/${p.slug}`,
      name: `Processor: ${humanize(p.slug)}`,
      params: p,
    });
  }
  for (const p of processorParams) {
    await record(reviewsMod, {
      path: `/processor/${p.slug}/reviews`,
      name: `Reviews: ${humanize(p.slug)}`,
      params: p,
    });
  }

  // --- Alternatives -------------------------------------------------------
  const altMod = await import("../app/(public)/alternatives/[slug]/page");
  for (const p of (await altMod.generateStaticParams()) as { slug: string }[]) {
    await record(altMod, {
      path: `/alternatives/${p.slug}`,
      name: `Alternatives: ${humanize(p.slug)}`,
      params: p,
    });
  }

  // --- Categories ---------------------------------------------------------
  const catMod = await import("../app/(public)/category/[slug]/page");
  for (const p of (await catMod.generateStaticParams()) as { slug: string }[]) {
    await record(catMod, {
      path: `/category/${p.slug}`,
      name: `Category: ${humanize(p.slug)}`,
      params: p,
    });
  }

  // --- Blog posts ---------------------------------------------------------
  const blogMod = await import("../app/(public)/blog/[slug]/page");
  for (const p of (await blogMod.generateStaticParams()) as { slug: string }[]) {
    await record(blogMod, {
      path: `/blog/${p.slug}`,
      name: `Blog: ${humanize(p.slug)}`,
      params: p,
    });
  }

  // --- Curated compare pairs ----------------------------------------------
  const pairMod = await import("../app/(public)/compare/[pair]/page");
  for (const p of (await pairMod.generateStaticParams()) as { pair: string }[]) {
    await record(pairMod, {
      path: `/compare/${p.pair}`,
      name: `Compare: ${humanize(p.pair)}`,
      params: p,
    });
  }

  // --- Facet landing pages ------------------------------------------------
  const facetMod = await import("../app/(public)/payment-processors/[facet]/page");
  for (const p of (await facetMod.generateStaticParams()) as { facet: string }[]) {
    await record(facetMod, {
      path: `/payment-processors/${p.facet}`,
      name: `Facet: ${humanize(p.facet)}`,
      params: p,
    });
  }

  // --- Glossary terms -----------------------------------------------------
  const termMod = await import("../app/(public)/glossary/[term]/page");
  for (const p of (await termMod.generateStaticParams()) as { term: string }[]) {
    await record(termMod, {
      path: `/glossary/${p.term}`,
      name: `Glossary: ${humanize(p.term)}`,
      params: p,
    });
  }

  // --- Admin-created landing pages ----------------------------------------
  const landingMod = await import("../app/(public)/[landing]/page");
  for (const p of (await landingMod.generateStaticParams()) as { landing: string }[]) {
    await record(landingMod, {
      path: `/${p.landing}`,
      name: `Landing: ${humanize(p.landing)}`,
      params: p,
    });
  }

  // --- Write-review forms (one per processor) -----------------------------
  for (const p of processorParams) {
    await record(writeReviewMod, {
      path: `/write-review/${p.slug}`,
      name: `Write review: ${humanize(p.slug)}`,
      params: p,
    });
  }

  // --- Output -------------------------------------------------------------
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const header = [
      "Page name",
      "URL",
      "Index or not",
      "Keywords",
      "Meta tag",
      "Meta desc",
      "Status",
    ].join("\t");
    console.log(header);
    for (const r of rows) {
      console.log(
        [
          cell(r.name),
          cell(r.url),
          cell(r.index),
          cell(r.keywords),
          cell(r.metaTitle),
          cell(r.metaDesc),
          cell(r.status),
        ].join("\t"),
      );
    }
  }

  console.error(`\n${rows.length} URLs`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
