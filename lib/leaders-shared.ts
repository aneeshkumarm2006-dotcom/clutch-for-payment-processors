import type { ListingTier } from "@/lib/enums";
import { REVIEW_LOG_CAP } from "@/lib/directory-shared";

/**
 * Client-safe Leaders Matrix primitives (axes, point type, normalization).
 *
 * Split out of `lib/leaders.ts` so the `LeadersMatrix` Client Component can
 * import the axis constants and `LeaderPoint` type WITHOUT pulling in
 * `@/models` / `@/lib/db` — those drag Mongoose into the browser bundle, where
 * `mongoose.models` is undefined and the page crashes with "Cannot read
 * properties of undefined (reading 'Processor')".
 *
 * `leaders.ts` re-exports everything here, so server callers are unaffected.
 */

/** The three plottable axes. `value` keys into `LeaderPoint.metrics`. */
export const LEADER_AXES = [
  { value: "reviews", label: "Adoption", axisTitle: "Review volume", hint: "review count (log-scaled)" },
  { value: "rating", label: "Satisfaction", axisTitle: "Average rating", hint: "mean rating, 1–5" },
  { value: "editor", label: "Editor score", axisTitle: "Editor score", hint: "PayCompare score, 1–5" },
] as const;

export type LeaderAxis = (typeof LEADER_AXES)[number]["value"];

/**
 * Default quadrant axes (resolves the PRD §19 open decision "Leaders Matrix
 * default axes", logged in NOTES.md): X = adoption (review volume), Y =
 * satisfaction (rating). That makes the top-right quadrant the classic "Leaders"
 * corner — well-reviewed *and* well-liked. Editor score is the third toggle.
 */
export const DEFAULT_X_AXIS: LeaderAxis = "reviews";
export const DEFAULT_Y_AXIS: LeaderAxis = "rating";

export interface LeaderPoint {
  slug: string;
  name: string;
  logo?: string;
  listingTier: ListingTier;
  /** Each axis metric normalized to 0..1 for plotting (axis-agnostic). */
  metrics: Record<LeaderAxis, number>;
  /** Raw values, for the tooltip. */
  ratingAverage: number;
  ratingCount: number;
  editorScore: number;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Normalize a processor's three ranking inputs to 0..1, matching the per-term
 * normalization of the `_rankScore` blend in `lib/processors-query.ts`:
 *   rating  → ratingAverage / 5
 *   reviews → min(1, log10(ratingCount + 1) / log10(1001))
 *   editor  → editorScore / 5
 */
export function normalize(
  ratingAverage: number,
  ratingCount: number,
  editorScore: number,
): Record<LeaderAxis, number> {
  return {
    rating: clamp01(ratingAverage / 5),
    reviews: clamp01(Math.log10(ratingCount + 1) / REVIEW_LOG_CAP),
    editor: clamp01(editorScore / 5),
  };
}
