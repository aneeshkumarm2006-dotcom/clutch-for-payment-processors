/**
 * Human-readable labels for the §8 enum tokens (TODO §2.2 — admin multi-selects;
 * reused by the public directory/profile in Stage 3).
 *
 * Most tokens humanize cleanly (`flat-rate` → "Flat rate"); the ones that don't
 * (acronyms, brand casing, `t+2`) are listed in `FULL_LABELS`. Keeping this in
 * one place means the DB stays machine-friendly while the UI stays readable.
 */

/** Whole-value overrides (acronyms, brand casing, symbols). */
const FULL_LABELS: Record<string, string> = {
  // pricing models
  "interchange-plus": "Interchange-plus",
  "custom-quote": "Custom quote",
  // payout times
  "t+2": "T+2",
  "t+3": "T+3",
  "same-day": "Same day",
  "next-day": "Next day",
  "2-day": "2-day",
  // payment methods
  amex: "Amex",
  "apple-pay": "Apple Pay",
  "google-pay": "Google Pay",
  paypal: "PayPal",
  ach: "ACH",
  sepa: "SEPA",
  bnpl: "BNPL",
  upi: "UPI",
  netbanking: "Netbanking",
  visa: "Visa",
  mastercard: "Mastercard",
  // integrations
  api: "API",
  "hosted-checkout": "Hosted checkout",
  "drop-in-ui": "Drop-in UI",
  woocommerce: "WooCommerce",
  bigcommerce: "BigCommerce",
  squarespace: "Squarespace",
  "mobile-sdk": "Mobile SDK",
  "virtual-terminal": "Virtual terminal",
  "payment-links": "Payment links",
  "pos-hardware": "POS hardware",
  // features
  "recurring-billing": "Recurring billing",
  "multi-currency": "Multi-currency",
  "fraud-protection": "Fraud protection",
  "3d-secure": "3D Secure",
  "marketplace-split": "Marketplace split",
  "reporting-dashboard": "Reporting dashboard",
  "tap-to-pay": "Tap to pay",
  "chargeback-protection": "Chargeback protection",
  "no-rolling-reserve": "No rolling reserve",
  "developer-friendly": "Developer-friendly",
  "24-7-support": "24/7 support",
  // contract types
  "month-to-month": "Month-to-month",
  "long-term": "Long-term",
  "no-contract": "No contract",
  // category types
  "use-case": "Use case",
  "business-size": "Business size",
};

/** Title-case a hyphenated token as a fallback (`flat-rate` → "Flat rate"). */
function humanizeToken(token: string): string {
  return token
    .split("-")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Display label for any §8 enum value. */
export function humanizeEnum(value: string): string {
  return FULL_LABELS[value] ?? humanizeToken(value);
}
