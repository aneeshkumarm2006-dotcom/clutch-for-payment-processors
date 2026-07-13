import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RichText } from "@/components/public/RichText";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { JsonLd } from "@/components/public/JsonLd";
import { FaqSection } from "@/components/public/FaqSection";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import { getAllPublishedCategorySlugs, getCategoryBySlug } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";
import { buildStructuredData } from "@/lib/engine";
import { toEngineContext } from "@/lib/engine/context";
import { toCategoryEngineEntity, toBlocks } from "@/lib/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { Blocks } from "@/components/public/Blocks";

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
  const [result, settings] = await Promise.all([
    queryDirectory(directoryParams, { categoryId: String(category._id) }),
    getOrCreateSiteSettings().catch(() => null),
  ]);
  const basePath = `/category/${category.slug}`;
  const blocks = toBlocks(category.blocks);
  const hasBlocks = Boolean(blocks?.length);
  const hasFaqBlock = Boolean(blocks?.some((b) => b.type === "faq"));

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
        {/* Opt-in: blocks supersede `introContent`, otherwise nothing changes. */}
        {hasBlocks ? (
          <Blocks blocks={blocks} className="mt-6" />
        ) : (
          category.introContent && <RichText html={category.introContent} className="mt-6" />
        )}
      </header>

      <div className="mt-8">
        <DirectoryView result={result} basePath={basePath} searchParams={searchParams} />
      </div>

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
