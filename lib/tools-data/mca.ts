/**
 * Merchant cash advance
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

export interface AprBand {
  max: number;
  label: string;
  note: string;
}

export interface McaDefaults {
  advance: number;
  factorRate: number;
  holdbackPct: number;
  monthlyVolume: number;
  originationPct: number;
}

/**
 * Banking days per year, the annualisation basis for the APR conversion.
 *
 * An advance repaid out of card settlement collects on banking days only, so
 * annualising a daily rate over 365 would overstate the term and understate the
 * rate. 252 is the standard US banking day count, and it is the basis every
 * figure on the MCA page uses.
 */
export const BANKING_DAYS_PER_YEAR = 252;

/** Banking days in an average month, used to turn monthly card volume into a daily holdback. */
export const BANKING_DAYS_PER_MONTH = 21;

export const MCA_DEFAULTS: McaDefaults = {
  advance: 50000,
  factorRate: 1.3,
  holdbackPct: 10,
  monthlyVolume: 100000,
  originationPct: 2.5,
};

/** Typical US factor rates, from published funder ranges. */
export const MCA_FACTOR_RANGE: readonly [number, number] = [
  1.14,
  1.5,
];

/** Typical US holdback percentages of daily card settlement. */
export const MCA_HOLDBACK_RANGE: readonly [number, number] = [
  5,
  25,
];

/** How to read the APR the calculator returns. Ordered ascending by `max`. */
export const MCA_APR_BANDS: AprBand[] = [
  {
    max: 36,
    label: "Low for this product",
    note: "An advance only lands here when repayment stretches a long way. On this page's method a 1.20 factor needs roughly twelve and a half months to get this low: twelve months computes to 37.5 percent and thirteen months to 34.6 percent. Check the contract for minimum payment terms, because many funders will not let repayment run this slowly.",
  },
  {
    max: 80,
    label: "Online lender range",
    note: "The Federal Reserve Board found equivalent APRs on online small business loans and lines of credit typically range from 10 percent to 80 percent. An advance in this band is at the cheap end of its own category, though still well above any bank product.",
  },
  {
    max: 150,
    label: "Triple digit territory",
    note: "The Federal Reserve's own illustration, $50,000 advanced for $65,000 of receipts at a 10 percent holdback, computes to about 101 percent before fees on this page's assumption of $100,000 in monthly card volume. That is the normal result for a mid range factor at a normal holdback, not an outlier.",
  },
  {
    max: 300,
    label: "Very high cost",
    note: "Usually driven by the holdback rather than the factor. Cutting the holdback in half roughly halves this rate without changing a single dollar of what you repay, so this is the number to take back to the funder.",
  },
  {
    max: 100000,
    label: "Extreme",
    note: "At this level the advance is clearing in weeks. New York's Attorney General settled with Yellowstone Capital in January 2025 over advances the office said carried rates up to 820 percent a year, and in February 2024 won a judgment over a $10,000 advance repaid at $19,900 across ten days.",
  },
];
