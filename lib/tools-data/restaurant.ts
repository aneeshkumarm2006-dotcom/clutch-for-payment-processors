/**
 * Restaurant card acceptance
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

export interface RestaurantBenchmark {
  segment: string;
  effectiveRate: string;
  note: string;
}

export interface RestaurantDefaults {
  monthlySales: number;
  averageCheck: number;
  tipPct: number;
  cardSharePct: number;
  rate: number;
  fixed: number;
  monthlyFees: number;
}

export const RESTAURANT_DEFAULTS: RestaurantDefaults = {
  monthlySales: 85000,
  averageCheck: 42.66,
  tipPct: 19.3,
  cardSharePct: 87,
  rate: 2.6,
  fixed: 0.15,
  monthlyFees: 0,
};

export const RESTAURANT_BENCHMARKS: RestaurantBenchmark[] = [
  {
    segment: "Full service, flat rate, card present",
    effectiveRate: "2.89%",
    note: "Square's published 2.6% plus 15 cents on a $50.89 charge, being a $42.66 check plus a 19.3% tip. Rate from squareup.com/us/en/payments/our-fees, tip from Toast Q1 2026 data, both checked 2026-09-04.",
  },
  {
    segment: "Quick service, flat rate, card present",
    effectiveRate: "3.48%",
    note: "The same 2.6% plus 15 cents on a $17.05 charge, being Toast's July 2026 median burger price of $14.72 plus a 15.8% quick service tip. The percentage did not change, the 15 cents did.",
  },
  {
    segment: "Visa consumer credit interchange, card present restaurant",
    effectiveRate: "2.10% to 2.60%",
    note: "Visa Restaurant 2, rates effective April 18, 2026. 2.10% for Traditional Rewards and All Other Products, 2.60% for Visa Signature, Signature Preferred and Infinite, 4 cent minimum. Wholesale floor paid to the issuer, not what a merchant pays.",
  },
  {
    segment: "Visa debit interchange, card present restaurant",
    effectiveRate: "0.46% to 1.63%",
    note: "On the same $50.89 charge: regulated debit at 0.05% plus 21 cents is about 24 cents, exempt CPS/Restaurant debit at 1.55% plus 4 cents is about 83 cents. Debit heavy rooms are far cheaper than a blended rate implies.",
  },
  {
    segment: "Interchange plus, card present, $50,000 to $100,000 monthly volume",
    effectiveRate: "2.59%",
    note: "Helcim's published interchange plus 0.35% plus 7 cents on top of Visa's 2.10% Traditional Rewards restaurant rate, on the same $50.89 charge. Excludes network assessments, which Visa and Mastercard do not publish, so treat it as a floor.",
  },
  {
    segment: "Visa card not present restaurant interchange",
    effectiveRate: "2.20% to 2.70%",
    note: "Visa Restaurant 1, effective April 18, 2026, 8 cent minimum. Applies to your own online ordering and phone orders. It does not apply to marketplace delivery, which the platform processes.",
  },
];
