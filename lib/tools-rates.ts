/**
 * Rate cards and the shared rate bands, for the `/tools/*` calculators.
 *
 * Split out of `lib/tools.ts` for ONE reason, and it is a bundling reason rather
 * than an organisational one. `BrandFeeCalculator` and `ToolKit` are both
 * `"use client"` modules, and both need these. Importing them from `lib/tools.ts`
 * pulled the entire tool registry, including `lib/tools-more.ts`, into the client
 * chunk that every `/tools/*` page loads. `/tools/[tool]` is a single route, so
 * anything a widget imports ships everywhere.
 *
 * Keep this module free of page copy and free of registry imports.
 *
 * `lib/tools.ts` re-exports everything here, so server code and the existing
 * import sites are unaffected.
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

export type RateCardKey = "stripe" | "paypal" | "square";

// ---------------------------------------------------------------------------
// Rate cards
// ---------------------------------------------------------------------------

/**
 * US published rate cards for the three brand calculators.
 *
 * Every figure here was read off the processor's own US schedule on the `checked`
 * date. The competing calculators that rank for these terms are measurably
 * stale (one page dated July 2026 still computes Square's pre-increase in-person
 * rate, and another carries a PayPal rate inside a Square calculator), so being
 * right is the whole differentiator. Treat an unverified edit to this object as
 * a content bug, not a tweak.
 */
export const RATE_CARDS: Record<RateCardKey, RateCard> = {
  stripe: {
    key: "stripe",
    processorName: "Stripe",
    processorSlug: "stripe",
    checked: "1 September 2026",
    sources: [{ label: "stripe.com/pricing", url: "https://stripe.com/pricing" }],
    plans: [{ id: "standard", label: "Standard pricing", monthly: 0 }],
    channels: [
      {
        id: "online",
        label: "Online cards and wallets",
        note: "Domestic cards, the standard rate most accounts pay.",
        rates: { standard: { rate: 2.9, fixed: 0.3 } },
      },
      {
        id: "terminal",
        label: "In person (Terminal)",
        note: "Card present. Tap to Pay adds $0.10 per authorization.",
        rates: { standard: { rate: 2.7, fixed: 0.05 } },
      },
      {
        id: "link",
        label: "Instant bank payments",
        note: "Bank payments confirmed at card speed.",
        rates: { standard: { rate: 2.6, fixed: 0.3 } },
      },
      {
        id: "ach",
        label: "ACH Direct Debit",
        note: "Capped at $5.00 per transaction, which is why it wins on large tickets.",
        rates: { standard: { rate: 0.8, fixed: 0 } },
      },
    ],
    addOns: [
      {
        id: "keyed",
        label: "Card details typed in manually",
        rate: 0.5,
        note: "Applies on top of the online rate.",
      },
      { id: "intl", label: "Card issued outside the US", rate: 1.5 },
      { id: "fx", label: "Currency conversion required", rate: 1 },
    ],
    extras: [
      { label: "Dispute received fee", value: "$15.00 per dispute" },
      { label: "Instant payouts", value: "1.5% of volume, minimum $0.50" },
      { label: "Standard payouts", value: "Free" },
      { label: "Monthly account fee", value: "None on standard pricing" },
    ],
  },

  paypal: {
    key: "paypal",
    processorName: "PayPal",
    processorSlug: "paypal",
    checked: "27 August 2026",
    sources: [
      {
        label: "paypal.com US business fees (page states last updated 15 July 2026)",
        url: "https://www.paypal.com/us/business/paypal-business-fees",
      },
    ],
    plans: [{ id: "standard", label: "Standard US seller rates", monthly: 0 }],
    channels: [
      {
        id: "checkout",
        label: "PayPal Checkout",
        note: "Also Guest Checkout and Pay with Venmo. The default rate for a PayPal button.",
        rates: { standard: { rate: 3.49, fixed: 0.49 } },
      },
      {
        id: "cards",
        label: "Standard card payments",
        note: "A card entered on your own site rather than through the PayPal wallet.",
        rates: { standard: { rate: 2.99, fixed: 0.49 } },
      },
      {
        id: "advanced",
        label: "Advanced card payments",
        note: "The upgraded card processing product, subject to approval.",
        rates: { standard: { rate: 2.89, fixed: 0.49 } },
      },
      {
        id: "invoice",
        label: "Invoicing",
        note: "An invoice paid through PayPal Checkout or Venmo.",
        rates: { standard: { rate: 3.49, fixed: 0.49 } },
      },
      {
        id: "qr",
        label: "QR code in person",
        note: "The cheapest PayPal channel, and the one most sellers never switch on.",
        rates: { standard: { rate: 2.29, fixed: 0.09 } },
      },
      {
        id: "pos",
        label: "PayPal Point of Sale, card present",
        rates: { standard: { rate: 2.29, fixed: 0.09 } },
      },
      {
        id: "vt",
        label: "Virtual Terminal",
        note: "Phone and mail orders keyed in by you.",
        rates: { standard: { rate: 3.39, fixed: 0.49 } },
      },
      {
        id: "paylater",
        label: "PayPal Pay Later",
        rates: { standard: { rate: 4.99, fixed: 0.49 } },
      },
      {
        id: "micro",
        label: "Micropayments",
        note: "Opt-in pricing. Cheaper only on very small tickets, roughly under $12.",
        rates: { standard: { rate: 4.99, fixed: 0.09 } },
      },
      {
        id: "ach",
        label: "ACH services",
        note: "Capped at $5.00 per transaction.",
        rates: { standard: { rate: 0.8, fixed: 0 } },
      },
    ],
    addOns: [
      {
        id: "intl",
        label: "Buyer outside the US",
        rate: 1.5,
        note: "Added to whichever domestic rate applies.",
      },
    ],
    extras: [
      { label: "Chargeback fee", value: "$20.00" },
      { label: "Standard dispute fee", value: "$15.00" },
      { label: "Currency conversion spread", value: "3.00% to 4.00% depending on transaction type" },
      { label: "Monthly account fee", value: "None on standard rates" },
    ],
  },

  square: {
    key: "square",
    processorName: "Square",
    processorSlug: "square",
    checked: "12 August 2026",
    sources: [
      { label: "squareup.com US pricing", url: "https://squareup.com/us/en/pricing" },
      { label: "squareup.com payments fees", url: "https://squareup.com/us/en/payments/our-fees" },
    ],
    plans: [
      { id: "free", label: "Square Free", monthly: 0 },
      { id: "plus", label: "Square Plus", monthly: 49, note: "Per location." },
      { id: "premium", label: "Square Premium", monthly: 149, note: "Per location." },
    ],
    channels: [
      {
        id: "inperson",
        label: "Tap, dip or swipe",
        note: "Card present. The rate Square raised in 2026, and the one most ranking calculators still get wrong.",
        rates: {
          free: { rate: 2.6, fixed: 0.15 },
          plus: { rate: 2.5, fixed: 0.15 },
          premium: { rate: 2.4, fixed: 0.15 },
        },
      },
      {
        id: "online",
        label: "Online and invoices",
        note: "Square groups invoice payments WITH online, which is where the plan difference bites hardest.",
        rates: {
          free: { rate: 3.3, fixed: 0.3 },
          plus: { rate: 2.9, fixed: 0.3 },
          premium: { rate: 2.9, fixed: 0.3 },
        },
      },
      {
        id: "api",
        label: "Online API",
        note: "Payments taken inside your own app or site through Square's APIs.",
        rates: {
          free: { rate: 2.9, fixed: 0.3 },
          plus: { rate: 2.9, fixed: 0.3 },
          premium: { rate: 2.9, fixed: 0.3 },
        },
      },
      {
        id: "keyed",
        label: "Manual entry or card on file",
        rates: {
          free: { rate: 3.5, fixed: 0.15 },
          plus: { rate: 3.5, fixed: 0.15 },
          premium: { rate: 3.5, fixed: 0.15 },
        },
      },
      {
        id: "afterpay",
        label: "Afterpay",
        rates: {
          free: { rate: 6, fixed: 0.3 },
          plus: { rate: 6, fixed: 0.3 },
          premium: { rate: 6, fixed: 0.3 },
        },
      },
      {
        id: "ebt",
        label: "EBT",
        note: "Fees waived while the feature is in beta.",
        rates: {
          free: { rate: 1.8, fixed: 0.05 },
          plus: { rate: 1.8, fixed: 0.05 },
          premium: { rate: 1.8, fixed: 0.05 },
        },
      },
    ],
    addOns: [{ id: "intl", label: "Card issued outside the US", rate: 1.5 }],
    extras: [
      { label: "ACH by invoice", value: "1%, $1 minimum, $10 fee cap on Plus and Premium" },
      { label: "Gift card load", value: "2.5% on Free and Plus, 0% on Premium" },
      { label: "Monthly plan fee", value: "$0, $49 or $149 per location" },
      { label: "Standard payouts", value: "Next business day" },
    ],
  },
};

export const getRateCard = (key: RateCardKey): RateCard => RATE_CARDS[key];

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
