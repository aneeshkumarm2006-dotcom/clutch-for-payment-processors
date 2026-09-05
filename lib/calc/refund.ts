/**
 * What a refunded order costs, and what refunds do to an effective rate.
 *
 * Client safe: no `@/models`, no I/O, no clock. The policy flags arrive as a
 * plain object rather than as an import of the data module, so the arithmetic
 * has no runtime dependency on a rate sheet that will change.
 *
 * ─── The failure mode this module exists to prevent ─────────────────────────
 *
 * The headline output is the effective rate a merchant really pays once refunds
 * are counted. There are two ways to compute it and only one is right:
 *
 *   fees / GROSS volume   is the nominal rate. It barely moves when returns
 *                         rise, because the fee and the volume both shrink
 *                         together, and it hides the entire point of the page.
 *   fees / REVENUE KEPT   is the real rate. You paid a fee on every order,
 *                         including the ones you handed back, so the money that
 *                         stayed has to carry the whole bill.
 *
 * On the page defaults the first is 3.23 percent and the second is 4.01 percent.
 * Both look like plausible answers, neither throws, and a reader cannot tell
 * from the number alone which one they are being shown. `nominalEffectiveRate`
 * and `trueEffectiveRate` are therefore BOTH returned and both labelled, so the
 * page has to state which is which rather than quietly picking one.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * Per-order money is computed in integer cents. A merchant reading this page is
 * usually holding a statement or a payout report, and binary floating point
 * produces one cent errors at precisely the moment somebody is checking. A
 * processor prices each order separately and rounds each fee separately, so the
 * per-order fee is rounded first and multiplied second, never the reverse.
 *
 * ─── Why the monthly figures are multiplied by twelve ───────────────────────
 *
 * Because this is a flow, not a growth rate. Annualising a churn rate by
 * multiplying is a real and silent bug (see `involuntaryChurn` in
 * `lib/tools-math.ts`), because survivors compound. Twelve months of refund fees
 * do not compound: each month's fee is charged once and paid once, so twelve
 * identical months cost twelve times one month. The model holds volume flat and
 * says so, which is a stated limit rather than a hidden one.
 */

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Round half UP, which is the direction a processor rounds. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const atLeastZero = (n: number): number => Math.max(0, safe(n));

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * How a processor treats the fee when you refund.
 *
 * Deliberately three independent switches rather than one enum: a processor that
 * returns the percentage but keeps the fixed fee is a real structure, it is what
 * PayPal did before 2019, and an enum would have had to name every combination.
 */
export interface RefundPolicyFlags {
  /** Does the percentage portion come back? Prorated on a partial refund. */
  percentReturned: boolean;
  /** Does the flat per-transaction fee come back? Full refunds only, see below. */
  fixedReturned: boolean;
  /** A charge for processing the refund itself, in dollars. */
  refundFee: number;
}

// ---------------------------------------------------------------------------
// One order, refunded in full or in part
// ---------------------------------------------------------------------------

export interface SingleRefundInputs {
  orderValue: number;
  /** What you hand back. Equal to `orderValue` for a full refund. */
  refundAmount: number;
  ratePct: number;
  fixedFee: number;
  policy: RefundPolicyFlags;
}

export interface SingleRefundResult {
  isPartial: boolean;
  refundAmount: number;
  /** Fee charged on the original sale. */
  originalFee: number;
  /** The two halves of that fee. */
  percentPortion: number;
  fixedPortion: number;
  /** What the policy actually gives back. */
  percentReturnedAmount: number;
  fixedReturnedAmount: number;
  /** A new charge for the refund transaction itself. */
  refundFeeCharged: number;
  /** Original fee, less anything returned, plus any refund fee. The damage. */
  feeRetained: number;
  /** Sale value you still hold after the refund. Zero on a full refund. */
  revenueKept: number;
  /** Fee retained as a share of the money you handed back. */
  costAsPctOfRefund: number;
  /**
   * Fee retained as a share of the revenue you kept.
   *
   * `null` on a full refund, where nothing was kept and the ratio is undefined.
   * Returning zero there would print an encouraging 0.00% on the worst case in
   * the model, and returning Infinity would print "N/A" without saying why.
   */
  effectiveRateOnKept: number | null;
}

/**
 * Price one refund.
 *
 * The percentage, where a policy returns it, is prorated on the amount actually
 * handed back, which is how a prorating processor behaves: refund 60 of a 90
 * dollar order and 60 dollars' worth of percentage comes back, not 90.
 *
 * The fixed fee is returned ONLY on a full refund, even when `fixedReturned` is
 * true. A flat fee is charged once for accepting the payment and has no natural
 * proration; every published policy that returned a fixed fee returned it on
 * full refunds only. Modelling it as prorated would understate the cost of the
 * exact case this page is about, which is the partial refund.
 */
export function singleRefund(input: SingleRefundInputs): SingleRefundResult {
  const orderC = atLeastZero(toCents(input.orderValue));
  const refundC = Math.min(orderC, atLeastZero(toCents(input.refundAmount)));
  const rate = atLeastZero(input.ratePct) / 100;
  const fixedC = atLeastZero(toCents(input.fixedFee));
  const refundFeeC = atLeastZero(toCents(input.policy.refundFee));

  const percentPortionC = roundHalfUp(orderC * rate);
  const originalFeeC = percentPortionC + fixedC;

  const isPartial = refundC > 0 && refundC < orderC;

  const percentBackC = input.policy.percentReturned
    ? Math.min(percentPortionC, roundHalfUp(refundC * rate))
    : 0;
  const fixedBackC = input.policy.fixedReturned && !isPartial && refundC > 0 ? fixedC : 0;

  const retainedC = originalFeeC - percentBackC - fixedBackC + (refundC > 0 ? refundFeeC : 0);
  const keptC = orderC - refundC;

  return {
    isPartial,
    refundAmount: refundC / 100,
    originalFee: originalFeeC / 100,
    percentPortion: percentPortionC / 100,
    fixedPortion: fixedC / 100,
    percentReturnedAmount: percentBackC / 100,
    fixedReturnedAmount: fixedBackC / 100,
    refundFeeCharged: (refundC > 0 ? refundFeeC : 0) / 100,
    feeRetained: retainedC / 100,
    revenueKept: keptC / 100,
    costAsPctOfRefund: refundC > 0 ? (retainedC / refundC) * 100 : 0,
    effectiveRateOnKept: keptC > 0 ? (retainedC / keptC) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// A month of orders, some of them refunded
// ---------------------------------------------------------------------------

export interface AnnualRefundInputs {
  /** Gross card volume in a month, before refunds. */
  monthlyVolume: number;
  monthlyTransactions: number;
  /** Share of orders refunded, in percent. */
  returnRatePct: number;
  ratePct: number;
  fixedFee: number;
  policy: RefundPolicyFlags;
  /** Your own handling cost per returned order. Zero unless the user supplies it. */
  restockingPerReturn: number;
  returnShippingPerReturn: number;
}

export interface AnnualRefundResult {
  averageOrderValue: number;
  feePerOrder: number;
  refundedOrdersPerMonth: number;
  refundedVolumeMonthly: number;
  /** Fee left behind by ONE refunded order, after any return and any refund fee. */
  retainedFeePerRefund: number;
  feeOnRefundedMonthly: number;
  feeOnRefundedAnnual: number;
  /** Fee on every order, refunded or not, before refund fees. */
  grossFeeMonthly: number;
  /** Everything the processor takes in a month, including refund fees. */
  totalFeeMonthly: number;
  totalFeeAnnual: number;
  /** Sales value that survived the refunds. */
  revenueKeptMonthly: number;
  /** Fees over GROSS volume. The rate a statement appears to show. */
  nominalEffectiveRate: number;
  /** Fees over revenue KEPT. The rate the business actually pays. */
  trueEffectiveRate: number;
  /** Percentage points between the two. */
  rateGapPoints: number;
  handlingCostMonthly: number;
  handlingCostAnnual: number;
  /** Retained fees plus refund fees plus handling, over a year. */
  totalRefundCostAnnual: number;
  /** What the same year would cost if the percentage came back on refunds. */
  feeOnRefundedAnnualIfPercentReturned: number;
  annualSavingIfPercentReturned: number;
}

/**
 * Price a month of trading, then annualise it.
 *
 * Average order value is DERIVED from volume and count rather than taken as a
 * third input. Taking all three invites a merchant to type figures that
 * contradict each other, and the calculator would then have to choose one
 * silently. Volume and transaction count are both printed on a statement;
 * average order value usually is not.
 *
 * The per-order fee is computed on that average order and multiplied by the
 * count. A processor prices each order separately, so a real statement will
 * differ by rounding on a mixed basket. The alternative, charging the percentage
 * on total volume and adding the fixed fee times the count, is the same figure
 * to within a cent or two and is harder to check by hand.
 */
export function refundCost(input: AnnualRefundInputs): AnnualRefundResult {
  const volumeC = atLeastZero(toCents(input.monthlyVolume));
  const txns = Math.floor(atLeastZero(input.monthlyTransactions));
  const rate = atLeastZero(input.ratePct) / 100;
  const fixedC = atLeastZero(toCents(input.fixedFee));
  const refundFeeC = atLeastZero(toCents(input.policy.refundFee));
  const returnRate = Math.min(100, atLeastZero(input.returnRatePct)) / 100;

  const empty: AnnualRefundResult = {
    averageOrderValue: 0,
    feePerOrder: 0,
    refundedOrdersPerMonth: 0,
    refundedVolumeMonthly: 0,
    retainedFeePerRefund: 0,
    feeOnRefundedMonthly: 0,
    feeOnRefundedAnnual: 0,
    grossFeeMonthly: 0,
    totalFeeMonthly: 0,
    totalFeeAnnual: 0,
    revenueKeptMonthly: 0,
    nominalEffectiveRate: 0,
    trueEffectiveRate: 0,
    rateGapPoints: 0,
    handlingCostMonthly: 0,
    handlingCostAnnual: 0,
    totalRefundCostAnnual: 0,
    feeOnRefundedAnnualIfPercentReturned: 0,
    annualSavingIfPercentReturned: 0,
  };
  if (txns <= 0 || volumeC <= 0) return empty;

  const aovC = roundHalfUp(volumeC / txns);
  const percentPortionC = roundHalfUp(aovC * rate);
  const feePerOrderC = percentPortionC + fixedC;

  // Fractional orders are kept fractional and rounded ONCE, at the money.
  // Rounding the order count first shifts the annual figure by dollars.
  const refundedOrders = txns * returnRate;
  const refundedVolumeC = roundHalfUp(refundedOrders * aovC);

  const percentBackC = input.policy.percentReturned ? percentPortionC : 0;
  const fixedBackC = input.policy.fixedReturned ? fixedC : 0;
  const retainedPerRefundC = feePerOrderC - percentBackC - fixedBackC + refundFeeC;

  const feeOnRefundedMonthlyC = roundHalfUp(refundedOrders * retainedPerRefundC);
  const grossFeeMonthlyC = txns * feePerOrderC;
  const refundFeesMonthlyC = roundHalfUp(refundedOrders * refundFeeC);
  const totalFeeMonthlyC = grossFeeMonthlyC + refundFeesMonthlyC;
  const revenueKeptC = volumeC - refundedVolumeC;

  const handlingPerReturnC = atLeastZero(toCents(input.restockingPerReturn)) + atLeastZero(toCents(input.returnShippingPerReturn));
  const handlingMonthlyC = roundHalfUp(refundedOrders * handlingPerReturnC);

  // The counterfactual: same month, same refunds, on a processor that returns
  // the percentage. Only the percentage, because no US processor verified for
  // this page returns the fixed fee either, and returning both would model a
  // product that does not exist.
  const retainedIfPercentBackC = feePerOrderC - percentPortionC + refundFeeC;
  const feeIfPercentBackMonthlyC = roundHalfUp(refundedOrders * retainedIfPercentBackC);

  const nominal = volumeC > 0 ? (totalFeeMonthlyC / volumeC) * 100 : 0;
  const real = revenueKeptC > 0 ? (totalFeeMonthlyC / revenueKeptC) * 100 : 0;

  return {
    averageOrderValue: aovC / 100,
    feePerOrder: feePerOrderC / 100,
    refundedOrdersPerMonth: refundedOrders,
    refundedVolumeMonthly: refundedVolumeC / 100,
    retainedFeePerRefund: retainedPerRefundC / 100,
    feeOnRefundedMonthly: feeOnRefundedMonthlyC / 100,
    feeOnRefundedAnnual: (feeOnRefundedMonthlyC * 12) / 100,
    grossFeeMonthly: grossFeeMonthlyC / 100,
    totalFeeMonthly: totalFeeMonthlyC / 100,
    totalFeeAnnual: (totalFeeMonthlyC * 12) / 100,
    revenueKeptMonthly: revenueKeptC / 100,
    nominalEffectiveRate: nominal,
    trueEffectiveRate: real,
    rateGapPoints: real - nominal,
    handlingCostMonthly: handlingMonthlyC / 100,
    handlingCostAnnual: (handlingMonthlyC * 12) / 100,
    totalRefundCostAnnual: ((feeOnRefundedMonthlyC + handlingMonthlyC) * 12) / 100,
    feeOnRefundedAnnualIfPercentReturned: (feeIfPercentBackMonthlyC * 12) / 100,
    annualSavingIfPercentReturned: ((feeOnRefundedMonthlyC - feeIfPercentBackMonthlyC) * 12) / 100,
  };
}

/**
 * The same month priced at a ladder of return rates.
 *
 * Everything except the return rate is held fixed, so the reader can see the
 * one relationship the page is about: the fee bill barely moves while the
 * revenue carrying it shrinks. Calls `refundCost` rather than reimplementing the
 * ratio, so the ladder cannot drift away from the headline figure above it.
 */
export function refundRateLadder(
  input: AnnualRefundInputs,
  rates: number[],
): { returnRatePct: number; trueEffectiveRate: number; feeOnRefundedAnnual: number }[] {
  return rates.map((returnRatePct) => {
    const r = refundCost({ ...input, returnRatePct });
    return {
      returnRatePct,
      trueEffectiveRate: r.trueEffectiveRate,
      feeOnRefundedAnnual: r.feeOnRefundedAnnual,
    };
  });
}
