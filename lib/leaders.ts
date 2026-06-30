import { connectToDatabase } from "@/lib/db";
import { Processor } from "@/models";
import type { ListingTier } from "@/lib/enums";
import { normalize, type LeaderAxis, type LeaderPoint } from "@/lib/leaders-shared";

/**
 * Leaders Matrix projection (Phase 2 / Stage 7.2 — PRD §5, §16).
 *
 * Projects every published processor onto the three metrics that already feed the
 * "Recommended" sort in `lib/processors-query.ts`, each normalized to 0..1 so the
 * client `LeadersMatrix` can plot any two of them on a 2×2 quadrant without
 * refetching. Reusing the same fields + log-scaling keeps the chart honest: a
 * processor's position can't drift from how it ranks elsewhere.
 *
 * The client-safe axes/types/normalization live in `lib/leaders-shared.ts`
 * (re-exported below) so the `LeadersMatrix` Client Component can import them
 * without bundling Mongoose. This file keeps only the DB-touching projection.
 *
 * Resilient: a Mongo outage yields `[]` so the SSG/ISR page renders its empty
 * state and `next build` never fails without a DB.
 */

// Re-export the client-safe primitives so existing imports from "@/lib/leaders"
// keep resolving unchanged.
export {
  LEADER_AXES,
  DEFAULT_X_AXIS,
  DEFAULT_Y_AXIS,
  type LeaderAxis,
  type LeaderPoint,
} from "@/lib/leaders-shared";

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
