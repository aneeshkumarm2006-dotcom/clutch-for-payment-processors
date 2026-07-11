import type { Metadata } from "next";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { JsonLd } from "@/components/public/JsonLd";
import { FaqSection } from "@/components/public/FaqSection";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import { breadcrumbJsonLd, itemListJsonLd, faqJsonLd } from "@/lib/seo";
import { getPageSeo, pageSeoMetadata } from "@/lib/page-seo";

/** All-processors directory (PRD §9.2). SSR per request (filters live in the URL). */
export const revalidate = 1800;

type RawParams = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  // Editable via admin → Page SEO ("processors").
  return pageSeoMetadata({
    pageKey: "processors",
    title: "All payment processors",
    description:
      "Browse and filter every payment processor in the directory by fees, payment methods, integrations, region, and use case.",
    path: "/processors",
  });
}

export default async function ProcessorsPage({ searchParams }: { searchParams: RawParams }) {
  const params = parseDirectoryParams(searchParams);
  const [result, pageSeo] = await Promise.all([queryDirectory(params), getPageSeo("processors")]);

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Processors", path: "/processors" },
          ]),
          itemListJsonLd(result.items.map((p) => ({ name: p.name, path: `/processor/${p.slug}` }))),
          ...(pageSeo?.faqs && pageSeo.faqs.length > 0 ? [faqJsonLd(pageSeo.faqs)] : []),
        ]}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Processors" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Payment processors</h1>
        <p className="mt-2 text-body-lg text-muted-foreground">
          Compare {result.total > 0 ? result.total : "every"} payment processor on fees, payment
          methods, integrations, and verified merchant reviews.
        </p>
      </header>

      <div className="mt-8">
        <DirectoryView result={result} basePath="/processors" searchParams={searchParams} />
      </div>

      <FaqSection faqs={pageSeo?.faqs} />
    </div>
  );
}
