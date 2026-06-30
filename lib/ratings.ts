import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Processor } from "@/models/Processor";
import { Review } from "@/models/Review";
import { SUB_RATING_KEYS } from "@/lib/enums";
import { computeTopMentionsForProcessor, type TopMention } from "@/lib/top-mentions";
import type { IProcessorSubRatings } from "@/models/Processor";

/**
 * lib/ratings.ts — THE SINGLE SOURCE OF TRUTH for a Processor's denormalized
 * ratings (PRD §8.1 / §10.5 / §15).
 *
 *   ratingAverage · ratingCount · subRatings
 *
 * are computed ONLY here, from the processor's **approved** reviews, and
 * persisted back onto the Processor document. The same pass also recomputes the
 * denormalized `topMentions` chips (PRD §8.1 / §9.3, via `lib/top-mentions.ts`)
 * so they fire on the exact same triggers and can never drift. They are NEVER
 * edited by hand (the admin form shows them read-only). Call
 * `recomputeProcessorRatings` after any event that changes the approved-review
 * set:
 *
 *   - a review is approved        (Stage 4 moderation)
 *   - an approved review is rejected / deleted
 *   - an approved review's ratings are edited
 *
 * Keeping this in one function guarantees the aggregate can never drift from
 * the underlying reviews.
 */

/** Round to one decimal place (PRD §8.1: "0–5, 1 decimal"). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const ZERO_SUB_RATINGS: IProcessorSubRatings = {
  easeOfUse: 0,
  pricing: 0,
  support: 0,
  features: 0,
  reliability: 0,
};

export interface RecomputedRatings {
  ratingAverage: number;
  ratingCount: number;
  subRatings: IProcessorSubRatings;
  topMentions: TopMention[];
}

/**
 * Recompute and persist a processor's aggregate ratings from its approved
 * reviews. Returns the values written (handy for tests / immediate UI updates).
 *
 * With zero approved reviews everything resets to 0 (so un-approving the last
 * review correctly clears the badge/aggregate).
 */
export async function recomputeProcessorRatings(
  processorId: string | Types.ObjectId,
): Promise<RecomputedRatings> {
  await connectToDatabase();

  const _id = typeof processorId === "string" ? new Types.ObjectId(processorId) : processorId;

  // One aggregation pass over the approved reviews → overall avg + count + each
  // sub-rating average. `$avg` ignores nothing here because sub-ratings are
  // required (1–5) on every Review (see models/Review.ts).
  const [agg] = await Review.aggregate<{
    ratingAverage: number;
    ratingCount: number;
    easeOfUse: number;
    pricing: number;
    support: number;
    features: number;
    reliability: number;
  }>([
    { $match: { processor: _id, status: "approved" } },
    {
      $group: {
        _id: null,
        ratingAverage: { $avg: "$overallRating" },
        ratingCount: { $sum: 1 },
        easeOfUse: { $avg: "$subRatings.easeOfUse" },
        pricing: { $avg: "$subRatings.pricing" },
        support: { $avg: "$subRatings.support" },
        features: { $avg: "$subRatings.features" },
        reliability: { $avg: "$subRatings.reliability" },
      },
    },
  ]);

  // Neutral keyword chips from the same approved-review set (PRD §8.1 / §9.3).
  // Skipped (→ []) when there are no approved reviews, so the chips clear in
  // lockstep with the aggregate.
  const topMentions =
    agg && agg.ratingCount > 0 ? await computeTopMentionsForProcessor(_id) : [];

  const result: RecomputedRatings =
    agg && agg.ratingCount > 0
      ? {
          ratingAverage: round1(agg.ratingAverage),
          ratingCount: agg.ratingCount,
          subRatings: SUB_RATING_KEYS.reduce((acc, key) => {
            acc[key] = round1(agg[key] ?? 0);
            return acc;
          }, {} as IProcessorSubRatings),
          topMentions,
        }
      : { ratingAverage: 0, ratingCount: 0, subRatings: { ...ZERO_SUB_RATINGS }, topMentions };

  await Processor.updateOne({ _id }, { $set: result });

  return result;
}

export default recomputeProcessorRatings;
