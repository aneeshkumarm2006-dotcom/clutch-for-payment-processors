/**
 * Shopify's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure was read off Shopify's own published US
 * pricing page on the `checked` date recorded below. A wrong number renders
 * identically to a right one, so do not move `checked` without re-reading the
 * source, and treat an unverified edit as a content bug. Shopify has renamed and
 * repriced its plans twice in recent years, which is precisely the failure mode
 * this page exists to beat, so this card rots faster than most.
 *
 * HOW IT WAS READ. shopify.com geo-redirects this machine to Indian rupee
 * pricing, so the figures come from the Wayback capture of the US page taken on
 * 4 September 2026, and `checked` is that CAPTURE date rather than today.
 *
 * THREE MODELLING DECISIONS WORTH UNDERSTANDING BEFORE EDITING
 *
 * 1. PLANS ARE BILLING TERMS, NOT JUST TIERS. `RateCard` has one `monthly` per
 *    plan and no billing-term field, and Shopify's annual discount is large
 *    (Basic $39 falls to $29, Advanced $399 to $299). Rather than hide a third
 *    of the cost difference, each tier appears twice, once per billing term. The
 *    per-transaction rates are identical inside a tier, because Shopify prices
 *    the card rate off the tier and not off how you pay for the plan.
 *
 * 2. SHOPIFY PLUS IS DELIBERATELY ABSENT FROM THE SELECTOR. Shopify publishes
 *    only two Plus numbers: "from $2,300" a month and "card rates from 2.25% +
 *    30c", and prints "Most competitive rates" in every other Plus cell of its
 *    own comparison table. There is no published Plus in-person rate, no
 *    published Plus premium-card rate, and Plus pricing is negotiated anyway.
 *    `channelRate` falls back to the FIRST plan when a plan id is missing from a
 *    channel, so a half-populated Plus plan would silently quote Basic's rate on
 *    the channels Shopify does not publish. The two figures Shopify does publish
 *    are carried in `extras` and in the page's rate table instead, where they can
 *    be labelled as the partial disclosure they are.
 *
 * 3. THE THIRD-PARTY GATEWAY CHANNEL IS A SUM, AND ONE HALF OF IT IS STRIPE'S.
 *    Shopify's third-party transaction fee (2%, 1%, 0.6%) buys no processing at
 *    all: it is charged on top of whatever the outside gateway charges. Modelling
 *    it as an `addOn` would be wrong, because add-ons in this type carry ONE rate
 *    for all plans and this fee is the single most plan-sensitive number Shopify
 *    publishes. It is modelled as two channels instead: `third-party-total`,
 *    which adds Stripe's published US online rate of 2.9% + $0.30 to Shopify's
 *    fee, and `third-party-fee`, which is Shopify's cut alone for merchants on a
 *    gateway priced differently. If Stripe's US rate moves, `third-party-total`
 *    moves with it; the source for that half is `lib/rate-cards/stripe.ts`.
 */

import type { RateCard } from "@/lib/tools-rates";

/**
 * Shopify's third-party transaction fee by tier, the fee that buys no processing.
 *
 * The other half of the `third-party-total` channel is Stripe's published US
 * online rate, 2.9% + $0.30, which lives in `lib/rate-cards/stripe.ts`.
 */
const GATEWAY_FEE = { basic: 2, grow: 1, advanced: 0.6 } as const;

export const SHOPIFY_RATE_CARD: RateCard = {
  key: "shopify",
  processorName: "Shopify",
  // There is no /processor/shopify listing on this site. Nothing renders this
  // field in the tools UI, and the page links to /payment-processors/for-shopify
  // instead, so it points at the listing for the gateway the page prices against.
  processorSlug: "stripe",
  checked: "4 September 2026",
  sources: [
    { label: "shopify.com US pricing", url: "https://www.shopify.com/pricing" },
    {
      label: "Wayback capture of shopify.com/pricing, 4 September 2026",
      url: "https://web.archive.org/web/20260904164805/https://www.shopify.com/pricing",
    },
    { label: "stripe.com/pricing, for the third-party gateway half", url: "https://stripe.com/pricing" },
  ],
  plans: [
    { id: "basic-m", label: "Basic, billed monthly", monthly: 39 },
    { id: "basic-y", label: "Basic, billed yearly", monthly: 29, note: "Same card rates, cheaper plan fee." },
    { id: "grow-m", label: "Grow, billed monthly", monthly: 105 },
    { id: "grow-y", label: "Grow, billed yearly", monthly: 79 },
    { id: "advanced-m", label: "Advanced, billed monthly", monthly: 399 },
    { id: "advanced-y", label: "Advanced, billed yearly", monthly: 299 },
  ],
  channels: [
    {
      id: "online",
      label: "Online, Shopify Payments",
      note: "Shopify's standard online card rate. The plan you are on is what moves it.",
      rates: {
        "basic-m": { rate: 2.9, fixed: 0.3 },
        "basic-y": { rate: 2.9, fixed: 0.3 },
        "grow-m": { rate: 2.7, fixed: 0.3 },
        "grow-y": { rate: 2.7, fixed: 0.3 },
        "advanced-m": { rate: 2.5, fixed: 0.3 },
        "advanced-y": { rate: 2.5, fixed: 0.3 },
      },
    },
    {
      id: "online-premium",
      label: "Online, premium card",
      note: "Shopify prices rewards and commercial cards on a separate, higher line. Most calculators ignore it.",
      rates: {
        "basic-m": { rate: 3.5, fixed: 0.3 },
        "basic-y": { rate: 3.5, fixed: 0.3 },
        "grow-m": { rate: 3.3, fixed: 0.3 },
        "grow-y": { rate: 3.3, fixed: 0.3 },
        "advanced-m": { rate: 3.1, fixed: 0.3 },
        "advanced-y": { rate: 3.1, fixed: 0.3 },
      },
    },
    {
      id: "inperson",
      label: "In person, Shopify POS",
      note: "Card present. The fixed fee is 10 cents rather than 30, which matters most on small tickets.",
      rates: {
        "basic-m": { rate: 2.6, fixed: 0.1 },
        "basic-y": { rate: 2.6, fixed: 0.1 },
        "grow-m": { rate: 2.5, fixed: 0.1 },
        "grow-y": { rate: 2.5, fixed: 0.1 },
        "advanced-m": { rate: 2.4, fixed: 0.1 },
        "advanced-y": { rate: 2.4, fixed: 0.1 },
      },
    },
    {
      id: "inperson-keyed",
      label: "In person, manually keyed",
      note: "3.5% + 10 cents on every plan. Upgrading does not improve this one.",
      rates: {
        "basic-m": { rate: 3.5, fixed: 0.1 },
        "basic-y": { rate: 3.5, fixed: 0.1 },
        "grow-m": { rate: 3.5, fixed: 0.1 },
        "grow-y": { rate: 3.5, fixed: 0.1 },
        "advanced-m": { rate: 3.5, fixed: 0.1 },
        "advanced-y": { rate: 3.5, fixed: 0.1 },
      },
    },
    {
      id: "third-party-total",
      label: "Online through a third-party gateway, all in",
      note: "Stripe's published US rate of 2.9% + 30 cents PLUS Shopify's third-party transaction fee. Two bills, one order.",
      // Written as literals, not as STRIPE_ONLINE_RATE + GATEWAY_FEE.x, because
      // 2.9 + 0.6 in IEEE 754 is 3.5000000000000004 and that artifact would leak
      // into every downstream product. The sum each literal encodes is beside it.
      rates: {
        "basic-m": { rate: 4.9, fixed: 0.3 }, // 2.9 + 2.0
        "basic-y": { rate: 4.9, fixed: 0.3 }, // 2.9 + 2.0
        "grow-m": { rate: 3.9, fixed: 0.3 }, // 2.9 + 1.0
        "grow-y": { rate: 3.9, fixed: 0.3 }, // 2.9 + 1.0
        "advanced-m": { rate: 3.5, fixed: 0.3 }, // 2.9 + 0.6
        "advanced-y": { rate: 3.5, fixed: 0.3 }, // 2.9 + 0.6
      },
    },
    {
      id: "third-party-fee",
      label: "Shopify's third-party fee on its own",
      note: "Platform rent only, with no processing in it. Use this if your gateway is not priced like Stripe, then add your gateway's own fee.",
      rates: {
        "basic-m": { rate: GATEWAY_FEE.basic, fixed: 0 },
        "basic-y": { rate: GATEWAY_FEE.basic, fixed: 0 },
        "grow-m": { rate: GATEWAY_FEE.grow, fixed: 0 },
        "grow-y": { rate: GATEWAY_FEE.grow, fixed: 0 },
        "advanced-m": { rate: GATEWAY_FEE.advanced, fixed: 0 },
        "advanced-y": { rate: GATEWAY_FEE.advanced, fixed: 0 },
      },
    },
    {
      id: "paypal-wallet",
      label: "PayPal Wallet through Shopify",
      note: "Shopify lists this from 3.49% + 49 cents on every plan, in the Shopify Payments block of its own pricing table.",
      rates: {
        "basic-m": { rate: 3.49, fixed: 0.49 },
        "basic-y": { rate: 3.49, fixed: 0.49 },
        "grow-m": { rate: 3.49, fixed: 0.49 },
        "grow-y": { rate: 3.49, fixed: 0.49 },
        "advanced-m": { rate: 3.49, fixed: 0.49 },
        "advanced-y": { rate: 3.49, fixed: 0.49 },
      },
    },
  ],
  addOns: [
    {
      id: "intl",
      label: "Card issued outside the US",
      rate: 1,
      note: "Shopify publishes this as online international rates, +1% on every plan.",
    },
  ],
  extras: [
    { label: "Plan fee, billed monthly", value: "$39 Basic, $105 Grow, $399 Advanced, per store" },
    { label: "Plan fee, billed yearly", value: "$29 Basic, $79 Grow, $299 Advanced, per store" },
    { label: "Third-party transaction fee", value: "2% Basic, 1% Grow, 0.6% Advanced, 0.2% Plus" },
    { label: "Shopify Payments transaction fee", value: "None. The third-party fee applies only to outside gateways" },
    { label: "Shopify Plus", value: "From $2,300 a month, card rates from 2.25% + $0.30, third-party fee 0.2%" },
    { label: "POS Pro", value: "$89 a month per location, on top of the plan" },
    { label: "Marketplace order sync", value: "Free to 50 orders a month, then 1% capped at $99 a month" },
    { label: "USDC payments", value: "2.9%, 2.7% or 2.5% + $0.30 by plan" },
  ],
};
