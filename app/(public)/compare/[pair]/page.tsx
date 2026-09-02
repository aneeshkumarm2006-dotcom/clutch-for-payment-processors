import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Blocks } from "@/components/public/Blocks";
import { FaqSection } from "@/components/public/FaqSection";
import { JsonLd } from "@/components/public/JsonLd";
import { CompareView } from "@/components/public/compare/CompareView";
import { getProcessorsBySlugs, getPublishedProcessorOptions } from "@/lib/public-data";
import { COMPARE_MAX } from "@/components/public/compare/constants";
import { breadcrumbJsonLd, comparePairJsonLd, faqJsonLd } from "@/lib/seo";
import { getPageSeoByPath, pageSeoMetadata } from "@/lib/page-seo";
import { toBlocks, toFaqs } from "@/lib/serialize";
import {
  comparePairParams,
  parseComparePairParam,
  relatedComparePairs,
} from "@/lib/compare-pairs";

/**
 * Pretty compare route `/compare/stripe-vs-paypal` (Phase 2 / Stage 7.3 — PRD
 * §9.4, §13). Unlike the query-param `/compare?ids=` page (combinatorial →
 * noindex), these are a CURATED set of popular head-to-heads (`lib/compare-pairs`)
 * so each is a canonical, indexable landing page with unique metadata + JSON-LD.
 *
 * Only curated pairs exist: `generateStaticParams` prerenders them and
 * `dynamicParams = false` 404s everything else (arbitrary combos keep using the
 * `?ids=` builder, which canonicalizes here when it matches a curated pair).
 * ISR — the matrix data tracks ratings/fees that change slowly.
 *
 * Everything above the editorial slot is GENERATED from the two processor
 * records, which is what makes all 110-odd of these pages exist at once — and
 * also what makes them read alike. A pair that earns real editorial investment
 * (a "where each one wins" breakdown, a pricing-in-practice section, its own meta
 * and FAQs) gets a `PageSeo` record at the same path, which layers on top. Same
 * mechanism as `/alternatives/[slug]` and `/payment-processors/[facet]`:
 * deepening one comparison is content work in the admin, not an edit to this
 * file. See `scripts/seed-new-compare-pages.ts` for the first four.
 */
export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams() {
  return comparePairParams();
}

export async function generateMetadata({
  params,
}: {
  params: { pair: string };
}): Promise<Metadata> {
  const slugs = parseComparePairParam(params.pair).slice(0, COMPARE_MAX);
  const processors = await getProcessorsBySlugs(slugs);
  if (processors.length < 2) return { title: "Comparison not found" };

  const names = processors.map((p) => p.name);
  const joined = names.join(" vs ");
  /*
    The title used to append " | side-by-side comparison" before the layout added
    " | Payment Processor Guide" on top. That is 51 characters of boilerplate on a
    title whose only distinguishing content is the two brand names, and it pushed
    all 68 curated pairs to 66-94 characters. Google truncated the brand names
    off the pairs with the longest names, which are exactly the ones a searcher
    would not otherwise recognise. "Compare" leads instead, matching the query.

    `absoluteTitle` keeps the layout suffix off: for the longest pairings even the
    bare "Compare A vs B" is close to the limit.
  */
  const title = `Compare ${joined}: Fees and Features`;
  return pageSeoMetadata({
    title: title.length <= 60 ? title : `Compare ${joined}`,
    absoluteTitle: true,
    // Kept under 155 characters for the longest real pairing on the site.
    description: `${joined} compared on pricing, payment methods, integrations, payout speed, and verified merchant reviews.`,
    path: `/compare/${params.pair}`,
    // No pageKey to invent: the route already knows its own URL, and the record
    // for a deepened pair is keyed on exactly that path.
    byPath: true,
  });
}

export default async function PrettyComparePage({ params }: { params: { pair: string } }) {
  const slugs = parseComparePairParam(params.pair).slice(0, COMPARE_MAX);
  const basePath = `/compare/${params.pair}`;
  const [processors, page] = await Promise.all([
    getProcessorsBySlugs(slugs),
    getPageSeoByPath(basePath),
  ]);

  // A curated pair whose processor was unpublished/removed → 404 (no half-matrix).
  if (processors.length < 2) notFound();

  const names = processors.map((p) => p.name);
  const joined = names.join(" vs ");

  const blocks = toBlocks(page?.blocks);
  const hasFaqBlock = Boolean(blocks?.some((b) => b.type === "faq"));
  const faqs = toFaqs(page?.faqs);

  // Named links for the related rail. The pair list is slugs only, and a rail of
  // slugs ("stripe-vs-adyen") is not a link a reader parses; the directory
  // options list is already cached per request by the compare picker's data.
  const related = relatedComparePairs(processors.map((p) => p.slug));
  const nameBySlug = related.length
    ? new Map((await getPublishedProcessorOptions()).map((o) => [o.slug, o.name]))
    : new Map<string, string>();
  const relatedLinks = related
    .map((r) => ({
      path: r.path,
      label: r.slugs.map((s) => nameBySlug.get(s)).join(" vs "),
      complete: r.slugs.every((s) => nameBySlug.has(s)),
    }))
    // An unpublished side means that pair's page 404s — don't link into it.
    .filter((r) => r.complete);

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
            { name: joined, path: basePath },
          ]),
          comparePairJsonLd({ name: joined, processors }),
          // The FAQ block emits its own FAQPage; two on one URL is invalid.
          ...(faqs && !hasFaqBlock ? [faqJsonLd(faqs)] : []),
        ]}
      />

      <Breadcrumb
        items={[{ name: "Home", href: "/" }, { name: "Compare", href: "/compare" }, { name: joined }]}
      />
      <h1 className="mt-4 text-h1 tracking-tighter2 text-foreground">{joined}</h1>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        A side-by-side look at {names.join(" and ")}: pricing, payment methods, integrations,
        features, and company facts. Add up to {COMPARE_MAX} processors to widen the comparison.
      </p>

      <div className="mt-8">
        <CompareView processors={processors} />
      </div>

      {/*
        Editorial slot: the written comparison sits BELOW the matrix it explains,
        so the reader has the numbers in front of them before the argument about
        what the numbers mean. It is also why the copy must never restate the
        table's own rows — see the seed script's header note.
      */}
      <Blocks blocks={blocks} className="mt-14" />

      {!hasFaqBlock && <FaqSection faqs={faqs} className="mt-14 max-w-prose" />}

      {relatedLinks.length > 0 && (
        <section className="mt-14">
          <h2 className="text-h3 text-foreground">Related comparisons</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {relatedLinks.map((r) => (
              <li key={r.path}>
                <Link
                  href={r.path}
                  className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
