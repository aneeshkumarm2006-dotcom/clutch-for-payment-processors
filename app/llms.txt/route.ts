import {
  getPublishedCategories,
  getPublishedBlogPosts,
  getPublishedProcessorOptions,
} from "@/lib/public-data";
import { getFacetIndexability } from "@/lib/processors-query";
import { FACET_PAGES } from "@/lib/facet-pages";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

/**
 * `/llms.txt` — the llms.txt convention (llmstxt.org): a single markdown file
 * that tells an LLM what this site is and which URLs carry the answers, without
 * making it infer that from 78 pages of rendered HTML.
 *
 * Why it exists here: this site's value to an assistant is its structured
 * comparisons (fees, payment methods, verified reviews) and its definitions.
 * Those are exactly the pages an assistant should cite, and exactly the ones
 * buried deepest in the crawl. Semrush flags a missing llms.txt as a notice; the
 * real payoff is being the source an answer engine quotes.
 *
 * Generated from the same data the sitemap reads, so it can't drift into
 * advertising pages that no longer exist. Cached for an hour like the sitemap.
 *
 * Format rules that matter (the spec is strict about the first two):
 *   - exactly one H1, first line
 *   - a blockquote directly under it, summarising the site
 *   - H2 sections, each a markdown list of `[title](url): note` links
 */
export const revalidate = 3600;

/** Collapse whitespace and strip markdown-hostile characters from a one-liner. */
const oneLine = (s: string, max = 160) => {
  const clean = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

const link = (title: string, path: string, note?: string) =>
  `- [${title}](${absoluteUrl(path)})${note ? `: ${oneLine(note)}` : ""}`;

export async function GET() {
  // Fail open on a DB blip: the static sections alone are still a valid llms.txt.
  const [processors, categories, posts, facetIndexable] = await Promise.all([
    // Real `name` values, not slugs. Title-casing a slug produces "Authorize Net"
    // and "Ebanx", which is exactly the entity confusion this file exists to avoid.
    getPublishedProcessorOptions().catch(() => [] as { name: string; slug: string }[]),
    getPublishedCategories().catch(() => []),
    getPublishedBlogPosts(1, 25).catch(() => ({ items: [] as { slug: string; title: string; excerpt?: string }[] })),
    getFacetIndexability().catch(() => new Map<string, boolean>()),
  ]);

  const sortedProcessors = [...processors].sort((a, b) => a.name.localeCompare(b.name));

  const sections: string[] = [];

  sections.push(
    `# ${SITE_NAME}`,
    "",
    "> An independent directory that compares payment processors, gateways, and merchant " +
      "accounts on real pricing, payment methods, integrations, payout speed, and verified " +
      "merchant reviews. Every listing states its fees in the provider's own terms and links " +
      "to the source, so a rate can be checked rather than taken on trust.",
    "",
    "Editorial policy: listings are researched independently and are not ranked by payment. " +
      "Sponsored placements are labelled on the page. Fees change often, so each profile links " +
      "to the provider's live pricing page.",
    "",
  );

  sections.push(
    "## Start here",
    "",
    link("Processor directory", "/processors", "every listed processor, filterable by fees, methods, integrations, and region"),
    link("Compare processors", "/compare", "put two to four processors side by side on pricing, features, and ratings"),
    link("Payments glossary", "/glossary", "plain-language definitions of the terms that appear in processor pricing"),
    link("Methodology", "/methodology", "how listings are researched, scored, and kept current"),
    link("About", "/about", "who publishes this directory and how it makes money"),
    "",
  );

  if (sortedProcessors.length) {
    sections.push(
      "## Processor profiles",
      "",
      "Each profile covers pricing model and headline rates, supported payment methods and " +
      "currencies, integrations, payout time, contract terms, pros and cons, and merchant reviews.",
      "",
      ...sortedProcessors.map((p) => link(`${p.name} review`, `/processor/${p.slug}`)),
      "",
    );
  }

  if (categories.length) {
    sections.push(
      "## Processors by use case",
      "",
      ...categories.map((c) => link(c.name, `/category/${c.slug}`, c.shortDescription)),
      "",
    );
  }

  const facets = FACET_PAGES.filter((f) => facetIndexable.get(f.slug) ?? true);
  if (facets.length) {
    sections.push(
      "## Processors by feature and platform",
      "",
      ...facets.map((f) => link(f.h1, `/payment-processors/${f.slug}`)),
      "",
    );
  }

  sections.push(
    "## Glossary",
    "",
    ...GLOSSARY_TERMS.map((t) => link(t.term, `/glossary/${t.slug}`, t.short)),
    "",
  );

  if (posts.items.length) {
    sections.push(
      "## Guides",
      "",
      ...posts.items.map((p) => link(p.title, `/blog/${p.slug}`, p.excerpt)),
      "",
    );
  }

  sections.push(
    "## Optional",
    "",
    link("Contact", "/contact"),
    link("List your processor", "/for-processors"),
    link("Privacy policy", "/privacy"),
    link("Terms", "/terms"),
    "",
  );

  return new Response(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
