/**
 * Reverse fee, also called gross-up
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

export interface FeePreset {
  id: string;
  label: string;
  /** A percentage, e.g. 2.9 for 2.9%. Every rate in this codebase is a percentage. */
  rate: number;
  fixed: number;
  processorSlug?: string;
}

export const GROSS_UP_PRESETS: FeePreset[] = [
  {
    id: "stripe-online",
    label: "Stripe, online standard (2.9% + $0.30)",
    rate: 2.9,
    fixed: 0.3,
    processorSlug: "stripe",
  },
  {
    id: "paypal-checkout",
    label: "PayPal Checkout, domestic (3.49% + $0.49)",
    rate: 3.49,
    fixed: 0.49,
    processorSlug: "paypal",
  },
  {
    id: "paypal-donations",
    label: "PayPal donations, domestic (2.89% + $0.49)",
    rate: 2.89,
    fixed: 0.49,
    processorSlug: "paypal",
  },
  {
    id: "paypal-charity",
    label: "PayPal confirmed charity, pre-approved (1.99% + $0.49)",
    rate: 1.99,
    fixed: 0.49,
    processorSlug: "paypal",
  },
  {
    id: "square-online-free",
    label: "Square Online or Invoices, Free plan (3.3% + $0.30)",
    rate: 3.3,
    fixed: 0.3,
    processorSlug: "square",
  },
  {
    id: "square-online-29",
    label: "Square eCommerce API any plan, or online on Plus or Premium (2.9% + $0.30)",
    rate: 2.9,
    fixed: 0.3,
    processorSlug: "square",
  },
  {
    id: "square-in-person",
    label: "Square in person, Free plan (2.6% + $0.15)",
    rate: 2.6,
    fixed: 0.15,
    processorSlug: "square",
  },
  {
    id: "square-keyed",
    label: "Square keyed in or card on file, any plan (3.5% + $0.15)",
    rate: 3.5,
    fixed: 0.15,
    processorSlug: "square",
  },
];

export const GROSS_UP_DEFAULTS: { net: number; rate: number; fixed: number } = {
  net: 100,
  rate: 2.9,
  fixed: 0.3,
};
