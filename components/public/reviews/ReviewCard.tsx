"use client";

import * as React from "react";
import { CheckCircle2, ThumbsUp } from "lucide-react";
import type { ReviewCardData } from "@/lib/serialize";
import { SUB_RATING_KEYS, type SubRatingKey } from "@/lib/enums";
import { cn, formatDate, formatRating } from "@/lib/utils";
import { RatingStars } from "@/components/public/RatingStars";

/**
 * ReviewCard (PRD §9.3 #reviews). Reviewer identity + verified badge, overall +
 * sub-ratings, title/body, optional pros/cons/use case, date, and a "Helpful (N)"
 * button. One-vote-per-browser is tracked in localStorage; the count is bumped via
 * `POST /api/reviews/[id]/helpful`.
 */

const SUB_LABELS: Record<SubRatingKey, string> = {
  easeOfUse: "Ease of use",
  pricing: "Pricing",
  support: "Support",
  features: "Features",
  reliability: "Reliability",
};

const HELPFUL_KEY = "paycompare:helpful";

function readVoted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(HELPFUL_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function ReviewCard({ review }: { review: ReviewCardData }) {
  const [helpful, setHelpful] = React.useState(review.helpfulCount);
  const [voted, setVoted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setVoted(readVoted().has(review.id));
  }, [review.id]);

  const vote = async () => {
    if (voted || busy) return;
    setBusy(true);
    // Optimistic; revert on failure.
    setHelpful((n) => n + 1);
    setVoted(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/helpful`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { helpfulCount: number };
      setHelpful(data.helpfulCount);
      const next = readVoted();
      next.add(review.id);
      window.localStorage.setItem(HELPFUL_KEY, JSON.stringify([...next]));
    } catch {
      setHelpful((n) => Math.max(0, n - 1));
      setVoted(false);
    } finally {
      setBusy(false);
    }
  };

  const meta = [review.reviewerTitle, review.companyName, review.companySize, review.industry]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-lg border border-border bg-card p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-foreground">{review.reviewerName}</h3>
            {review.isVerified && (
              <span className="inline-flex items-center gap-1 text-accent" title="Verified reviewer">
                <CheckCircle2 className="size-4" aria-hidden />
                <span className="text-micro font-medium uppercase tracking-wide">Verified</span>
              </span>
            )}
          </div>
          {meta && <p className="mt-0.5 text-small text-muted-foreground">{meta}</p>}
        </div>
        <div className="flex flex-col items-end">
          <RatingStars value={review.overallRating} size={15} />
          <span className="mt-0.5 text-micro text-muted-foreground">{formatDate(review.createdAt)}</span>
        </div>
      </div>

      <h4 className="mt-4 text-body-lg font-medium text-foreground">{review.title}</h4>
      <p className="mt-1.5 whitespace-pre-line text-body text-ink-700 dark:text-ink-300">{review.body}</p>

      {(review.pros || review.cons) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {review.pros && (
            <div className="rounded-md border border-border bg-ink-50 p-3 dark:bg-ink-900">
              <p className="text-label uppercase text-ink-500">Pros</p>
              <p className="mt-1 whitespace-pre-line text-small text-ink-800 dark:text-ink-200">{review.pros}</p>
            </div>
          )}
          {review.cons && (
            <div className="rounded-md border border-border bg-ink-50 p-3 dark:bg-ink-900">
              <p className="text-label uppercase text-ink-500">Cons</p>
              <p className="mt-1 whitespace-pre-line text-small text-ink-800 dark:text-ink-200">{review.cons}</p>
            </div>
          )}
        </div>
      )}

      {review.useCase && (
        <p className="mt-4 text-small text-muted-foreground">
          <span className="font-medium text-foreground">Use case:</span> {review.useCase}
        </p>
      )}

      {/* Sub-ratings */}
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
        {SUB_RATING_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <dt className="text-micro text-muted-foreground">{SUB_LABELS[key]}</dt>
            <dd className="text-micro font-semibold tabular-nums text-foreground">
              {formatRating(review.subRatings[key])}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void vote()}
          disabled={voted || busy}
          aria-pressed={voted}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-small transition-colors",
            voted
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          <ThumbsUp className="size-3.5" aria-hidden />
          Helpful{helpful > 0 ? ` (${helpful})` : ""}
        </button>
      </div>
    </article>
  );
}

export default ReviewCard;
