import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ListOrdered, ScrollText, ShieldCheck } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Prose } from "@/components/public/Prose";
import { JsonLd } from "@/components/public/JsonLd";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";

/** Methodology (PRD §9.7). How we rank & verify — static editorial, SSG. */
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Methodology — how we rank & verify",
    description:
      "How PayCompare ranks payment processors, what a verified badge means, how reviews are collected and verified, and how sponsorship is disclosed.",
    path: "/methodology",
  });
}

const RANK_STEPS = [
  {
    title: "1 · Sponsored placements",
    body: "Processors with a paid sponsored placement appear first, ordered by their sponsor rank. Every sponsored listing carries a clear “Sponsored” label on the card — it is never hidden.",
  },
  {
    title: "2 · Listing tier",
    body: "Next, remaining processors are grouped by listing tier: Premier, then Verified, then Free. A higher tier reflects a more complete, maintained profile — not a higher rating.",
  },
  {
    title: "3 · Rank score",
    body: "Within each tier, processors are ordered by a computed rank score — a weighted blend of their average rating (60%), review volume on a log scale so a handful of reviews can’t outweigh hundreds (25%), and our editorial score (15%).",
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Methodology", path: "/methodology" },
        ])}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Methodology" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">How we rank and verify</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          PayCompare is an independent directory. Here’s exactly how listings are ordered, what our
          badges mean, and how we handle reviews and sponsorship — so you can judge what you read.
        </p>
      </header>

      {/* Ranking */}
      <section className="mt-12 max-w-prose">
        <div className="flex items-center gap-2 text-accent">
          <ListOrdered className="size-5" aria-hidden />
          <h2 className="text-h2 tracking-tighter2 text-foreground">How processors are ranked</h2>
        </div>
        <p className="mt-3 text-body-lg text-ink-700 dark:text-ink-300">
          The default “Recommended” order on directory and category pages is applied in three stages,
          in this exact priority:
        </p>
        <ol className="mt-6 space-y-4">
          {RANK_STEPS.map((step) => (
            <li key={step.title} className="rounded-lg border bg-card p-5">
              <h3 className="text-h4 text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-body text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-body text-muted-foreground">
          You can override this any time with the sort control — Highest rated, Most reviewed, Lowest
          fees, or Newest. Those orders are applied as you’d expect and do not pin sponsored listings.
        </p>
      </section>

      {/* Verified */}
      <section className="mt-14 max-w-prose">
        <div className="flex items-center gap-2 text-accent">
          <BadgeCheck className="size-5" aria-hidden />
          <h2 className="text-h2 tracking-tighter2 text-foreground">What “Verified” means</h2>
        </div>
        <Prose className="mt-3">
          <p>
            A <strong>Verified</strong> badge means we’ve confirmed the processor is a genuine,
            operating business and that the core facts on its profile — pricing model, supported
            regions, and payment methods — match its official documentation at the time of review.
          </p>
          <p>
            Verification is about authenticity, not endorsement. It doesn’t mean a processor is the
            cheapest or the best fit for you — only that what you’re reading is accurate. Fees change
            often, so always confirm current pricing directly with the provider before signing up.
          </p>
        </Prose>
      </section>

      {/* Reviews */}
      <section className="mt-14 max-w-prose">
        <div className="flex items-center gap-2 text-accent">
          <ShieldCheck className="size-5" aria-hidden />
          <h2 className="text-h2 tracking-tighter2 text-foreground">
            How reviews are collected and verified
          </h2>
        </div>
        <Prose className="mt-3">
          <p>
            Reviews are submitted by real merchants through our{" "}
            <Link href="/write-review">write-a-review</Link> form. Every submission is held for
            moderation and is <strong>never shown publicly until a human approves it</strong>. We
            check for spam, conflicts of interest, and off-topic content before publishing.
          </p>
          <p>
            Reviewers provide a private email so we can confirm they’re a genuine customer. Reviews
            from confirmed merchants are marked <strong>Verified</strong>. A processor’s star rating
            and sub-ratings are computed only from approved reviews and update automatically as new
            ones are published or removed — they’re never edited by hand.
          </p>
        </Prose>
      </section>

      {/* Sponsorship */}
      <section className="mt-14 max-w-prose">
        <div className="flex items-center gap-2 text-accent">
          <ScrollText className="size-5" aria-hidden />
          <h2 className="text-h2 tracking-tighter2 text-foreground">Sponsorship & disclosure</h2>
        </div>
        <Prose className="mt-3">
          <p>
            PayCompare is free for merchants. We’re funded by sponsored placements and affiliate
            links — when you click “Visit website” we may earn a commission, at no cost to you. These
            links are marked with <code className="rounded bg-ink-100 px-1 text-small dark:bg-ink-800">rel=&quot;sponsored&quot;</code> and we tag affiliate clicks for our own analytics.
          </p>
          <p>
            Sponsorship affects <strong>placement only</strong> — it never influences a processor’s
            star rating, sub-ratings, review content, or editorial score, and sponsored listings are
            always labelled. Our reviews and rankings stay independent of any commercial relationship.
          </p>
        </Prose>
      </section>

      {/* CTA */}
      <section className="mt-16 max-w-prose rounded-lg border bg-ink-50 p-6 dark:bg-ink-900">
        <h2 className="text-h3 tracking-tighter2 text-foreground">Questions about our methodology?</h2>
        <p className="mt-2 text-body text-muted-foreground">
          We aim to be transparent. If something looks wrong on a profile, let us know.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
          >
            Contact us →
          </Link>
        </div>
      </section>
    </div>
  );
}
