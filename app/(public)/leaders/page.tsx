import type { Metadata } from "next";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { JsonLd } from "@/components/public/JsonLd";
import { LeadersMatrix } from "@/components/public/LeadersMatrix";
import { getLeaderPoints } from "@/lib/leaders";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

/**
 * Leaders Matrix `/leaders` (Phase 2 / Stage 7.2 — PRD §5, §16). A 2×2 quadrant
 * scatter of every published processor so visitors can spot the leaders at a
 * glance. ISR — the plotted data tracks ratings/review counts that change slowly.
 */
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrCreateSiteSettings().catch(() => null);
  return buildMetadata({
    title: "Leaders Matrix",
    description:
      "See every payment processor plotted on a 2×2 quadrant by adoption and merchant satisfaction — the leaders sit top-right. Toggle the axes to compare on review volume, average rating, or editor score.",
    path: "/leaders",
    seo: settings?.defaultSeo,
  });
}

export default async function LeadersPage() {
  const points = await getLeaderPoints();

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Leaders", path: "/leaders" },
          ]),
          itemListJsonLd(points.map((p) => ({ name: p.name, path: `/processor/${p.slug}` }))),
        ]}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Leaders" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Leaders Matrix</h1>
        <p className="mt-2 text-body-lg text-muted-foreground">
          Every published processor mapped on two dimensions at once. By default the horizontal axis
          is adoption (how many merchants have reviewed it) and the vertical axis is satisfaction
          (average rating) — so the <span className="text-accent">top-right quadrant</span> holds the
          well-reviewed, well-liked leaders. Switch either axis to weigh review volume, rating, or our
          editor score. Each dot links to the full profile.
        </p>
      </header>

      <div className="mt-8">
        <LeadersMatrix points={points} />
      </div>
    </div>
  );
}
