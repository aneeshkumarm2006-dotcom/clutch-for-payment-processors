/**
 * Authorize.Net's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure below was read off Authorize.Net's own
 * published US pricing page on the `checked` date recorded here, with the source
 * beside it. A wrong number renders identically to a right one, so do not move
 * `checked` without re-reading the source, and treat an unverified edit as a
 * content bug.
 *
 * ─── Why this card is shaped differently to Stripe's or Square's ──────────────
 * Authorize.Net is a GATEWAY, not a processor, and it sells two different
 * shapes of the same product. That distinction is the whole reason the page
 * exists, and it has to survive inside the shared `RateCard` structure:
 *
 *   All-in-One            $25.00 a month, 2.9% + $0.30. The merchant account is
 *                         bundled, so the card rate IS Authorize.Net's money.
 *   Payment Gateway Only  $25.00 a month, $0.10 per transaction, plus a $0.10
 *                         DAILY BATCH FEE. You bring your own merchant account,
 *                         and its discount rate is set and billed by your
 *                         merchant service provider. None of that percentage is
 *                         Authorize.Net's money and none of it is on this page's
 *                         source.
 *
 * Two consequences for anyone editing this file:
 *
 * 1. THE BATCH FEE IS FOLDED INTO THE PLAN'S MONTHLY FIGURE, DELIBERATELY.
 *    `BrandFeeCalculator` models exactly three cost lines: a percentage, a per
 *    transaction fixed fee, and a monthly plan fee. A per-settled-batch charge
 *    is a fourth shape it cannot express, and the batch fee is the single cost
 *    every competing Authorize.Net calculator drops. Rather than drop it too,
 *    the gateway-only plans carry $25.00 + ($0.10 x 250 US business days / 12),
 *    which is $25.00 + $2.08 = $27.08 a month. 250 is the count of 2026 weekdays
 *    (261) less the eleven federal holidays, all of which fall on a weekday in
 *    2026. The plan `note` says so on the page, and the assumptions block on the
 *    tool says so again. If you change the batch fee or the business-day basis,
 *    change both numbers and both sentences.
 *
 * 2. THE MERCHANT ACCOUNT RATE IS A USER ASSUMPTION, NOT A PUBLISHED FIGURE.
 *    On the gateway-only plans the percentage column is whatever the merchant's
 *    own acquirer charges, which Authorize.Net does not publish and cannot. The
 *    plan list therefore offers the same gateway-only plan at three named
 *    discount rates, plus a fees-only variant at 0%, so a merchant can pick the
 *    one matching their statement. Those percentages are labelled as the user's
 *    assumption in the plan label itself. They are NOT claims about market
 *    pricing and must never be presented as such.
 */

import type { RateCard } from "@/lib/tools-rates";

export const AUTHORIZE_NET_RATE_CARD: RateCard = {
  key: "authorize-net",
  processorName: "Authorize.Net",
  processorSlug: "authorize-net",
  checked: "5 September 2026",
  sources: [
    {
      label: "Authorize.Net US pricing page",
      url: "https://www.authorize.net/en-us/sign-up/pricing.html",
    },
    {
      label: "Authorize.Net Merchant Interface fee definitions",
      url: "https://account.authorize.net/help/account/Merchant_Profile/Fee_Definitions.htm",
    },
    {
      label: "Authorize.Net support: transaction cut-off time and settlement",
      url: "https://support.authorize.net/knowledgebase/article/000001244/en-us",
    },
  ],
  plans: [
    {
      id: "allinone",
      label: "All-in-One, merchant account included",
      monthly: 25,
      note: "Authorize.Net quotes $25.00 a month plus 2.9% and 30 cents per transaction. The merchant account is bundled, and no daily batch fee is listed on this plan.",
    },
    {
      id: "gateway",
      label: "Gateway only, Authorize.Net fees alone",
      monthly: 27.08,
      note: "The $25.00 gateway fee plus the 10 cent daily batch fee annualized over 250 US business days, which is $2.08 a month. Your merchant account's discount rate is set and billed by your merchant service provider and is not counted here.",
    },
    {
      id: "gateway-190",
      label: "Gateway only, plus a 1.90% merchant account",
      monthly: 27.08,
      note: "Same Authorize.Net fees, with a 1.90% discount rate added so the total cost of acceptance is visible. The 1.90% is your assumption from your own statement, not an Authorize.Net published rate.",
    },
    {
      id: "gateway-225",
      label: "Gateway only, plus a 2.25% merchant account",
      monthly: 27.08,
      note: "Same Authorize.Net fees, with a 2.25% discount rate added so the total cost of acceptance is visible. The 2.25% is your assumption from your own statement, not an Authorize.Net published rate.",
    },
    {
      id: "gateway-260",
      label: "Gateway only, plus a 2.60% merchant account",
      monthly: 27.08,
      note: "Same Authorize.Net fees, with a 2.60% discount rate added so the total cost of acceptance is visible. The 2.60% is your assumption from your own statement, not an Authorize.Net published rate.",
    },
  ],
  channels: [
    {
      id: "card",
      label: "Card payment",
      note: "On All-in-One the 2.9% is Authorize.Net's own rate. On the gateway-only plans Authorize.Net charges 10 cents per transaction and nothing else per sale, so the percentage shown is the merchant account rate you picked in the plan list.",
      rates: {
        allinone: { rate: 2.9, fixed: 0.3 },
        gateway: { rate: 0, fixed: 0.1 },
        "gateway-190": { rate: 1.9, fixed: 0.1 },
        "gateway-225": { rate: 2.25, fixed: 0.1 },
        "gateway-260": { rate: 2.6, fixed: 0.1 },
      },
    },
    {
      id: "echeck",
      label: "eCheck.Net bank payment (ACH)",
      note: "Authorize.Net prices eCheck.Net at 0.75% of the transaction with a $10.00 eCheck.Net minimum monthly fee, which this calculator does not apply. The 10 cent per transaction fee and the daily batch fee are listed against credit card volume.",
      rates: {
        allinone: { rate: 0.75, fixed: 0 },
        gateway: { rate: 0.75, fixed: 0 },
        "gateway-190": { rate: 0.75, fixed: 0 },
        "gateway-225": { rate: 0.75, fixed: 0 },
        "gateway-260": { rate: 0.75, fixed: 0 },
      },
    },
  ],
  // Authorize.Net publishes no percentage surcharges of its own: no keyed
  // uplift, no international uplift, no currency conversion line. On the
  // gateway-only plans it cannot, because the percentage belongs to somebody
  // else. Leaving this empty hides the add-on fieldset in the widget, which is
  // the correct rendering rather than an omission.
  addOns: [],
  extras: [
    { label: "Setup fee", value: "$0.00" },
    { label: "Contract or cancellation fee", value: "None published" },
    { label: "Daily batch fee, gateway-only plans", value: "$0.10 per settled batch" },
    { label: "Batch fee over 250 US business days", value: "$25.00 a year, $2.08 a month" },
    { label: "eCheck.Net discount rate", value: "0.75%" },
    { label: "eCheck.Net minimum monthly fee", value: "$10.00" },
    { label: "eCheck.Net returned item fee", value: "$3.00" },
    { label: "Account Updater", value: "$0.25 per update" },
    { label: "Advanced Fraud Detection Suite", value: "No monthly fee" },
    { label: "Customer Information Manager", value: "No monthly fee" },
    { label: "Default transaction cut-off", value: "4:00 PM Pacific, one batch a day" },
    {
      label: "Merchant account rate on gateway only",
      value: "Set by your merchant service provider, not by Authorize.Net",
    },
  ],
};
