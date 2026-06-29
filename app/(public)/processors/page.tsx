import type { Metadata } from "next";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { JsonLd } from "@/components/public/JsonLd";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

/** All-processors directory (PRD §9.2). SSR per request (filters live in the URL). */
export const revalidate = 1800;

type RawParams = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrCreateSiteSettings().catch(() => null);
  return buildMetadata({
    title: "All payment processors",
    description:
      "Browse and filter every payment processor in the directory by fees, payment methods, integrations, region, and use case.",
    path: "/processors",
    seo: settings?.defaultSeo,
  });
}

export default async function ProcessorsPage({ searchParams }: { searchParams: RawParams }) {
  const params = parseDirectoryParams(searchParams);
  const result = await queryDirectory(params);

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Processors", path: "/processors" },
          ]),
          itemListJsonLd(result.items.map((p) => ({ name: p.name, path: `/processor/${p.slug}` }))),
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
    </div>
  );
}
