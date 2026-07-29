import type { ReviewSort } from "@/lib/public-data";

/**
 * The reviews page's URL contract, in one place.
 *
 * Both halves of the page depend on it and they must not drift: the server
 * component parses `searchParams` with `parseReviewQuery` and the client filter
 * bar builds the next URL with `reviewsHref`. A mismatch here is invisible —
 * nothing errors, a control just silently stops filtering.
 *
 * ⚠️ Type-only import of `ReviewSort`. `lib/public-data` reaches mongoose, and
 * this module is imported by a client component; a value import would drag the
 * driver into the browser bundle.
 */

export const REVIEW_SORTS = ["newest", "highest", "most-helpful"] as const;

export const SORT_LABELS: Record<ReviewSort, string> = {
  newest: "Newest",
  highest: "Highest rated",
  "most-helpful": "Most helpful",
};

export const RATING_OPTIONS = [
  { value: 0, label: "All ratings" },
  { value: 4, label: "4 stars & up" },
  { value: 3, label: "3 stars & up" },
  { value: 2, label: "2 stars & up" },
] as const;

export const ALL_INDUSTRIES = "__all__";

export interface ReviewQuery {
  page: number;
  sort: ReviewSort;
  /** 0 = no minimum. */
  minRating: number;
  industry?: string;
  verifiedOnly: boolean;
  /** A "Top mentions" chip label. */
  mention?: string;
}

export const DEFAULT_REVIEW_QUERY: ReviewQuery = {
  page: 1,
  sort: "newest",
  minRating: 0,
  verifiedOnly: false,
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export function parseReviewQuery(sp: RawParams): ReviewQuery {
  const sort = one(sp.sort) as ReviewSort;
  const rating = Number(one(sp.rating));
  const industry = one(sp.industry);
  const mention = one(sp.mention);
  return {
    page: Math.max(1, Number(one(sp.page)) || 1),
    sort: REVIEW_SORTS.includes(sort) ? sort : "newest",
    // Only the offered thresholds — an arbitrary `?rating=3.7` would mint a
    // distinct URL for every value someone cared to type.
    minRating: RATING_OPTIONS.some((o) => o.value === rating) ? rating : 0,
    industry: industry || undefined,
    verifiedOnly: one(sp.verified) === "1",
    mention: mention || undefined,
  };
}

/**
 * Is this a filtered view rather than the plain list?
 *
 * Drives `noindex`. Pagination alone does NOT count: `?page=2` is more of the same
 * content and should stay indexable, while a sort/rating/industry/mention
 * combination is a re-cut of reviews that already exist on page 1 — near-duplicate
 * URLs multiplying with every option, which is exactly what `/compare?ids=` is
 * kept out of the index for.
 */
export function isFilteredQuery(q: ReviewQuery): boolean {
  return (
    q.sort !== "newest" ||
    q.minRating > 0 ||
    Boolean(q.industry) ||
    q.verifiedOnly ||
    Boolean(q.mention)
  );
}

/** Serialize a query back to a URL, omitting every default so page 1 stays clean. */
export function reviewsHref(basePath: string, q: Partial<ReviewQuery>): string {
  const sp = new URLSearchParams();
  if (q.sort && q.sort !== "newest") sp.set("sort", q.sort);
  if (q.minRating) sp.set("rating", String(q.minRating));
  if (q.industry) sp.set("industry", q.industry);
  if (q.verifiedOnly) sp.set("verified", "1");
  if (q.mention) sp.set("mention", q.mention);
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
