/**
 * Refund fee policies, per US processor
 *
 * Generated reference data for the `/tools/*` calculators. The maintenance
 * contract is in `lib/tools-data/index.ts`: every figure here was read from a
 * primary source on the date recorded beside it, and a checked date must never
 * be moved without re-reading the source.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Splitting these is what keeps the 290 row MCC table off
 * the Stripe fee calculator. Do not merge them back into one file, and do not
 * import from `lib/tools-data/index.ts` inside a `"use client"` module.
 *
 * ─── Why this module carries a status field ──────────────────────────────────
 *
 * The whole page turns on one claim: when you refund a customer, most US
 * processors do not give the processing fee back. That claim is only worth
 * making per processor, with the processor's own words next to it, because a
 * merchant reading this page is about to decide whether to argue with support.
 * So every row carries `quote`, the sentence the policy was read from, and
 * `source`, the document and the date it was read.
 *
 * Where a processor does not publish the answer, the row is `unverified` rather
 * than guessed. `SURCHARGE_STATES` carries an "Unclear" status for exactly the
 * same reason. An unverified row still renders, labelled as unverified, and the
 * widget warns before it prices anything with it. Adyen is the current example:
 * its refund documentation does not mention fees at all.
 *
 * ─── What the three flags mean ───────────────────────────────────────────────
 *
 * A card fee has two parts and a refund can return either, both or neither:
 *
 *   percentReturned  the percentage of the sale, prorated on a partial refund
 *   fixedReturned    the flat per-transaction fee
 *   refundFee        a NEW charge for processing the refund itself
 *
 * Every verified row below is false, false and (except Authorize.net) zero. That
 * uniformity is the finding, not an oversight, and the flags exist so the widget
 * can still price a processor whose contract differs.
 */

export type RefundPolicyStatus = "verified" | "unverified";

export interface RefundFeePolicy {
  /** Processor slug. Matches `/processor/<slug>` where this site has a profile. */
  slug: string;
  name: string;
  /** "verified" means the quote below was read from the processor's own document. */
  status: RefundPolicyStatus;
  /** Does the percentage portion of the original fee come back on a refund? */
  percentReturned: boolean;
  /** Does the fixed per-transaction fee come back on a refund? */
  fixedReturned: boolean;
  /** A fee charged to process the refund itself, in US dollars. Usually zero. */
  refundFee: number;
  /** How partial refunds are treated, which is where processors differ most. */
  partialTreatment: string;
  /** Anything a merchant needs to know before acting on the row. */
  note: string;
  /** The sentence the flags were read from. Verbatim, with straight quotes. */
  quote: string;
  /** Publisher, document, and the date it was checked. */
  source: string;
}

export interface RefundDefaults {
  processorSlug: string;
  monthlyVolume: number;
  monthlyTransactions: number;
  returnRatePct: number;
  ratePct: number;
  fixedFee: number;
  restockingPerReturn: number;
  returnShippingPerReturn: number;
  orderValue: number;
  refundAmount: number;
}

/**
 * Widget default state, held here rather than as magic strings in the component.
 *
 * The volume and count describe a mid-sized US online store: $180,000 a month
 * across 2,000 orders, which is a $90 average order value. The 19.3 percent
 * return rate is not invented either: it is the online return rate the National
 * Retail Federation and Happy Returns published on 15 October 2025. The card
 * rate is the most common US flat rate, 2.9 percent plus 30 cents.
 *
 * Handling costs default to zero on purpose. Nobody publishes a credible average
 * cost to inspect, repack and restock a returned item, so the fields start empty
 * of any claim and the page says to enter your own.
 */
export const REFUND_DEFAULTS: RefundDefaults = {
  processorSlug: "stripe",
  monthlyVolume: 180000,
  monthlyTransactions: 2000,
  returnRatePct: 19.3,
  ratePct: 2.9,
  fixedFee: 0.3,
  restockingPerReturn: 0,
  returnShippingPerReturn: 0,
  orderValue: 90,
  refundAmount: 90,
};

/** The id the widget uses for "my processor is not listed". Never a data row. */
export const REFUND_CUSTOM_ID = "custom";

/** Return rates the sensitivity ladder is priced at, in percent. */
export const REFUND_SENSITIVITY_LADDER: number[] = [0, 5, 10, 15, 20, 25, 30];

/**
 * US return rate benchmarks, sourced rather than estimated.
 *
 * One publisher, one release, so the three figures are comparable with each
 * other. Mixing a retail figure from one survey with an ecommerce figure from
 * another is how a benchmark band ends up meaningless.
 */
export const REFUND_RATE_BENCHMARKS: { label: string; ratePct: number; source: string }[] = [
  {
    label: "All US retail sales",
    ratePct: 15.8,
    source:
      "National Retail Federation and Happy Returns, 2025 Retail Returns Landscape, press release 15 October 2025, checked 5 September 2026",
  },
  {
    label: "US online sales",
    ratePct: 19.3,
    source:
      "National Retail Federation and Happy Returns, 2025 Retail Returns Landscape, press release 15 October 2025, checked 5 September 2026",
  },
  {
    label: "US holiday season sales",
    ratePct: 17,
    source:
      "National Retail Federation and Happy Returns, 2025 Retail Returns Landscape, press release 15 October 2025, checked 5 September 2026",
  },
];

/**
 * Per-processor refund fee treatment.
 *
 * Ordered by how often a US merchant meets them, not alphabetically, because
 * this list is also the widget's select and the first row is the default.
 */
export const REFUND_FEE_POLICIES: RefundFeePolicy[] = [
  {
    slug: "stripe",
    name: "Stripe",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment:
      "Stripe supports partial refunds and states no proration of the original fee, so refunding half an order returns none of the fee on the half you gave back.",
    note: "Stripe charges nothing to issue a card refund, and cancelling an uncaptured payment costs nothing at all, which is why manual capture is the cheap route for a business that reverses a lot of orders soon after checkout. Stripe's own page recommends it.",
    quote: "Stripe's processing fees from the original transaction aren't returned.",
    source: "Stripe documentation, Refund and cancel payments, docs.stripe.com/refunds, checked 5 September 2026",
  },
  {
    slug: "paypal",
    name: "PayPal",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment:
      "PayPal's US merchant fees page applies the same sentence to full and partial refunds. Nothing comes back either way. This is a change from PayPal's pre-2019 policy, which returned the percentage and kept the fixed fee, and stale calculators still model the old rule.",
    note: "PayPal charges no fee to issue the refund itself. The fees at stake are the ones you already paid to receive the payment, which on PayPal Checkout is the most expensive common US rate.",
    quote:
      "If you refund a Commercial Transaction or an Invoicing Transaction payment, there are no fees to make the refund, but the fees you originally paid to receive the payment are not returned to you.",
    source: "PayPal US merchant fees page, paypal.com/us/webapps/mpp/merchant-fees, checked 5 September 2026",
  },
  {
    slug: "square",
    name: "Square",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment:
      "Square's announcement names full and partial refunds together, so a partial refund returns no share of the fee.",
    note: "Square used to return processing fees on refunds and stopped. The change took effect for US sellers on 11 April 2023, immediately for sellers who joined from 1 March 2023. Square's stated reason is that it does not recoup those fees in full from its own partners. Any calculator still showing Square returning fees was built before that date.",
    quote: "When you refund a payment, the processing fees for the payment aren't refunded back to you.",
    source:
      "Square Support Center, Manage customer refunds (squareup.com/help/us/en/article/6116-process-refunds), with the effective dates from Square Policy and Pricing Updates (squareup.com/us/en/press/policy-and-pricing-updates), both checked 5 September 2026",
  },
  {
    slug: "braintree",
    name: "Braintree",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment:
      "The published US fee schedule states the rule for refunded transactions without distinguishing full from partial, so treat a partial refund as returning nothing.",
    note: "Braintree is PayPal's platform and prints the rule at the top of its US fee schedule rather than burying it in a help article. The US standard rate on that schedule is 2.89 percent plus 29 cents, so a refunded $90 order leaves $2.89 behind.",
    quote: "Transaction fees charged by PayPal Braintree will not be returned for refunded transactions.",
    source: "PayPal Braintree Fees, US schedule, last updated 13 January 2025, paypalobjects.com, checked 5 September 2026",
  },
  {
    slug: "helcim",
    name: "Helcim",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment:
      "Helcim allows partial refunds on card transactions but not on ACH, which can only be refunded in full. The original processing fee stands either way.",
    note: "Helcim draws the sharpest line in the industry between a void and a refund, and it is worth copying: a voided transaction incurs no processing fee at all, so reversing a sale before the batch closes costs nothing while refunding the same sale the next morning costs the whole fee. Interchange plus pricing does not change that.",
    quote:
      "Transactions that are voided do not incur any processing fees. The original processing fees for the transaction are applied.",
    source: "Helcim documentation, The difference between refunds and voids, learn.helcim.com/docs/what-are-refunds-voids, checked 5 September 2026",
  },
  {
    slug: "shopify-payments",
    name: "Shopify Payments",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment:
      "Shopify's page states the rule for refunds generally and describes no proration, so a partial refund returns no share of the card fee.",
    note: "The rule applies whether or not the order was ever fulfilled, which surprises stores that cancel unshipped orders. Cancelling before the payment is captured is the only free reversal.",
    quote:
      "When processing a refund, no additional transaction fee is incurred. However, the original credit card transaction fee isn't refunded to you when issuing a refund.",
    source: "Shopify Help Center, Shopify Payments refunds, help.shopify.com, checked 5 September 2026",
  },
  {
    slug: "authorize-net",
    name: "Authorize.net",
    status: "verified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0.1,
    partialTreatment:
      "The gateway fee is charged per transaction submitted, so a partial refund costs the same 10 cents as a full one, and two partial refunds against one order cost 20 cents.",
    note: "Authorize.net is the one common US name that charges you to issue the refund. Scope matters here: the verified figures are the gateway's own per-transaction fee, which is charged on the refund and not returned on the sale. On the Gateway Only plan the discount rate sits with a separate merchant account and that acquirer decides how it treats refunds, so ask them rather than assuming this row covers it.",
    quote:
      "The credit card transaction types for which the per-transaction fee is charged are: charges, refunds, voids and declines.",
    source: "Authorize.net Merchant Interface help, Fee Definitions, account.authorize.net, checked 5 September 2026",
  },
  {
    slug: "adyen",
    name: "Adyen",
    status: "unverified",
    percentReturned: false,
    fixedReturned: false,
    refundFee: 0,
    partialTreatment: "Not published. Adyen's refund documentation describes the mechanics and says nothing about fees.",
    note: "Adyen's public refund documentation does not mention fees in any form, and Adyen prices on interchange++ under a contract rather than a public flat schedule, so the answer is likely to be in your agreement rather than on the website. The flags on this row are the industry default and are shown as unverified for that reason. Ask your account manager, then price the answer here.",
    quote: "",
    source: "Adyen documentation, Refund (docs.adyen.com/online-payments/refund), read 5 September 2026: no fee treatment stated",
  },
];

export function getRefundPolicy(slug: string): RefundFeePolicy | undefined {
  return REFUND_FEE_POLICIES.find((p) => p.slug === slug);
}
