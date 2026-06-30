import type { Metadata } from "next";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { CompareView } from "@/components/public/compare/CompareView";
import { getProcessorsBySlugs } from "@/lib/public-data";
import { COMPARE_MAX } from "@/components/public/compare/CompareContext";
import { buildMetadata, absoluteUrl } from "@/lib/seo";
import { prettyComparePath } from "@/lib/compare-pairs";

/**
 * Compare `/compare?ids=stripe,paypal,square` (PRD §9.4).
 *
 * `?ids=` carries 2–4 processor slugs (also reached from the compare tray). The
 * page resolves them to full detail data and hands them to the client CompareView
 * (which owns add/remove + the searchable picker). Query-param-driven, so it's
 * dynamic and kept out of the index (canonical points at the bare `/compare`).
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
  const processors = await getProcessorsBySlugs(slugs);
  const names = processors.map((p) => p.name);

  const title = names.length >= 2 ? `Compare ${names.join(" vs ")}` : "Compare payment processors";
  const description =
    names.length >= 2
      ? `Side-by-side comparison of ${names.join(", ")} — pricing, payment methods, integrations, features, and company facts.`
      : "Compare payment processors side by side — pricing, payment methods, integrations, and features.";

  const base = buildMetadata({ title, description, path: "/compare" });
  // When the selected slugs match a curated popular pair, point the canonical at
  // the pretty, indexable route (`/compare/stripe-vs-paypal`) so link equity lands
  // there; otherwise the canonical stays the bare `/compare` (Stage 7.3, PRD §9.4).
  const pretty = prettyComparePath(slugs);

  return {
    ...base,
    ...(pretty ? { alternates: { canonical: absoluteUrl(pretty) } } : {}),
    // Query-driven combinatorial URLs shouldn't be indexed. The page stays a
    // working fallback/builder; crawlers follow the canonical to the real page.
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

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Compare" }]} />
      <h1 className="mt-4 text-h1 tracking-tighter2 text-foreground">Compare processors</h1>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        Put up to {COMPARE_MAX} payment processors side by side and weigh pricing, capabilities, and
        company facts at a glance.
      </p>

      <div className="mt-8">
        <CompareView processors={processors} />
      </div>
    </div>
  );
}
