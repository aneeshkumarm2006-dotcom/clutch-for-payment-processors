import type { Metadata } from "next";
import { BarChart3, Check, ShieldCheck, Star, TrendingUp, Users } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { SubmissionForm } from "@/components/public/SubmissionForm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";

/**
 * For Processors `/for-processors` (PRD §9.8). Marketing value props + the
 * Free/Verified/Premier tier cards + the get-listed submission form
 * (→ POST /api/submissions). SSG (static marketing) — `revalidate` not needed.
 */
export const metadata: Metadata = buildMetadata({
  title: "List your payment processor",
  description:
    "Reach businesses actively comparing payment processors. Add your processor to the PayCompare directory — free to start, with Verified and Premier tiers for more visibility.",
  path: "/for-processors",
});

const VALUE_PROPS = [
  {
    Icon: Users,
    title: "Reach high-intent buyers",
    body: "Get in front of businesses actively comparing processors and ready to switch.",
  },
  {
    Icon: TrendingUp,
    title: "Rank on the facets that matter",
    body: "Surface for the pricing models, payment methods, and features merchants filter by.",
  },
  {
    Icon: Star,
    title: "Build trust with reviews",
    body: "Collect verified merchant reviews that show up right on your profile and in search.",
  },
  {
    Icon: BarChart3,
    title: "Stand out in comparisons",
    body: "Appear in side-by-side compare tables where buyers make the final call.",
  },
];

interface Tier {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  featured?: boolean;
  badge?: string;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    blurb: "A complete listing to get discovered.",
    features: [
      "Full profile (pricing, features, company facts)",
      "Appears in the directory + search",
      "Collect merchant reviews",
    ],
  },
  {
    name: "Verified",
    price: "Contact us",
    blurb: "A trust badge and better placement.",
    featured: true,
    badge: "Most popular",
    features: [
      "Everything in Free",
      "Verified badge on your profile + cards",
      "Higher default ranking",
      "Featured in relevant categories",
    ],
  },
  {
    name: "Premier",
    price: "Contact us",
    blurb: "Top visibility across the site.",
    features: [
      "Everything in Verified",
      "Premier placement above the listing tier",
      "Sponsored slots on key directory pages",
      "Priority support",
    ],
  },
];

export default function ForProcessorsPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "For processors" }]} />

      {/* Hero */}
      <section className="mt-6 max-w-3xl">
        <Badge variant="neutral">For payment processors</Badge>
        <h1 className="mt-4 text-display text-foreground">List your processor on PayCompare</h1>
        <p className="mt-4 max-w-2xl text-body-lg text-muted-foreground">
          Get in front of businesses comparing payment processors right now. Start free, add a
          Verified badge, or go Premier for top placement.
        </p>
      </section>

      {/* Value props */}
      <section aria-label="Why list with us" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_PROPS.map((v) => (
          <div key={v.title} className="rounded-lg border border-border bg-card p-5">
            <span className="flex size-9 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
              <v.Icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-h4 text-foreground">{v.title}</h2>
            <p className="mt-1 text-small text-muted-foreground">{v.body}</p>
          </div>
        ))}
      </section>

      {/* Tier cards */}
      <section aria-label="Listing tiers" className="mt-16">
        <h2 className="text-h2 tracking-tighter2 text-foreground">Choose how you show up</h2>
        <p className="mt-2 max-w-prose text-body text-muted-foreground">
          Every listing starts free. Verified and Premier add trust signals and placement — tell us
          which you’re interested in below.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-lg border bg-card p-6",
                tier.featured ? "border-accent shadow-pop" : "border-border",
              )}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-6">
                  <Badge variant="premier">{tier.badge}</Badge>
                </span>
              )}
              <div className="flex items-center gap-2">
                {tier.name === "Verified" && <ShieldCheck className="size-5 text-accent" aria-hidden />}
                <h3 className="text-h3 tracking-tighter2 text-foreground">{tier.name}</h3>
              </div>
              <p className="mt-2 text-h2 tabular-nums text-foreground">{tier.price}</p>
              <p className="mt-1 text-small text-muted-foreground">{tier.blurb}</p>
              <ul className="mt-5 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-small text-ink-800 dark:text-ink-200">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Submission form */}
      <section id="submit" aria-label="Submit your processor" className="mt-16 max-w-3xl scroll-mt-24">
        <h2 className="text-h2 tracking-tighter2 text-foreground">Get listed</h2>
        <p className="mt-2 max-w-prose text-body text-muted-foreground">
          Send us the basics and we’ll set up your listing. No payment required to get started.
        </p>
        <div className="mt-6">
          <SubmissionForm />
        </div>
      </section>
    </div>
  );
}
