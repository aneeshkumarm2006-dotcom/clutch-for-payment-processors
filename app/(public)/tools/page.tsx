import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Blocks } from "@/components/public/Blocks";
import { JsonLd } from "@/components/public/JsonLd";
import { TOOLS, TOOLS_HUB } from "@/lib/tools";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { getPageSeoByPath, pageSeoMetadata } from "@/lib/page-seo";
import { toBlocks } from "@/lib/serialize";

/**
 * The `/tools` hub.
 *
 * A hub is not decoration here. A brand-new `/tools/*` section has no external
 * links, so internal PageRank is the only thing pointing at it: the hub is
 * linked from the navbar and footer, and it is the page every tool links back
 * into. The site has an existing orphan-cluster problem (sitemap-only pages with
 * no internal path in), and this is the fix applied up front rather than later.
 */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageSeoMetadata({
    title: TOOLS_HUB.title,
    description: TOOLS_HUB.description,
    path: "/tools",
    byPath: true,
  });
}

const TIER_LABEL: Record<number, string> = {
  1: "Most used",
  2: "Popular",
  3: "More tools",
};

export default async function ToolsHubPage() {
  const page = await getPageSeoByPath("/tools");
  const blocks = toBlocks(page?.blocks);

  const groups = [1, 2, 3]
    .map((tier) => ({ tier, tools: TOOLS.filter((t) => t.tier === tier) }))
    .filter((g) => g.tools.length > 0);

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
          ]),
          itemListJsonLd(TOOLS.map((t) => ({ name: t.name, path: `/tools/${t.slug}` }))),
        ]}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Tools" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">{TOOLS_HUB.h1}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">{TOOLS_HUB.intro}</p>
      </header>

      <div className="mt-10 space-y-12">
        {groups.map((group) => (
          <section key={group.tier}>
            <h2 className="text-label uppercase text-muted-foreground">
              {TIER_LABEL[group.tier] ?? "Tools"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((t) => (
                <Link
                  key={t.slug}
                  href={`/tools/${t.slug}`}
                  className="group flex flex-col rounded-lg border bg-card p-6 transition-colors hover:border-border-strong"
                >
                  <span className="text-h3 tracking-tighter2 text-foreground">{t.name}</span>
                  <span className="mt-2 flex-1 text-body text-muted-foreground">{t.summary}</span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-small font-medium text-accent">
                    Open calculator
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Blocks blocks={blocks} className="mt-14" />

      <section className="mt-14 max-w-prose">
        <h2 className="text-h2 tracking-tighter2 text-foreground">How these calculators work</h2>
        <div className="mt-4 space-y-4 text-body text-muted-foreground">
          <p>
            Every calculator runs entirely in your browser. Nothing you type is uploaded, stored or
            sent anywhere, and none of them asks for an email address before showing you the answer.
            That is deliberate: the free statement-analysis services you will find elsewhere all
            require a PDF of your financials and a phone number, handed to a company that sells
            payment processing, before they will tell you whether you are overpaying.
          </p>
          <p>
            The brand calculators use each processor&rsquo;s own published US rate card, and every tool
            shows the date those rates were last checked. That matters more than it sounds: several
            of the calculators currently ranking for these searches still compute Square&rsquo;s
            pre-2026 in-person rate, and one carries a PayPal rate inside a Square calculator. A
            wrong number looks exactly like a right one, so we show our sources and our dates.
          </p>
          <p>
            Where a figure genuinely cannot be known precisely, such as interchange, the tools show a
            range and say so rather than inventing a number. Interchange depends on card type,
            merchant category and how the payment was taken, and the card networks publish it as rate
            tables rather than a feed.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-h3 text-foreground">Keep comparing</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "All payment processors", href: "/processors" },
            { label: "Compare head to head", href: "/compare" },
            { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
            { label: "Flat-rate processors", href: "/payment-processors/flat-rate" },
            { label: "ACH processors", href: "/payment-processors/ach" },
            { label: "Payments glossary", href: "/glossary" },
            { label: "How we rate processors", href: "/methodology" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-small font-medium text-foreground transition-colors hover:border-border-strong hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
