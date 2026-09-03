/**
 * Subscription payment failures
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
 */

export interface ChurnBenchmark {
  metric: string;
  typical: string;
  source: string;
}

export interface DeclineReason {
  reason: string;
  share: string;
  fixable: string;
}

export interface ChurnDefaults {
  subscribers: number;
  arpu: number;
  declineRatePct: number;
  recoveryRatePct: number;
  targetRecoveryPct: number;
}

export const CHURN_DEFAULTS: ChurnDefaults = {
  subscribers: 2500,
  arpu: 49,
  declineRatePct: 4,
  recoveryRatePct: 53,
  targetRecoveryPct: 71,
};

export const CHURN_BENCHMARKS: ChurnBenchmark[] = [
  {
    metric: "Involuntary share of all subscription churn",
    typical: "About 35% (1.25% involuntary against 3.60% total, both median annual rates, all industries)",
    source: "Recurly network data, July 2026, recurly.com/research/churn-rate-benchmarks/",
  },
  {
    metric: "Involuntary churn by average revenue per customer",
    typical: "1.30% in the $10 to $25 tier, falling to 0.18% above $250, median annual rates",
    source: "Recurly network data, July 2026, recurly.com/research/churn-rate-benchmarks/",
  },
  {
    metric: "Card decline rate, physical goods merchants",
    typical: "Often 3% to 4% of transactions",
    source: "Ethoca, Solving the CNP False Decline Puzzle: Collaboration is Key, March 2017",
  },
  {
    metric: "Card decline rate, digital goods merchants",
    typical: "Above 15% of gross attempts, but approximately 4% when measured per unique cardholder",
    source: "Ethoca, Solving the CNP False Decline Puzzle: Collaboration is Key, March 2017",
  },
  {
    metric: "Baseline failed payment recovery",
    typical: "Approximately 53% before retry tuning",
    source: "Recurly, failed payment recovery, 30 April 2026",
  },
  {
    metric: "Optimised failed payment recovery",
    typical: "Approximately 71% after retry tuning, a 10 to 20 point improvement",
    source: "Recurly, failed payment recovery, 30 April 2026",
  },
  {
    metric: "Recovery timing window",
    typical: "90% of recovered transactions land within 10 days of the failure",
    source: "Recurly, failed payment recovery, 30 April 2026",
  },
  {
    metric: "Recovery rate by decline message",
    typical: "Over 45% for the three most common decline messages; over 20% for invalid card number",
    source: "Recurly, Subscription Benchmarks: Top Payment Decline Reasons",
  },
  {
    metric: "Visa reattempt limit",
    typical: "Up to 15 reattempts in 30 days on Category 2 declines; no reattempts permitted on Category 1",
    source: "Visa Business News AI10325, 3 September 2020, effective 17 April 2021",
  },
  {
    metric: "Recommended retry count",
    typical: "Maximum of 8; Stripe Smart Retries defaults to 8 tries within 2 weeks",
    source: "Stripe documentation, docs.stripe.com/declines/card and docs.stripe.com/billing/revenue-recovery/smart-retries",
  },
];

export const CHURN_DECLINE_REASONS: DeclineReason[] = [
  {
    reason: "Insufficient funds or credit",
    share: "44.4%",
    fixable: "Yes, through timed retries. Recurly finds this reason has the highest recovery rate of the top five decline reasons, since funds often arrive within days.",
  },
  {
    reason: "Card data errors: wrong expiry date or wrong CVV2",
    share: "20.6%",
    fixable: "Partly. Visa Account Updater and Mastercard Automatic Billing Updater supply a new expiry date or account number without contacting the customer, but neither supplies a CVV2, and stored credential renewals generally do not submit one. Ethoca does not split the bucket, so treat only part of this share as updater-addressable.",
  },
  {
    reason: "Other declines",
    share: "15.2%",
    fixable: "Mixed. Stripe notes issuers categorise most declines as generic, so this bucket hides several different causes and resists targeted treatment.",
  },
  {
    reason: "Lost or stolen card",
    share: "10.4%",
    fixable: "Not by retrying. Stripe classes lost_card and stolen_card as hard declines it will not retry. Requires a new credential.",
  },
  {
    reason: "Suspected fraud",
    share: "9.4%",
    fixable: "Rarely by retrying. Ethoca found 52% of orders merchants themselves rejected as fraud were good orders, so the bigger win is usually reviewing your own fraud rules.",
  },
];
