import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Blocks } from "@/components/public/Blocks";
import { JsonLd } from "@/components/public/JsonLd";
import { LeadDialog } from "@/components/public/LeadDialog";
import { ToolWidget } from "@/components/public/tools/ToolWidget";
import { TOOL_SLUGS, TOOLS_HUB, getRateCard, getTool } from "@/lib/tools";
import { breadcrumbJsonLd, faqJsonLd, webApplicationJsonLd } from "@/lib/seo";
import { getPageSeoByPath, pageSeoMetadata } from "@/lib/page-seo";
import { toBlocks, toFaqs } from "@/lib/serialize";

/**
 * A free tool page (`/tools/<slug>`).
 *
 * Structure follows what actually ranks for calculator queries: the widget above
 * the fold, then 900 to 1,600 words of genuine explainer beneath it. Both halves
 * are load-bearing. A bare widget does not rank (KoronaPOS has a working
 * effective-rate calculator that never cracks the top ten), and a pure article
 * does not satisfy tool intent even when it outranks the tools.
 *
 * Everything except the calculator itself is SERVER rendered, including a worked
 * numeric example, so the crawler gets a concrete answer and an answer engine
 * gets an extractable passage. The calculator is a client island that also
 * renders its default state on the server.
 *
 * `dynamicParams = false` so only curated `TOOL_SLUGS` render. Calculator state
 * lives in React state and never in the query string, so this route can never
 * mint a near-duplicate URL and needs no `NOINDEX_ROUTES` entry.
 *
 * Editorial slot: a `PageSeo` record at the same path overrides the registry's
 * meta and FAQs and adds blocks, exactly as on `/payment-processors/[facet]`.
 */
export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams() {
  return TOOL_SLUGS.map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: {
  params: { tool: string };
}): Promise<Metadata> {
  const tool = getTool(params.tool);
  if (!tool) return { title: "Not found" };

  return pageSeoMetadata({
    title: tool.title,
    description: tool.description,
    path: `/tools/${tool.slug}`,
    byPath: true,
  });
}

export default async function ToolPage({ params }: { params: { tool: string } }) {
  const tool = getTool(params.tool);
  if (!tool) notFound();

  const path = `/tools/${tool.slug}`;
  const page = await getPageSeoByPath(path);

  const blocks = toBlocks(page?.blocks);
  const hasFaqBlock = Boolean(blocks?.some((b) => b.type === "faq"));
  // An editor's FAQs replace the registry's rather than appending: appending is
  // how a page ends up answering the same question twice.
  const faqs = toFaqs(page?.faqs) ?? tool.faqs;

  const rateCard = tool.rateCard ? getRateCard(tool.rateCard) : null;
  const related = (tool.related ?? [])
    .map((s) => getTool(s))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: tool.name, path },
          ]),
          webApplicationJsonLd({ name: tool.name, description: tool.description, path }),
          ...(hasFaqBlock || faqs.length === 0 ? [] : [faqJsonLd(faqs)]),
        ]}
      />

      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          { name: tool.name },
        ]}
      />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">{tool.h1}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">{tool.intro}</p>
      </header>

      <div className="mt-8">
        <ToolWidget tool={tool} />
      </div>

      {/* The worked example is server-rendered on purpose. The widget is a client
          island, so this is the numeric passage a crawler and an answer engine
          can actually lift, and it is never blank. */}
      <section className="mt-8 rounded-lg border bg-muted px-5 py-5 sm:px-6">
        <h2 className="text-h4 text-foreground">Worked example</h2>
        <p className="mt-2 text-body text-muted-foreground">{tool.workedExample.scenario}</p>
        <p className="mt-2 text-body text-foreground">{tool.workedExample.result}</p>
      </section>

      <div className="mt-14 max-w-prose space-y-12">
        {tool.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-h2 tracking-tighter2 text-foreground">{section.heading}</h2>
            <div className="mt-4 space-y-4">
              {section.body.map((para, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <p key={i} className="text-body text-muted-foreground">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {tool.rateTable && (
        <section className="mt-14">
          <h2 className="text-h2 tracking-tighter2 text-foreground">{tool.rateTable.caption}</h2>
          <div className="mt-5 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] border-collapse text-body">
              <thead>
                <tr className="border-b bg-muted">
                  <th scope="col" className="px-4 py-3 text-left text-label uppercase text-muted-foreground">
                    Fee
                  </th>
                  {tool.rateTable.columns.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-4 py-3 text-right text-label uppercase text-muted-foreground"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tool.rateTable.rows.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-normal text-foreground">
                      {row.label}
                      {row.note && (
                        <span className="block text-micro text-muted-foreground">{row.note}</span>
                      )}
                    </th>
                    {row.values.map((v, i) => (
                      <td
                        // eslint-disable-next-line react/no-array-index-key
                        key={i}
                        className="px-4 py-3 text-right tabular-nums text-foreground"
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Assumptions and sources, dated. This is the block that carries the
          E-E-A-T and the one answer engines quote, and it is the thing every
          thin competitor omits. Never ship a calculator without it. */}
      <section className="mt-14 max-w-prose">
        <h2 className="text-h2 tracking-tighter2 text-foreground">Assumptions and limits</h2>
        <ul className="mt-4 space-y-3">
          {tool.assumptions.map((a) => (
            <li key={a} className="text-body text-muted-foreground">
              {a}
            </li>
          ))}
        </ul>
        {rateCard && (
          <p className="mt-4 text-small text-muted-foreground">
            Rate card checked {rateCard.checked}. Source
            {rateCard.sources.length > 1 ? "s" : ""}:{" "}
            {rateCard.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener nofollow"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {s.label}
                </a>
              </span>
            ))}
            .
          </p>
        )}
        <p className="mt-3 text-small text-muted-foreground">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-foreground">
            How we research and check these numbers
          </Link>
        </p>
      </section>

      {/* Editorial slot: long-form copy an editor adds sits below the tool it explains. */}
      <Blocks blocks={blocks} className="mt-14" />

      {!hasFaqBlock && faqs.length > 0 && (
        <section className="mt-14 max-w-prose">
          <h2 className="text-h2 tracking-tighter2 text-foreground">Frequently asked questions</h2>
          <dl className="mt-6 divide-y divide-ink-150 dark:divide-ink-800">
            {faqs.map((f) => (
              <div key={f.question} className="py-5">
                <dt className="text-h4 text-foreground">{f.question}</dt>
                <dd className="mt-2 text-body text-muted-foreground">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {tool.links.length > 0 && (
        <section className="mt-14">
          <h2 className="text-h3 text-foreground">Go deeper</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tool.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
              >
                {l.label}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-h3 text-foreground">Other calculators</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/tools/${r.slug}`}
                className="rounded-lg border bg-card p-5 transition-colors hover:border-border-strong"
              >
                <span className="text-h4 text-foreground">{r.name}</span>
                <span className="mt-1.5 block text-small text-muted-foreground">{r.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14 rounded-lg border bg-card p-8 text-center">
        <h2 className="text-h3 text-foreground">{tool.cta.heading}</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground">{tool.cta.body}</p>
        <div className="mt-5 flex justify-center">
          <LeadDialog
            source={`tool-${tool.slug}`}
            triggerLabel={tool.cta.label}
            triggerVariant="accent"
            triggerSize="lg"
          />
        </div>
      </section>

      <p className="mt-8 text-center text-small text-muted-foreground">
        Looking for something else? See{" "}
        <Link href="/tools" className="underline underline-offset-2 hover:text-foreground">
          {TOOLS_HUB.h1.toLowerCase()}
        </Link>
        .
      </p>
    </div>
  );
}
