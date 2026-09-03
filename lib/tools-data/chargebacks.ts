/**
 * Card network chargeback monitoring programmes
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

export interface MonitoringProgram {
  network: string;
  program: string;
  /** Who the programme measures: the merchant, or the acquirer on the merchant's behalf. */
  metric: string;
  ratioPct: number;
  countMin: number;
  /**
   * Which transactions form the denominator, and from which month.
   *
   * This field exists because the pages ranking for "chargeback ratio calculator"
   * openly contradict each other on exactly this point, and the answer changes
   * the ratio materially. It is sourced per row rather than assumed.
   */
  denominator: string;
  note: string;
  source: string;
}

export interface ProcessorChargebackFee {
  processorSlug: string;
  name: string;
  fee: number;
}

export interface ChargebackDefaults {
  monthlyTransactions: number;
  monthlyChargebacks: number;
  disputedVolume: number;
  totalVolume: number;
  averageOrderValue: number;
  costOfGoods: number;
  shipping: number;
  processingFeePaid: number;
  chargebackFee: number;
  staffMinutes: number;
  staffHourlyRate: number;
}

export const CHARGEBACK_DEFAULTS: ChargebackDefaults = {
  monthlyTransactions: 5000,
  monthlyChargebacks: 55,
  disputedVolume: 5060,
  totalVolume: 425000,
  averageOrderValue: 85,
  costOfGoods: 34,
  shipping: 8,
  processingFeePaid: 2.77,
  chargebackFee: 15,
  staffMinutes: 45,
  staffHourlyRate: 32,
};

/** Network programme thresholds. These are CONTRACTUAL RULES, not law, and the networks revise them. */
export const CHARGEBACK_PROGRAMS: MonitoringProgram[] = [
  {
    network: "Visa",
    program: "VAMP Excessive (merchant)",
    metric: "merchant",
    ratioPct: 1.5,
    countMin: 1500,
    denominator: "Count of settled card-not-present VisaNet transactions (TC05), same calendar month",
    note: "United States line since 1 April 2026, reduced from 220 basis points per footnote 5 of Visa's fact sheet. Numerator is the count of TC40 fraud reports plus TC15 disputes. Excludes disputes resolved through pre-dispute solutions and TC40 fraud qualified for Compelling Evidence 3.0. Both the ratio and the 1,500 count must be met in the same month. The merchant line applies only where the acquirer's own portfolio is not already identified.",
    source: "Visa Acquirer Monitoring Program fact sheet, corporate.visa.com, checked 4 September 2026",
  },
  {
    network: "Visa",
    program: "VAMP Above Standard (acquirer portfolio)",
    metric: "acquirer portfolio",
    ratioPct: 0.5,
    countMin: 1500,
    denominator: "Count of settled card-not-present VisaNet transactions (TC05), same calendar month",
    note: "Measured across the acquirer's entire book, not one merchant, so it is shown for context only. Your volume contributes to it, which is why an acquirer may act on your ratio long before Visa names you individually.",
    source: "Visa Acquirer Monitoring Program fact sheet, corporate.visa.com, checked 4 September 2026",
  },
  {
    network: "Visa",
    program: "VAMP Excessive (acquirer portfolio)",
    metric: "acquirer portfolio",
    ratioPct: 0.7,
    countMin: 1500,
    denominator: "Count of settled card-not-present VisaNet transactions (TC05), same calendar month",
    note: "Acquirer portfolio level, shown for context only. Where an acquirer is itself identified as Above Standard or Excessive, Visa does not additionally apply the merchant Excessive line.",
    source: "Visa Acquirer Monitoring Program fact sheet, corporate.visa.com, checked 4 September 2026",
  },
  {
    network: "Visa",
    program: "VAMP Enumeration",
    metric: "merchant enumeration",
    ratioPct: 20,
    countMin: 300000,
    denominator: "Count of card-absent authorization attempts, approved and declined, in the calendar month",
    note: "Enumeration is card testing rather than chargebacks, and it is measured on authorization attempts rather than settled sales, so this calculator does not score it. 2,000 basis points is 20 percent, and the 300,000 figure is a monthly enumerated transaction count identified by Visa's VAAI model.",
    source: "Visa Acquirer Monitoring Program fact sheet, corporate.visa.com, checked 4 September 2026",
  },
  {
    network: "Mastercard",
    program: "Excessive Chargeback Merchant (ECM)",
    metric: "merchant",
    ratioPct: 1.5,
    countMin: 100,
    denominator: "Number of Mastercard transactions in the PRECEDING calendar month",
    note: "At least 100 chargebacks in the month together with a ratio of at least 1.50 percent. Both conditions must be true in the same month. Assessments begin in the second consecutive month above the line at USD 1,000, and exit requires three consecutive months below it. The two acquirer guides describe the ECM count differently, one as a 100 to 299 band and one as a 100 minimum; that difference only bites above 300 chargebacks, where the HECM ratio test decides the tier.",
    source: "Formula and preceding-month denominator from Mastercard Security Rules and Procedures Merchant Edition, 4 August 2026, section 8.3.1. Numeric thresholds are not public: they come from two acquirer program guides, Moneris (last modified March 2025) and J.P. Morgan (rev. 12/2019), which agree with each other. Checked 4 September 2026",
  },
  {
    network: "Mastercard",
    program: "High Excessive Chargeback Merchant (HECM)",
    metric: "merchant",
    ratioPct: 3,
    countMin: 300,
    denominator: "Number of Mastercard transactions in the PRECEDING calendar month",
    note: "At least 300 chargebacks together with a ratio of at least 3.00 percent, both in the same month. Assessments run USD 1,000 in month two, USD 2,000 in month three, then USD 10,000, USD 50,000, USD 100,000 and USD 200,000 a month past eighteen months. Issuer recovery adds USD 5 per chargeback above 300 from the fourth month above the line.",
    source: "Formula and preceding-month denominator from Mastercard Security Rules and Procedures Merchant Edition, 4 August 2026, section 8.3.1. Numeric thresholds are not public: they come from two acquirer program guides, Moneris (last modified March 2025) and J.P. Morgan (rev. 12/2019), which agree with each other. Checked 4 September 2026",
  },
  {
    network: "Mastercard",
    program: "Excessive Fraud Merchant (EFM)",
    metric: "reference",
    ratioPct: 0.5,
    countMin: 1000,
    denominator: "Monthly ecommerce transaction count, with separate USD 50,000 fraud chargeback and 3-D Secure share tests",
    note: "Fraud chargebacks only, at 50 basis points or more, with 1,000 or more monthly ecommerce transactions, fraud chargebacks totalling USD 50,000 or more, and less than 10 percent of monthly clearing volume authenticated with 3-D Secure or DSRP in non-regulated countries, or less than 50 percent in regulated countries. This calculator does not take a fraud-only split or a 3-D Secure share, so EFM is listed as reference and is not scored. Here countMin is a transaction count, not a chargeback count.",
    source: "Moneris Visa/Mastercard Risk Program Thresholds, last modified March 2025, checked 4 September 2026",
  },
];

export const CHARGEBACK_PROCESSOR_FEES: ProcessorChargebackFee[] = [
  {
    processorSlug: "stripe",
    name: "Stripe",
    fee: 15,
  },
  {
    processorSlug: "paypal",
    name: "PayPal",
    fee: 20,
  },
  {
    processorSlug: "braintree",
    name: "Braintree",
    fee: 15,
  },
  {
    processorSlug: "helcim",
    name: "Helcim",
    fee: 15,
  },
  {
    processorSlug: "square",
    name: "Square",
    fee: 0,
  },
  {
    processorSlug: "authorize-net",
    name: "Authorize.net",
    fee: 0,
  },
];
