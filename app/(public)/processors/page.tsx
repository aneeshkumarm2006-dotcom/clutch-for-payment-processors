import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { JsonLd } from "@/components/public/JsonLd";
import { FaqSection } from "@/components/public/FaqSection";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import { getPublishedProcessorOptions } from "@/lib/public-data";
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
  const [result, pageSeo, processorOptions] = await Promise.all([
    queryDirectory(params),
    getPageSeo("processors"),
    getPublishedProcessorOptions(),
  ]);

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

      {/*
        Hub links into the per-processor "alternatives" pages.

        Those pages were reachable from exactly two places each — their own
        processor profile and that profile's reviews tab — both several clicks
        deep. Search Console had every one of them at "Discovered - currently not
        indexed": listed in the sitemap, never crawled. The directory is the
        natural parent for them, and linking the full set from one indexed page
        is what turns a sitemap hint into an actual crawl.

        Rendered from the full published list, not `result.items`, so an active
        filter or page 2 never truncates the link set.
      */}
      {processorOptions.length > 0 && (
        <section className="mt-14">
          <h2 className="text-h2 tracking-tighter2 text-foreground">Looking for alternatives?</h2>
          <p className="mt-2 max-w-prose text-body text-muted-foreground">
            Every processor in the directory has a guide to the options merchants switch to, and
            why.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {processorOptions.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/alternatives/${p.slug}`}
                  className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
                >
                  {p.name} alternatives
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FaqSection faqs={pageSeo?.faqs} />
    </div>
  );
}
