"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ReviewCardData, SubRatingsData, TopMentionData } from "@/lib/serialize";
import type { ReviewsResult, ReviewSort } from "@/lib/public-data";
import { cn, formatCount } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingBreakdown } from "@/components/public/RatingBreakdown";
import { ReviewCard } from "@/components/public/reviews/ReviewCard";

/**
 * ReviewsSection (PRD §9.3 #reviews) — the interactive reviews block on a
 * processor profile. Server-renders page 1 (good for SEO + no-JS), then filters,
 * sorts, and paginates client-side against `GET /api/reviews`. The summary uses
 * the processor's denormalized aggregate (computed by `lib/ratings.ts`), so it
 * always matches the badge elsewhere on the page.
 */

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest rated" },
  { value: "most-helpful", label: "Most helpful" },
];

const RATING_OPTIONS = [
  { value: "0", label: "All ratings" },
  { value: "4", label: "4 stars & up" },
  { value: "3", label: "3 stars & up" },
  { value: "2", label: "2 stars & up" },
];

const ALL_INDUSTRIES = "__all__";

export function ReviewsSection({
  processorId,
  processorName,
  processorSlug,
  average,
  count,
  subRatings,
  topMentions,
  industries,
  initial,
}: {
  processorId: string;
  processorName: string;
  processorSlug: string;
  average: number;
  count: number;
  subRatings: SubRatingsData;
  topMentions: TopMentionData[];
  industries: string[];
  initial: ReviewsResult;
}) {
  const [items, setItems] = React.useState<ReviewCardData[]>(initial.items);
  const [page, setPage] = React.useState(initial.page);
  const [totalPages, setTotalPages] = React.useState(initial.totalPages);
  const [total, setTotal] = React.useState(initial.total);

  const [sort, setSort] = React.useState<ReviewSort>("newest");
  const [industry, setIndustry] = React.useState(ALL_INDUSTRIES);
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [minRating, setMinRating] = React.useState("0");
  // Active "Top mentions" chip filter (empty = none). Clicking a chip narrows the
  // list to approved reviews that mention that topic (server-side, same dictionary).
  const [mention, setMention] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const firstRender = React.useRef(true);

  const load = React.useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams({
          processor: processorId,
          sort,
          page: String(nextPage),
        });
        if (industry !== ALL_INDUSTRIES) sp.set("industry", industry);
        if (verifiedOnly) sp.set("verifiedOnly", "true");
        if (minRating !== "0") sp.set("minRating", minRating);
        if (mention) sp.set("mention", mention);

        const res = await fetch(`/api/reviews?${sp.toString()}`);
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as ReviewsResult;
        setItems(data.items);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [processorId, sort, industry, verifiedOnly, minRating, mention],
  );

  // Refetch from page 1 whenever a filter/sort changes (skip the mount — page 1
  // with default filters is already server-rendered into `initial`).
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, industry, verifiedOnly, minRating, mention]);

  const hasReviews = count > 0;

  return (
    <div className="mt-6 space-y-8">
      {/* Summary */}
      {hasReviews ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <RatingBreakdown average={average} count={count} subRatings={subRatings} />

          {/* Top mentions (DESIGN §6.4) — neutral, auto-derived topic chips with
              counts. Clicking one filters the list to reviews mentioning it. */}
          {topMentions.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-label uppercase text-ink-500">Top mentions</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {topMentions.map((m) => {
                  const active = mention === m.keyword;
                  return (
                    <button
                      key={m.keyword}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setMention(active ? "" : m.keyword)}
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
                    </button>
                  );
                })}
                {mention && (
                  <button
                    type="button"
                    onClick={() => setMention("")}
                    className="inline-flex items-center px-2 py-1 text-small font-medium text-accent hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          No reviews yet. Be the first to share your experience with {processorName}.
        </p>
      )}

      {hasReviews && (
        <>
          {/* Filter / sort bar */}
          <div className="flex flex-col gap-3 border-y border-border py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-small text-muted-foreground">Sort</Label>
                <Select value={sort} onValueChange={(v) => setSort(v as ReviewSort)}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-small text-muted-foreground">Rating</Label>
                <Select value={minRating} onValueChange={setMinRating}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {industries.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-small text-muted-foreground">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_INDUSTRIES}>All industries</SelectItem>
                      {industries.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch id="verified-only" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
              <Label htmlFor="verified-only" className="cursor-pointer text-small text-muted-foreground">
                Verified only
              </Label>
            </div>
          </div>

          {/* List */}
          <div className="relative space-y-4">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-start justify-center pt-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading reviews" />
              </div>
            )}
            <p className="text-small text-muted-foreground tabular-nums">
              {total} {total === 1 ? "review" : "reviews"}
            </p>
            <div className={cn("space-y-4", loading && "opacity-50")}>
              {items.length === 0 && !loading ? (
                <p className="rounded-lg border border-dashed border-border py-10 text-center text-small text-muted-foreground">
                  No reviews match these filters.
                </p>
              ) : (
                items.map((review) => <ReviewCard key={review.id} review={review} />)
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Reviews pagination" className="flex items-center justify-center gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => void load(page - 1)}
                  disabled={page <= 1 || loading}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "disabled:opacity-40")}
                >
                  Prev
                </button>
                <span className="px-3 text-small text-muted-foreground tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => void load(page + 1)}
                  disabled={page >= totalPages || loading}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "disabled:opacity-40")}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </>
      )}

      {/* Write a Review CTA */}
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

export default ReviewsSection;
