/**
 * Trade credit terms
 *
 * Reference data for `/tools/early-payment-discount-calculator`. The maintenance
 * contract is the one stated in `lib/tools-data/index.ts`: every figure carries
 * its own provenance, and a checked date must never be moved without re-reading
 * the source it points at.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Do not merge these back into one file, and do not
 * import `lib/tools-data/index.ts` from a `"use client"` module. Batch four's
 * data modules are deliberately not re-exported by that barrel at all.
 *
 * ─── WHAT IS SOURCED HERE AND WHAT IS COMPUTED ──────────────────────────────
 *
 * Unusually for this directory, almost nothing in this file is a vendor price
 * or a regulator's figure. The terms themselves ("2/10 net 30") are a NOTATION,
 * not a published rate, and the annualized costs beside them are arithmetic on
 * that notation. So every row's `source` says which it is, and the computed rows
 * name the function that produced them. They were read off a run of
 * `lib/calc/early-payment.ts` on 5 September 2026 and are asserted in
 * `tests/tools/batch-four/early-payment-discount-calculator.test.ts` against
 * values derived by hand, so they cannot silently drift from the widget printing
 * the same numbers three inches away.
 *
 * The two figures that ARE sourced, and that will go stale:
 *
 *   - `TRADE_TERM_DEFAULTS.costOfCapitalPct` is the bank prime loan rate from
 *     the Federal Reserve's H.15 Selected Interest Rates release of 4 September
 *     2026, which posts 6.75 percent for every business day from 28 August to 3
 *     September 2026. It is a DEFAULT, not a claim about the user's own
 *     borrowing rate, and the page says so.
 *   - `TRADE_TERM_DEFAULTS.cardFeePct` is Melio's published US fee for paying a
 *     business bill by card, 2.9 percent, read from melio.com/pricing on 5
 *     September 2026.
 *
 * ─── THE DAY COUNT FORK IS REAL AND IS NOT A ROUNDING PREFERENCE ────────────
 *
 * The same terms annualize to two different published numbers depending on
 * whether the year is taken as 365 days or 360. AccountingTools' cost of credit
 * article uses 360 and works 2/15 net 40 to 29.4 percent; most course material
 * and most calculators use 365, which gives 29.80 percent on the same terms. On
 * 2/10 net 30 the gap is 36.73 against 37.24. Both columns are carried below so
 * a reader reconciling this page against another one can see which convention
 * the other page used, instead of concluding one of the two is broken.
 */

export interface TradeTerm {
  /** Stable id. Also the select value in the widget. */
  id: string;
  /** How the term is written on an invoice. */
  label: string;
  /** Discount percentage. 0 means the term carries no discount at all. */
  discountPct: number;
  /** Last day the discount may be taken. 0 when there is no discount. */
  discountDays: number;
  /** Day the full amount falls due. */
  netDays: number;
  /** netDays minus discountDays: the days of credit bought by skipping the discount. */
  creditPeriodDays: number;
  /** d / (1 - d) as a percentage: the cost of the credit over one credit period. */
  periodRatePct: number;
  /** 365 divided by the credit period. Fractional on purpose. */
  periodsPerYear: number;
  /** Nominal annualized cost of forgoing the discount, 365 day basis. */
  nominalAnnualPct: number;
  /** Compounded effective annual rate, 365 day basis. */
  effectiveAnnualPct: number;
  /** Nominal on the 360 day basis several published sources use. */
  nominalAnnual360Pct: number;
  /** The arithmetic, written out, so a reader can check it without the widget. */
  arithmetic: string;
  /** What the term is for, in one sentence. */
  note: string;
  /** Sourced or computed, and by what, on what date. */
  source: string;
}

const COMPUTED =
  "Computed by this site from the terms notation using lib/calc/early-payment.ts, run 5 September 2026. Nominal is (d / (1 - d)) x (365 / credit days); effective is (1 + d / (1 - d)) ^ (365 / credit days) - 1. Not a published rate.";

const NO_DISCOUNT =
  "Not a computed rate. A net term carries no discount, so there is nothing to forgo and nothing to annualize.";

/**
 * The terms quoted often enough in US B2B to be worth naming, plus the three
 * plain net terms, which are here precisely so the page can say out loud that
 * their cost of trade credit is zero rather than leaving a blank.
 *
 * Ordered by how often the notation is searched rather than by size: 2/10 net 30
 * is the query this page exists for.
 */
export const TRADE_TERMS: TradeTerm[] = [
  {
    id: "2-10-net-30",
    label: "2/10 net 30",
    discountPct: 2,
    discountDays: 10,
    netDays: 30,
    creditPeriodDays: 20,
    periodRatePct: 2.0408,
    periodsPerYear: 18.25,
    nominalAnnualPct: 37.2449,
    effectiveAnnualPct: 44.5853,
    nominalAnnual360Pct: 36.7347,
    arithmetic:
      "0.02 / 0.98 = 2.0408% for 20 days. 365 / 20 = 18.25 periods a year. 2.0408% x 18.25 = 37.24% nominal, and 1.020408 to the power 18.25, minus 1, is 44.59% compounded.",
    note: "The default term across US wholesale, distribution and print, and the one the notation is usually explained with. Skipping it is expensive credit at any normal borrowing rate.",
    source: COMPUTED,
  },
  {
    id: "1-10-net-30",
    label: "1/10 net 30",
    discountPct: 1,
    discountDays: 10,
    netDays: 30,
    creditPeriodDays: 20,
    periodRatePct: 1.0101,
    periodsPerYear: 18.25,
    nominalAnnualPct: 18.4343,
    effectiveAnnualPct: 20.1317,
    nominalAnnual360Pct: 18.1818,
    arithmetic:
      "0.01 / 0.99 = 1.0101% for 20 days. 365 / 20 = 18.25 periods a year. 1.0101% x 18.25 = 18.43% nominal, and 1.010101 to the power 18.25, minus 1, is 20.13% compounded.",
    note: "Half the discount over the same window, so roughly half the annualized cost. Still above every SBA 7(a) ceiling, so still worth taking, but it is the term where a genuinely cash-tight buyer can reasonably decline.",
    source: COMPUTED,
  },
  {
    id: "2-10-net-60",
    label: "2/10 net 60",
    discountPct: 2,
    discountDays: 10,
    netDays: 60,
    creditPeriodDays: 50,
    periodRatePct: 2.0408,
    periodsPerYear: 7.3,
    nominalAnnualPct: 14.898,
    effectiveAnnualPct: 15.891,
    nominalAnnual360Pct: 14.6939,
    arithmetic:
      "0.02 / 0.98 = 2.0408% for 50 days. 365 / 50 = 7.30 periods a year. 2.0408% x 7.30 = 14.90% nominal, and 1.020408 to the power 7.30, minus 1, is 15.89% compounded.",
    note: "The same 2 percent stretched over 50 days of credit rather than 20, which cuts the annualized cost by well over half. The clearest demonstration that the discount alone tells you nothing until you know the window.",
    source: COMPUTED,
  },
  {
    id: "3-10-net-30",
    label: "3/10 net 30",
    discountPct: 3,
    discountDays: 10,
    netDays: 30,
    creditPeriodDays: 20,
    periodRatePct: 3.0928,
    periodsPerYear: 18.25,
    nominalAnnualPct: 56.4433,
    effectiveAnnualPct: 74.3476,
    nominalAnnual360Pct: 55.6701,
    arithmetic:
      "0.03 / 0.97 = 3.0928% for 20 days. 365 / 20 = 18.25 periods a year. 3.0928% x 18.25 = 56.44% nominal, and 1.030928 to the power 18.25, minus 1, is 74.35% compounded.",
    note: "Where the nominal and compounded figures separate hardest, 18 points apart. A supplier offering this is buying cash aggressively and is usually the one under pressure.",
    source: COMPUTED,
  },
  {
    id: "net-30",
    label: "net 30",
    discountPct: 0,
    discountDays: 0,
    netDays: 30,
    creditPeriodDays: 0,
    periodRatePct: 0,
    periodsPerYear: 0,
    nominalAnnualPct: 0,
    effectiveAnnualPct: 0,
    nominalAnnual360Pct: 0,
    arithmetic: "No discount is offered, so there is no discount to forgo. The 30 days of credit are free.",
    note: "Free credit. Paying a net 30 invoice on day 5 buys nothing at all and costs you 25 days of your own cash, which is the mirror image of the mistake this page usually corrects.",
    source: NO_DISCOUNT,
  },
  {
    id: "net-60",
    label: "net 60",
    discountPct: 0,
    discountDays: 0,
    netDays: 60,
    creditPeriodDays: 0,
    periodRatePct: 0,
    periodsPerYear: 0,
    nominalAnnualPct: 0,
    effectiveAnnualPct: 0,
    nominalAnnual360Pct: 0,
    arithmetic: "No discount is offered, so there is no discount to forgo. The 60 days of credit are free.",
    note: "Free credit, twice as much of it. Common where a large buyer sets the terms, and the cost lands on the supplier's working capital rather than on any interest line.",
    source: NO_DISCOUNT,
  },
  {
    id: "net-90",
    label: "net 90",
    discountPct: 0,
    discountDays: 0,
    netDays: 90,
    creditPeriodDays: 0,
    periodRatePct: 0,
    periodsPerYear: 0,
    nominalAnnualPct: 0,
    effectiveAnnualPct: 0,
    nominalAnnual360Pct: 0,
    arithmetic: "No discount is offered, so there is no discount to forgo. The 90 days of credit are free.",
    note: "Free credit for a quarter. Take every day of it. A supplier on net 90 who wants paying sooner has to buy that with a discount, and this page prices what that discount is worth to them.",
    source: NO_DISCOUNT,
  },
];

export const findTradeTerm = (id: string): TradeTerm | undefined =>
  TRADE_TERMS.find((t) => t.id === id);

export interface TradeTermDefaults {
  /** Which row of TRADE_TERMS the widget opens on. */
  termId: string;
  /** Free-form fields, used when the term select is set to "custom". */
  discountPct: number;
  discountDays: number;
  netDays: number;
  /** Day count basis. 365 by default; 360 is offered because published figures use it. */
  basisDays: number;

  /** Buyer mode. */
  invoiceAmount: number;
  costOfCapitalPct: number;

  /** Seller mode. */
  annualCreditSales: number;
  currentPaymentDays: number;
  takeUpPct: number;

  /** Card mode. */
  cardFeePct: number;
  rewardsPct: number;
  cardGraceDays: number;
}

/**
 * Widget default state, kept here so the defaults are data rather than magic
 * strings scattered through the component, and so the worked example in the page
 * copy can be checked against one named object.
 *
 * `currentPaymentDays` at 45 is a PLACEHOLDER, not an industry average, and the
 * field label says so. It is the single input the seller answer turns on, and no
 * figure this site could publish would be right for a given business, so it opens
 * on a round number that is visibly later than the quoted net 30.
 */
export const TRADE_TERM_DEFAULTS: TradeTermDefaults = {
  termId: "2-10-net-30",
  discountPct: 2,
  discountDays: 10,
  netDays: 30,
  basisDays: 365,

  invoiceAmount: 10000,
  // Bank prime loan rate, Federal Reserve H.15 release of 4 September 2026.
  costOfCapitalPct: 6.75,

  annualCreditSales: 1200000,
  currentPaymentDays: 45,
  takeUpPct: 40,

  // Melio's published US fee to pay a business bill by card, melio.com/pricing,
  // read 5 September 2026.
  cardFeePct: 2.9,
  rewardsPct: 1.5,
  cardGraceDays: 25,
};

/** Day count options, as a select. Both conventions are in published use. */
export const TRADE_TERM_BASIS_OPTIONS: { value: string; label: string }[] = [
  { value: "365", label: "365 day year" },
  { value: "360", label: "360 day year" },
];
