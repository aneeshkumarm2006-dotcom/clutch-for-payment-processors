import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { JsonLd } from "@/components/public/JsonLd";
import { GLOSSARY_TERMS, glossaryByLetter } from "@/lib/glossary";
import { buildMetadata, breadcrumbJsonLd, definedTermSetJsonLd } from "@/lib/seo";

/**
 * Payments glossary hub (`/glossary`). A static A–Z index of every term, linking
 * to the individual `/glossary/<slug>` pages. Emits DefinedTermSet JSON-LD so the
 * whole glossary reads as one structured reference — a strong topical-authority
 * and AI-citation surface.
 */
export const revalidate = 86400;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Payments glossary",
    description:
      "Plain-English definitions of payment processing terms — interchange, chargebacks, ACH, PCI, rolling reserves, tokenization, and more.",
    path: "/glossary",
  });
}

export default function GlossaryHubPage() {
  const groups = glossaryByLetter();

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Glossary", path: "/glossary" },
          ]),
          definedTermSetJsonLd(GLOSSARY_TERMS.map((t) => ({ term: t.term, slug: t.slug }))),
        ]}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Glossary" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Payments glossary</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Plain-English definitions of the payment processing terms you&rsquo;ll meet when comparing
          providers: interchange, chargebacks, ACH, PCI, and rolling reserves.
        </p>
      </header>

      <nav aria-label="Jump to letter" className="mt-8 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <a
            key={g.letter}
            href={`#letter-${g.letter}`}
            className="inline-flex size-8 items-center justify-center rounded border text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
          >
            {g.letter}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-10">
        {groups.map((g) => (
          <section key={g.letter} id={`letter-${g.letter}`} className="scroll-mt-24">
            <h2 className="text-h3 text-ink-500">{g.letter}</h2>
            <dl className="mt-4 divide-y divide-ink-150 border-t dark:divide-ink-800">
              {g.terms.map((t) => (
                <div key={t.slug} className="py-4">
                  <dt>
                    <Link
                      href={`/glossary/${t.slug}`}
                      className="text-h4 text-foreground transition-colors hover:text-accent"
                    >
                      {t.term}
                    </Link>
                  </dt>
                  <dd className="mt-1 max-w-prose text-body text-muted-foreground">{t.short}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
