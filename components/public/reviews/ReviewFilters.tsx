"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReviewSort } from "@/lib/public-data";
import {
  ALL_INDUSTRIES,
  RATING_OPTIONS,
  REVIEW_SORTS,
  SORT_LABELS,
  reviewsHref,
  type ReviewQuery,
} from "@/components/public/reviews/params";

/**
 * Filter/sort bar for `/processor/<slug>/reviews`.
 *
 * Every control NAVIGATES — it writes the choice into the URL and lets the server
 * component re-render the list. It does not fetch and swap the list client-side,
 * which is what the profile's old reviews section did.
 *
 * That is the point of the page. Reviews are the reason it can rank, so they have
 * to be in the initial HTML for every state a crawler or a JS-less reader can
 * reach — including a shared link to "4 stars & up, retail". A filtered state is
 * then a real, linkable URL, and the page decides on its own whether that URL
 * belongs in the index (it doesn't — see `isFilteredQuery`).
 *
 * Changing any filter resets to page 1: staying on page 4 of a result set that
 * just shrank to two pages lands the reader on an empty list.
 */
export function ReviewFilters({
  basePath,
  query,
  industries,
}: {
  basePath: string;
  query: ReviewQuery;
  industries: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const go = (patch: Partial<ReviewQuery>) => {
    const next = reviewsHref(basePath, { ...query, ...patch, page: 1 });
    startTransition(() => router.push(next, { scroll: false }));
  };

  return (
    <div
      // Dimmed while the server renders the next state — without it a slow
      // navigation reads as a control that didn't respond.
      data-pending={pending ? "" : undefined}
      className="flex flex-col gap-3 border-y border-border py-4 data-[pending]:opacity-60 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="review-sort" className="text-small text-muted-foreground">
            Sort
          </Label>
          <Select value={query.sort} onValueChange={(v) => go({ sort: v as ReviewSort })}>
            <SelectTrigger id="review-sort" className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="review-rating" className="text-small text-muted-foreground">
            Rating
          </Label>
          <Select
            value={String(query.minRating)}
            onValueChange={(v) => go({ minRating: Number(v) })}
          >
            <SelectTrigger id="review-rating" className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RATING_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {industries.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="review-industry" className="text-small text-muted-foreground">
              Industry
            </Label>
            <Select
              value={query.industry ?? ALL_INDUSTRIES}
              onValueChange={(v) => go({ industry: v === ALL_INDUSTRIES ? undefined : v })}
            >
              <SelectTrigger id="review-industry" className="h-9 w-44">
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
        <Switch
          id="verified-only"
          checked={query.verifiedOnly}
          onCheckedChange={(checked) => go({ verifiedOnly: checked })}
        />
        <Label htmlFor="verified-only" className="cursor-pointer text-small text-muted-foreground">
          Verified only
        </Label>
      </div>
    </div>
  );
}

export default ReviewFilters;
