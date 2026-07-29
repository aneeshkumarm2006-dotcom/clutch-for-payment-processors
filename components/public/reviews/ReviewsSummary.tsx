import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReviewCardData, SubRatingsData, TopMentionData } from "@/lib/serialize";
import { cn, formatCount } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingBreakdown } from "@/components/public/RatingBreakdown";
import { ReviewCard } from "@/components/public/reviews/ReviewCard";

/**
 * The profile page's `#reviews` section — a teaser, not the archive.
 *
 * It shows the aggregate, the auto-derived topic chips, and the newest few
 * reviews, then hands off to `/processor/<slug>/reviews`, which holds every
 * review plus its own editorial sections.
 *
 * The split is deliberate and it is an SEO decision, not a layout one. Both pages
 * are about the same processor, so if the profile also carried the full, filterable
 * review archive the two would be competing for "{name} reviews" with substantially
 * the same text. Keeping the depth on one URL and a summary on the other gives
 * each a distinct job: the profile answers "what is {name} and what does it cost",
 * the reviews page answers "what do merchants say about {name}".
 *
 * A server component. The reviews are the content — they belong in the initial
 * HTML, and nothing here needs state (the interactive filters live on the reviews
 * page, where there is enough to filter).
 */
export function ReviewsSummary({
  processorName,
  processorSlug,
  average,
  count,
  subRatings,
  topMentions,
  reviews,
}: {
  processorName: string;
  processorSlug: string;
  average: number;
  count: number;
  subRatings: SubRatingsData;
  topMentions: TopMentionData[];
  /** The newest few approved reviews. */
  reviews: ReviewCardData[];
}) {
  const reviewsHref = `/processor/${processorSlug}/reviews`;
  const hasReviews = count > 0;

  return (
    <div className="mt-6 space-y-8">
      {hasReviews ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <RatingBreakdown average={average} count={count} subRatings={subRatings} />

          {/* Top mentions (DESIGN §6.4). Static here — filtering by one lives on
              the reviews page, which has the full set to filter. */}
          {topMentions.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-label uppercase text-ink-500">Top mentions</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {topMentions.map((m) => (
                  <Badge key={m.keyword} variant="neutral">
                    {m.keyword}
                    <span className="ml-1.5 text-micro tabular-nums text-muted-foreground">
                      {formatCount(m.count)}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          No reviews yet. Be the first to share your experience with {processorName}.
        </p>
      )}

      {reviews.length > 0 && (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          <Link
            href={reviewsHref}
            className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
          >
            Read all {formatCount(count)} {processorName} review{count === 1 ? "" : "s"}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/write-review/${processorSlug}`}
          className={cn(buttonVariants({ variant: "accent" }))}
        >
          Write a review
        </Link>
        <p className="text-small text-muted-foreground">
          Share your experience with {processorName}. Reviews are moderated before they appear.
        </p>
      </div>
    </div>
  );
}

export default ReviewsSummary;
