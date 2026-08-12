import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/public/SearchBox";
import { CategoryCard } from "@/components/public/CategoryCard";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { BlogCard } from "@/components/public/BlogCard";
import { LeadDialog } from "@/components/public/LeadDialog";
import { Blocks } from "@/components/public/Blocks";
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
import { faqJsonLd } from "@/lib/seo";
import { POPULAR_COMPARE_PAIRS, compareHref } from "@/lib/compare-pairs";
import { getPageSeo, pageSeoMetadata } from "@/lib/page-seo";
import { FaqSection } from "@/components/public/FaqSection";
import { formatCount } from "@/lib/utils";
import { resolveHomepage, type HomeSectionKey } from "@/lib/homepage";
import { homeIcon } from "@/lib/home-icons";

/** Homepage (PRD §9.1). SSG + ISR. */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  // Editable via admin → Landing page ("SEO & meta" tab, the "home" PageSeo
  // record); falls back to the copy below.
  return pageSeoMetadata({
    pageKey: "home",
    title:
      "Payment Processing Guide | Expert Guides, Gateways and Merchant Services",
    description:
      "Compare payment processing platforms, merchant services providers, and credit card processing services on fees, features, and verified merchant reviews.",
    // Kept in sync with the "home" PageSeo record (scripts/seed-seo.ts), which
    // overrides this whenever it exists. Terms owned by other pages — "online
    // payment processing" (/processors), "online payment gateway" (/glossary/
    // payment-gateway), "payment processing fees" (fees blog) — stay off the homepage.
    keywords: [
      "payment processing guide",
      "payment processing platform",
      "payment processing software",
      "merchant services provider",
      "merchant service providers",
      "credit card processing services",
      "business payment solutions",
    ],
    path: "/",
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  // Settings first, on its own: every fetch below is sized by the landing-page
  // config it carries. `getOrCreateSiteSettings` is request-cached, so the layout
  // reading it too costs nothing.
  const settings = await getOrCreateSiteSettings().catch(() => null);
  const home = resolveHomepage(settings);

  // A disabled section fetches nothing. Note the `> 0` guards: Mongo reads
  // `.limit(0)` as "no limit", so passing a zero count straight through would
  // fetch the ENTIRE collection for a section that renders nothing.
  const categoriesLimit = home.categories.enabled ? home.categories.limit : 0;
  const featuredLimit = home.featured.enabled ? home.featured.limit : 0;
  const comparePairs = home.compare.enabled ? home.compare.limit : 0;
  const blogLimit = home.blog.enabled ? home.blog.limit : 0;

  const [allCategories, featured, topRated, stats, recentPosts, pageSeo] = await Promise.all([
    categoriesLimit > 0 ? getPublishedCategories() : Promise.resolve([]),
    featuredLimit > 0 ? getFeaturedProcessors(featuredLimit) : Promise.resolve([]),
    // Two processors per "A vs B" card.
    comparePairs > 0 ? getTopRatedProcessors(comparePairs * 2) : Promise.resolve([]),
    home.hero.statsEnabled ? getDirectoryStats() : Promise.resolve(null),
    blogLimit > 0 ? getRecentBlogPosts(blogLimit) : Promise.resolve([]),
    getPageSeo("home"),
  ]);

  const featuredCategories =
    categoriesLimit > 0
      ? pickFeaturedCategories(
          allCategories,
          { featuredCategorySlugs: settings?.featuredCategorySlugs ?? [] },
          categoriesLimit,
        )
      : [];

  /**
   * "A vs B" cards, drawn from the top-rated processors.
   *
   * Curated pairs are picked FIRST, because only a curated pair has a pretty,
   * indexable `/compare/a-vs-b` URL — everything else falls back to the noindex
   * `?ids=` tool (see `compareHref`). Pairing purely by rank, as this used to,
   * spent the homepage's three strongest internal links on URLs that tell Google
   * not to index them while the 20 curated pages the sitemap advertises got none.
   * Rank order still decides which curated pairs win, and any leftover slots fall
   * back to sequential pairing so the section never renders short.
   */
  const quickPicks: { a: (typeof topRated)[number]; b: (typeof topRated)[number] }[] = [];
  const bySlug = new Map(topRated.map((p) => [p.slug, p]));
  const used = new Set<string>();
  for (const [aSlug, bSlug] of POPULAR_COMPARE_PAIRS) {
    if (quickPicks.length >= comparePairs) break;
    const a = bySlug.get(aSlug);
    const b = bySlug.get(bSlug);
    if (!a || !b || used.has(aSlug) || used.has(bSlug)) continue;
    quickPicks.push({ a, b });
    used.add(aSlug);
    used.add(bSlug);
  }
  const leftovers = topRated.filter((p) => !used.has(p.slug));
  for (let i = 0; i + 1 < leftovers.length && quickPicks.length < comparePairs; i += 2) {
    quickPicks.push({ a: leftovers[i]!, b: leftovers[i + 1]! });
  }

  const statItems = stats
    ? [
        { value: stats.processors, label: home.hero.statProcessorsLabel },
        { value: stats.reviews, label: home.hero.statReviewsLabel },
        { value: stats.categories, label: home.hero.statCategoriesLabel },
      ].filter((s) => s.value > 0)
    : [];

  const faqs = pageSeo?.faqs ?? [];
  const showFaqs = home.faq.enabled && faqs.length > 0;
  const blocks = pageSeo?.blocks ?? [];
  const showBlocks = home.content.enabled && blocks.length > 0;

  /**
   * Sections that will actually render, in the admin-configured order. Resolved
   * before rendering so the alternating background can be computed over what's
   * on the page rather than over the config — otherwise reordering or emptying a
   * section would leave two tinted bands touching.
   */
  const visible = home.sectionOrder.filter((key) => {
    switch (key) {
      case "categories":
        return featuredCategories.length > 0;
      case "featured":
        return featured.length > 0;
      case "howItWorks":
        return home.howItWorks.enabled;
      case "compare":
        return quickPicks.length > 0;
      case "blog":
        return recentPosts.length > 0;
      case "content":
        return showBlocks;
      case "ctaBand":
        return home.ctaBand.enabled && home.ctaBand.cards.length > 0;
      case "faq":
        return showFaqs;
      default:
        return false;
    }
  });

  const renderSection = (key: HomeSectionKey, tinted: boolean) => {
    const band = tinted ? "border-t bg-ink-50/60 dark:bg-ink-900/30" : "border-t";
    const inner = "mx-auto max-w-content px-4 py-16 lg:px-6 lg:py-20";

    switch (key) {
      case "categories":
        return (
          <section key={key} className={band}>
            <div className={inner}>
              <SectionHeading section={home.categories} />
              <RevealGroup className="mt-8 grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                {featuredCategories.map((c) => (
                  <RevealItem key={c.slug} className="h-full">
                    <CategoryCard category={c} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </section>
        );

      case "featured":
        return (
          <section key={key} className={band}>
            <div className={inner}>
              <SectionHeading section={home.featured} />
              <RevealGroup className="mt-8 grid gap-4 md:grid-cols-2">
                {featured.map((p) => (
                  <RevealItem key={p.id}>
                    <ProcessorCard processor={p} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </section>
        );

      case "howItWorks":
        return (
          // The hero's default secondary button links to this anchor.
          <section key={key} id="how-it-works" className={`scroll-mt-20 ${band}`}>
            <div className={inner}>
              <SectionHeading section={home.howItWorks} />
              {home.howItWorks.steps.length > 0 && (
                <ol className="mt-8 grid gap-6 md:grid-cols-3">
                  {home.howItWorks.steps.map((step, i) => {
                    const Icon = homeIcon(step.icon);
                    return (
                      <li key={`${step.title}-${i}`} className="rounded-lg border bg-card p-6">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <span className="text-label uppercase text-ink-500">Step {i + 1}</span>
                        </div>
                        {step.title && <h3 className="mt-4 text-h3 text-foreground">{step.title}</h3>}
                        {step.body && (
                          <p className="mt-2 text-body text-muted-foreground">{step.body}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        );

      case "compare":
        return (
          <section key={key} className={band}>
            <div className={inner}>
              <SectionHeading section={home.compare} />
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quickPicks.map(({ a, b }) => (
                  <Link
                    key={`${a.slug}-${b.slug}`}
                    href={compareHref([a.slug, b.slug])}
                    className="group flex items-center justify-between gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-border-strong"
                  >
                    <span className="text-h4 text-foreground">
                      {a.name} <span className="text-muted-foreground">vs</span> {b.name}
                    </span>
                    <GitCompare
                      className="size-5 shrink-0 text-ink-400 transition-colors group-hover:text-accent"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );

      case "blog":
        return (
          <section key={key} className={band}>
            <div className={inner}>
              <SectionHeading section={home.blog} />
              <RevealGroup className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recentPosts.map((post) => (
                  <RevealItem key={post.id}>
                    <BlogCard post={post} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </section>
        );

      case "content":
        return (
          <section key={key} className={band}>
            <div className={inner}>
              {home.content.title && (
                <h2 className="text-h1 tracking-tighter2 text-foreground">{home.content.title}</h2>
              )}
              <Reveal>
                <Blocks blocks={blocks} className={home.content.title ? "mt-8" : undefined} />
              </Reveal>
            </div>
          </section>
        );

      case "ctaBand":
        return (
          <section key={key} className={band}>
            <div className="mx-auto grid max-w-content gap-4 px-4 py-16 md:grid-cols-2 lg:px-6 lg:py-20">
              {home.ctaBand.cards.map((card, i) => {
                const Icon = homeIcon(card.icon);
                return (
                  <div
                    key={`${card.href}-${i}`}
                    className="flex flex-col items-start rounded-lg border bg-card p-8"
                  >
                    <span className="flex size-10 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-h3 text-foreground">{card.title}</h3>
                    {card.body && <p className="mt-2 text-body text-muted-foreground">{card.body}</p>}
                    {card.cta && (
                      <Button asChild variant="secondary" className="mt-5">
                        <Link href={card.href}>{card.cta}</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );

      case "faq":
        return (
          <section key={key} className={band}>
            <div className={inner}>
              <FaqSection faqs={faqs} title={home.faq.title} className="max-w-3xl" />
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/*
        Organization + WebSite are NOT emitted here — `app/(public)/layout.tsx`
        emits them as an @graph on every public page. Re-adding them here would
        declare the same two entities twice on the homepage.

        FAQPage is tied to `showFaqs`, not to the FAQs merely existing: Google
        requires the Q&As to be visible on the page, so hiding the section must
        take its schema with it.
      */}
      <JsonLd data={showFaqs ? [faqJsonLd(faqs)] : []} />

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto max-w-content px-4 py-20 lg:px-6 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            {home.hero.eyebrow && (
              <p className="text-label uppercase text-ink-500">{home.hero.eyebrow}</p>
            )}
            <h1 className="text-display text-foreground">{home.hero.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-body-lg text-muted-foreground">
              {home.hero.subtitle}
            </p>

            {home.hero.searchEnabled && (
              <div className="mx-auto mt-8 max-w-xl">
                <SearchBox size="lg" placeholder={home.hero.searchPlaceholder} />
              </div>
            )}

            {(home.hero.primaryCtaEnabled || home.hero.secondaryCtaEnabled) && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {home.hero.primaryCtaEnabled && (
                  <LeadDialog
                    source="home-hero"
                    triggerLabel={home.hero.primaryCtaLabel}
                    triggerVariant="accent"
                    triggerSize="lg"
                  />
                )}
                {home.hero.secondaryCtaEnabled && (
                  <Button asChild variant="secondary" size="lg">
                    <Link href={home.hero.secondaryCtaHref}>{home.hero.secondaryCtaLabel}</Link>
                  </Button>
                )}
              </div>
            )}

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

      {visible.map((key, i) => renderSection(key, i % 2 === 1))}
    </>
  );
}

/**
 * Eyebrow + heading + optional intro paragraph + optional "see all" link. Both
 * link fields must be set to render the link.
 *
 * The intro sits under the heading rather than beside it: it's a full sentence
 * or two, and the "see all" link stays pinned to the heading row so it doesn't
 * drift half a paragraph away from the H2 it belongs to.
 */
function SectionHeading({
  section,
}: {
  section: {
    eyebrow: string;
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  };
}) {
  const showAction = Boolean(section.actionLabel && section.actionHref);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {section.eyebrow && <p className="text-label uppercase text-ink-500">{section.eyebrow}</p>}
          <h2 className="mt-2 text-h1 tracking-tighter2 text-foreground">{section.title}</h2>
        </div>
        {showAction && (
          <Link
            href={section.actionHref}
            className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
          >
            {section.actionLabel}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {section.description && (
        <p className="mt-3 max-w-3xl text-body text-muted-foreground">{section.description}</p>
      )}
    </div>
  );
}
