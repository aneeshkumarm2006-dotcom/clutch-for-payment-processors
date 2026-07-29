import { cache } from "react";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { PageSeo, type IPageSeo, type ISeo } from "@/models";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

/**
 * SEO + editorial content for pages with no Category/Processor record of their
 * own. A `PageSeo` record — edited in admin, seeded by `scripts/seed-seo.ts` —
 * supplies the meta title/description/keywords, FAQs and content blocks; when
 * absent the page's hardcoded copy is used, so wiring a route up to this is
 * always additive.
 *
 * `cache()` dedupes the lookup between `generateMetadata` and the page body
 * within a single request — both call it, and without the cache every wired-up
 * route would issue two identical queries per render.
 */

/**
 * Look a record up by its `pageKey`. Keys are plain strings, not a closed union:
 * a `landing` page's key is derived from its slug at creation time, so the set is
 * open by design.
 */
export const getPageSeo = cache(async (pageKey: string): Promise<IPageSeo | null> => {
  try {
    await connectToDatabase();
    return await PageSeo.findOne({ pageKey }).lean<IPageSeo>();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[page-seo] getPageSeo failed:", err);
    return null;
  }
});

/**
 * Look a record up by the URL it applies to. This is what lets any coded route
 * gain an editorial slot without inventing a key for itself — the route already
 * knows its own path.
 */
export const getPageSeoByPath = cache(async (path: string): Promise<IPageSeo | null> => {
  try {
    await connectToDatabase();
    return await PageSeo.findOne({ path }).lean<IPageSeo>();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[page-seo] getPageSeoByPath failed:", err);
    return null;
  }
});

/**
 * A standalone landing page by its path. Unpublished records resolve to `null`
 * so the route 404s: a draft must not be reachable by guessing its URL.
 */
export const getLandingPage = cache(async (path: string): Promise<IPageSeo | null> => {
  try {
    await connectToDatabase();
    return await PageSeo.findOne({ path, kind: "landing", isPublished: true }).lean<IPageSeo>();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[page-seo] getLandingPage failed:", err);
    return null;
  }
});

/**
 * Every published landing page.
 *
 * Pass `indexableOnly` for the sitemap, which must additionally drop anything an
 * editor has explicitly noindexed — listing a noindexed URL is a contradiction
 * Search Console reports as an error. The route's `generateStaticParams` wants
 * the unfiltered list: a noindexed page is still a live page and should still be
 * prerendered.
 *
 * `seo.robotsIndex` is tri-state, hence `$ne: false`. `undefined` (no robots
 * directive at all) describes nearly every document and must stay in;
 * `{ robotsIndex: true }` would empty the sitemap.
 */
export async function getPublishedLandingPages(
  opts: { indexableOnly?: boolean } = {},
): Promise<{ path: string; updatedAt: Date }[]> {
  try {
    await connectToDatabase();
    const docs = await PageSeo.find({
      kind: "landing",
      isPublished: true,
      ...(opts.indexableOnly
        ? { "seo.robotsIndex": { $ne: false }, "seo.redirectTo": { $in: [null, ""] } }
        : {}),
    })
      .select("path updatedAt")
      .lean<{ path: string; updatedAt: Date }[]>();
    return docs.map((d) => ({
      path: d.path,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt : new Date(String(d.updatedAt)),
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[page-seo] getPublishedLandingPages failed:", err);
    return [];
  }
}

/**
 * `path → updatedAt` for every PageSeo record, for the sitemap.
 *
 * The static, facet and glossary sitemap entries carry no `lastModified` today,
 * because their copy lives in code registries with no timestamp — so Google has
 * no freshness signal for any of them. Where a route HAS a record, its
 * `updatedAt` is a real, honest edit date. Where it doesn't, the entry keeps no
 * date at all: a fabricated `lastModified` is worse than none, since a sitemap
 * that claims everything changed today teaches Google to ignore the field.
 */
export async function getPageSeoLastModified(): Promise<Map<string, Date>> {
  try {
    await connectToDatabase();
    const docs = await PageSeo.find().select("path updatedAt").lean<
      { path: string; updatedAt: Date }[]
    >();
    return new Map(
      docs.map((d) => [
        d.path,
        d.updatedAt instanceof Date ? d.updatedAt : new Date(String(d.updatedAt)),
      ]),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[page-seo] getPageSeoLastModified failed:", err);
    return new Map();
  }
}

/**
 * The regional variants of one page, for `hreflang` and the on-page switcher.
 *
 * A variant only counts when it carries BOTH `seo.localeGroup` and `seo.locale`.
 * hreflang is reciprocal — every URL in a set must list every other URL,
 * including itself — so a half-configured variant would produce a set Google
 * discards entirely. Requiring both fields is what keeps the emitted set
 * complete by construction.
 *
 * Returns `[]` when there is only one variant: a lone self-referencing hreflang
 * says nothing.
 */
export const getLocaleVariants = cache(
  async (localeGroup: string | undefined): Promise<{ locale: string; path: string; title: string }[]> => {
    if (!localeGroup) return [];
    try {
      await connectToDatabase();
      const docs = await PageSeo.find({
        "seo.localeGroup": localeGroup,
        "seo.locale": { $exists: true, $ne: "" },
        isPublished: true,
      })
        .select("path title seo.locale")
        .lean<{ path: string; title: string; seo?: { locale?: string } }[]>();

      const variants = docs
        .filter((d) => d.seo?.locale)
        .map((d) => ({ locale: d.seo!.locale as string, path: d.path, title: d.title }))
        .sort((a, b) => a.locale.localeCompare(b.locale));

      return variants.length > 1 ? variants : [];
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[page-seo] getLocaleVariants failed:", err);
      return [];
    }
  },
);

/**
 * Turn locale variants into the `languages` map `buildMetadata` expects.
 *
 * `x-default` names the page to serve a reader whose locale matches none of the
 * variants, so it is only emitted when a genuinely region-less variant exists
 * (`en`, not `en-CA`). With two regional pages and no neutral one there is no
 * correct answer, and picking by sort order would quietly nominate whichever
 * country sorts first — Canada, in the current set — as the world's default.
 * Omitting `x-default` is valid; Google falls back to its own inference, which
 * beats an arbitrary claim.
 *
 * To choose one deliberately, give that variant a region-less locale (`en`).
 */
export function toHreflangMap(
  variants: { locale: string; path: string }[],
): Record<string, string> {
  if (variants.length < 2) return {};
  const map: Record<string, string> = {};
  for (const v of variants) map[v.locale] = v.path;
  const generic = variants.find((v) => !v.locale.includes("-"));
  if (generic) map["x-default"] = generic.path;
  return map;
}

/**
 * Site-wide footer links to the published landing pages.
 *
 * A landing page has no parent listing, no category, and no navigation of its
 * own, so without this it would be reachable only from the sitemap. Capped
 * because the footer is a fixed-height column, not a directory: past the cap the
 * remaining pages still rank on their own, they just don't get the site-wide
 * link. Ordered by title so the list is stable between renders.
 */
export const getLandingPageLinks = cache(
  async (limit = 4): Promise<{ label: string; href: string }[]> => {
    try {
      await connectToDatabase();
      const docs = await PageSeo.find({
        kind: "landing",
        isPublished: true,
        "seo.robotsIndex": { $ne: false },
      })
        .select("title path")
        .sort({ title: 1 })
        .limit(limit)
        .lean<{ title: string; path: string }[]>();
      return docs.map((d) => ({ label: d.title, href: d.path }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[page-seo] getLandingPageLinks failed:", err);
      return [];
    }
  },
);

/**
 * Build a page's `Metadata`, letting an admin-edited `PageSeo` override the
 * passed-in defaults. Precedence: PageSeo → global Default SEO (Settings) →
 * the hardcoded `title`/`description` args.
 *
 * Pass either `pageKey` or `path` — `path` is the one to reach for when wiring
 * up an existing route, since it needs no new identifier.
 */
export async function pageSeoMetadata(opts: {
  pageKey?: string;
  title: string;
  description: string;
  path: string;
  image?: string;
  absoluteTitle?: boolean;
  ogType?: "website" | "article" | "profile";
  /** Fallback keywords used only when the PageSeo record sets none. */
  keywords?: string[];
  /** Look the record up by `path` instead of `pageKey`. */
  byPath?: boolean;
  /** `hreflang` alternates — see `buildMetadata`. Build them with `toHreflangMap`. */
  languages?: Record<string, string>;
}): Promise<Metadata> {
  const [page, settings] = await Promise.all([
    opts.byPath || !opts.pageKey ? getPageSeoByPath(opts.path) : getPageSeo(opts.pageKey),
    getOrCreateSiteSettings().catch(() => null),
  ]);

  // Only `ogImage` falls back to the global default. `metaTitle`/`metaDescription`
  // deliberately do NOT: they are a single site-wide string, so falling back to
  // them would give every PageSeo route the *same* <title> — and because
  // `buildMetadata` treats any custom title as absolute, they'd also lose the
  // "· Payment Processor Guide" suffix. The page's own hardcoded copy is the right fallback.
  const defaultSeo = settings?.defaultSeo;
  const mergedSeo: Partial<ISeo> = {
    ...page?.seo,
    metaTitle: page?.seo?.metaTitle,
    metaDescription: page?.seo?.metaDescription,
    ogImage: page?.seo?.ogImage || defaultSeo?.ogImage,
  };

  return buildMetadata({
    title: opts.title,
    description: opts.description,
    path: opts.path,
    image: opts.image,
    absoluteTitle: opts.absoluteTitle,
    ogType: opts.ogType,
    seo: mergedSeo,
    keywords: page?.seo?.keywords?.length ? page.seo.keywords : opts.keywords,
    ...(opts.languages ? { languages: opts.languages } : {}),
  });
}
