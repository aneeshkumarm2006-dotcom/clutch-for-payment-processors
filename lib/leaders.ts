import { connectToDatabase } from "@/lib/db";
import { Processor } from "@/models";
import { REVIEW_LOG_CAP } from "@/lib/processors-query";
import type { ListingTier } from "@/lib/enums";

/**
 * Leaders Matrix projection (Phase 2 / Stage 7.2 — PRD §5, §16).
 *
 * Projects every published processor onto the three metrics that already feed the
 * "Recommended" sort in `lib/processors-query.ts`, each normalized to 0..1 so the
 * client `LeadersMatrix` can plot any two of them on a 2×2 quadrant without
 * refetching. Reusing the same fields + log-scaling (`REVIEW_LOG_CAP`) keeps the
 * chart honest: a processor's position can't drift from how it ranks elsewhere.
 *
 * Resilient: a Mongo outage yields `[]` so the SSG/ISR page renders its empty
 * state and `next build` never fails without a DB.
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
function normalize(ratingAverage: number, ratingCount: number, editorScore: number): Record<LeaderAxis, number> {
  return {
    rating: clamp01(ratingAverage / 5),
    reviews: clamp01(Math.log10(ratingCount + 1) / REVIEW_LOG_CAP),
    editor: clamp01(editorScore / 5),
  };
}

/** Every published processor projected to plottable points (resilient → []). */
export async function getLeaderPoints(): Promise<LeaderPoint[]> {
  try {
    await connectToDatabase();
    const docs = await Processor.find({ isPublished: true })
      .select("name slug logo listingTier ratingAverage ratingCount editorScore")
      .lean();

    return docs.map((d) => {
      const ratingAverage = Number(d.ratingAverage ?? 0);
      const ratingCount = Number(d.ratingCount ?? 0);
      const editorScore = Number(d.editorScore ?? 0);
      return {
        slug: String(d.slug),
        name: String(d.name ?? ""),
        logo: d.logo ? String(d.logo) : undefined,
        listingTier: (d.listingTier as ListingTier) ?? "free",
        metrics: normalize(ratingAverage, ratingCount, editorScore),
        ratingAverage,
        ratingCount,
        editorScore,
      };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[leaders] getLeaderPoints failed:", err);
    return [];
  }
}
