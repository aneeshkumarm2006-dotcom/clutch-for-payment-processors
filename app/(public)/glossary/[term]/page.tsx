import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { JsonLd } from "@/components/public/JsonLd";
import {
  GLOSSARY_SLUGS,
  getGlossaryTerm,
  type GlossaryTerm,
} from "@/lib/glossary";
import { getFacetPage, type FacetPageDef } from "@/lib/facet-pages";
import { buildMetadata, breadcrumbJsonLd, definedTermJsonLd } from "@/lib/seo";

/**
 * Glossary term page (`/glossary/<slug>`). Statically generated from the term
 * data; `dynamicParams = false` so only defined terms render. Emits DefinedTerm
 * JSON-LD and cross-links to related terms and facet ("best-for") pages, wiring
 * the glossary into the wider directory graph.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return GLOSSARY_SLUGS.map((term) => ({ term }));
}

export function generateMetadata({ params }: { params: { term: string } }): Metadata {
  const t = getGlossaryTerm(params.term);
  if (!t) return { title: "Term not found" };
  return buildMetadata({
    title: `${t.term} — payments glossary`,
    description: t.short,
    path: `/glossary/${t.slug}`,
  });
}

export default function GlossaryTermPage({ params }: { params: { term: string } }) {
  const t = getGlossaryTerm(params.term);
  if (!t) notFound();

  const related = (t.related ?? [])
    .map((s) => getGlossaryTerm(s))
    .filter((x): x is GlossaryTerm => Boolean(x));
  const relatedFacets = (t.relatedFacets ?? [])
    .map((s) => getFacetPage(s))
    .filter((x): x is FacetPageDef => Boolean(x));

  return (
    <article className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Glossary", path: "/glossary" },
            { name: t.term, path: `/glossary/${t.slug}` },
          ]),
          definedTermJsonLd({
            term: t.term,
            slug: t.slug,
            definition: t.definition,
            aka: t.aka,
          }),
        ]}
      />

      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Glossary", href: "/glossary" },
          { name: t.term },
        ]}
      />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">{t.term}</h1>
        {t.aka && t.aka.length > 0 && (
          <p className="mt-2 text-small text-muted-foreground">Also known as: {t.aka.join(", ")}</p>
        )}
      </header>

      <div className="mt-6 max-w-prose">
        <p className="text-body-lg text-foreground">{t.short}</p>
        <p className="mt-4 text-body text-muted-foreground">{t.definition}</p>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-h3 text-foreground">Related terms</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/glossary/${r.slug}`}
                className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
              >
                {r.term}
              </Link>
            ))}
          </div>
        </section>
      )}

      {relatedFacets.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h3 text-foreground">Compare processors</h2>
          <ul className="mt-4 space-y-2">
            {relatedFacets.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/payment-processors/${f.slug}`}
                  className="inline-flex items-center gap-1 text-body font-medium text-accent hover:underline"
                >
                  {f.h1}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 border-t pt-6">
        <Link href="/glossary" className="text-small font-medium text-accent hover:underline">
          &larr; Back to the payments glossary
        </Link>
      </div>
    </article>
  );
}
