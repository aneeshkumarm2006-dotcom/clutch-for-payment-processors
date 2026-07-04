import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, GitCompare, PencilLine, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/public/SearchBox";
import { CategoryCard } from "@/components/public/CategoryCard";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { BlogCard } from "@/components/public/BlogCard";
import { LeadDialog } from "@/components/public/LeadDialog";
import { Reveal, RevealGroup, RevealItem } from "@/components/public/Reveal";
import { JsonLd } from "@/components/public/JsonLd";
import { getOrCreateSiteSettings } from "@/lib/settings";
import {
  getDirectoryStats,
  getFeaturedProcessors,
  getPublishedCategories,
  getRecentBlogPosts,
  getTopRatedProcessors,
  pickFeaturedCategories,
} from "@/lib/public-data";
import { buildMetadata, organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
import { formatCount } from "@/lib/utils";

/** Homepage (PRD §9.1). SSG + ISR. */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrCreateSiteSettings().catch(() => null);
  return buildMetadata({
    title:
      "PaymentProcessingGuide | Expert Payment Processing Guides, Gateways & Merchant Services",
    description:
      "PaymentProcessingGuide is your trusted resource for payment processing guides, payment gateways, merchant accounts, transaction fees, payment security, fraud prevention, and digital payment solutions.",
    path: "/",
    absoluteTitle: true,
    // An admin-set Default SEO (Settings) still wins over the copy above.
    seo: settings?.defaultSeo,
  });
}

const STEPS = [
  {
    Icon: Search,
    title: "Browse",
    body: "Filter the directory by fees, payment methods, integrations, region, and use case.",
  },
  {
    Icon: GitCompare,
    title: "Compare",
    body: "Put 2–4 processors side by side on pricing, features, and verified merchant reviews.",
  },
  {
    Icon: CheckCircle2,
    title: "Decide",
    body: "Read real reviews, check the methodology, and pick the processor that fits your business.",
  },
];

export default async function HomePage() {
  const [settings, allCategories, featured, topRated, stats, recentPosts] = await Promise.all([
    getOrCreateSiteSettings().catch(() => null),
    getPublishedCategories(),
    getFeaturedProcessors(6),
    getTopRatedProcessors(4),
    getDirectoryStats(),
    getRecentBlogPosts(3),
  ]);

  const heroTitle = settings?.homepageHeroTitle || "Payment Processing Guide: Your Trusted Payment Processing Resource";
  const heroSubtitle =
    settings?.homepageHeroSubtitle ||
    "Compare fees, features, and verified merchant reviews — all in one independent directory.";

  const featuredCategories = pickFeaturedCategories(
    allCategories,
    { featuredCategorySlugs: settings?.featuredCategorySlugs ?? [] },
    8,
  );

  // Compare teaser quick-picks: pair up the top-rated processors.
  const quickPicks: { a: (typeof topRated)[number]; b: (typeof topRated)[number] }[] = [];
  for (let i = 0; i + 1 < topRated.length && quickPicks.length < 3; i += 2) {
    quickPicks.push({ a: topRated[i]!, b: topRated[i + 1]! });
  }

  const statItems = [
    { value: stats.processors, label: "processors reviewed" },
    { value: stats.reviews, label: "verified reviews" },
    { value: stats.categories, label: "categories" },
  ].filter((s) => s.value > 0);

  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd({
            name: settings?.siteName,
            logo: settings?.logo,
            sameAs: Object.values(settings?.socialLinks ?? {}).filter(
              (v): v is string => typeof v === "string" && v.length > 0,
            ),
            email: settings?.contactEmail,
          }),
          webSiteJsonLd({ name: settings?.siteName }),
        ]}
      />

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto max-w-content px-4 py-20 lg:px-6 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-display text-foreground">{heroTitle}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-body-lg text-muted-foreground">{heroSubtitle}</p>

            <div className="mx-auto mt-8 max-w-xl">
              <SearchBox size="lg" placeholder="Search by name, e.g. Stripe, ACH, high-risk…" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <LeadDialog
                source="home-hero"
                triggerLabel="Get matched"
                triggerVariant="accent"
                triggerSize="lg"
              />
              <Button asChild variant="secondary" size="lg">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>

            {statItems.length > 0 && (
              <dl className="mx-auto mt-12 flex max-w-lg flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {statItems.map((s) => (
                  <div key={s.label} className="text-center">
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      <span className="block text-h2 tabular-nums text-foreground">
                        {formatCount(s.value)}
                      </span>
                      <span className="text-small text-muted-foreground">{s.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      {/* Popular categories */}
      {featuredCategories.length > 0 && (
        <section className="mx-auto max-w-content px-4 py-16 lg:px-6 lg:py-20">
          <SectionHeading
            eyebrow="Browse by need"
            title="Popular categories"
            action={{ label: "All categories", href: "/processors" }}
          />
          <RevealGroup className="mt-8 grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {featuredCategories.map((c) => (
              <RevealItem key={c.slug} className="h-full">
                <CategoryCard category={c} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* Featured / top-rated processors */}
      {featured.length > 0 && (
        <section className="border-t bg-ink-50/60 dark:bg-ink-900/30">
          <div className="mx-auto max-w-content px-4 py-16 lg:px-6 lg:py-20">
            <SectionHeading
              eyebrow="Editor & merchant picks"
              title="Featured processors"
              action={{ label: "View all processors", href: "/processors" }}
            />
            <RevealGroup className="mt-8 grid gap-4 md:grid-cols-2">
              {featured.map((p) => (
                <RevealItem key={p.id}>
                  <ProcessorCard processor={p} />
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-t">
        <div className="mx-auto max-w-content px-4 py-16 lg:px-6 lg:py-20">
          <SectionHeading eyebrow="How it works" title="From shortlist to decision in minutes" />
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
                    <step.Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-label uppercase text-ink-500">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-h3 text-foreground">{step.title}</h3>
                <p className="mt-2 text-body text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Compare teaser */}
      {quickPicks.length > 0 && (
        <section className="border-t bg-ink-50/60 dark:bg-ink-900/30">
          <div className="mx-auto max-w-content px-4 py-16 lg:px-6 lg:py-20">
            <SectionHeading
              eyebrow="Side by side"
              title="Compare popular processors"
              action={{ label: "Open compare", href: "/compare" }}
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quickPicks.map(({ a, b }) => (
                <Link
                  key={`${a.slug}-${b.slug}`}
                  href={`/compare?ids=${a.slug},${b.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-border-strong"
                >
                  <span className="text-h4 text-foreground">
                    {a.name} <span className="text-muted-foreground">vs</span> {b.name}
                  </span>
                  <GitCompare className="size-5 shrink-0 text-ink-400 transition-colors group-hover:text-accent" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* From the blog */}
      {recentPosts.length > 0 && (
        <section className="border-t">
          <div className="mx-auto max-w-content px-4 py-16 lg:px-6 lg:py-20">
            <SectionHeading
              eyebrow="Guides & comparisons"
              title="From the blog"
              action={{ label: "All articles", href: "/blog" }}
            />
            <RevealGroup className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recentPosts.map((post) => (
                <RevealItem key={post.id}>
                  <BlogCard post={post} />
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* Dual CTA band */}
      <section className="border-t">
        <div className="mx-auto grid max-w-content gap-4 px-4 py-16 md:grid-cols-2 lg:px-6 lg:py-20">
          <CtaCard
            Icon={PencilLine}
            title="Used a processor? Write a review"
            body="Share your real merchant experience and help other businesses choose."
            href="/write-review"
            cta="Write a review"
          />
          <CtaCard
            Icon={Store}
            title="Run a payment company? Get listed"
            body="Add your processor to the directory and reach businesses comparing options."
            href="/for-processors"
            cta="List your processor"
          />
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-label uppercase text-ink-500">{eyebrow}</p>
        <h2 className="mt-2 text-h1 tracking-tighter2 text-foreground">{title}</h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
        >
          {action.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function CtaCard({
  Icon,
  title,
  body,
  href,
  cta,
}: {
  Icon: typeof Store;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-lg border bg-card p-8">
      <span className="flex size-10 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-h3 text-foreground">{title}</h3>
      <p className="mt-2 text-body text-muted-foreground">{body}</p>
      <Button asChild variant="secondary" className="mt-5">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
