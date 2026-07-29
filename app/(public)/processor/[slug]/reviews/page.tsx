import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react";
import { cn, formatCount, formatRating } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  getApprovedReviews,
  getProcessorBySlug,
  getReviewIndustries,
  REVIEWS_FULL_PAGE_SIZE,
} from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";
import { applySeoRedirect } from "@/lib/seo-redirect";
import { buildStructuredData } from "@/lib/engine";
import { toEngineContext } from "@/lib/engine/context";
import { toProcessorReviewsEngineEntity } from "@/lib/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { Blocks } from "@/components/public/Blocks";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { FaqSection } from "@/components/public/FaqSection";
import { JsonLd } from "@/components/public/JsonLd";
import { RatingBreakdown } from "@/components/public/RatingBreakdown";
import { RatingStars } from "@/components/public/RatingStars";
import { VisitWebsiteButton } from "@/components/public/VisitWebsiteButton";
import { ReviewCard } from "@/components/public/reviews/ReviewCard";
import { ReviewFilters } from "@/components/public/reviews/ReviewFilters";
import {
  isFilteredQuery,
  parseReviewQuery,
  reviewsHref,
  type ReviewQuery,
} from "@/components/public/reviews/params";

/**
 * A processor's reviews archive (`/processor/<slug>/reviews`).
 *
 * Every approved review for one processor, server-rendered and paginated, with an
 * editorial layer underneath that an admin composes from the same block library
 * the rest of the site uses (Processor form → "Reviews page" tab).
 *
 * Three things about this page are SEO decisions rather than UI ones:
 *
 * 1. **The reviews are in the HTML.** Filters and pagination navigate to real
 *    URLs and the server re-renders; nothing about the list depends on JS. On a
 *    page whose entire ranking case is "unique, first-hand text about {name}",
 *    fetching that text after hydration throws the case away.
 * 2. **Filtered views are `noindex`.** Sort × rating × industry × mention is a
 *    combinatorial set of URLs over the SAME reviews. Same reasoning as
 *    `/compare?ids=`. Pagination is NOT filtered: `?page=2` holds reviews that
 *    exist nowhere else, so it stays indexable with a self-referencing canonical.
 * 3. **A page with no reviews noindexes itself.** It still renders (it is linked
 *    from the profile and it is where the "write a review" CTA lands), but until
 *    a merchant has actually written something there is nothing here worth
 *    indexing. `getSitemapEntries` applies the same rule from the other side.
 *
 * The profile keeps a summary and links here. See `ReviewsSummary` for why the
 * depth lives on one URL rather than both.
 */
/**
 * No `generateStaticParams` here, unlike the profile and the alternatives page.
 * Reading `searchParams` opts a route into dynamic rendering, so prerendering a
 * list of slugs would buy nothing and only imply a caching story that isn't true.
 * `revalidate` still bounds the data-cache behind the queries.
 */
export const revalidate = 1800;

type SearchParams = Record<string, string | string[] | undefined>;

/** Copy the page falls back to when an editor hasn't written its own. */
function defaultCopy(name: string, count: number) {
  return {
    heading: `${name} reviews`,
    title:
      count > 0
        ? `${name} reviews: ${count} verified merchant rating${count === 1 ? "" : "s"}`
        : `${name} reviews from real merchants`,
    description:
      count > 0
        ? `Read all ${count} ${name} review${count === 1 ? "" : "s"} from verified merchants, with ratings for pricing, support, ease of use, features, and reliability.`
        : `Merchant reviews of ${name}, rated on pricing, support, ease of use, features, and reliability. Share your own experience.`,
    intro:
      count > 0
        ? `What merchants say about ${name} after running payments through it, rated on pricing, support, ease of use, features, and reliability.`
        : `No merchant has reviewed ${name} yet. If you process payments with them, yours would be the first.`,
  };
}

/**
 * Is there enough here to be worth indexing?
 *
 * Reviews OR an editor's own sections. Kept as one named rule because the sitemap
 * has to agree with it: listing a URL that answers `noindex` is a contradiction
 * Search Console reports as an error.
 */
function hasReviewContent(count: number, blocks?: unknown[], faqs?: unknown[]): boolean {
  return count > 0 || Boolean(blocks?.length) || Boolean(faqs?.length);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}): Promise<Metadata> {
  const p = await getProcessorBySlug(params.slug);
  if (!p) return { title: "Reviews not found" };

  const rp = p.reviewsPage;
  const query = parseReviewQuery(searchParams);
  const basePath = `/processor/${p.slug}/reviews`;
  const copy = defaultCopy(p.name, p.ratingCount);
  const filtered = isFilteredQuery(query);
  const indexable = hasReviewContent(p.ratingCount, rp?.blocks, rp?.faqs);

  /**
   * Canonical is SELF-referencing in every state, including filtered ones.
   *
   * The tempting alternative, pointing a filtered URL's canonical at the clean
   * one, contradicts the `noindex` it also carries: canonical says "index that
   * other page instead", noindex says "index nothing here". Google's guidance is
   * to pick one signal, so the page picks noindex and lets the canonical simply
   * describe the URL it is on.
   */
  const canonicalPath = reviewsHref(basePath, query);

  // Page 2+ says so in the title. Two indexable URLs sharing one title look like
  // duplicates in a report even when their content is entirely different.
  const pageSuffix = query.page > 1 ? ` (page ${query.page})` : "";

  return buildMetadata({
    title: `${copy.title}${pageSuffix}`,
    description: copy.description,
    path: basePath,
    canonicalPath,
    image: p.logo,
    seo: rp?.seo,
    keywords: rp?.seo?.keywords,
    ...(filtered || !indexable ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function ProcessorReviewsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  const p = await getProcessorBySlug(params.slug);
  if (!p) notFound();

  const rp = p.reviewsPage;
  const basePath = `/processor/${p.slug}/reviews`;
  // A redirect set on this page wins over one set on the listing as a whole; the
  // listing's own redirect still applies, because a retired processor takes its
  // reviews page with it.
  applySeoRedirect(rp?.seo, basePath);
  applySeoRedirect(p.seo, basePath);

  const query = parseReviewQuery(searchParams);
  const [result, industries, settings] = await Promise.all([
    getApprovedReviews({
      processorId: p.id,
      sort: query.sort,
      page: query.page,
      limit: REVIEWS_FULL_PAGE_SIZE,
      industry: query.industry,
      verifiedOnly: query.verifiedOnly,
      minRating: query.minRating,
      mention: query.mention,
    }),
    getReviewIndustries(p.id),
    getOrCreateSiteSettings().catch(() => null),
  ]);

  // Out-of-range pages are a 404, not an empty list. They are reachable by hand
  // and by a stale crawl after reviews are removed, and a soft-404 that renders
  // chrome around nothing is the one outcome worth avoiding.
  if (query.page > 1 && result.items.length === 0) notFound();

  const copy = defaultCopy(p.name, p.ratingCount);
  const heading = rp?.heading?.trim() || copy.heading;
  const intro = rp?.intro?.trim() || copy.intro;
  const primaryCategory = p.categories[0];
  const hasReviews = p.ratingCount > 0;
  const filtered = isFilteredQuery(query);

  // An FAQ block renders its own section inside <Blocks>; showing `faqs` as well
  // would ask the reader the same questions twice. Same rule as the profile.
  const hasFaqBlock = Boolean(rp?.blocks?.some((b) => b.type === "faq"));
  const showFaqs = !hasFaqBlock && Boolean(rp?.faqs?.length);

  // Schema from the same engine every other page uses: Product + AggregateRating
  // + the reviews THIS page shows, BreadcrumbList, and whatever the editor's
  // FAQs/blocks add.
  const { nodes } = buildStructuredData(
    "processorReviews",
    toProcessorReviewsEngineEntity(p, result.items.slice(0, 10)),
    toEngineContext(settings),
  );

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd data={nodes} />

      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Processors", href: "/processors" },
          ...(primaryCategory
            ? [{ name: primaryCategory.name, href: `/category/${primaryCategory.slug}` }]
            : []),
          { name: p.name, href: `/processor/${p.slug}` },
          { name: "Reviews" },
        ]}
      />

      {/* Header */}
      <header className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-ink-0">
            {p.logo ? (
              <Image
                src={p.logo}
                alt={`${p.name} logo`}
                width={56}
                height={56}
                className="size-14 object-contain p-2"
                unoptimized
              />
            ) : (
              <span className="text-h3 font-semibold text-ink-400">
                {p.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-h1 tracking-tighter2 text-foreground">{heading}</h1>
            <div className="mt-2">
              <RatingStars
                value={p.ratingAverage}
                count={p.ratingCount}
                showValue
                showCount
                emptyLabel="No reviews yet"
                size={16}
              />
            </div>
            <p className="mt-3 max-w-prose text-body-lg text-muted-foreground">{intro}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
          <Link
            href={`/write-review/${p.slug}`}
            className={cn(buttonVariants({ variant: "accent" }), "flex-1 lg:flex-none lg:w-full")}
          >
            Write a review
          </Link>
          <VisitWebsiteButton
            website={p.website}
            affiliateUrl={p.affiliateUrl}
            slug={p.slug}
            variant="secondary"
            className="flex-1 lg:flex-none lg:w-full"
          />
          <Link
            href={`/processor/${p.slug}`}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "flex-1 gap-1 lg:flex-none lg:w-full",
            )}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to profile
          </Link>
        </div>
      </header>

      {/* Aggregate + top mentions */}
      {hasReviews && (
        <section className="mt-10 rounded-lg border border-border bg-card p-6">
          <h2 className="sr-only">{p.name} rating summary</h2>
          <RatingBreakdown
            average={p.ratingAverage}
            count={p.ratingCount}
            subRatings={p.subRatings}
          />

          {p.topMentions.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-label uppercase text-ink-500">Top mentions</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {p.topMentions.map((m) => {
                  const active = query.mention === m.keyword;
                  return (
                    <Link
                      key={m.keyword}
                      href={reviewsHref(basePath, {
                        ...query,
                        page: 1,
                        mention: active ? undefined : m.keyword,
                      })}
                      scroll={false}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-small font-medium transition-colors",
                        active
                          ? "border-accent bg-accent-subtle text-accent-subtle-foreground"
                          : "border-border bg-card text-ink-700 hover:border-border-strong hover:text-foreground dark:text-ink-300",
                      )}
                    >
                      {m.keyword}
                      <span className="text-micro tabular-nums text-muted-foreground">
                        {formatCount(m.count)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* The reviews */}
      <section id="all-reviews" className="mt-10 scroll-mt-24">
        <h2 className="text-h2 tracking-tighter2 text-foreground">
          {hasReviews
            ? `All ${formatCount(p.ratingCount)} ${p.name} review${p.ratingCount === 1 ? "" : "s"}`
            : `${p.name} reviews`}
        </h2>

        {hasReviews && (
          <ReviewFilters basePath={basePath} query={query} industries={industries} />
        )}

        {result.items.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-border py-16 text-center">
            <MessageSquareText className="size-8 text-muted-foreground" aria-hidden />
            <h3 className="mt-4 text-h4 text-ink-700 dark:text-ink-300">
              {filtered ? "No reviews match these filters" : `No reviews of ${p.name} yet`}
            </h3>
            <p className="mt-1 max-w-prose text-body text-muted-foreground">
              {filtered
                ? "Try widening the rating or industry filter."
                : "Reviews are written by merchants who use the processor and are moderated before they appear."}
            </p>
            {filtered ? (
              <Link href={basePath} className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}>
                Clear filters
              </Link>
            ) : (
              <Link
                href={`/write-review/${p.slug}`}
                className={cn(buttonVariants({ variant: "accent" }), "mt-6")}
              >
                Write the first review
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mt-5 text-small tabular-nums text-muted-foreground">
              Showing {result.items.length} of {result.total}
              {filtered ? " matching" : ""} review{result.total === 1 ? "" : "s"}
              {result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}
            </p>

            <div className="mt-4 space-y-4">
              {result.items.map((review) => (
                // Anchored so a single review can be linked to and cited directly.
                <div key={review.id} id={`review-${review.id}`} className="scroll-mt-24">
                  <ReviewCard review={review} />
                </div>
              ))}
            </div>

            {result.totalPages > 1 && (
              <ReviewsPagination
                basePath={basePath}
                query={query}
                page={result.page}
                totalPages={result.totalPages}
              />
            )}
          </>
        )}
      </section>

      {/* Editor-composed sections. Deliberately BELOW the reviews: the reviews are
          what the reader came for, and what the page is meant to rank on. */}
      {rp?.blocks?.length ? <Blocks blocks={rp.blocks} className="mt-16" /> : null}

      {showFaqs && <FaqSection faqs={rp?.faqs} className="mt-16 max-w-3xl" />}

      {/* Close with the two things a reader is here to do next. */}
      <section className="mt-16 rounded-lg border bg-card p-8 text-center">
        <h2 className="text-h3 text-foreground">
          {hasReviews
            ? `Used ${p.name}? Add your review`
            : `Be the first to review ${p.name}`}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground">
          Rate it on pricing, support, ease of use, features, and reliability. Reviews are moderated
          before they appear.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/write-review/${p.slug}`}
            className={cn(buttonVariants({ variant: "accent", size: "lg" }))}
          >
            Write a review
          </Link>
          <Link
            href={`/alternatives/${p.slug}`}
            className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
          >
            Compare {p.name} alternatives
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {hasReviews && (
        <p className="mt-8 text-small text-muted-foreground">
          Average of {formatRating(p.ratingAverage)} out of 5 across {formatCount(p.ratingCount)}{" "}
          approved review{p.ratingCount === 1 ? "" : "s"}. See how we score processors in our{" "}
          <Link href="/methodology" className="font-medium text-accent hover:underline">
            methodology
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/**
 * Real `<a>` pagination, so page 2 exists for a crawler and for a reader with no
 * JS. Buttons that refetch in place, which is what the profile used to do, leave
 * every review past the first page reachable only by running the script.
 */
function ReviewsPagination({
  basePath,
  query,
  page,
  totalPages,
}: {
  basePath: string;
  query: ReviewQuery;
  page: number;
  totalPages: number;
}) {
  const link = (target: number, label: string, icon: "prev" | "next") => {
    const disabled = icon === "prev" ? page <= 1 : page >= totalPages;
    if (disabled) {
      return (
        <span
          aria-disabled
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "pointer-events-none opacity-50",
          )}
        >
          {label}
        </span>
      );
    }
    return (
      <Link
        href={reviewsHref(basePath, { ...query, page: target })}
        rel={icon === "prev" ? "prev" : "next"}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Reviews pagination"
      className="mt-10 flex items-center justify-between border-t border-border pt-6"
    >
      {link(page - 1, "← Previous", "prev")}
      <span className="text-small tabular-nums text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {link(page + 1, "Next →", "next")}
    </nav>
  );
}
