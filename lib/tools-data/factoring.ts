/**
 * Invoice factoring: how the discount fee is quoted, and the fees beside it
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
 * ─── Why the fee structures are data and not three branches in a component ───
 *
 * A factoring quote is not one number. It is a fee percentage, a period the
 * percentage covers, a rule for what happens after that period, and a statement
 * of what the percentage is charged ON. That last field is the one that decides
 * the answer and the one nobody quotes: a flat or tiered discount fee is charged
 * on the FACE VALUE of the invoice, while a prime plus facility charges interest
 * on FUNDS EMPLOYED, which is the advance. Same headline percentage, materially
 * different money, because the advance is only 80 to 90 percent of the face.
 *
 * Each structure therefore carries `chargedOn` as a field rather than as a
 * comment, and `lib/calc/factoring.ts` reads it. A component that hard coded
 * "multiply by face value" would silently overcharge every prime plus quote.
 *
 * ─── What is sourced and what is a modeled default ──────────────────────────
 *
 * Ranges carry a `source` naming the publisher, the document and the date read.
 * Where a fee varies so widely between term sheets that no published range is
 * meaningful, the default is ZERO and the field asks the user for their own
 * figure, the same discipline `REFUND_DEFAULTS` uses for handling costs. A zero
 * default that the page tells you to replace is honest. A plausible invented
 * default is not, because it renders identically to a sourced one.
 */

/** What the quoted percentage is multiplied by. The whole point of the module. */
export type FactoringChargeBase = "face" | "funds-employed";

export interface FactoringFeeStructure {
  id: "flat" | "tiered" | "prime-plus";
  label: string;
  /** The base the quoted percentage is applied to. Read by the calculator. */
  chargedOn: FactoringChargeBase;
  /** How a term sheet words it. */
  howItIsQuoted: string;
  /** The part of the quote that does not appear on the term sheet. */
  whatItHides: string;
  /** A published example of the structure, quoted or paraphrased with its source. */
  example: string;
  source: string;
}

export interface FactoringAncillaryFee {
  id: string;
  label: string;
  /** The published range, as a string, because several are open ended. */
  typical: string;
  /** When it is charged, which decides whether it is a prepaid finance charge. */
  when: string;
  note: string;
  source: string;
}

export interface FactoringDefaults {
  mode: "invoice" | "facility";
  structure: "flat" | "tiered" | "prime-plus";
  /** Single invoice mode. */
  faceValue: number;
  advanceRatePct: number;
  daysToPayment: number;
  /** Flat structure. */
  flatPct: number;
  /** Tiered structure. */
  initialPct: number;
  initialDays: number;
  stepPct: number;
  stepDays: number;
  /** Prime plus structure. */
  benchmarkPct: number;
  marginPct: number;
  dayCountBasis: 360 | 365;
  /** Ancillary. */
  transferFee: number;
  applicationFee: number;
  dueDiligenceFee: number;
  monthlyMinimumFee: number;
  minimumIsFloor: boolean;
  lockboxMonthlyFee: number;
  terminationFee: number;
  includeTermination: boolean;
  /** Facility mode. */
  monthlyFactoredVolume: number;
  averageInvoice: number;
}

/**
 * Widget default state, held here rather than as magic strings in the component.
 *
 * The 85 percent advance rate is the midpoint of the 80 to 90 percent range
 * altLINE publishes for general (non freight) factoring. The tiered default,
 * 3.0 percent covering the first 30 days and 1.0 percent for each further 10
 * days, is a MODELED default bracketed by two published examples rather than
 * lifted from either. altLINE's own worked schedule opens at 1.5 percent for the
 * first 30 days and steps 0.50 percent every 10 days; eCapital's published split
 * fee opens at 5 percent for the first 15 days and steps 1.0 percent every
 * further 15. Both sit inside the 1 to 5 percent of invoice value altLINE
 * publishes as the general market range, and so does this default. Replace it
 * with your own term sheet. The $25 wire fee sits inside altLINE's published $15
 * to $30 per wire.
 *
 * The prime plus default is the September 4, 2026 bank prime loan rate from the
 * Federal Reserve H.15 release, 6.75 percent, plus the 3.5 percent margin
 * eCapital uses in its own published example. 360 day accrual because that is
 * the ordinary US commercial convention, and the tool exposes the switch.
 *
 * Application, due diligence, monthly minimum, lockbox and termination all
 * default to ZERO. They are real and they are often the larger number, but the
 * published ranges are wide enough ($150 to $500 filing at altLINE against 0 to
 * 3 percent of the credit line across the market, $50 to $1,000 a month for a
 * lockbox, and no published range at all for an exit fee) that any single
 * default would be a guess dressed as a figure. `FACTORING_ANCILLARY_FEES`
 * carries the ranges beside the fields so a merchant can fill them in from their
 * own term sheet.
 *
 * The facility default, $150,000 of face value a month across $12,500 average
 * invoices, is a modeled mid sized US B2B services company, not a survey
 * figure, and the page says so.
 */
export const FACTORING_DEFAULTS: FactoringDefaults = {
  mode: "invoice",
  structure: "tiered",
  faceValue: 50000,
  advanceRatePct: 85,
  daysToPayment: 45,
  flatPct: 3,
  initialPct: 3,
  initialDays: 30,
  stepPct: 1,
  stepDays: 10,
  benchmarkPct: 6.75,
  marginPct: 3.5,
  dayCountBasis: 360,
  transferFee: 25,
  applicationFee: 0,
  dueDiligenceFee: 0,
  monthlyMinimumFee: 0,
  minimumIsFloor: true,
  lockboxMonthlyFee: 0,
  terminationFee: 0,
  includeTermination: false,
  monthlyFactoredVolume: 150000,
  averageInvoice: 12500,
};

/** Days to payment the sensitivity ladder is priced at. Net 30 pays late; this brackets it. */
export const FACTORING_DAY_LADDER: number[] = [15, 30, 45, 60, 75, 90];

/** Discount rates the benchmark grid is priced at, as a percentage of face value. */
export const FACTORING_RATE_LADDER: number[] = [1.5, 2, 3, 4, 5];

/**
 * The three ways a US factor quotes the discount fee.
 *
 * Ordered by how often a small business meets them, not by cost. The order is
 * also the order of increasing honesty: a flat rate hides the aging, a tiered
 * rate shows the aging but hides the annualization, and a prime plus rate is
 * the only one of the three quoted in units a business loan can be compared to.
 */
/**
 * The default row, named rather than indexed off the front of the array.
 *
 * Same reason `WORST_BAND` is named in `lib/tools-rates.ts`: with
 * `noUncheckedIndexedAccess` on, `ARRAY[0]` is typed `T | undefined`, so a
 * widget falling back to it inherits the undefined and has to defend against a
 * case that cannot happen. Naming the row makes the fallback total.
 */
const FLAT_DISCOUNT_STRUCTURE: FactoringFeeStructure = {
  id: "flat",
  label: "Flat discount rate",
  chargedOn: "face",
  howItIsQuoted:
    "One percentage of the invoice face value, covering a whole recourse period rather than a number of days. eCapital describes it as a one time cost for the entire recourse period, usually 60 or 90 days.",
  whatItHides:
    "Time. The fee does not change whether the debtor pays on day 12 or day 88, so the annualized cost of the same quote can differ by a factor of seven across the period it covers. A flat 3 percent is about 73 percent a year if the invoice clears in 15 days and about 12 percent a year if it clears in 90. Nothing on the term sheet tells you which one you signed, and a fast paying customer is the expensive case, not the cheap one.",
  example:
    "eCapital: a flat fee is a one time cost for the entire recourse period, usually 60 or 90 days.",
  source:
    "eCapital, Understanding Factoring Rates, Fees, and the Total Cost of a Factoring Agreement, page last updated July 29, 2026, read September 5, 2026",
};

export const FACTORING_FEE_STRUCTURES: FactoringFeeStructure[] = [
  FLAT_DISCOUNT_STRUCTURE,
  {
    id: "tiered",
    label: "Tiered by aging period",
    chargedOn: "face",
    howItIsQuoted:
      "An initial percentage of face value covering the first period, usually 30 days, then a smaller percentage added for each further block of 10, 15 or 30 days the invoice stays unpaid. altLINE publishes a worked example opening at 1.5 percent for the first 30 days and stepping 0.50 percent every 10 days, and eCapital publishes a split fee example of 5 percent for the initial 15 days plus 1.0 percent for each additional 15 days until payment.",
    whatItHides:
      "The step function. The fee does not accrue smoothly, it jumps at the boundary, so an invoice paid on day 41 under a 30 day plus 10 day structure costs the same as one paid on day 50 and one third more than one paid on day 40. It also hides who carries the aging risk: your customer decides when to pay, and the tier moves whether or not you had any say in it.",
    example:
      "altLINE publishes a worked tiered structure: 1.5 percent for 0 to 30 days, 2.0 percent to 40 days, 2.5 percent to 50 days, 3.0 percent to 60 days, 3.5 percent to 70 days, 4.0 percent to 80 days and 4.5 percent to 90 days.",
    source:
      "altLINE (a division of The Southern Bank Company), Invoice Factoring Rates and Cost, page last updated July 6, 2026, read September 5, 2026; eCapital, Understanding Factoring Rates, Fees, and the Total Cost of a Factoring Agreement, updated July 29, 2026",
  },
  {
    id: "prime-plus",
    label: "Prime plus, accrued daily",
    chargedOn: "funds-employed",
    howItIsQuoted:
      "A benchmark rate plus a margin, expressed per year, accrued each day on funds employed rather than on the invoice. eCapital publishes prime plus 3.5 percent as its example, and notes that at a 3 percent prime rate that is 6.5 percent per year.",
    whatItHides:
      "Very little, on the rate itself, which is why larger facilities use it. What it hides is the rest of the invoice: a prime plus facility almost always carries a separate monthly servicing or administration fee, and it is that fee, not the interest, that sets the real cost on a small book. Check the day count too. Accruing on a 360 day year rather than 365 turns a stated 10.25 percent into 10.39 percent without touching the number on the paper.",
    example:
      "eCapital: prime plus 3.5 percent, calculated each day an invoice is outstanding. The benchmark default here is the bank prime loan rate of 6.75 percent.",
    source:
      "eCapital, Understanding Factoring Rates, Fees, and the Total Cost of a Factoring Agreement, updated July 29, 2026; benchmark from Federal Reserve statistical release H.15 Selected Interest Rates, bank prime loan rate 6.75 percent, release of September 4, 2026",
  },
];

/**
 * The fees beside the discount rate.
 *
 * These are the real margin on a small factoring facility and they are the part
 * a rate comparison never reaches, because they are not percentages of anything
 * a quote mentions. Two of them, the monthly minimum and the termination fee,
 * can exceed the whole discount bill for a merchant who factors less than
 * planned or leaves early.
 *
 * `when` is load bearing rather than descriptive. A fee deducted from the
 * advance at funding is a prepaid finance charge, which under California's
 * commercial financing rules reduces the amount financed and therefore RAISES
 * the disclosed APR. A fee billed monthly does not. The calculator treats them
 * differently for that reason.
 */
export const FACTORING_ANCILLARY_FEES: FactoringAncillaryFee[] = [
  {
    id: "application",
    label: "Application, filing or origination fee",
    typical: "$150 to $500 at altLINE; 0 to 3 percent of the credit line across the market",
    when: "Once, at signing. Usually netted out of the first advance.",
    note: "Charged on the facility, not the invoice, so it lands entirely on your first few invoices if the relationship is short. altLINE describes its own as a filing fee and prices it in dollars; the wider market prices it as a percentage of the line, which on a $500,000 line at 2 percent is $10,000.",
    source: "altLINE, Invoice Factoring Rates and Cost, updated July 6, 2026, read September 5, 2026",
  },
  {
    id: "due-diligence",
    label: "Due diligence and credit approval fee",
    typical: "$35 to $100 per debtor credit check across the market; $0 at altLINE",
    when: "At onboarding, and again each time you add a customer to the facility.",
    note: "Per debtor, not per invoice. A business with forty customers pays it forty times, and pays it again when a customer's limit is reviewed. Ask whether the fee recurs on review or only on approval.",
    source: "altLINE, Invoice Factoring Rates and Cost, updated July 6, 2026, read September 5, 2026",
  },
  {
    id: "wire",
    label: "Wire transfer fee per advance",
    typical: "$15 to $30 at altLINE",
    when: "Every advance, deducted from the money that reaches you.",
    note: "This is the fee that quietly matters, because it is per advance rather than per month. A business factoring 12 invoices a month pays it 144 times a year. It is also a prepaid finance charge, so it raises the APR by more than its size suggests.",
    source: "altLINE, Invoice Factoring Rates and Cost, updated July 6, 2026, read September 5, 2026",
  },
  {
    id: "ach",
    label: "ACH transfer fee per advance",
    typical: "$5 to $30 across the market; $0 to $3 at altLINE",
    when: "Every advance funded by ACH rather than wire.",
    note: "The cheap alternative to a wire, at the cost of one to three days. If your factor charges $25 to wire and $3 to ACH, taking ACH on invoices you are not waiting on is free money.",
    source: "altLINE, Invoice Factoring Rates and Cost, updated July 6, 2026, read September 5, 2026",
  },
  {
    id: "monthly-minimum",
    label: "Monthly minimum volume fee",
    typical: "Not published as a range. eCapital names it; altLINE says it charges none.",
    when: "Monthly, whenever your discount fees fall below the contracted floor.",
    note: "The most dangerous line on a factoring term sheet for a seasonal business, because it charges you for the months you did not need the facility. Read whether it is a floor on your fees or a separate charge added to them, and model it as a floor only if the contract says so.",
    source: "eCapital, Understanding Factoring Rates, Fees, and the Total Cost of a Factoring Agreement, updated July 29, 2026, read September 5, 2026",
  },
  {
    id: "lockbox",
    label: "Lockbox, servicing or account monitoring fee",
    typical: "$50 to $1,000 a month across the market; up to $300 a month for a monthly access fee; $0 at altLINE",
    when: "Monthly, for the whole term, used or not.",
    note: "A lockbox is the bank account your customers are redirected to pay. On a prime plus facility this monthly fee, not the interest rate, is usually the larger number, which is why a prime plus quote cannot be compared to a discount rate quote on the headline percentage alone.",
    source: "altLINE, Invoice Factoring Rates and Cost, updated July 6, 2026, read September 5, 2026",
  },
  {
    id: "termination",
    label: "Early termination fee",
    typical: "No published range exists. Liquid Capital's own case studies show a 10 percent facility termination fee costing $100,000 to exit a $1,000,000 line, and a $160,000 exit fee priced off a volume shortfall.",
    when: "Once, if you leave before the term ends or miss the notice window.",
    note: "Priced on the facility LIMIT or on a volume shortfall, not on what you actually drew, so a business that took a large line and used little of it can still owe five figures to leave. Liquid Capital names three different formulas factors use: a percentage of the total facility amount, a charge based on how far short of the minimum volume you fell, and a charge for every month left on the contract. Pair it with the notice period, because a written cancellation window of 30 to 90 days that you miss silently renews the term.",
    source: "Liquid Capital, 5 Invoice Factoring Contract Terms That Can Trap Your Business, published April 16, 2026, read September 5, 2026. Case examples rather than a published schedule; get the number from your own agreement.",
  },
  {
    id: "misdirected",
    label: "Misdirected payment fee",
    typical: "Not published as a range. Named by eCapital as a standard fee line.",
    when: "Each time a customer pays you instead of the factor and you do not remit it within the contract window, usually two to five business days.",
    note: "The fee nobody budgets for, because it is triggered by your customer's accounts payable habits rather than by anything you do. Every assigned invoice has to be redirected, and long standing customers pay the way they always have. Depositing a misdirected check is a breach of most factoring agreements, not just a fee.",
    source: "eCapital, Understanding Factoring Rates, Fees, and the Total Cost of a Factoring Agreement, updated July 29, 2026, read September 5, 2026",
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
export const DEFAULT_FACTORING_STRUCTURE = FLAT_DISCOUNT_STRUCTURE;
