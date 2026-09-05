/**
 * Interest arithmetic: compounding options, defaults and US deposit benchmarks.
 *
 * Generated reference data for the `/tools/*` calculators. The maintenance
 * contract is in `lib/tools-data/index.ts`: every figure here was read from a
 * primary source on the date recorded beside it, and a checked date must never
 * be moved without re-reading the source.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Do not import from `lib/tools-data/index.ts` inside a
 * `"use client"` module.
 *
 * WHY THIS MODULE IS DIFFERENT FROM ITS SIBLINGS. Every other dataset under
 * `tools-data/` is a rate card that expires. This one is mostly arithmetic that
 * does not: the compounding options and the Regulation DD formula are stable.
 * The only perishable part is `FDIC_NATIONAL_RATES`, which the FDIC republishes
 * monthly, and it is fenced off with its own effective date for that reason.
 */

// ---------------------------------------------------------------------------
// Frequencies
// ---------------------------------------------------------------------------

export interface FrequencyOption {
  /** The select value. Stringified `periodsPerYear`, so the widget can parse it back. */
  value: string;
  label: string;
  /** 0 is the sentinel for continuous compounding, which has no period count. */
  periodsPerYear: number;
}

/**
 * How often interest is added to the balance.
 *
 * Continuous is included because it is the ceiling: no compounding schedule can
 * beat it at the same nominal rate, so it answers "how much is left on the
 * table?" in one click. US deposit accounts compound daily or monthly in
 * practice; nothing pays continuously.
 */
export const COMPOUNDING_OPTIONS: FrequencyOption[] = [
  { value: "1", label: "Annually", periodsPerYear: 1 },
  { value: "2", label: "Semiannually", periodsPerYear: 2 },
  { value: "4", label: "Quarterly", periodsPerYear: 4 },
  { value: "12", label: "Monthly", periodsPerYear: 12 },
  { value: "365", label: "Daily", periodsPerYear: 365 },
  { value: "0", label: "Continuously", periodsPerYear: 0 },
];

/** How often money is added. 0 means a one-off deposit and nothing after it. */
export const CONTRIBUTION_OPTIONS: FrequencyOption[] = [
  { value: "0", label: "None", periodsPerYear: 0 },
  { value: "12", label: "Monthly", periodsPerYear: 12 },
  { value: "4", label: "Quarterly", periodsPerYear: 4 },
  { value: "1", label: "Annually", periodsPerYear: 1 },
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export interface CompoundDefaults {
  principal: number;
  annualRatePct: number;
  years: number;
  compoundsPerYear: number;
  contribution: number;
  contributionsPerYear: number;
  contributeAtStart: boolean;
}

/**
 * Placeholders, not recommendations. They exist to make the server-rendered
 * default state a legible worked example, and the page says so.
 */
export const COMPOUND_DEFAULTS: CompoundDefaults = {
  principal: 10000,
  annualRatePct: 5,
  years: 10,
  compoundsPerYear: 12,
  contribution: 250,
  contributionsPerYear: 12,
  contributeAtStart: false,
};

export interface SimpleDefaults {
  principal: number;
  annualRatePct: number;
  termValue: number;
  termUnit: "years" | "months" | "days";
  dayBasis: 365 | 360;
}

export const SIMPLE_DEFAULTS: SimpleDefaults = {
  principal: 25000,
  annualRatePct: 9,
  termValue: 180,
  termUnit: "days",
  dayBasis: 365,
};

export const TERM_UNIT_OPTIONS: { value: SimpleDefaults["termUnit"]; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

export const DAY_BASIS_OPTIONS: { value: string; label: string }[] = [
  { value: "365", label: "Actual/365" },
  { value: "360", label: "Actual/360" },
];

// ---------------------------------------------------------------------------
// Regulation DD
// ---------------------------------------------------------------------------

/**
 * The only APY definition that is law in the United States, quoted rather than
 * paraphrased because the whole point of the page is that APY is a defined term
 * and "interest rate" is not.
 *
 * Read from Appendix A to 12 CFR Part 1030 on 5 September 2026, cross-checked
 * against the CFPB's own copy of the regulation and Cornell LII. The formula and
 * the certificate example are both verbatim.
 */
export const REG_DD = {
  citation: "Appendix A to 12 CFR Part 1030 (Regulation DD, Truth in Savings)",
  checked: "5 September 2026",
  formula: "APY = 100 [(1 + Interest/Principal)^(365/Days in term) - 1]",
  simplified: "APY = 100 (Interest/Principal), when the term is 365 days",
  /** The regulation's own worked example, kept exactly as its numbers appear. */
  example: {
    principal: 1000,
    interest: 30.37,
    days: 182,
    apy: "6.18%",
    text:
      "If an institution pays $30.37 in interest on a $1,000 six-month certificate of deposit (where the six-month period used by the institution contains 182 days), using the general formula above, the annual percentage yield is 6.18%.",
  },
  sources: [
    { label: "12 CFR Part 1030, Appendix A", url: "https://www.consumerfinance.gov/rules-policy/regulations/1030/A/" },
    { label: "Cornell LII, Appendix A to Part 1030", url: "https://www.law.cornell.edu/cfr/text/12/appendix-A_to_part_1030" },
  ],
} as const;

// ---------------------------------------------------------------------------
// FDIC national deposit rates
// ---------------------------------------------------------------------------

export interface DepositRate {
  product: string;
  nationalAverage: number;
}

/**
 * THE ONE DATASET HERE THAT EXPIRES. The FDIC republishes these monthly, and a
 * stale row renders identically to a current one.
 *
 * The FDIC defines the national rate as "the average of rates paid by all
 * insured depository institutions and credit unions for which data is available,
 * with rates weighted by each institution's share of domestic deposits". Rates
 * below are the published national averages, as percentages.
 */
export const FDIC_RATES_EFFECTIVE = "17 August 2026";
export const FDIC_RATES_CHECKED = "5 September 2026";
export const FDIC_RATES_SOURCE = {
  label: "FDIC national rates and rate caps",
  url: "https://www.fdic.gov/national-rates-and-rate-caps",
};

export const FDIC_NATIONAL_RATES: DepositRate[] = [
  { product: "Savings", nationalAverage: 0.38 },
  { product: "Money market", nationalAverage: 0.63 },
  { product: "12-month CD", nationalAverage: 1.71 },
  { product: "24-month CD", nationalAverage: 1.57 },
  { product: "36-month CD", nationalAverage: 1.34 },
  { product: "48-month CD", nationalAverage: 1.27 },
  { product: "60-month CD", nationalAverage: 1.36 },
];
