/**
 * What false declines cost, and what a point of approval rate is worth.
 *
 * Client safe: no `@/models`, no I/O, no clock. Takes plain numbers and returns
 * plain numbers, so the widget, the worked example on the page and the tests are
 * all reading the same arithmetic.
 *
 * ─── The failure modes this module exists to prevent ────────────────────────
 *
 * 1. DOUBLE COUNTING THE LOST CUSTOMER. A falsely declined shopper can do three
 *    things: retry and succeed with you, give up on this order but come back,
 *    or leave for good. The first costs nothing, the second costs one order of
 *    gross profit, the third costs one order of gross profit AND the future
 *    profit that customer would have delivered. Adding the full order value to
 *    a lifetime value that already contains it inflates the answer by an order
 *    value per lost customer. `lifetimeGrossProfit` is therefore defined as
 *    FUTURE profit BEYOND the declined order, and the declined order is counted
 *    exactly once, in `lostGrossProfitMonthly`.
 *
 * 2. SHARES THAT OVERLAP. Recovery share and walk-away share are both expressed
 *    as a share of false declines, and a user can type 60 and 60. Left alone
 *    that produces 120 percent of the population and a loss larger than the
 *    revenue that generated it. The walk-away share is CLAMPED to what is left
 *    after recovery, and the clamped value is returned so the widget can say it
 *    happened rather than silently disagreeing with the inputs on screen.
 *
 * 3. REVENUE WHERE PROFIT BELONGS. A declined order does not cost you its sale
 *    price. It costs you the margin on it, because the goods were never shipped.
 *    Lost revenue is the bigger, more quotable number and it is returned, but
 *    the NET POSITION against fraud is computed on gross profit, because the
 *    fraud side is also measured in real losses rather than in top line.
 *
 * 4. ANNUALISING BY COMPOUNDING. These are flows, not growth rates. Twelve
 *    months of declined orders is twelve times one month's declined orders. The
 *    model holds volume flat and says so; there is nothing here to compound.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * Money is computed in integer cents. A merchant reading this page is usually
 * holding a gateway report, and binary floating point produces one cent errors
 * at exactly the moment somebody is checking. Order counts stay FRACTIONAL and
 * are rounded once, at the money: 1,560 declines at a 20 percent false share is
 * 312 exactly, but at 1,559 it is 311.8, and rounding the count first moves the
 * annual figure by dollars.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round half UP, the direction a processor rounds. Explicit about intent. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const atLeastZero = (n: number): number => Math.max(0, safe(n));

/** Clamp a user-typed percentage into 0 to 100 before it is divided by 100. */
const asShare = (pct: number): number => Math.min(100, atLeastZero(pct)) / 100;

// ---------------------------------------------------------------------------
// The main model
// ---------------------------------------------------------------------------

export interface FalseDeclineInputs {
  /** Authorization attempts in a month, approved and declined. */
  monthlyAttempts: number;
  /** Approved authorizations divided by attempts, in percent. */
  approvalRatePct: number;
  averageOrderValue: number;
  /** Gross margin on a sale, in percent. What a lost order really costs. */
  grossMarginPct: number;
  /** Share of DECLINES that were good customers wrongly refused, in percent. */
  falseDeclineSharePct: number;
  /** Share of FALSE DECLINES who retry and succeed with you anyway, in percent. */
  retryRecoverySharePct: number;
  /** Share of FALSE DECLINES who leave and do not come back, in percent. */
  walkAwaySharePct: number;
  /** Future gross profit from a retained customer, BEYOND the declined order. */
  lifetimeGrossProfit: number;
  /** Share of DECLINES that were genuine fraud your rules stopped, in percent. */
  fraudDeclineSharePct: number;
  /** What your processor charges per dispute. Avoided on a blocked fraud order. */
  chargebackFee: number;
}

export interface FalseDeclineResult {
  approvedOrders: number;
  declinesPerMonth: number;
  falseDeclinesPerMonth: number;
  /** Walk-away share after clamping, and whether the clamp fired. */
  effectiveWalkAwaySharePct: number;
  walkAwayClamped: boolean;
  recoveredOrders: number;
  lostOrders: number;
  walkAwayCustomers: number;

  lostRevenueMonthly: number;
  lostRevenueAnnual: number;
  lostGrossProfitMonthly: number;
  lostGrossProfitAnnual: number;
  lostLifetimeValueMonthly: number;
  lostLifetimeValueAnnual: number;
  /** Gross profit lost on the orders plus the future profit that walked out. */
  totalDamageMonthly: number;
  totalDamageAnnual: number;
  /** Damage attributable to one falsely declined order. */
  damagePerFalseDecline: number;

  /** Blocked fraud orders, and what each one saved you. */
  blockedFraudOrders: number;
  savedPerBlockedFraudOrder: number;
  fraudPreventedMonthly: number;
  fraudPreventedAnnual: number;

  /** Fraud prevented less the damage. Negative means the rules cost you money. */
  netPositionMonthly: number;
  netPositionAnnual: number;
  /**
   * The share of declines that would have to be false for the fraud prevented
   * and the damage done to be exactly equal. Below it the rules pay for
   * themselves; above it they do not. `null` when there is no damage per false
   * decline to divide by, which is the case where every falsely declined
   * customer retries successfully and none leaves.
   */
  breakEvenFalseSharePct: number | null;

  /** One percentage point of approval rate, in orders and in money. */
  ordersPerApprovalPoint: number;
  revenuePerApprovalPointMonthly: number;
  revenuePerApprovalPointAnnual: number;
  grossProfitPerApprovalPointMonthly: number;
  grossProfitPerApprovalPointAnnual: number;
  /** Points of approval rate sitting in the false declines. */
  headroomPoints: number;
  /** The whole loss restated as approval rate points, at your margin. */
  damageInApprovalPoints: number;
  /** Approval rate you would run at if no good customer were ever refused. */
  potentialApprovalRatePct: number;
}

/**
 * Price a month of false declines, then compare it against the fraud the rules
 * prevented.
 *
 * WHY THE NET POSITION IS COMPUTED ON GROSS PROFIT AND NOT REVENUE. A blocked
 * fraudulent order never had revenue in it: the money would have been reversed.
 * What it saved you is the goods you did not ship plus the dispute fee you were
 * not charged. Comparing that against LOST REVENUE would be comparing a real
 * loss with a top line, and would make almost any fraud rule look catastrophic.
 * The comparison here is loss against loss.
 *
 * WHY A BLOCKED FRAUD ORDER SAVES COST OF GOODS AND NOT THE ORDER VALUE. On a
 * fraudulent card sale that charges back you lose the goods, the shipping and
 * the dispute fee, and you never keep the sale price. Modelling the saving as
 * the full order value would credit the fraud rules with revenue that was never
 * yours. Cost of goods is derived from the margin the user typed, so a merchant
 * with a 90 percent margin correctly sees that blocking a fraudulent digital
 * order saves them very little in goods and mostly saves the dispute fee.
 */
export function falseDeclineCost(input: FalseDeclineInputs): FalseDeclineResult {
  const attempts = atLeastZero(input.monthlyAttempts);
  const approvalShare = asShare(input.approvalRatePct);
  const aovC = atLeastZero(toCents(input.averageOrderValue));
  const margin = asShare(input.grossMarginPct);
  const falseShare = asShare(input.falseDeclineSharePct);
  const recoveryShare = asShare(input.retryRecoverySharePct);
  const ltvC = atLeastZero(toCents(input.lifetimeGrossProfit));
  const fraudShare = asShare(input.fraudDeclineSharePct);
  const cbFeeC = atLeastZero(toCents(input.chargebackFee));

  // Walk-away is a share of the SAME population as recovery, so the two cannot
  // sum past 100. Clamping rather than erroring keeps the page usable while a
  // merchant is still typing, and the clamp is reported so the widget can say
  // it happened.
  const requestedWalk = asShare(input.walkAwaySharePct);
  const walkShare = Math.min(requestedWalk, 1 - recoveryShare);
  const walkAwayClamped = walkShare < requestedWalk - 1e-12;

  const approvedOrders = attempts * approvalShare;
  const declines = attempts - approvedOrders;
  const falseDeclines = declines * falseShare;
  const recoveredOrders = falseDeclines * recoveryShare;
  const lostOrders = falseDeclines - recoveredOrders;
  const walkAwayCustomers = falseDeclines * walkShare;

  // Per-order money is rounded to the cent FIRST, then multiplied by a
  // fractional order count and rounded once more. A processor prices each order
  // separately, so this is the order the real bill is built in.
  const grossProfitPerOrderC = roundHalfUp(aovC * margin);
  const cogsPerOrderC = aovC - grossProfitPerOrderC;

  const lostRevenueC = roundHalfUp(lostOrders * aovC);
  const lostGrossProfitC = roundHalfUp(lostOrders * grossProfitPerOrderC);
  const lostLtvC = roundHalfUp(walkAwayCustomers * ltvC);
  const damageC = lostGrossProfitC + lostLtvC;

  // Damage traceable to one falsely declined order. Held as an exact
  // per-decline figure rather than dividing the rounded monthly total, so the
  // break-even solve below does not inherit a rounding error.
  const damagePerFalseC = (1 - recoveryShare) * grossProfitPerOrderC + walkShare * ltvC;

  const blockedFraudOrders = declines * fraudShare;
  const savedPerBlockedC = cogsPerOrderC + cbFeeC;
  const fraudPreventedC = roundHalfUp(blockedFraudOrders * savedPerBlockedC);

  const netC = fraudPreventedC - damageC;

  // The false-decline share at which the two sides are equal. Damage is linear
  // in that share and the fraud side does not depend on it, so this is a
  // division rather than a solver. `null` where the denominator is zero, which
  // means no false decline costs anything and there is no share that balances.
  const breakEvenDenominator = declines * damagePerFalseC;
  const breakEvenFalseSharePct =
    breakEvenDenominator > 0 ? (fraudPreventedC / breakEvenDenominator) * 100 : null;

  const ordersPerPoint = attempts / 100;
  const revenuePerPointC = roundHalfUp(ordersPerPoint * aovC);
  const gpPerPointC = roundHalfUp(ordersPerPoint * grossProfitPerOrderC);

  return {
    approvedOrders,
    declinesPerMonth: declines,
    falseDeclinesPerMonth: falseDeclines,
    effectiveWalkAwaySharePct: walkShare * 100,
    walkAwayClamped,
    recoveredOrders,
    lostOrders,
    walkAwayCustomers,

    lostRevenueMonthly: lostRevenueC / 100,
    lostRevenueAnnual: (lostRevenueC * 12) / 100,
    lostGrossProfitMonthly: lostGrossProfitC / 100,
    lostGrossProfitAnnual: (lostGrossProfitC * 12) / 100,
    lostLifetimeValueMonthly: lostLtvC / 100,
    lostLifetimeValueAnnual: (lostLtvC * 12) / 100,
    totalDamageMonthly: damageC / 100,
    totalDamageAnnual: (damageC * 12) / 100,
    damagePerFalseDecline: damagePerFalseC / 100,

    blockedFraudOrders,
    savedPerBlockedFraudOrder: savedPerBlockedC / 100,
    fraudPreventedMonthly: fraudPreventedC / 100,
    fraudPreventedAnnual: (fraudPreventedC * 12) / 100,

    netPositionMonthly: netC / 100,
    netPositionAnnual: (netC * 12) / 100,
    breakEvenFalseSharePct,

    ordersPerApprovalPoint: ordersPerPoint,
    revenuePerApprovalPointMonthly: revenuePerPointC / 100,
    revenuePerApprovalPointAnnual: (revenuePerPointC * 12) / 100,
    grossProfitPerApprovalPointMonthly: gpPerPointC / 100,
    grossProfitPerApprovalPointAnnual: (gpPerPointC * 12) / 100,
    headroomPoints: attempts > 0 ? (falseDeclines / attempts) * 100 : 0,
    damageInApprovalPoints: gpPerPointC > 0 ? damageC / gpPerPointC : 0,
    potentialApprovalRatePct:
      attempts > 0 ? ((approvedOrders + falseDeclines) / attempts) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Retry recovery
// ---------------------------------------------------------------------------

export interface RetryRecoveryInputs {
  monthlyAttempts: number;
  approvalRatePct: number;
  averageOrderValue: number;
  grossMarginPct: number;
  /** Share of declines that are soft, meaning the rules permit a reattempt. */
  softDeclineSharePct: number;
  /** Share of those reattempts that end in an approval. */
  retrySuccessRatePct: number;
}

export interface RetryRecoveryResult {
  declinesPerMonth: number;
  retryableDeclines: number;
  /** Declines the rules forbid you to reattempt at all. */
  hardDeclines: number;
  recoveredOrders: number;
  recoveredRevenueMonthly: number;
  recoveredRevenueAnnual: number;
  recoveredGrossProfitMonthly: number;
  recoveredGrossProfitAnnual: number;
  /** What a successful retry programme adds to the approval rate, in points. */
  approvalPointsGained: number;
  newApprovalRatePct: number;
}

/**
 * Price a retry programme.
 *
 * Deliberately a SEPARATE question from `falseDeclineCost`, and the two answers
 * OVERLAP: some of the orders recovered here are the same falsely declined
 * customers counted there. They must never be added together, and the page says
 * so. This function exists because the retry decision is made by a different
 * person, on a different budget, from the fraud rules decision.
 *
 * The hard decline count is returned rather than discarded because it is the
 * number that stops a retry programme becoming a rules breach: those attempts
 * are not slow to recover, they are forbidden.
 */
export function retryRecovery(input: RetryRecoveryInputs): RetryRecoveryResult {
  const attempts = atLeastZero(input.monthlyAttempts);
  const approvalShare = asShare(input.approvalRatePct);
  const aovC = atLeastZero(toCents(input.averageOrderValue));
  const margin = asShare(input.grossMarginPct);
  const softShare = asShare(input.softDeclineSharePct);
  const successShare = asShare(input.retrySuccessRatePct);

  const approved = attempts * approvalShare;
  const declines = attempts - approved;
  const retryable = declines * softShare;
  const recovered = retryable * successShare;

  const grossProfitPerOrderC = roundHalfUp(aovC * margin);
  const revenueC = roundHalfUp(recovered * aovC);
  const gpC = roundHalfUp(recovered * grossProfitPerOrderC);

  return {
    declinesPerMonth: declines,
    retryableDeclines: retryable,
    hardDeclines: declines - retryable,
    recoveredOrders: recovered,
    recoveredRevenueMonthly: revenueC / 100,
    recoveredRevenueAnnual: (revenueC * 12) / 100,
    recoveredGrossProfitMonthly: gpC / 100,
    recoveredGrossProfitAnnual: (gpC * 12) / 100,
    approvalPointsGained: attempts > 0 ? (recovered / attempts) * 100 : 0,
    newApprovalRatePct: attempts > 0 ? ((approved + recovered) / attempts) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Approval rate ladder
// ---------------------------------------------------------------------------

export interface ApprovalPointRow {
  points: number;
  extraOrders: number;
  extraRevenueMonthly: number;
  extraRevenueAnnual: number;
  extraGrossProfitAnnual: number;
}

/**
 * The same merchant at a ladder of approval rate improvements.
 *
 * Everything except the uplift is held fixed, so the reader sees the one
 * relationship the page is about: approval rate is linear in orders, so a
 * quarter of a point is a real number and not a rounding error. Computed off
 * the same per-order cents as `falseDeclineCost`, so the ladder cannot drift
 * away from the headline figures printed above it.
 */
export function approvalPointLadder(
  input: Pick<FalseDeclineInputs, "monthlyAttempts" | "averageOrderValue" | "grossMarginPct">,
  points: number[],
): ApprovalPointRow[] {
  const attempts = atLeastZero(input.monthlyAttempts);
  const aovC = atLeastZero(toCents(input.averageOrderValue));
  const margin = asShare(input.grossMarginPct);
  const grossProfitPerOrderC = roundHalfUp(aovC * margin);

  return points.map((p) => {
    const extraOrders = attempts * (atLeastZero(p) / 100);
    const revenueC = roundHalfUp(extraOrders * aovC);
    const gpC = roundHalfUp(extraOrders * grossProfitPerOrderC);
    return {
      points: p,
      extraOrders,
      extraRevenueMonthly: revenueC / 100,
      extraRevenueAnnual: (revenueC * 12) / 100,
      extraGrossProfitAnnual: (gpC * 12) / 100,
    };
  });
}
