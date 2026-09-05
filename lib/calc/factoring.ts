/**
 * Invoice factoring: discount rate in, real annualized cost out.
 *
 * Client safe: no `@/models`, no I/O, no clock. The fee structure arrives as a
 * plain object rather than as an import of the data module, so the arithmetic
 * has no runtime dependency on a rate sheet that will change.
 *
 * ─── The failure mode this module exists to prevent: the denominator ─────────
 *
 * A factoring fee is charged on the FACE VALUE of the invoice. The merchant only
 * receives the ADVANCE, which is typically 80 to 90 percent of face. So there
 * are two ways to annualize the same fee and only one of them describes money
 * anybody actually had:
 *
 *   fee / FACE    x 365/days   understates the cost by the advance rate. On an
 *                              85 percent advance it is 15 percent too low, every
 *                              time, in the merchant's favor.
 *   fee / ADVANCE x 365/days   is the cost of the cash that reached the bank
 *                              account, which is the only cash that existed.
 *
 * On the page defaults the first is 40.96 percent and the second is 48.22
 * percent. Both are plausible, neither throws, and a reader cannot tell from the
 * number which one they are being shown. `aprOnFace` and `aprOnAdvance` are
 * therefore BOTH returned and both labeled, so the page has to say which is
 * which rather than quietly picking one.
 *
 * ─── Why the annualization multiplies rather than compounds ──────────────────
 *
 * This is not a stylistic choice, it is the disclosure method. California's
 * commercial financing regulations require the annual percentage rate to be
 * computed by the United States Rule or the actuarial method as set out in
 * Appendix J to 12 CFR Part 1026 (10 CCR 940(a)), and New York's Part 600 says
 * the same thing. Appendix J (b)(5)(vii) states that in a single advance, single
 * payment transaction whose term is less than a year and is not a whole number
 * of months, the number of unit periods in the term is 1 and the number of unit
 * periods per year is 365 divided by the number of days in the term. With one
 * unit period, Appendix J's P(1+i)^n = A collapses to i = A/P - 1, which is the
 * finance charge over the amount financed, and the annual percentage rate is
 * I = wi. That is exactly
 *
 *     APR = (finance charge / amount financed) x (365 / days outstanding)
 *
 * and it is the number this module returns as `aprOnAdvance`. Compounding the
 * same periodic cost gives a bigger figure that no US disclosure rule means and
 * no factor owes you. It is returned separately as `effectiveAnnualRate`, for
 * the merchant who is genuinely going to roll the facility all year, and it is
 * labeled as the compounded equivalent everywhere it appears.
 *
 * ─── What counts as the amount financed, and why the wire fee matters ────────
 *
 * California defines the amount financed for a factoring disclosure as "the
 * original advance amount, minus any prepaid finance charge" (10 CCR
 * 900(a)(1)(D)), and defines the finance charge in a factoring transaction as
 * "the face value on the invoice minus the amount paid directly to the recipient
 * upon assignment", with the reserve subtracted only where the financer
 * reasonably anticipates returning it (10 CCR 943(a)(3)). Follow that through
 * and the finance charge is the discount fee plus anything else deducted, and
 * the amount financed is the advance net of whatever was taken off the top.
 *
 * So a $25 wire fee is not a rounding error. It is charged AND it shrinks the
 * denominator, which is why a fee worth 0.06 percent of the advance moves the
 * APR by half a point.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * Per invoice money is computed in integer cents. A merchant reading this page
 * is usually holding a factoring statement or a term sheet, and binary floating
 * point produces one cent errors at precisely the moment somebody is checking.
 * Rates and day counts are floats, because they are not money.
 */

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Round half UP, matching `lib/tools-math.ts`. Explicit about intent on positives. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * 100);

const fromCents = (cents: number): number => cents / 100;

/** The disclosure year. Appendix J (b)(5) annualizes a sub year term over 365 days. */
export const FACTORING_DAYS_PER_YEAR = 365;

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------

export type FactoringStructureId = "flat" | "tiered" | "prime-plus";

export interface FactoringFeeTerms {
  structure: FactoringStructureId;
  /** Flat: one percentage of face for the whole recourse period. */
  flatPct: number;
  /** Tiered: the opening percentage of face and the days it covers. */
  initialPct: number;
  initialDays: number;
  /** Tiered: the percentage of face added per further block, and the block length in days. */
  stepPct: number;
  stepDays: number;
  /** Prime plus: benchmark and margin, per year, accrued on funds employed. */
  benchmarkPct: number;
  marginPct: number;
  /** Prime plus: 360 or 365. A 360 day year raises the real rate by 365/360. */
  dayCountBasis: number;
}

/**
 * The discount fee as a percentage of FACE VALUE, for the two structures priced
 * that way. Prime plus is not priced on face at all and returns 0 here; use
 * `discountFeeCents`, which handles all three.
 *
 * The tier count is a CEILING, not a rounding. Entering the 41st day of a 30 day
 * plus 10 day structure buys the whole 41 to 50 block: a factor does not prorate
 * a step. Rounding to nearest here would make an invoice paid on day 44 cheaper
 * than one paid on day 41, which is not a rate any contract charges, and the
 * error is invisible because the number stays plausible.
 */
export function discountPctOfFace(days: number, terms: FactoringFeeTerms): number {
  const d = Math.max(0, days);
  if (terms.structure === "flat") return Math.max(0, terms.flatPct);
  if (terms.structure === "tiered") {
    const initial = Math.max(0, terms.initialPct);
    const initialDays = Math.max(1, terms.initialDays);
    const stepDays = Math.max(1, terms.stepDays);
    if (d <= initialDays) return initial;
    const steps = Math.ceil((d - initialDays) / stepDays);
    return initial + steps * Math.max(0, terms.stepPct);
  }
  return 0;
}

/**
 * The discount fee in cents, for all three structures.
 *
 * `faceCents` and `advanceCents` are both taken because the base differs by
 * structure and getting it wrong is the silent overcharge this module exists to
 * prevent: a prime plus rate applied to face rather than to funds employed
 * overstates the cost by 1 / advance rate, about 18 percent on an 85 percent
 * advance, and the answer still looks like a factoring quote.
 */
export function discountFeeCents(
  faceCents: number,
  advanceCents: number,
  days: number,
  terms: FactoringFeeTerms,
): number {
  if (terms.structure === "prime-plus") {
    const annual = (Math.max(0, terms.benchmarkPct) + Math.max(0, terms.marginPct)) / 100;
    const basis = terms.dayCountBasis === 365 ? 365 : 360;
    return roundHalfUp((advanceCents * annual * Math.max(0, days)) / basis);
  }
  return roundHalfUp((faceCents * discountPctOfFace(days, terms)) / 100);
}

// ---------------------------------------------------------------------------
// One invoice
// ---------------------------------------------------------------------------

export interface FactoringInvoiceInput {
  faceValue: number;
  advanceRatePct: number;
  /** Actual days from funding to the debtor paying, not the stated terms. */
  daysToPayment: number;
  terms: FactoringFeeTerms;
  /** Wire or ACH fee taken out of the advance when it is funded. Prepaid. */
  transferFee: number;
  /** Any other one time charge netted out of this advance. Prepaid. */
  upfrontFees: number;
  /** Any charge deducted from the reserve release rather than from the advance. */
  settlementFees: number;
}

export interface FactoringInvoiceResult {
  faceValue: number;
  advance: number;
  /** Face minus advance. Held by the factor until the debtor pays. */
  reserveHeld: number;
  discountFee: number;
  /** Everything charged that is not the discount fee. */
  ancillaryTotal: number;
  totalCost: number;
  /** Cash that reaches the bank account on funding day. */
  cashAtFunding: number;
  /** Cash released when the debtor pays. Can be negative if fees exceed the reserve. */
  cashAtSettlement: number;
  netProceeds: number;
  costPctOfFace: number;
  costPctOfAdvance: number;
  /** Advance minus prepaid finance charges. 10 CCR 900(a)(1)(D). */
  amountFinanced: number;
  /** Discount fee plus everything else charged. 10 CCR 943(a)(3). */
  financeCharge: number;
  /** The honest number. Appendix J (b)(5) on the cash actually advanced. */
  aprOnAdvance: number;
  /** The flattering number: the same fee annualized over the invoice face. */
  aprOnFace: number;
  /** What rolling this deal all year would really cost, compounded. */
  effectiveAnnualRate: number;
  /** The discount fee expressed as a percentage of face, for the tier that applied. */
  discountPctApplied: number;
  daysToPayment: number;
}

/**
 * Price one factored invoice and annualize it two ways.
 *
 * The reserve is assumed to be RETURNED in full less the fees, which is what
 * 10 CCR 943(a)(3) contemplates and what a performing facility does. If your
 * factor keeps part of the reserve as a permanent holdback, the money is a cost
 * and belongs in `settlementFees`, not in the reserve.
 */
export function factoringInvoice(input: FactoringInvoiceInput): FactoringInvoiceResult {
  const faceC = toCents(input.faceValue);
  const ratePct = Math.min(100, Math.max(0, input.advanceRatePct));
  const advanceC = roundHalfUp((faceC * ratePct) / 100);
  const reserveC = faceC - advanceC;
  const days = Math.max(0, input.daysToPayment);

  const feeC = discountFeeCents(faceC, advanceC, days, input.terms);
  const prepaidC = toCents(input.transferFee) + toCents(input.upfrontFees);
  const settlementC = toCents(input.settlementFees);
  const ancillaryC = prepaidC + settlementC;
  const totalCostC = feeC + ancillaryC;

  const cashAtFundingC = advanceC - prepaidC;
  const cashAtSettlementC = reserveC - feeC - settlementC;
  const netProceedsC = faceC - totalCostC;

  // Amount financed: the advance net of what was taken off the top of it.
  const amountFinancedC = advanceC - prepaidC;
  const financeChargeC = totalCostC;

  const periodicRate = amountFinancedC > 0 ? financeChargeC / amountFinancedC : 0;
  const periodsPerYear = days > 0 ? FACTORING_DAYS_PER_YEAR / days : 0;

  const aprOnAdvance = periodicRate * periodsPerYear * 100;
  const aprOnFace = faceC > 0 && days > 0 ? (financeChargeC / faceC) * periodsPerYear * 100 : 0;
  const effectiveAnnualRate =
    periodsPerYear > 0 && periodicRate > 0
      ? (Math.pow(1 + periodicRate, periodsPerYear) - 1) * 100
      : 0;

  return {
    faceValue: fromCents(faceC),
    advance: fromCents(advanceC),
    reserveHeld: fromCents(reserveC),
    discountFee: fromCents(feeC),
    ancillaryTotal: fromCents(ancillaryC),
    totalCost: fromCents(totalCostC),
    cashAtFunding: fromCents(cashAtFundingC),
    cashAtSettlement: fromCents(cashAtSettlementC),
    netProceeds: fromCents(netProceedsC),
    costPctOfFace: faceC > 0 ? (totalCostC / faceC) * 100 : 0,
    costPctOfAdvance: advanceC > 0 ? (totalCostC / advanceC) * 100 : 0,
    amountFinanced: fromCents(amountFinancedC),
    financeCharge: fromCents(financeChargeC),
    aprOnAdvance,
    aprOnFace,
    effectiveAnnualRate,
    discountPctApplied: faceC > 0 ? (feeC / faceC) * 100 : 0,
    daysToPayment: days,
  };
}

// ---------------------------------------------------------------------------
// A year on the facility
// ---------------------------------------------------------------------------

export interface FactoringFacilityInput {
  /** Face value of invoices assigned each month. */
  monthlyFactoredVolume: number;
  /** Average invoice, used only to count advances so the per advance fees are right. */
  averageInvoice: number;
  advanceRatePct: number;
  daysToPayment: number;
  terms: FactoringFeeTerms;
  transferFee: number;
  /** Charged once at signing. Spread over the twelve months this models. */
  applicationFee: number;
  dueDiligenceFee: number;
  /** Monthly minimum. A floor on the discount bill, or a separate monthly charge. */
  monthlyMinimumFee: number;
  minimumIsFloor: boolean;
  lockboxMonthlyFee: number;
  terminationFee: number;
  includeTermination: boolean;
}

export interface FactoringFacilityResult {
  annualFactoredVolume: number;
  advancesPerYear: number;
  annualDiscountFees: number;
  /** How much of the discount bill is the minimum rather than actual usage. */
  minimumTopUp: number;
  annualTransferFees: number;
  annualLockboxFees: number;
  oneTimeFees: number;
  annualTotalCost: number;
  /** Face volume factored across the year, less everything charged. */
  annualNetProceeds: number;
  costPctOfVolume: number;
  /** The average dollar balance of advances outstanding across the year. */
  averageFundsEmployed: number;
  /** Annual cost over average funds employed. The facility level answer. */
  annualizedRateOnFunds: number;
}

/**
 * Price twelve months on a factoring facility.
 *
 * `averageFundsEmployed` is the whole point of the second mode. A single invoice
 * APR answers "what did this one cost"; a revolving facility needs "what am I
 * paying for the average balance I keep outstanding", and those are different
 * questions with the same units. The average balance is
 *
 *     annual advance volume x (days outstanding / 365)
 *
 * which is Little's law applied to money: each dollar advanced is out for
 * `days` days, so the average balance is the annual flow times the fraction of a
 * year each dollar is away.
 *
 * The minimum is applied as a FLOOR on the discount bill by default, not as an
 * extra line, because that is how a factoring agreement words it, exactly as the
 * monthly minimum on a card processing agreement is a floor on the processing
 * charge. Contracts that add it instead exist, so the caller can switch.
 *
 * The one time fees are charged ONCE and divided by nothing: they are the real
 * first year cost and the page says the second year is cheaper. Amortizing them
 * across an assumed multi year relationship would flatter a facility that most
 * merchants leave inside eighteen months.
 */
export function factoringFacility(input: FactoringFacilityInput): FactoringFacilityResult {
  const monthlyVolumeC = toCents(input.monthlyFactoredVolume);
  const annualVolumeC = monthlyVolumeC * 12;
  const ratePct = Math.min(100, Math.max(0, input.advanceRatePct));
  const days = Math.max(0, input.daysToPayment);

  const avgInvoice = Math.max(0, input.averageInvoice);
  const advancesPerMonth = avgInvoice > 0 ? input.monthlyFactoredVolume / avgInvoice : 0;
  const advancesPerYear = advancesPerMonth * 12;

  // Price the month, then floor it, then annualize. Flooring an annual figure
  // would let a strong month subsidise a weak one, which a monthly minimum
  // specifically does not allow.
  const monthlyAdvanceC = roundHalfUp((monthlyVolumeC * ratePct) / 100);
  const rawMonthlyFeeC = discountFeeCents(monthlyVolumeC, monthlyAdvanceC, days, input.terms);
  const minimumC = toCents(input.monthlyMinimumFee);
  const chargedMonthlyFeeC = input.minimumIsFloor
    ? Math.max(rawMonthlyFeeC, minimumC)
    : rawMonthlyFeeC + minimumC;
  const topUpC = Math.max(0, chargedMonthlyFeeC - rawMonthlyFeeC);

  const annualDiscountC = chargedMonthlyFeeC * 12;
  const annualTransferC = roundHalfUp(toCents(input.transferFee) * advancesPerYear);
  const annualLockboxC = toCents(input.lockboxMonthlyFee) * 12;
  const oneTimeC =
    toCents(input.applicationFee) +
    toCents(input.dueDiligenceFee) +
    (input.includeTermination ? toCents(input.terminationFee) : 0);

  const annualTotalC = annualDiscountC + annualTransferC + annualLockboxC + oneTimeC;

  const annualAdvanceC = roundHalfUp((annualVolumeC * ratePct) / 100);
  const averageFundsC = (annualAdvanceC * days) / FACTORING_DAYS_PER_YEAR;

  return {
    annualFactoredVolume: fromCents(annualVolumeC),
    advancesPerYear,
    annualDiscountFees: fromCents(annualDiscountC),
    minimumTopUp: fromCents(topUpC * 12),
    annualTransferFees: fromCents(annualTransferC),
    annualLockboxFees: fromCents(annualLockboxC),
    oneTimeFees: fromCents(oneTimeC),
    annualTotalCost: fromCents(annualTotalC),
    annualNetProceeds: fromCents(annualVolumeC - annualTotalC),
    costPctOfVolume: annualVolumeC > 0 ? (annualTotalC / annualVolumeC) * 100 : 0,
    averageFundsEmployed: fromCents(averageFundsC),
    annualizedRateOnFunds: averageFundsC > 0 ? (annualTotalC / averageFundsC) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

export interface FactoringLadderRow {
  days: number;
  discountPct: number;
  cost: number;
  aprOnAdvance: number;
  aprOnFace: number;
}

/**
 * The same invoice priced at a range of payment speeds.
 *
 * This is the output that makes the page useful rather than merely correct: the
 * merchant does not choose the days, the customer does, so the honest answer to
 * "what does factoring cost" is a curve rather than a number. It calls
 * `factoringInvoice`, deliberately, so the ladder can never drift from the
 * headline printed above it.
 */
export function factoringLadder(
  input: FactoringInvoiceInput,
  dayList: number[],
): FactoringLadderRow[] {
  return dayList.map((days) => {
    const r = factoringInvoice({ ...input, daysToPayment: days });
    return {
      days,
      discountPct: r.discountPctApplied,
      cost: r.totalCost,
      aprOnAdvance: r.aprOnAdvance,
      aprOnFace: r.aprOnFace,
    };
  });
}

/**
 * A grid of APRs: discount rate as a percentage of face down the side, days to
 * payment across the top, at one advance rate. Fees excluded, so every cell is
 * reproducible by hand as (pct / advanceRate) x (365 / days).
 */
export function factoringAprGrid(
  advanceRatePct: number,
  discountPcts: number[],
  dayList: number[],
): { discountPct: number; aprs: number[] }[] {
  const a = Math.min(100, Math.max(0.0001, advanceRatePct)) / 100;
  return discountPcts.map((p) => ({
    discountPct: p,
    aprs: dayList.map((d) => (d > 0 ? (p / 100 / a) * (FACTORING_DAYS_PER_YEAR / d) * 100 : 0)),
  }));
}
