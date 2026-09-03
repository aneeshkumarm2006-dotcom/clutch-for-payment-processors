/**
 * Rolling reserves
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

export interface ReserveType {
  id: string;
  label: string;
  description: string;
}

export interface ReserveRange {
  tier: string;
  reservePct: string;
  holdMonths: string;
}

export const RESERVE_DEFAULTS: { monthlyVolume: number; reservePct: number; holdMonths: number } = {
  monthlyVolume: 100000,
  reservePct: 10,
  holdMonths: 6,
};

export const RESERVE_TYPES: ReserveType[] = [
  {
    id: "rolling",
    label: "Rolling reserve",
    description: "A set percentage of every batch is withheld and each batch is released on its own clock. PayPal's contractual example: with a reserve set at 10% on a 90 day rolling period, 10% of day 1 money is released on day 91 and 10% of day 2 money on day 92. PayPal calls rolling reserves the most common type. It is also the only type that grows with your volume forever.",
  },
  {
    id: "upfront",
    label: "Upfront reserve",
    description: "A lump sum posted before you process a single transaction, with nothing withheld from daily batches afterwards. PaymentCloud puts the usual size at 50% to 100% of monthly processing volume. Painful at signup, but it does not scale as you grow.",
  },
  {
    id: "minimum",
    label: "Minimum reserve",
    description: "A floor balance you must keep available in the account at all times. PayPal builds one either as a single upfront deposit or by taking a percentage of sales until the floor is reached, and it can run alongside a rolling reserve on the same account.",
  },
  {
    id: "capped",
    label: "Capped reserve",
    description: "A percentage is withheld only until the balance reaches a fixed ceiling, then withholding stops. Corepay and Stripe both describe this type. Identical to a rolling reserve until you hit the cap, and strictly better after that, which makes it the term worth negotiating for.",
  },
  {
    id: "fixed",
    label: "Fixed term reserve",
    description: "A percentage of each charge is withheld and every hold is released together on one specified date, rather than each hold ageing out separately. Stripe uses this shape for date-specific refund and dispute risk, such as payments for an event that might be cancelled.",
  },
];

export const RESERVE_RANGES: ReserveRange[] = [
  {
    tier: "Standard risk, no reserve imposed",
    reservePct: "0%",
    holdMonths: "None",
  },
  {
    tier: "Elevated risk, Stripe published guidance",
    reservePct: "5% to 15% of each transaction",
    holdMonths: "1 to 6 (30 to 90 days lower risk, 180 days or more for high chargeback industries)",
  },
  {
    tier: "High risk on a dedicated merchant account, Corepay published range",
    reservePct: "5% to 15%",
    holdMonths: "3 to 6 (90 to 180 days)",
  },
  {
    tier: "High risk, PaymentCloud published average",
    reservePct: "5% to 10% of expected monthly sales volume",
    holdMonths: "6 to 12 (rolling reserves usually run six months to a year)",
  },
  {
    tier: "New account, no processing history, upfront reserve",
    reservePct: "50% to 100% of one month's volume, posted once",
    holdMonths: "Renegotiation realistic after about six months of processing",
  },
];

/**
 * The rate used to price what the locked-up money costs to carry.
 *
 * A reserve is not a fee, it is your own money held back, so the honest cost is
 * the cost of not having it. This is a published reference rate, named on the
 * page, rather than a number we invented.
 */
export const RESERVE_CARRY_RATE: { value: number; label: string; source: string; releaseDate: string } = {
  value: 0.0675,
  label: "bank prime loan rate",
  source: "Federal Reserve H.15",
  releaseDate: "2026-09-02",
};
