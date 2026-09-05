/**
 * The chargeback cost model behind `/tools/chargeback-cost-calculator`.
 *
 * Client-safe: no `@/models`, no `server-only`, no I/O, no `Date.now()`. Given
 * the same inputs it returns the same numbers on the server and in the browser,
 * which is what lets the widget render a real result into the initial HTML.
 *
 * ─── WHY THIS IS ITS OWN MODULE AND ITS OWN TEST ────────────────────────────
 * Every failure mode below is SILENT. Three of them in particular:
 *
 *   1. COMPOUNDING THE TWO WIN RATES. A representment that succeeds at the first
 *      cycle can still be lost at pre-arbitration. The final win rate is
 *      first x (1 - secondCycleLoss), a PRODUCT. Subtracting instead
 *      (44.6 - 19 = 25.6 percent) or ignoring the second cycle (44.6 percent)
 *      both produce a plausible looking number and both are wrong. The right
 *      answer on those inputs is 36.126 percent, which sits between the two, so
 *      neither error looks obviously silly on the page.
 *
 *   2. THE DIRECTION OF THE REFUNDABLE COUNTER FEE. Where a processor returns
 *      the dispute countered fee on a win, that fee belongs on BOTH sides of the
 *      expected value: paid on every case fought, returned on the share you win.
 *      Modeling it as a cost only overstates the case for giving up, and
 *      modeling it as free understates it. It also moves the break-even order
 *      value by more than you would guess: with a 36.126 percent win rate a
 *      refundable 15 dollar fee shifts break-even by 15 dollars exactly, because
 *      the probability weight cancels in the algebra.
 *
 *   3. MONEY THAT A MERCHANT WILL CHECK AGAINST A STATEMENT. The per chargeback
 *      figures are computed in INTEGER CENTS, because binary floating point
 *      produces one cent errors at exactly the moment somebody is holding a
 *      statement next to the screen. Expected values are a different animal:
 *      they are probability weighted, so there is no cent to be exact about.
 *      Those are carried as fractional cents and rounded only for display, and
 *      the split is deliberate rather than accidental.
 *
 * The whole model is documented against `tests/tools/batch-four/chargeback-cost-calculator.test.ts`,
 * where every expected value is derived by hand or from a closed form worked
 * separately from this file.
 */

import type { MonitoringEscalation } from "@/lib/tools-data/chargeback-cost";

// ---------------------------------------------------------------------------
// Cents
// ---------------------------------------------------------------------------

/**
 * Round half UP, which is what a processor does. Duplicated from
 * `lib/tools-math.ts` on purpose: importing that module would drag the payout
 * and MCA reference data into the chunk every `/tools/*` page loads, for one
 * line of arithmetic.
 */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const cents = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * 100);
const dollars = (c: number): number => c / 100;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ChargebackCostInput {
  /** The disputed order. */
  averageOrderValue: number;
  costOfGoods: number;
  /** Pick, pack, postage and anything else spent getting the order out. */
  fulfillment: number;
  /** The processing you already paid on the original sale and do not get back. */
  processingRatePct: number;
  processingFixed: number;
  /** Charged on receipt of the dispute, whatever the outcome. */
  chargebackFee: number;
  /** Charged when you submit evidence. Some processors return it on a win. */
  counterFee: number;
  counterFeeRefundedOnWin: boolean;
  /** Minutes spent handling a dispute you do NOT fight: logging it, reconciling it. */
  staffMinutes: number;
  /** ADDITIONAL minutes to assemble and submit a representment, on top of the above. */
  fightMinutes: number;
  staffHourlyRate: number;
  monthlyChargebacks: number;
  monthlyTransactions: number;
  /** Share of chargebacks you actually represent. */
  fightSharePct: number;
  /** First-cycle representment win rate. */
  firstCycleWinRatePct: number;
  /** Share of first-cycle wins later reversed at pre-arbitration or arbitration. */
  secondCycleLossPct: number;
}

// ---------------------------------------------------------------------------
// One chargeback
// ---------------------------------------------------------------------------

export interface PerChargebackResult {
  /** The sale you no longer have. Received at settlement, taken back at the debit. */
  revenueReversed: number;
  goodsAndFulfillment: number;
  /** Not returned when a payment is disputed, which is why it is a loss and not a wash. */
  processingFeeRetained: number;
  chargebackFee: number;
  staffCost: number;
  /**
   * Net cash actually gone. The settlement and the chargeback debit cancel each
   * other out over the life of the order, so the order value is NOT a cash line
   * twice: what leaves the bank is the goods, the fulfillment, the processing fee
   * the processor keeps, the chargeback fee and the labor.
   */
  cashOut: number;
  /** Cash gone plus the revenue reversed. This is the number behind the "2x to 3x" claim. */
  totalExposure: number;
  /** totalExposure divided by the order value. */
  multipleOfOrder: number;
  grossMarginPerOrder: number;
  grossMarginPct: number;
  /** Orders at this margin needed to replace the cash one chargeback removed. */
  salesToBreakEven: number;
}

export function perChargebackCost(input: ChargebackCostInput): PerChargebackResult {
  const aovC = cents(input.averageOrderValue);
  const cogsC = cents(input.costOfGoods);
  const fulfilC = cents(input.fulfillment);
  const processingC =
    roundHalfUp((aovC * Math.max(0, input.processingRatePct)) / 100) + cents(input.processingFixed);
  const feeC = cents(input.chargebackFee);
  const staffC = roundHalfUp((cents(input.staffHourlyRate) * Math.max(0, input.staffMinutes)) / 60);

  const cashOutC = cogsC + fulfilC + processingC + feeC + staffC;
  const exposureC = cashOutC + aovC;
  const marginC = aovC - cogsC - fulfilC - processingC;

  return {
    revenueReversed: dollars(aovC),
    goodsAndFulfillment: dollars(cogsC + fulfilC),
    processingFeeRetained: dollars(processingC),
    chargebackFee: dollars(feeC),
    staffCost: dollars(staffC),
    cashOut: dollars(cashOutC),
    totalExposure: dollars(exposureC),
    multipleOfOrder: aovC > 0 ? exposureC / aovC : 0,
    grossMarginPerOrder: dollars(marginC),
    grossMarginPct: aovC > 0 ? (marginC / aovC) * 100 : 0,
    // A merchant selling below variable cost cannot trade out of a chargeback at
    // any volume, so this is reported as zero rather than as a negative order
    // count that would render as a confident piece of nonsense.
    salesToBreakEven: marginC > 0 ? cashOutC / marginC : 0,
  };
}

// ---------------------------------------------------------------------------
// Representment
// ---------------------------------------------------------------------------

export interface RepresentmentResult {
  /** first x (1 - secondCycleLoss). A product, not a difference. */
  finalWinRatePct: number;
  /** What it costs to fight one, win or lose: extra labor plus the countered fee. */
  costToFightOne: number;
  /** Probability weighted recovery on one case fought. */
  expectedRecoveryPerFight: number;
  /** Recovery minus cost. Negative means fighting the average case destroys value. */
  expectedValuePerFight: number;
  /**
   * The order value at which fighting breaks even.
   *
   * p x (A + refundedFee) = labor + fee, so A = (labor + fee) / p - refundedFee.
   * Infinity when the final win rate is zero, which the widget renders as "no
   * order value makes this pay" rather than as a dollar figure.
   */
  breakEvenOrderValue: number;
  /** Cases fought per year at the entered fight share. */
  disputesFoughtPerYear: number;
  /** Expected cases still won after the second cycle. */
  disputesWonPerYear: number;
}

export function representmentEconomics(input: ChargebackCostInput): RepresentmentResult {
  const first = Math.min(100, Math.max(0, input.firstCycleWinRatePct)) / 100;
  const secondLoss = Math.min(100, Math.max(0, input.secondCycleLossPct)) / 100;
  const p = first * (1 - secondLoss);

  const aovC = cents(input.averageOrderValue);
  const counterC = cents(input.counterFee);
  const refundedC = input.counterFeeRefundedOnWin ? counterC : 0;
  const fightLaborC = roundHalfUp((cents(input.staffHourlyRate) * Math.max(0, input.fightMinutes)) / 60);

  const costC = fightLaborC + counterC;
  const recoverOnWinC = aovC + refundedC;
  const expectedRecoveryC = p * recoverOnWinC;

  const perYear = Math.max(0, input.monthlyChargebacks) * 12;
  const fought = perYear * (Math.min(100, Math.max(0, input.fightSharePct)) / 100);

  return {
    finalWinRatePct: p * 100,
    costToFightOne: dollars(costC),
    expectedRecoveryPerFight: dollars(expectedRecoveryC),
    expectedValuePerFight: dollars(expectedRecoveryC - costC),
    breakEvenOrderValue: p > 0 ? dollars(costC / p - refundedC) : Number.POSITIVE_INFINITY,
    disputesFoughtPerYear: fought,
    disputesWonPerYear: fought * p,
  };
}

// ---------------------------------------------------------------------------
// A year of it
// ---------------------------------------------------------------------------

export interface AnnualChargebackResult {
  chargebacksPerYear: number;
  disputeRatePct: number;
  /** Cash out on every chargeback received, whether or not it is fought. */
  baseCashOut: number;
  /** Extra labor and countered fees spent fighting. */
  representmentCost: number;
  /** Probability weighted recovery from the cases fought. */
  representmentRecovered: number;
  /** baseCashOut + representmentCost - representmentRecovered. */
  netAnnualCost: number;
  annualRevenue: number;
  pctOfRevenue: number;
  /**
   * The number that lands. Additional orders at the merchant's own gross margin
   * needed to earn back a year of chargebacks.
   *
   * Margin is the right denominator and almost nobody uses it: dividing by
   * revenue tells you how many dollars have to pass through the till, which is
   * not the same thing as how many dollars you have to keep. Zero when margin is
   * not positive, because no volume of loss-making orders earns anything back.
   */
  extraSalesNeeded: number;
  extraRevenueNeeded: number;
}

export function annualChargebackCost(input: ChargebackCostInput): AnnualChargebackResult {
  const per = perChargebackCost(input);
  const rep = representmentEconomics(input);

  const n = Math.max(0, input.monthlyChargebacks) * 12;
  const baseCashOut = per.cashOut * n;
  const representmentCost = rep.costToFightOne * rep.disputesFoughtPerYear;
  const representmentRecovered = rep.expectedRecoveryPerFight * rep.disputesFoughtPerYear;
  const net = baseCashOut + representmentCost - representmentRecovered;

  const annualRevenue = Math.max(0, input.monthlyTransactions) * 12 * Math.max(0, input.averageOrderValue);
  const extraSales = per.grossMarginPerOrder > 0 ? net / per.grossMarginPerOrder : 0;

  return {
    chargebacksPerYear: n,
    disputeRatePct:
      input.monthlyTransactions > 0
        ? (Math.max(0, input.monthlyChargebacks) / input.monthlyTransactions) * 100
        : 0,
    baseCashOut,
    representmentCost,
    representmentRecovered,
    netAnnualCost: net,
    annualRevenue,
    pctOfRevenue: annualRevenue > 0 ? (net / annualRevenue) * 100 : 0,
    extraSalesNeeded: extraSales,
    extraRevenueNeeded: extraSales * Math.max(0, input.averageOrderValue),
  };
}

// ---------------------------------------------------------------------------
// Monitoring program escalation
// ---------------------------------------------------------------------------

export interface EscalationMonth {
  month: number;
  monthlyAssessment: number;
  issuerRecovery: number;
  perEventAssessment: number;
  total: number;
  cumulative: number;
}

export interface EscalationResult {
  months: EscalationMonth[];
  twelveMonthTotal: number;
  firstChargedMonth: number | null;
}

const bandFor = (ladder: MonitoringEscalation["ladder"], month: number): number => {
  for (const b of ladder) {
    if (month >= b.fromMonth && (b.toMonth === null || month <= b.toMonth)) return b.monthlyUsd;
  }
  return 0;
};

/**
 * What a monitoring program costs month by month once it has identified you.
 *
 * Month 1 is the month of identification, NOT the month you first went over a
 * ratio. Both Mastercard tiers charge nothing in month 1 and the ladder steps up
 * from month 2, so a merchant reading "USD 1,000" off a program guide and
 * budgeting one payment is out by a factor of ten inside a year.
 *
 * `monthlyEvents` is the Visa count: fraud reports plus disputes, which is a
 * larger number than the chargeback count and is passed separately for that
 * reason.
 */
export function monitoringEscalationCost(
  program: MonitoringEscalation,
  monthlyChargebacks: number,
  monthlyEvents: number,
  months = 12,
): EscalationResult {
  const cbs = Math.max(0, monthlyChargebacks);
  const events = Math.max(0, monthlyEvents);
  const out: EscalationMonth[] = [];
  let cumulative = 0;
  let firstCharged: number | null = null;

  for (let m = 1; m <= months; m += 1) {
    const monthly = bandFor(program.ladder, m);
    const ir =
      program.perChargebackOverCount && m >= program.perChargebackOverCount.fromMonth
        ? Math.max(0, cbs - program.perChargebackOverCount.overCount) * program.perChargebackOverCount.usd
        : 0;
    const perEvent = program.perEventUsd !== null ? program.perEventUsd * events : 0;
    const total = monthly + ir + perEvent;
    cumulative += total;
    if (total > 0 && firstCharged === null) firstCharged = m;
    out.push({ month: m, monthlyAssessment: monthly, issuerRecovery: ir, perEventAssessment: perEvent, total, cumulative });
  }

  return { months: out, twelveMonthTotal: cumulative, firstChargedMonth: firstCharged };
}
