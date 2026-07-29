import type { Metadata } from "next";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Blocks } from "@/components/public/Blocks";
import { CompareView } from "@/components/public/compare/CompareView";
import { FaqSection } from "@/components/public/FaqSection";
import { JsonLd } from "@/components/public/JsonLd";
import { getProcessorsBySlugs } from "@/lib/public-data";
import { COMPARE_MAX } from "@/components/public/compare/constants";
import { buildMetadata, absoluteUrl, faqJsonLd } from "@/lib/seo";
import { getPageSeo, pageSeoMetadata } from "@/lib/page-seo";
import { toBlocks } from "@/lib/serialize";
import { prettyComparePath } from "@/lib/compare-pairs";

/**
 * Compare `/compare?ids=stripe,paypal,square` (PRD §9.4).
 *
 * `?ids=` carries 2–4 processor slugs (also reached from the compare tray). The
 * page resolves them to full detail data and hands them to the client CompareView
 * (which owns add/remove + the searchable picker).
 *
 * Indexing splits on whether `ids` is present, and this page is the only place
 * that can tell — `NOINDEX_ROUTES` used to prefix-match `/compare` and so
 * noindexed the bare landing page and every curated `/compare/a-vs-b` route
 * along with it. Bare `/compare` is a real landing page with its own PageSeo
 * copy and editorial blocks; anything carrying `ids` is combinatorial and gets
 * `noindex` set here, canonicalised to the pretty pair URL when one exists.
 */
export const dynamic = "force-dynamic";

function parseIds(idsParam?: string | string[]): string[] {
  const raw = Array.isArray(idsParam) ? idsParam.join(",") : idsParam ?? "";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, COMPARE_MAX);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { ids?: string | string[] };
}): Promise<Metadata> {
  const slugs = parseIds(searchParams.ids);
  // Any `ids` at all makes this a selection URL, not the landing page. A single
  // id is still a query-driven near-duplicate, so it must not slip into the
  // index just because it can't fill a comparison table.
  const hasSelection = Boolean(searchParams.ids);

  // Bare `/compare` (no ids) is the real landing page we want indexed and
  // ranking (e.g. "payment processor comparison"). Its SEO is editable via
  // admin → Page SEO ("compare").
  if (!hasSelection) {
    return pageSeoMetadata({
      pageKey: "compare",
      title: "Compare payment processors",
      description:
        "Compare payment processors side by side on pricing, payment methods, integrations, and features.",
      path: "/compare",
    });
  }

  // A specific selection is a query-driven, combinatorial URL — keep it out of
  // the index. If the pair is curated, point the canonical at the pretty,
  // indexable route (`/compare/stripe-vs-paypal`) so link equity lands there.
  const processors = await getProcessorsBySlugs(slugs);
  const names = processors.map((p) => p.name);
  const title = names.length >= 2 ? `Compare ${names.join(" vs ")}` : "Compare payment processors";
  const description =
    names.length >= 2
      ? `Side-by-side comparison of ${names.join(", ")} on pricing, payment methods, integrations, features, and company facts.`
      : "Compare payment processors side by side on pricing, payment methods, integrations, and features.";

  const base = buildMetadata({ title, description, path: "/compare" });
  const pretty = prettyComparePath(slugs);

  return {
    ...base,
    ...(pretty ? { alternates: { canonical: absoluteUrl(pretty) } } : {}),
    robots: { index: false, follow: true },
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string | string[] };
}) {
  const slugs = parseIds(searchParams.ids);
  const processors = await getProcessorsBySlugs(slugs);
  // Editorial copy only on the bare landing (no selection) — that's the
  // indexable page, and it's the one a reader arrives at cold.
  const pageSeo = searchParams.ids ? null : await getPageSeo("compare");
  const blocks = toBlocks(pageSeo?.blocks);
  const hasFaqBlock = Boolean(blocks?.some((b) => b.type === "faq"));

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      {!hasFaqBlock && pageSeo?.faqs && pageSeo.faqs.length > 0 && (
        <JsonLd data={faqJsonLd(pageSeo.faqs)} />
      )}
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Compare" }]} />
      <h1 className="mt-4 text-h1 tracking-tighter2 text-foreground">Compare processors</h1>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        Put up to {COMPARE_MAX} payment processors side by side and weigh pricing, capabilities, and
        company facts at a glance.
      </p>

      <div className="mt-8">
        <CompareView processors={processors} />
      </div>

      {/* The comparison tool is the tool; this is the copy the page ranks on. */}
      <Blocks blocks={blocks} className="mt-14" />

      {!hasFaqBlock && <FaqSection faqs={pageSeo?.faqs} />}
    </div>
  );
}
