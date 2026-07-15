import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RichText } from "@/components/public/RichText";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { JsonLd } from "@/components/public/JsonLd";
import { FaqSection } from "@/components/public/FaqSection";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import {
  getAllPublishedCategorySlugs,
  getCategoryBySlug,
  getSiblingCategories,
} from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";
import { buildStructuredData } from "@/lib/engine";
import { toEngineContext } from "@/lib/engine/context";
import { toCategoryEngineEntity, toBlocks } from "@/lib/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { Blocks } from "@/components/public/Blocks";
import { BuyersGuide } from "@/components/public/BuyersGuide";
import { CategoryTabs } from "@/components/public/CategoryTabs.client";

/** Narrow a `buyersGuide` block's Mixed `data` into render-ready guide props. */
function toGuide(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const sections = (Array.isArray(d.sections) ? d.sections : [])
    .filter(
      (s): s is { heading: string; body: string } =>
        Boolean(s) &&
        typeof s === "object" &&
        typeof (s as { heading?: unknown }).heading === "string" &&
        typeof (s as { body?: unknown }).body === "string" &&
        (s as { heading: string }).heading.trim() !== "" &&
        (s as { body: string }).body.trim() !== "",
    )
    .map((s) => ({ heading: s.heading, body: s.body }));
  if (!sections.length) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  return {
    title: str(d.title),
    intro: str(d.intro),
    layout: d.layout === "tabs" ? ("tabs" as const) : ("stacked" as const),
    showToc: d.showToc !== false,
    keyTakeaways: Array.isArray(d.keyTakeaways)
      ? d.keyTakeaways.map((t) => String(t)).filter((t) => t.trim())
      : [],
    sections,
  };
}

/** Category directory (PRD §9.2). SSG/ISR + generateStaticParams; SSR when filtered. */
export const revalidate = 1800;
export const dynamicParams = true;

type RawParams = Record<string, string | string[] | undefined>;

export async function generateStaticParams() {
  const slugs = await getAllPublishedCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: "Category not found" };

  return buildMetadata({
    title: category.name,
    description:
      category.shortDescription ||
      `Compare the best payment processors for ${category.name.toLowerCase()} on fees, features, and reviews.`,
    path: `/category/${category.slug}`,
    seo: category.seo,
    keywords: category.seo?.keywords,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: RawParams;
}) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const directoryParams = parseDirectoryParams(searchParams);
  const [result, settings, siblings] = await Promise.all([
    queryDirectory(directoryParams, { categoryId: String(category._id) }),
    getOrCreateSiteSettings().catch(() => null),
    getSiblingCategories(category),
  ]);
  const basePath = `/category/${category.slug}`;
  const blocks = toBlocks(category.blocks);
  const hasFaqBlock = Boolean(blocks?.some((b) => b.type === "faq"));

  // The buyers guide is pulled OUT of the in-header block flow: it needs the full
  // content width (its TOC layout) and its own placement relative to the directory.
  const guideBlock = blocks?.find((b) => b.type === "buyersGuide");
  const introBlocks = blocks?.filter((b) => b.type !== "buyersGuide");
  const hasIntroBlocks = Boolean(introBlocks?.length);
  const guide = toGuide(guideBlock?.data);

  // ItemList + BreadcrumbList + FAQPage, from the engine. Note the ItemList is
  // built from the CURRENT page of results, matching the previous behaviour.
  const { nodes } = buildStructuredData(
    "category",
    toCategoryEngineEntity(
      category,
      result.items.map((p) => ({ name: p.name, path: `/processor/${p.slug}` })),
    ),
    toEngineContext(settings),
  );

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd data={nodes} />

      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Processors", href: "/processors" },
          { name: category.name },
        ]}
      />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">{category.name}</h1>
        {category.shortDescription && (
          <p className="mt-2 text-body-lg text-muted-foreground">{category.shortDescription}</p>
        )}
        {/* Opt-in: blocks supersede `introContent`, otherwise nothing changes. The
            buyers guide is excluded here and rendered full-width below. */}
        {hasIntroBlocks ? (
          <Blocks blocks={introBlocks} className="mt-6" />
        ) : (
          category.introContent && <RichText html={category.introContent} className="mt-6" />
        )}
      </header>

      {(() => {
        const directory = (
          <DirectoryView result={result} basePath={basePath} searchParams={searchParams} />
        );
        const guideNode = guide ? (
          <BuyersGuide
            title={guide.title}
            intro={guide.intro}
            showToc={guide.showToc}
            keyTakeaways={guide.keyTakeaways}
            sections={guide.sections}
            updatedAt={category.updatedAt as Date | undefined}
            related={siblings.map((c) => ({ name: c.name, href: `/category/${c.slug}` }))}
          />
        ) : null;

        // Capterra-style tab swap between the directory and the guide.
        if (guide && guide.layout === "tabs") {
          return (
            <div className="mt-8">
              <CategoryTabs
                productsLabel="All products"
                guideLabel="Buyers guide"
                products={directory}
                guide={<div className="mt-6">{guideNode}</div>}
              />
            </div>
          );
        }

        // Stacked: directory, then the guide as its own full-width section.
        return (
          <>
            <div className="mt-8">{directory}</div>
            {guideNode && <div className="mt-14">{guideNode}</div>}
          </>
        );
      })()}

      {/*
        An FAQ block already renders its own FAQ section inside <Blocks> above.
        Rendering the legacy `faqs` here as well would show the reader two FAQ
        sections — and the engine has already resolved the same conflict in the
        JSON-LD by letting the block win. Keep the page and the schema agreeing.
      */}
      {!hasFaqBlock && <FaqSection faqs={category.faqs} />}
    </div>
  );
}
