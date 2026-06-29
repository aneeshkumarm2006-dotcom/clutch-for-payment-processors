import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Scale, Users } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Prose } from "@/components/public/Prose";
import { JsonLd } from "@/components/public/JsonLd";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";

/** About (PRD §9). Static editorial, SSG. */
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "About PayCompare",
    description:
      "PayCompare is an independent directory and review platform that helps businesses compare payment processors on fees, features, and verified merchant reviews.",
    path: "/about",
  });
}

const VALUES = [
  {
    Icon: Compass,
    title: "Independent by design",
    body: "We’re not owned by a processor. Rankings and reviews stay separate from any commercial relationship, and sponsored placements are always labelled.",
  },
  {
    Icon: Scale,
    title: "Apples to apples",
    body: "Payment pricing is deliberately confusing. We normalise fees, methods, and features into a consistent model so you can actually compare like for like.",
  },
  {
    Icon: Users,
    title: "Built on real experience",
    body: "Star ratings come from verified merchants who’ve used these processors — not from us. Every review is moderated before it’s published.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "About" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">About PayCompare</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Choosing how to accept payments is one of the highest-stakes decisions a business makes —
          and one of the hardest to research. We built PayCompare to fix that.
        </p>
      </header>

      <section className="mt-10 max-w-prose">
        <Prose>
          <p>
            PayCompare is an independent directory, comparison, and review platform for payment
            processors and gateways. Whether you’re a startup picking your first gateway, a retailer
            adding in-person payments, or a high-risk merchant who keeps getting turned away, our goal
            is to get you from “I need to accept payments” to a confident decision in minutes.
          </p>
          <p>
            We cover providers across markets and use cases — from Stripe, PayPal, and Square to
            region-specific specialists — and break each one down on the things that actually matter:
            real pricing, payment methods, integrations, settlement times, and what merchants say
            after living with them.
          </p>
        </Prose>
      </section>

      <section className="mt-12">
        <div className="grid gap-4 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-lg border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
                <v.Icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-h4 text-foreground">{v.title}</h2>
              <p className="mt-2 text-body text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 max-w-prose">
        <Prose>
          <h2>How we make money</h2>
          <p>
            PayCompare is free for merchants. We’re funded by sponsored placements and affiliate
            links, both of which are clearly disclosed. This never changes a processor’s rating or
            review content — read exactly how on our <Link href="/methodology">methodology</Link>{" "}
            page.
          </p>
        </Prose>
      </section>

      <section className="mt-12 flex flex-wrap gap-3">
        <Link href="/processors" className={cn(buttonVariants({ variant: "primary" }))}>
          Browse processors
        </Link>
        <Link href="/contact" className={cn(buttonVariants({ variant: "secondary" }))}>
          Get in touch
        </Link>
      </section>
    </div>
  );
}
