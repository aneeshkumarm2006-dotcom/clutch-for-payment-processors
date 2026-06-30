import type { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Processor, Category } from "@/models";
import { toProcessorCardData } from "@/lib/serialize";
import {
  PAGE_SIZE,
  REVIEW_LOG_CAP,
  RATE_VALUES,
  FEE_VALUES,
  escapeRegex,
  type ProcessorSort,
  type DirectoryParams,
  type DirectoryResult,
} from "@/lib/directory-shared";

/**
 * Shared faceted directory query (PRD §9.2 / TODO §3.2 & §3.4).
 *
 * One code path builds the filter + sort used by BOTH the public API
 * (`GET /api/processors`) and the server-rendered directory/category pages, so
 * the ranking can never drift between them. Results are computed with an
 * aggregation because the default "Recommended" order is a multi-key blend that
 * `.find().sort()` can't express, and the rate/fee buckets need numbers parsed
 * out of the free-text fee strings.
 *
 * The client-safe constants, types, and URL parsers live in
 * `lib/directory-shared.ts` (re-exported below) so Client Components can use them
 * without bundling Mongoose. This file keeps only the DB-touching query.
 */

// Re-export the client-safe primitives so existing server imports from
// "@/lib/processors-query" keep resolving unchanged.
export {
  PAGE_SIZE,
  SORT_OPTIONS,
  RATE_BUCKETS,
  FEE_BUCKETS,
  MIN_RATING_OPTIONS,
  REVIEW_LOG_CAP,
  paramsReader,
  parseDirectoryParams,
  hasActiveFilters,
  type ProcessorSort,
  type DirectoryParams,
  type DirectoryResult,
  type ParamReader,
} from "@/lib/directory-shared";

/**
 * Build the base `$match` (everything except the rate/fee buckets, which need the
 * parsed numbers computed in `$addFields`).
 *
 * Facet semantics: capability facets (payment methods / integrations / features)
 * use `$all` ("must have all of these"); classification facets (pricing model /
 * region / business size) use `$in` ("any of these"). Logged in NOTES.md.
 */
function buildBaseMatch(p: DirectoryParams, categoryId?: string): Record<string, unknown> {
  const match: Record<string, unknown> = { isPublished: true };

  if (categoryId) match.categories = categoryId;
  if (p.pricingModel.length) match.pricingModel = { $in: p.pricingModel };
  if (p.methods.length) match.paymentMethods = { $all: p.methods };
  if (p.integrations.length) match.integrations = { $all: p.integrations };
  if (p.features.length) match.features = { $all: p.features };
  if (p.region.length) match.supportedRegions = { $in: p.region };
  if (p.size.length) match.companySize = { $in: p.size };
  if (p.highRisk) match.highRiskFriendly = true;
  if (p.verifiedOnly) match.isVerified = true;
  if (p.minRating !== undefined) match.ratingAverage = { $gte: p.minRating };

  if (p.q) {
    const rx = { $regex: escapeRegex(p.q), $options: "i" };
    match.$or = [{ name: rx }, { tagline: rx }, { shortDescription: rx }, { bestFor: rx }];
  }

  return match;
}

/** Post-`$addFields` match for the rate/fee buckets (OR within a facet). */
function buildBucketMatch(p: DirectoryParams): Record<string, unknown> | null {
  const and: Record<string, unknown>[] = [];

  if (p.rate.length) {
    const rateCond: Record<string, Record<string, unknown>> = {
      lt2: { _onlineRatePct: { $gte: 0, $lt: 2 } },
      "2-2.5": { _onlineRatePct: { $gte: 2, $lt: 2.5 } },
      "2.5-3": { _onlineRatePct: { $gte: 2.5, $lt: 3 } },
      gt3: { _onlineRatePct: { $gte: 3 } },
      custom: { _onlineRatePct: null },
    };
    and.push({ $or: p.rate.map((b) => rateCond[b]).filter(Boolean) });
  }

  if (p.fee.length) {
    const feeCond: Record<string, Record<string, unknown>> = {
      "0": { _monthlyFeeNum: 0 },
      lt25: { _monthlyFeeNum: { $gt: 0, $lt: 25 } },
      "25-99": { _monthlyFeeNum: { $gte: 25, $lt: 100 } },
      gt100: { _monthlyFeeNum: { $gte: 100 } },
    };
    and.push({ $or: p.fee.map((b) => feeCond[b]).filter(Boolean) });
  }

  return and.length ? { $and: and } : null;
}

/**
 * Computed ranking fields. The "Recommended" default sort (PRD §9.2 — "must be
 * implemented exactly") then orders by:
 *
 *   1. isSponsored first, by sponsorRank asc (nulls last)   → `_sponsorActive`,`_sponsorRank`
 *   2. listingTier: premier(3) > verified(2) > free(1)      → `_tierRank`
 *   3. rankScore desc — a weighted, each-term-normalized blend → `_rankScore`:
 *        rankScore = 0.60 · (ratingAverage / 5)
 *                  + 0.25 · min(1, log10(ratingCount + 1) / log10(1001))
 *                  + 0.15 · (editorScore / 5)
 *
 * Each term is 0..1 so the weights (0.60 / 0.25 / 0.15) are meaningful. The
 * rate/fee numbers (`_onlineRatePct`,`_monthlyFeeNum`) are parsed from the
 * free-text fee strings for the "Lowest fees" sort + the rate/fee bucket filters.
 */
const ADD_FIELDS: PipelineStage.AddFields["$addFields"] = {
  _tierRank: {
    $switch: {
      branches: [
        { case: { $eq: ["$listingTier", "premier"] }, then: 3 },
        { case: { $eq: ["$listingTier", "verified"] }, then: 2 },
      ],
      default: 1,
    },
  },
  _sponsorActive: { $cond: [{ $eq: ["$isSponsored", true] }, 1, 0] },
  _sponsorRank: { $ifNull: ["$sponsorRank", 999999] },
  _onlineRatePct: {
    $let: {
      vars: {
        m: {
          $regexFind: {
            input: { $ifNull: ["$fees.onlineCardRate", ""] },
            regex: "([0-9]+(?:\\.[0-9]+)?)\\s*%",
          },
        },
      },
      in: {
        $cond: [{ $ne: ["$$m", null] }, { $toDouble: { $arrayElemAt: ["$$m.captures", 0] } }, null],
      },
    },
  },
  _monthlyFeeNum: {
    $let: {
      vars: {
        m: {
          $regexFind: {
            input: { $ifNull: ["$fees.monthlyFee", ""] },
            regex: "([0-9]+(?:\\.[0-9]+)?)",
          },
        },
      },
      in: {
        $cond: [{ $ne: ["$$m", null] }, { $toDouble: { $arrayElemAt: ["$$m.captures", 0] } }, null],
      },
    },
  },
  _rankScore: {
    $add: [
      { $multiply: [0.6, { $divide: [{ $ifNull: ["$ratingAverage", 0] }, 5] }] },
      {
        $multiply: [
          0.25,
          {
            $min: [
              1,
              { $divide: [{ $log10: { $add: [{ $ifNull: ["$ratingCount", 0] }, 1] } }, REVIEW_LOG_CAP] },
            ],
          },
        ],
      },
      { $multiply: [0.15, { $divide: [{ $ifNull: ["$editorScore", 0] }, 5] }] },
    ],
  },
};

/** The temp ranking fields, stripped from the returned docs. */
const STRIP_TEMP = {
  _tierRank: 0,
  _sponsorActive: 0,
  _sponsorRank: 0,
  _onlineRatePct: 0,
  _monthlyFeeNum: 0,
  _hasRate: 0,
  _rankScore: 0,
} as const;

function sortSpec(sort: ProcessorSort): Record<string, 1 | -1> {
  switch (sort) {
    case "rating":
      return { ratingAverage: -1, ratingCount: -1, _id: 1 };
    case "reviews":
      return { ratingCount: -1, ratingAverage: -1, _id: 1 };
    case "fees":
      // `_hasRate` (0 = has a parseable rate) first so "varies" rows sort last.
      return { _hasRate: 1, _onlineRatePct: 1, ratingAverage: -1, _id: 1 };
    case "newest":
      return { createdAt: -1, _id: 1 };
    case "recommended":
    default:
      return { _sponsorActive: -1, _sponsorRank: 1, _tierRank: -1, _rankScore: -1, ratingAverage: -1, _id: 1 };
  }
}

/**
 * Run the faceted directory query. Pass `opts.categoryId` when the caller already
 * resolved the category (the `/category/[slug]` page); otherwise a `?category=`
 * slug in the params is resolved here. Resilient: returns an empty result set if
 * Mongo is unreachable so public pages can render their empty state.
 */
export async function queryDirectory(
  params: DirectoryParams,
  opts: { categoryId?: string } = {},
): Promise<DirectoryResult> {
  const empty: DirectoryResult = { items: [], total: 0, page: params.page, totalPages: 1 };

  try {
    await connectToDatabase();

    let categoryId = opts.categoryId;
    if (!categoryId && params.category) {
      const cat = await Category.findOne({ slug: params.category, isPublished: true })
        .select("_id")
        .lean();
      if (!cat) return empty; // unknown/unpublished category → no results
      categoryId = String(cat._id);
    }

    const baseMatch = buildBaseMatch(params, categoryId);
    const bucketMatch = buildBucketMatch(params);

    const pipeline: PipelineStage[] = [
      { $match: baseMatch },
      { $addFields: ADD_FIELDS },
      { $addFields: { _hasRate: { $cond: [{ $eq: ["$_onlineRatePct", null] }, 1, 0] } } },
      ...(bucketMatch ? [{ $match: bucketMatch }] : []),
      {
        $facet: {
          items: [
            { $sort: sortSpec(params.sort) },
            { $skip: (params.page - 1) * PAGE_SIZE },
            { $limit: PAGE_SIZE },
            { $project: STRIP_TEMP },
          ],
          meta: [{ $count: "total" }],
        },
      },
    ];

    const [result] = await Processor.aggregate<{
      items: Record<string, unknown>[];
      meta: { total: number }[];
    }>(pipeline);

    const docs = result?.items ?? [];
    const total = result?.meta?.[0]?.total ?? 0;

    return {
      items: docs.map(toProcessorCardData),
      total,
      page: params.page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[processors-query] queryDirectory failed:", err);
    return empty;
  }
}
