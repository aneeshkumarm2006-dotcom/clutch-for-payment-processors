/**
 * Chargeback cost, representment economics and monitoring escalation
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
 * ─── WHY THIS IS NOT `lib/tools-data/chargebacks.ts` ─────────────────────────
 * That module belongs to `/tools/chargeback-ratio-calculator` and holds the
 * network monitoring THRESHOLDS: the ratio and count that decide whether a
 * merchant is identified. This module holds the money that starts moving AFTER
 * that question is answered: what one dispute costs, what fighting it is worth,
 * and the assessment ladder a merchant pays once a program has picked them up.
 * Deliberately no threshold rows here. The threshold question has a page and it
 * is not this one.
 *
 * ─── THE HONEST BIT, WHICH IS THE POINT OF THE PAGE ─────────────────────────
 * Nobody publishes representment win rates by dispute reason category. Every
 * page that prints one is quoting a vendor's own book of business or nothing at
 * all. So `REPRESENTMENT_WIN_RATES` carries exactly ONE sourced rate, the
 * all-disputes average, and every category row repeats it with `sourced: false`
 * and says so. The categories exist to explain what actually decides the
 * outcome, which is checkable against published network rules, rather than to
 * assert a number that is not.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepresentmentBenchmark {
  id: string;
  label: string;
  /** Which dispute conditions or reason codes the category covers. */
  covers: string;
  /**
   * The win rate the widget preloads when this category is selected.
   *
   * READ `sourced` BEFORE USING THIS. It is a published figure on exactly one
   * row. On every other row it is the same all-disputes average repeated,
   * because no per-category benchmark is published by anyone whose sample is
   * disclosed. The widget renders it as an editable field with a warning, not
   * as a benchmark, and the copy tells the merchant to replace it with their own
   * last twelve months.
   */
  winRatePct: number;
  sourced: boolean;
  /**
   * What decides the outcome in this category. Every claim here is a rule a
   * network publishes, not an outcome statistic, which is why it can be stated
   * plainly where the win rate cannot.
   */
  mechanism: string;
  source: string;
}

export interface EscalationBand {
  /** First month in the program this band covers, counting the month of identification as 1. */
  fromMonth: number;
  /** Last month covered, or null for "and every month after". */
  toMonth: number | null;
  monthlyUsd: number;
}

export interface MonitoringEscalation {
  id: string;
  network: string;
  program: string;
  /** Monthly assessments, in order, non-overlapping and contiguous from month 1. */
  ladder: EscalationBand[];
  /**
   * An additional per-chargeback assessment charged only on the chargebacks
   * above a count, starting from a given month. Mastercard calls this issuer
   * recovery. Null where the program has none.
   */
  perChargebackOverCount: { overCount: number; usd: number; fromMonth: number } | null;
  /**
   * An additional assessment on EVERY qualifying event in the month rather than
   * on a monthly ladder. Visa's program works this way. Null where it does not
   * apply.
   */
  perEventUsd: number | null;
  /** True only where the network itself publishes the amounts. */
  published: boolean;
  note: string;
  source: string;
}

export interface ChargebackCostDefaults {
  averageOrderValue: number;
  costOfGoods: number;
  fulfillment: number;
  processingRatePct: number;
  processingFixed: number;
  chargebackFee: number;
  counterFee: number;
  counterFeeRefundedOnWin: boolean;
  staffMinutes: number;
  fightMinutes: number;
  staffHourlyRate: number;
  monthlyChargebacks: number;
  monthlyTransactions: number;
  fightSharePct: number;
  firstCycleWinRatePct: number;
  secondCycleLossPct: number;
  category: string;
  program: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * The widget's opening state, kept here so the defaults are data with sources
 * rather than magic numbers inside a component.
 *
 * Sourced values:
 *   staffHourlyRate 46.60  Total employer compensation costs for private
 *                          industry workers averaged USD 46.60 per hour worked
 *                          in March 2026. Bureau of Labor Statistics, Employer
 *                          Costs for Employee Compensation news release,
 *                          released 12 June 2026, read 5 September 2026. Wages
 *                          and salaries alone were USD 32.60; the loaded figure
 *                          is the right one for an hour of somebody's time.
 *   chargebackFee 15.00    Stripe's US dispute received fee, from
 *                          stripe.com/pricing as read for this site's Stripe
 *                          rate card on 1 September 2026. stripe.com
 *                          geo-redirects this machine, so it was not re-read on
 *                          5 September 2026.
 *   counterFee 15.00       Stripe's dispute countered fee, charged when you
 *                          submit evidence. Stripe's dispute fees FAQ at
 *                          support.stripe.com states "If you win the dispute,
 *                          the dispute countered fee is returned to you" and
 *                          does not print the amount, read 5 September 2026.
 *                          The USD 15.00 amount is from the same rate card read.
 *   firstCycleWinRatePct   44.6, see REPRESENTMENT_WIN_RATES.
 *   secondCycleLossPct 19  Merchants lose 19 percent of their first-cycle wins
 *                          to second-cycle escalations. Chargebacks911 2026
 *                          Chargeback Field Report, published 30 June 2026.
 *
 * Everything else is an illustrative merchant, not a benchmark: a US direct to
 * consumer store on flat-rate pricing at a 1.20 percent dispute rate. The user
 * is expected to overwrite all of it.
 */
export const CHARGEBACK_COST_DEFAULTS: ChargebackCostDefaults = {
  averageOrderValue: 120,
  costOfGoods: 48,
  fulfillment: 9,
  processingRatePct: 2.9,
  processingFixed: 0.3,
  chargebackFee: 15,
  counterFee: 15,
  counterFeeRefundedOnWin: true,
  staffMinutes: 45,
  fightMinutes: 60,
  staffHourlyRate: 46.6,
  monthlyChargebacks: 60,
  monthlyTransactions: 5000,
  fightSharePct: 60,
  firstCycleWinRatePct: 44.6,
  secondCycleLossPct: 19,
  category: "product-not-received",
  program: "mastercard-ecm",
};

// ---------------------------------------------------------------------------
// Representment
// ---------------------------------------------------------------------------

const FIELD_REPORT =
  "Chargebacks911 2026 Chargeback Field Report, published 30 June 2026, checked 5 September 2026";

const NO_CATEGORY_DATA =
  "No win rate is published for this category by any source that discloses its sample, so this row repeats the all-disputes average above rather than inventing a category figure. Replace it with your own last twelve months of outcomes before you trust the result. " +
  FIELD_REPORT;

/**
 * Representment outcomes, by dispute reason category.
 *
 * Exactly one row is sourced. That is not an oversight, it is the finding: the
 * industry publishes an average and nothing beneath it, and the pages that print
 * a table of win rates per reason code are quoting a vendor's own customers or
 * quoting each other.
 */
/**
 * The default row, named rather than indexed off the front of the array.
 *
 * Same reason `WORST_BAND` is named in `lib/tools-rates.ts`: with
 * `noUncheckedIndexedAccess` on, `ARRAY[0]` is typed `T | undefined`, so a
 * widget falling back to it inherits the undefined and has to defend against a
 * case that cannot happen. Naming the row makes the fallback total.
 */
const ALL_REASONS_BENCHMARK: RepresentmentBenchmark = {
  id: "all",
  label: "Any reason, all disputes represented",
  covers: "Every dispute condition, blended.",
  winRatePct: 44.6,
  sourced: true,
  mechanism:
    "The average across everything merchants chose to fight. It is a first-cycle figure: it counts the representment being accepted, not the case being closed. The same report puts net recovery across every chargeback received, fought or not, at 10.7 percent, and 19 percent of first-cycle wins are lost again at the second cycle.",
  source: FIELD_REPORT,
};

export const REPRESENTMENT_WIN_RATES: RepresentmentBenchmark[] = [
  ALL_REASONS_BENCHMARK,
  {
    id: "fraud-card-absent",
    label: "Fraud, card absent",
    covers: "Visa dispute condition 10.4, Mastercard reason code 4837.",
    winRatePct: 44.6,
    sourced: false,
    mechanism:
      "The outcome turns almost entirely on whether you can produce the evidence Visa's Compelling Evidence 3.0 framework asks for: two prior undisputed transactions by the same cardholder at least 120 days old, matched on device fingerprint or IP address plus account or delivery details. If you have that history the case is strong. If the disputed order is the cardholder's first with you, there is usually nothing to send.",
    source: NO_CATEGORY_DATA,
  },
  {
    id: "product-not-received",
    label: "Product or service not received",
    covers: "Visa dispute condition 13.1, Mastercard reason code 4855.",
    winRatePct: 44.6,
    sourced: false,
    mechanism:
      "The most evidence-driven category, because the question is objective. Tracked delivery to the address the order was placed with, signature where the carrier captured one, and a delivery date inside the promised window generally answer it. This is the category worth fighting hardest, and it is also the one where a fulfillment fix removes the disputes entirely rather than winning them.",
    source: NO_CATEGORY_DATA,
  },
  {
    id: "not-as-described",
    label: "Not as described, or defective",
    covers: "Visa dispute condition 13.3, Mastercard reason code 4853.",
    winRatePct: 44.6,
    sourced: false,
    mechanism:
      "Subjective, and the hardest of the categories to win on paper. The cardholder is asserting a quality judgment and you are answering with a product page and a returns policy. Where the cardholder did not attempt to return the item first, that is the strongest point you have, because both networks require the cardholder to try to resolve it with the merchant.",
    source: NO_CATEGORY_DATA,
  },
  {
    id: "subscription-recurring",
    label: "Cancelled recurring or subscription billing",
    covers: "Visa dispute condition 13.2, Mastercard reason code 4841.",
    winRatePct: 44.6,
    sourced: false,
    mechanism:
      "You win these on the cancellation record: when the customer signed up, what they agreed to, whether a cancellation request exists, and whether the charge fell before it. A subscription that can only be cancelled by emailing support produces disputes no evidence file will fix. Sending a refund the moment a cancellation lands is nearly always cheaper than the case.",
    source: NO_CATEGORY_DATA,
  },
  {
    id: "merchant-error",
    label: "Duplicate, credit not processed, processing error",
    covers: "Visa dispute conditions 12.6, 13.6 and 12.5, Mastercard reason codes 4834 and 4860.",
    winRatePct: 44.6,
    sourced: false,
    mechanism:
      "Usually a real mistake on your side, which makes representment the wrong tool. Fighting a duplicate charge you did make costs staff time and a countered fee to lose. The value in this category is in the count, not the outcome: it points at a billing bug, and fixing it removes every future dispute of the same shape.",
    source: NO_CATEGORY_DATA,
  },
];

// ---------------------------------------------------------------------------
// Monitoring program escalation
// ---------------------------------------------------------------------------

/**
 * What being identified by a monitoring program costs per month.
 *
 * These are ASSESSMENTS, not thresholds. Whether your ratio puts you inside one
 * of these programs is the question `/tools/chargeback-ratio-calculator`
 * answers, and it carries the ratio and count rows with their own sources. This
 * module starts from "you have been identified" and prices the ladder.
 *
 * Month 1 is the month the program identifies you, not the month you first
 * exceeded a ratio, and month 1 carries no assessment in either Mastercard tier.
 */
/**
 * The default row, named rather than indexed off the front of the array.
 *
 * Same reason `WORST_BAND` is named in `lib/tools-rates.ts`: with
 * `noUncheckedIndexedAccess` on, `ARRAY[0]` is typed `T | undefined`, so a
 * widget falling back to it inherits the undefined and has to defend against a
 * case that cannot happen. Naming the row makes the fallback total.
 */
const MASTERCARD_ECM_ESCALATION: MonitoringEscalation = {
  id: "mastercard-ecm",
  network: "Mastercard",
  program: "Excessive Chargeback Merchant (ECM)",
  ladder: [
    { fromMonth: 1, toMonth: 1, monthlyUsd: 0 },
    { fromMonth: 2, toMonth: 3, monthlyUsd: 1000 },
    { fromMonth: 4, toMonth: 6, monthlyUsd: 5000 },
    { fromMonth: 7, toMonth: 11, monthlyUsd: 25000 },
    { fromMonth: 12, toMonth: 18, monthlyUsd: 50000 },
    { fromMonth: 19, toMonth: null, monthlyUsd: 100000 },
  ],
  perChargebackOverCount: null,
  perEventUsd: null,
  published: false,
  note: "The ladder resets nothing on the way down: exit requires three consecutive months back below the ECM line, and the assessment for the current month is charged in the meantime. A merchant who fixes the problem in month six still pays month seven, month eight and month nine at the month seven rate while the three clean months accumulate.",
  source:
    "PayPal Braintree developer documentation, Card brand monitoring programs, Mastercard programs, Excessive Chargeback Program, developer.paypal.com, read 5 September 2026. Mastercard does not publish these amounts in the public Security Rules and Procedures; the acquirer and processor guides that do publish them agree with each other, and a Moneris guide last modified March 2025 carries the same ladder with one cell differing (USD 25,500 rather than USD 25,000 for months seven to eleven).",
};

export const CHARGEBACK_MONITORING_ESCALATION: MonitoringEscalation[] = [
  MASTERCARD_ECM_ESCALATION,
  {
    id: "mastercard-hecm",
    network: "Mastercard",
    program: "High Excessive Chargeback Merchant (HECM)",
    ladder: [
      { fromMonth: 1, toMonth: 1, monthlyUsd: 0 },
      { fromMonth: 2, toMonth: 2, monthlyUsd: 1000 },
      { fromMonth: 3, toMonth: 3, monthlyUsd: 2000 },
      { fromMonth: 4, toMonth: 6, monthlyUsd: 10000 },
      { fromMonth: 7, toMonth: 11, monthlyUsd: 50000 },
      { fromMonth: 12, toMonth: 18, monthlyUsd: 100000 },
      { fromMonth: 19, toMonth: null, monthlyUsd: 200000 },
    ],
    perChargebackOverCount: { overCount: 300, usd: 5, fromMonth: 4 },
    perEventUsd: null,
    published: false,
    note: "The issuer recovery assessment is the part merchants miss when they budget for this. From the fourth month it adds USD 5 for every chargeback above 300 in the month, on top of the monthly figure, so the cost scales with your volume rather than sitting flat.",
    source:
      "PayPal Braintree developer documentation, Card brand monitoring programs, Mastercard programs, Excessive Chargeback Program, developer.paypal.com, read 5 September 2026. Mastercard does not publish these amounts publicly.",
  },
  {
    id: "visa-vamp-excessive",
    network: "Visa",
    program: "VAMP Excessive merchant",
    ladder: [],
    perChargebackOverCount: null,
    perEventUsd: 8,
    published: false,
    note: "Visa's program does not use a monthly ladder. It assesses a flat amount on each qualifying event in the month, and the qualifying count is fraud reports plus disputes rather than chargebacks alone, so the real event count is higher than your chargeback count. There is no warning tier: the assessment starts in the month you are identified.",
    source:
      "Visa does not publish the amount. Its own Acquirer Monitoring Program fact sheet on corporate.visa.com sets out the ratio and the thresholds and states no assessment figure, and a Visa update page on the same site describes the program without one, both checked 5 September 2026. The USD 8 per event figure is taken from Chargeflow's VAMP guide, chargeflow.io, updated 3 September 2026, which itself describes it as approximate. Treat it as an order of magnitude and get the number from your acquirer, who is the party that actually bills it.",
  },
];

/**
 * The default row, named rather than indexed off the front of the array.
 *
 * Same reason `WORST_BAND` is named in `lib/tools-rates.ts`: with
 * `noUncheckedIndexedAccess` on, `ARRAY[0]` is typed `T | undefined`, so a
 * widget falling back to it inherits the undefined and has to defend against a
 * case that cannot happen. Naming the row makes the fallback total.
 */
export const DEFAULT_REPRESENTMENT_BENCHMARK = ALL_REASONS_BENCHMARK;

/**
 * The default row, named rather than indexed off the front of the array.
 *
 * Same reason `WORST_BAND` is named in `lib/tools-rates.ts`: with
 * `noUncheckedIndexedAccess` on, `ARRAY[0]` is typed `T | undefined`, so a
 * widget falling back to it inherits the undefined and has to defend against a
 * case that cannot happen. Naming the row makes the fallback total.
 */
export const DEFAULT_MONITORING_PROGRAM = MASTERCARD_ECM_ESCALATION;
