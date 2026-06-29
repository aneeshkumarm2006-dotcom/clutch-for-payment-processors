import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RichText } from "@/components/public/RichText";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { JsonLd } from "@/components/public/JsonLd";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import { getAllPublishedCategorySlugs, getCategoryBySlug } from "@/lib/public-data";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

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
  const result = await queryDirectory(directoryParams, { categoryId: String(category._id) });
  const basePath = `/category/${category.slug}`;

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Processors", path: "/processors" },
            { name: category.name, path: basePath },
          ]),
          itemListJsonLd(result.items.map((p) => ({ name: p.name, path: `/processor/${p.slug}` }))),
        ]}
      />

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
        {category.introContent && <RichText html={category.introContent} className="mt-6" />}
      </header>

      <div className="mt-8">
        <DirectoryView result={result} basePath={basePath} searchParams={searchParams} />
      </div>
    </div>
  );
}
