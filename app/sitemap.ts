import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { getSitemapEntries } from "@/lib/public-data";
import { FACET_SLUGS } from "@/lib/facet-pages";
import { GLOSSARY_SLUGS } from "@/lib/glossary";

/**
 * Dynamic sitemap (PRD §13). Lists every indexable public page: the static
 * marketing/legal pages plus all published processors, categories, and blog
 * posts. Query-param-only utility pages (`/compare`, `/search`, `/write-review`)
 * are `noindex` and intentionally omitted. `/admin` is excluded (also blocked in
 * robots). Resilient: a DB outage yields just the static URLs.
 */
export const revalidate = 3600;

const STATIC_PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/processors", priority: 0.9 },
  { path: "/blog", priority: 0.7 },
  { path: "/for-processors", priority: 0.6 },
  { path: "/glossary", priority: 0.5 },
  { path: "/methodology", priority: 0.5 },
  { path: "/about", priority: 0.4 },
  { path: "/contact", priority: 0.4 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, priority }) => ({
    url: absoluteUrl(path),
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

  // Curated facet landing pages + glossary terms — static registries, so no DB
  // call needed (they render regardless of catalog size, carrying unique copy).
  const facetEntries: MetadataRoute.Sitemap = FACET_SLUGS.map((slug) => ({
    url: absoluteUrl(`/payment-processors/${slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const glossaryEntries: MetadataRoute.Sitemap = GLOSSARY_SLUGS.map((slug) => ({
    url: absoluteUrl(`/glossary/${slug}`),
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticEntries, ...dynamicEntries, ...facetEntries, ...glossaryEntries];
}
