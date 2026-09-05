/**
 * Rate card TYPES, the shared effective-rate bands, and the lookups a brand
 * widget needs. For the `/tools/*` calculators.
 *
 * Split out of `lib/tools.ts` for ONE reason, and it is a bundling reason rather
 * than an organisational one. `BrandFeeCalculator` and `ToolKit` are both
 * `"use client"` modules, and both need these. Importing them from `lib/tools.ts`
 * pulled the entire tool registry, including `lib/tools-more.ts`, into the client
 * chunk that every `/tools/*` page loads. `/tools/[tool]` is a single route, so
 * anything a widget imports ships everywhere.
 *
 * THE RATE CARD DATA ITSELF IS NOT HERE. It lives in `lib/rate-cards/*.ts`, one
 * module per processor, and is read on the SERVER in `ToolWidget` then handed to
 * `BrandFeeCalculator` as a prop. Ten cards inline in this module would ship all
 * ten to every calculator page, which is the same mistake `lib/tools-data/` was
 * split to undo. Keep this module to types, bands and pure functions.
 *
 * Keep this module free of page copy and free of registry imports.
 *
 * `lib/tools.ts` re-exports everything here and everything in `lib/rate-cards`,
 * so server code and the existing import sites are unaffected.
 */

export interface RateCardChannel {
  id: string;
  label: string;
  note?: string;
  /** planId → rate. Cards with no plans use the single plan id `"standard"`. */
  rates: Record<string, { rate: number; fixed: number }>;
}

export interface RateCard {
  key: RateCardKey;
  processorName: string;
  /** The listing this card describes, for the two-way internal link. */
  processorSlug: string;
  /** Date the numbers below were read off the processor's own published US schedule. */
  checked: string;
  sources: { label: string; url: string }[];
  plans: { id: string; label: string; monthly: number; note?: string }[];
  channels: RateCardChannel[];
  /** Percentage add-ons that stack on the channel rate. */
  addOns: { id: string; label: string; rate: number; note?: string }[];
  /** Flat facts worth showing but not modelling. */
  extras: { label: string; value: string }[];
}

/**
 * Every brand with a published US card in `lib/rate-cards/`. Adding a key here
 * without adding the module breaks the barrel's `Record` at compile time, which
 * is the point: the two cannot drift apart silently.
 */
export type RateCardKey =
  | "stripe"
  | "paypal"
  | "square"
  | "shopify"
  | "clover"
  | "toast"
  | "helcim"
  | "adyen"
  | "braintree"
  | "authorize-net";


/**
 * The effective-rate verdict ladder, shown as the output of every fee tool.
 *
 * These bands are the consensus a merchant actually gets from people who read
 * statements for a living, not a number we invented: the same ladder recurs
 * across merchant discussions and across the ranking editorial, and the AI
 * Overview on these queries already treats roughly this split as settled.
 * Keeping one copy here means the fee calculator and the effective rate
 * calculator can never disagree about what "high" means.
 */
export interface RateBand {
  max: number;
  label: string;
  note: string;
}

/**
 * Named rather than indexed off the end of the array, so `rateBand` can return a
 * `RateBand` and not `RateBand | undefined`. The last entry's `max` is Infinity,
 * so the lookup always matches, but the type system has no way to know that.
 */
const WORST_BAND: RateBand = {
  max: Number.POSITIVE_INFINITY,
  label: "Very high",
  note: "Something specific is wrong: tiered pricing, junk line items, or a high-risk rate you have outgrown.",
};

export const EFFECTIVE_RATE_BANDS: RateBand[] = [
  { max: 1.9, label: "Excellent", note: "Better than most small merchants ever see. Nothing to fix." },
  { max: 2.25, label: "Good", note: "A competitive rate. Worth re-checking once a year, not today." },
  { max: 2.75, label: "Average", note: "Typical for flat-rate pricing. There is usually room at volume." },
  { max: 3.2, label: "High", note: "Look at your pricing model and your monthly fixed fees before anything else." },
  WORST_BAND,
];

export function rateBand(effectiveRate: number): RateBand {
  return EFFECTIVE_RATE_BANDS.find((b) => effectiveRate < b.max) ?? WORST_BAND;
}

/**
 * Rate-card lookups that always resolve. A brand calculator reads a channel and
 * a plan straight from user-chosen ids, and `noUncheckedIndexedAccess` is on, so
 * doing the narrowing once here keeps the five widgets free of defensive noise.
 */
export const defaultPlanId = (card: RateCard): string => card.plans[0]?.id ?? "standard";

export const defaultChannelId = (card: RateCard): string => card.channels[0]?.id ?? "";

export function findChannel(card: RateCard, id: string): RateCardChannel | undefined {
  return card.channels.find((c) => c.id === id) ?? card.channels[0];
}

export function channelRate(
  card: RateCard,
  channel: RateCardChannel | undefined,
  planId: string,
): { rate: number; fixed: number } {
  if (!channel) return { rate: 0, fixed: 0 };
  return channel.rates[planId] ?? channel.rates[defaultPlanId(card)] ?? { rate: 0, fixed: 0 };
}
