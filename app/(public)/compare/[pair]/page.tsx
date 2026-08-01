import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { JsonLd } from "@/components/public/JsonLd";
import { CompareView } from "@/components/public/compare/CompareView";
import { getProcessorsBySlugs } from "@/lib/public-data";
import { COMPARE_MAX } from "@/components/public/compare/constants";
import { buildMetadata, breadcrumbJsonLd, comparePairJsonLd } from "@/lib/seo";
import { comparePairParams, parseComparePairParam } from "@/lib/compare-pairs";

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
  return buildMetadata({
    title: title.length <= 60 ? title : `Compare ${joined}`,
    absoluteTitle: true,
    // Kept under 155 characters for the longest real pairing on the site.
    description: `${joined} compared on pricing, payment methods, integrations, payout speed, and verified merchant reviews.`,
    path: `/compare/${params.pair}`,
  });
}

export default async function PrettyComparePage({ params }: { params: { pair: string } }) {
  const slugs = parseComparePairParam(params.pair).slice(0, COMPARE_MAX);
  const processors = await getProcessorsBySlugs(slugs);

  // A curated pair whose processor was unpublished/removed → 404 (no half-matrix).
  if (processors.length < 2) notFound();

  const names = processors.map((p) => p.name);
  const joined = names.join(" vs ");

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
            { name: joined, path: `/compare/${params.pair}` },
          ]),
          comparePairJsonLd({ name: joined, processors }),
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
    </div>
  );
}
