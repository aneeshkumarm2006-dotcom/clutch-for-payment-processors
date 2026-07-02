import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GitCompare } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { LeadDialog } from "@/components/public/LeadDialog";
import { JsonLd } from "@/components/public/JsonLd";
import {
  getAllPublishedProcessorSlugs,
  getAlternatives,
  getProcessorBySlug,
} from "@/lib/public-data";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd, faqJsonLd } from "@/lib/seo";
import { prettyComparePath } from "@/lib/compare-pairs";

/**
 * Processor "alternatives" landing page (`/alternatives/<slug>`). Targets the
 * high-intent "best {X} alternatives" query, distinct from the "{X} review"
 * profile page. SSG/ISR + generateStaticParams over every published processor;
 * reuses `getAlternatives` (the same related-processor logic as the profile).
 */
export const revalidate = 1800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllPublishedProcessorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const p = await getProcessorBySlug(params.slug);
  if (!p) return { title: "Alternatives not found" };
  return buildMetadata({
    title: `Best ${p.name} alternatives`,
    description: `Compare the top alternatives to ${p.name} on fees, payment methods, features, and verified merchant reviews — and find the payment processor that fits your business.`,
    path: `/alternatives/${p.slug}`,
    image: p.logo,
  });
}

/** A few useful, data-aware FAQs (also emitted as FAQPage JSON-LD). */
function buildFaqs(name: string, topAlt?: string): { question: string; answer: string }[] {
  return [
    {
      question: `What is the best alternative to ${name}?`,
      answer: topAlt
        ? `${topAlt} is one of the most-compared ${name} alternatives, but the best choice depends on your pricing model, payment methods, and integrations. Compare each option side by side before deciding.`
        : `The best alternative depends on your pricing model, payment methods, and integrations. Compare the options on this page side by side before deciding.`,
    },
    {
      question: `Why do merchants look for ${name} alternatives?`,
      answer: `Merchants usually switch to lower processing fees, get better support, avoid restrictive contract or reserve terms, or find payment methods and integrations that fit their business more closely.`,
    },
    {
      question: `How do I compare ${name} with its alternatives?`,
      answer: `Use the side-by-side compare tool to line up ${name} against any alternative on pricing, payment methods, integrations, features, and company facts, then read verified merchant reviews for each.`,
    },
  ];
}

export default async function AlternativesPage({ params }: { params: { slug: string } }) {
  const p = await getProcessorBySlug(params.slug);
  if (!p) notFound();

  const alternatives = await getAlternatives(p, 8);
  const primaryCategory = p.categories[0];
  const basePath = `/alternatives/${p.slug}`;
  const faqs = buildFaqs(p.name, alternatives[0]?.name);

  // Real, per-processor reasons: the profile's own "cons" double as switch drivers.
  const reasons =
    p.cons.length > 0
      ? p.cons.slice(0, 4)
      : [
          `You want lower or more transparent processing fees than ${p.name}.`,
          `You need payment methods or integrations ${p.name} doesn't prioritise.`,
          `You'd prefer different contract, payout, or support terms.`,
        ];

  const compareIds = [p.slug, ...alternatives.slice(0, 3).map((a) => a.slug)].join(",");

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Processors", path: "/processors" },
            { name: p.name, path: `/processor/${p.slug}` },
            { name: "Alternatives", path: basePath },
          ]),
          itemListJsonLd(alternatives.map((a) => ({ name: a.name, path: `/processor/${a.slug}` }))),
          faqJsonLd(faqs),
        ]}
      />

      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Processors", href: "/processors" },
          { name: p.name, href: `/processor/${p.slug}` },
          { name: "Alternatives" },
        ]}
      />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Best {p.name} alternatives</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          {p.tagline ? `${p.name} — ${p.tagline}. ` : ""}
          If you&rsquo;re weighing up {p.name}, here {alternatives.length === 1 ? "is" : "are"}{" "}
          {alternatives.length} payment processor{alternatives.length === 1 ? "" : "s"} worth
          comparing on fees, features, and verified merchant reviews
          {primaryCategory ? `, especially for ${primaryCategory.name.toLowerCase()}` : ""}.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-h3 text-foreground">Why consider alternatives to {p.name}?</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 text-body text-muted-foreground">
              <ArrowRight className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-h2 tracking-tighter2 text-foreground">
            {alternatives.length} alternatives to {p.name}
          </h2>
          {alternatives.length > 1 && (
            <Link
              href={`/compare?ids=${compareIds}`}
              className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
            >
              Compare side by side <GitCompare className="size-4" aria-hidden />
            </Link>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {alternatives.map((alt) => {
            const compareHref = prettyComparePath([p.slug, alt.slug]) ?? `/compare?ids=${p.slug},${alt.slug}`;
            return (
              <div key={alt.id} className="flex flex-col gap-2">
                <ProcessorCard processor={alt} />
                <Link
                  href={compareHref}
                  className="inline-flex items-center gap-1 self-start text-small font-medium text-accent hover:underline"
                >
                  Compare {p.name} vs {alt.name} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14 max-w-prose">
        <h2 className="text-h2 tracking-tighter2 text-foreground">{p.name} alternatives — FAQ</h2>
        <dl className="mt-6 divide-y divide-ink-150 dark:divide-ink-800">
          {faqs.map((f) => (
            <div key={f.question} className="py-5">
              <dt className="text-h4 text-foreground">{f.question}</dt>
              <dd className="mt-2 text-body text-muted-foreground">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 rounded-lg border bg-card p-8 text-center">
        <h2 className="text-h3 text-foreground">Not sure which processor fits?</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground">
          Tell us what you need and we&rsquo;ll help you shortlist the right
          {primaryCategory ? ` ${primaryCategory.name.toLowerCase()}` : " payment"} processor.
        </p>
        <div className="mt-5 flex justify-center">
          <LeadDialog
            source="alternatives"
            triggerLabel="Get matched"
            triggerVariant="accent"
            triggerSize="lg"
          />
        </div>
      </section>
    </div>
  );
}
