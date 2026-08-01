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
import { buildMetadata, breadcrumbJsonLd, definedTermJsonLd, faqJsonLd } from "@/lib/seo";

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
    /*
      Was "{term} | payments glossary", to which the layout appended
      " | Payment Processor Guide" — two pipes and 46 characters of scaffolding
      around a two-word term, pushing the longer terms past 60 characters.

      This shape leads with the term and then states the intent behind the query
      ("what is X", "X meaning"), which is what the page actually answers now
      that each entry carries a "How it works" section, a worked example, and an
      FAQ. `absoluteTitle` keeps the brand suffix off.
    */
    title: `${t.term}: Definition and How It Works`,
    absoluteTitle: true,
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
          // Only when the term actually renders an FAQ section — Google rejects an
          // FAQPage whose questions aren't visible on the page.
          ...(t.faqs?.length ? [faqJsonLd(t.faqs)] : []),
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

      {t.detail && t.detail.length > 0 && (
        <section className="mt-10 max-w-prose">
          <h2 className="text-h3 text-foreground">How it works</h2>
          {t.detail.map((para) => (
            <p key={para.slice(0, 48)} className="mt-4 text-body text-muted-foreground">
              {para}
            </p>
          ))}
        </section>
      )}

      {t.example && (
        <section className="mt-10 max-w-prose">
          <h2 className="text-h3 text-foreground">Worked example</h2>
          <p className="mt-4 rounded-lg border bg-card p-5 text-body text-muted-foreground">
            {t.example}
          </p>
        </section>
      )}

      {t.faqs && t.faqs.length > 0 && (
        <section className="mt-10 max-w-prose">
          <h2 className="text-h3 text-foreground">Frequently asked questions</h2>
          <dl className="mt-4 divide-y border-t">
            {t.faqs.map((f) => (
              <div key={f.question} className="py-4">
                <dt className="text-body font-semibold text-foreground">{f.question}</dt>
                <dd className="mt-2 text-body text-muted-foreground">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

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
