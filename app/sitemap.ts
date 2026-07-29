import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { getSitemapEntries } from "@/lib/public-data";
import { getPageSeoLastModified, getPublishedLandingPages } from "@/lib/page-seo";
import { FACET_SLUGS } from "@/lib/facet-pages";
import { GLOSSARY_SLUGS } from "@/lib/glossary";

/**
 * Dynamic sitemap (PRD §13). Lists every indexable public page: the static
 * marketing/legal pages, all published processors, categories and blog posts,
 * plus the admin-created landing pages. `/search` and `/write-review` are
 * `noindex` and intentionally omitted, as is `/admin` (also blocked in robots).
 * Resilient: a DB outage yields just the static URLs.
 *
 * `/compare` IS listed: the bare landing page is indexable and carries its own
 * copy. Only `/compare?ids=` is noindex, and a query string is not a sitemap
 * entry. See the `NOINDEX_ROUTES` note in `lib/seo.ts`.
 */
export const revalidate = 3600;

const STATIC_PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/processors", priority: 0.9 },
  { path: "/blog", priority: 0.7 },
  { path: "/compare", priority: 0.7 },
  { path: "/for-processors", priority: 0.6 },
  { path: "/glossary", priority: 0.5 },
  { path: "/methodology", priority: 0.5 },
  { path: "/about", priority: 0.4 },
  { path: "/contact", priority: 0.4 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, landings, editedAt] = await Promise.all([
    getSitemapEntries(),
    getPublishedLandingPages({ indexableOnly: true }),
    getPageSeoLastModified(),
  ]);

  /**
   * Attach a real edit date when the route has a PageSeo record behind it, and
   * none when it doesn't. A sitemap that stamps everything with today's date is
   * a sitemap Google learns to ignore the dates in.
   */
  const withDate = (path: string) => {
    const lastModified = editedAt.get(path);
    return lastModified ? { lastModified } : {};
  };

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, priority }) => ({
    url: absoluteUrl(path),
    ...withDate(path),
    changeFrequency: "weekly",
    priority,
  }));

  const dynamicEntries: MetadataRoute.Sitemap = entries.map((e) => ({
    url: absoluteUrl(e.path),
    lastModified: e.lastModified,
    changeFrequency: e.path.startsWith("/blog/") ? "monthly" : "weekly",
    priority: e.path.startsWith("/processor/")
      ? 0.8
      : e.path.startsWith("/alternatives/")
        ? 0.7
        : 0.6,
  }));

  // Curated facet landing pages + glossary terms. Their copy lives in static
  // registries, so most carry no date; a facet an editor has deepened with a
  // PageSeo record (e.g. `/payment-processors/ach`) gets that record's date.
  const facetEntries: MetadataRoute.Sitemap = FACET_SLUGS.map((slug) => ({
    url: absoluteUrl(`/payment-processors/${slug}`),
    ...withDate(`/payment-processors/${slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const glossaryEntries: MetadataRoute.Sitemap = GLOSSARY_SLUGS.map((slug) => ({
    url: absoluteUrl(`/glossary/${slug}`),
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  // Admin-created landing pages. Only published ones are returned, which is the
  // same condition the route renders on — a draft must not be advertised.
  const landingEntries: MetadataRoute.Sitemap = landings.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...staticEntries,
    ...dynamicEntries,
    ...facetEntries,
    ...glossaryEntries,
    ...landingEntries,
  ];
}
