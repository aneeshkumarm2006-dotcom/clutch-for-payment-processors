import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { DirectoryView } from "@/components/public/directory/DirectoryView";
import { LeadDialog } from "@/components/public/LeadDialog";
import { JsonLd } from "@/components/public/JsonLd";
import { parseDirectoryParams, queryDirectory } from "@/lib/processors-query";
import { FACET_SLUGS, getFacetPage, mergeFacetParams } from "@/lib/facet-pages";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, faqJsonLd } from "@/lib/seo";

/**
 * Faceted "best-for" landing page (`/payment-processors/<facet>`). A curated set
 * of capability landing pages (integration / method / pricing / feature) that
 * pre-filter the directory via `queryDirectory` — the same engine as
 * `/category/[slug]` — and wrap the results in unique intro copy + FAQs.
 *
 * `dynamicParams = false` → only the curated `FACET_SLUGS` render; any other
 * segment 404s (no arbitrary/spam facet URLs). SSR when the rail adds filters.
 */
export const revalidate = 1800;
export const dynamicParams = false;

type RawParams = Record<string, string | string[] | undefined>;

export function generateStaticParams() {
  return FACET_SLUGS.map((facet) => ({ facet }));
}

export async function generateMetadata({
  params,
}: {
  params: { facet: string };
}): Promise<Metadata> {
  const facet = getFacetPage(params.facet);
  if (!facet) return { title: "Not found" };
  return buildMetadata({
    title: facet.title,
    description: facet.description,
    path: `/payment-processors/${facet.slug}`,
  });
}

export default async function FacetPage({
  params,
  searchParams,
}: {
  params: { facet: string };
  searchParams: RawParams;
}) {
  const facet = getFacetPage(params.facet);
  if (!facet) notFound();

  const directoryParams = mergeFacetParams(parseDirectoryParams(searchParams), facet.filter);
  const result = await queryDirectory(directoryParams);
  const basePath = `/payment-processors/${facet.slug}`;

  const related = (facet.related ?? [])
    .map((s) => getFacetPage(s))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Processors", path: "/processors" },
            { name: facet.h1, path: basePath },
          ]),
          itemListJsonLd(result.items.map((p) => ({ name: p.name, path: `/processor/${p.slug}` }))),
          faqJsonLd(facet.faqs),
        ]}
      />

      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Processors", href: "/processors" },
          { name: facet.h1 },
        ]}
      />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">{facet.h1}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">{facet.intro}</p>
      </header>

      <div className="mt-8">
        <DirectoryView result={result} basePath={basePath} searchParams={searchParams} />
      </div>

      <section className="mt-14 max-w-prose">
        <h2 className="text-h2 tracking-tighter2 text-foreground">Frequently asked questions</h2>
        <dl className="mt-6 divide-y divide-ink-150 dark:divide-ink-800">
          {facet.faqs.map((f) => (
            <div key={f.question} className="py-5">
              <dt className="text-h4 text-foreground">{f.question}</dt>
              <dd className="mt-2 text-body text-muted-foreground">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-h3 text-foreground">Related searches</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/payment-processors/${r.slug}`}
                className="inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
              >
                {r.h1}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14 rounded-lg border bg-card p-8 text-center">
        <h2 className="text-h3 text-foreground">Still comparing options?</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground">
          Tell us what you need and we&rsquo;ll help you shortlist the right processor for your
          business.
        </p>
        <div className="mt-5 flex justify-center">
          <LeadDialog
            source={`facet-${facet.slug}`}
            triggerLabel="Get matched"
            triggerVariant="accent"
            triggerSize="lg"
          />
        </div>
      </section>
    </div>
  );
}
