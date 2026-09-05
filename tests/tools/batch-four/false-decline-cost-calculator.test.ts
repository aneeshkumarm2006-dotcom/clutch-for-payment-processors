import { test } from "node:test";
import assert from "node:assert/strict";
import { approvalPointLadder, falseDeclineCost, retryRecovery } from "../../../lib/calc/false-decline";
import {
  DECLINE_CODE_GROUPS,
  FALSE_DECLINE_BENCHMARKS,
  FALSE_DECLINE_DEFAULTS,
} from "../../../lib/tools-data/false-decline";

/**
 * Every expected value below was worked out on paper from the stated inputs
 * before the implementation was consulted. The arithmetic is small enough that
 * this is possible, which is exactly why it is worth doing: a test that asserts
 * whatever the function happened to return pins the bug in place.
 *
 * The failure modes being pinned:
 *
 *   1. DOUBLE COUNTING THE LOST CUSTOMER. The declined order's gross profit and
 *      the walked-away customer's lifetime profit are two different losses. Add
 *      the order value into the lifetime value and the answer inflates by an
 *      order per lost customer, silently, in the direction that flatters the
 *      page's own argument.
 *   2. OVERLAPPING SHARES. Recovery share and walk-away share describe the same
 *      population. 70 and 60 is not an error a user will notice; left alone it
 *      produces 130 percent of the false declines and a loss bigger than the
 *      revenue that generated it.
 *   3. CREDITING FRAUD RULES WITH REVENUE. A blocked fraudulent order saves the
 *      goods and the dispute fee, never the sale price, because the sale price
 *      was always going to be reversed. Using order value here makes any fraud
 *      rule look profitable.
 *   4. A BREAK-EVEN THAT DOES NOT BREAK EVEN. The returned break-even share must
 *      actually zero the net position when fed back into the model, or it is
 *      decoration.
 *   5. A LADDER THAT DRIFTS FROM THE HEADLINE. Approval rate is linear in
 *      orders, so two points must be exactly twice one point.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

// The published defaults, which are also the page's worked example. Every
// expected value in the first block was derived from these by hand.
const D = FALSE_DECLINE_DEFAULTS;

const baseInputs = {
  monthlyAttempts: D.monthlyAttempts,
  approvalRatePct: D.approvalRatePct,
  averageOrderValue: D.averageOrderValue,
  grossMarginPct: D.grossMarginPct,
  falseDeclineSharePct: D.falseDeclineSharePct,
  retryRecoverySharePct: D.retryRecoverySharePct,
  walkAwaySharePct: D.walkAwaySharePct,
  lifetimeGrossProfit: D.lifetimeGrossProfit,
  fraudDeclineSharePct: D.fraudDeclineSharePct,
  chargebackFee: D.chargebackFee,
};

// ---------------------------------------------------------------------------
// The default merchant, computed by hand
// ---------------------------------------------------------------------------

test("falseDeclineCost: 12,000 attempts at an 87% approval rate is 1,560 declines and 312 false ones", () => {
  // By hand: 12,000 x 0.87 = 10,440 approved, so 1,560 declined.
  // 1,560 x 0.20 = 312 of those were good customers.
  const r = falseDeclineCost(baseInputs);
  assert.equal(r.approvedOrders, 10440);
  assert.equal(r.declinesPerMonth, 1560);
  close(r.falseDeclinesPerMonth, 312, 1e-9, "false declines a month");
  // 312 x 0.35 = 109.2 recovered, leaving 202.8 orders gone.
  close(r.recoveredOrders, 109.2, 1e-9, "recovered orders");
  close(r.lostOrders, 202.8, 1e-9, "lost orders");
  // 312 x 0.25 = 78 customers walked out.
  close(r.walkAwayCustomers, 78, 1e-9, "customers lost for good");
  assert.equal(r.walkAwayClamped, false);
});

test("falseDeclineCost: the default merchant loses $19,468.80 of revenue and $8,176.90 of gross profit a month", () => {
  // By hand: 202.8 lost orders x $96.00 = $19,468.80 of revenue a month,
  // and x 12 = $233,625.60 a year.
  // Gross profit per order is 96 x 0.42 = $40.32 exactly, so
  // 202.8 x $40.32 = $8,176.896, rounded to $8,176.90.
  const r = falseDeclineCost(baseInputs);
  assert.equal(r.lostRevenueMonthly, 19468.8);
  assert.equal(r.lostRevenueAnnual, 233625.6);
  assert.equal(r.lostGrossProfitMonthly, 8176.9);
  assert.equal(r.lostGrossProfitAnnual, 98122.8);
});

test("falseDeclineCost: the 78 customers who walked out take $14,040.00 a month of future profit with them", () => {
  // By hand: 78 x $180.00 of future gross profit = $14,040.00 a month.
  // Total damage is the order profit PLUS the future profit, never the order
  // value plus the future profit: $8,176.90 + $14,040.00 = $22,216.90.
  const r = falseDeclineCost(baseInputs);
  assert.equal(r.lostLifetimeValueMonthly, 14040);
  assert.equal(r.lostLifetimeValueAnnual, 168480);
  assert.equal(r.totalDamageMonthly, 22216.9);
  assert.equal(r.totalDamageAnnual, 266602.8);
  // And per falsely declined order: 0.65 x 40.32 + 0.25 x 180 = 26.208 + 45.
  close(r.damagePerFalseDecline, 71.208, 0.0005, "damage per false decline");
});

test("falseDeclineCost: blocked fraud saves goods and the dispute fee, $70.68 an order, not the $96 sale", () => {
  // By hand: cost of goods is 96 - 40.32 = $55.68, plus the $15.00 dispute fee
  // = $70.68 saved per blocked fraudulent order. 1,560 x 0.12 = 187.2 blocked,
  // so 187.2 x $70.68 = $13,231.296, rounded to $13,231.30 a month.
  const r = falseDeclineCost(baseInputs);
  close(r.blockedFraudOrders, 187.2, 1e-9, "blocked fraud orders");
  assert.equal(r.savedPerBlockedFraudOrder, 70.68);
  assert.equal(r.fraudPreventedMonthly, 13231.3);
  assert.equal(r.fraudPreventedAnnual, 158775.6);
});

test("falseDeclineCost: the net position is negative $8,985.60 a month, so the rules cost more than they save", () => {
  // By hand: $13,231.30 prevented less $22,216.90 of damage = -$8,985.60,
  // which is -$107,827.20 a year.
  const r = falseDeclineCost(baseInputs);
  assert.equal(r.netPositionMonthly, -8985.6);
  assert.equal(r.netPositionAnnual, -107827.2);
});

test("falseDeclineCost: one point of approval rate is 120 orders, $11,520 a month and $58,060.80 of annual gross profit", () => {
  // By hand: 12,000 / 100 = 120 orders. 120 x $96 = $11,520 a month and
  // $138,240 a year. 120 x $40.32 = $4,838.40 a month of gross profit,
  // $58,060.80 a year.
  const r = falseDeclineCost(baseInputs);
  assert.equal(r.ordersPerApprovalPoint, 120);
  assert.equal(r.revenuePerApprovalPointMonthly, 11520);
  assert.equal(r.revenuePerApprovalPointAnnual, 138240);
  assert.equal(r.grossProfitPerApprovalPointMonthly, 4838.4);
  assert.equal(r.grossProfitPerApprovalPointAnnual, 58060.8);
});

test("falseDeclineCost: 312 false declines is 2.6 points of approval rate, and the loss is worth 4.59 points", () => {
  // By hand: 312 / 12,000 = 2.6 percentage points of headroom, so a perfect
  // ruleset would run at 87 + 2.6 = 89.6 percent.
  // The damage restated in points: 22,216.90 / 4,838.40 = 4.5917 points.
  const r = falseDeclineCost(baseInputs);
  close(r.headroomPoints, 2.6, 1e-9, "approval rate headroom");
  close(r.potentialApprovalRatePct, 89.6, 1e-9, "approval rate with no false declines");
  close(r.damageInApprovalPoints, 4.5917, 0.0005, "damage expressed in approval points");
});

// ---------------------------------------------------------------------------
// The clamp
// ---------------------------------------------------------------------------

test("falseDeclineCost: recovery 70% and walk-away 60% cannot both be true, so walk-away is clamped to 30%", () => {
  // Both shares describe the same 312 false declines. 70 + 60 = 130 percent of
  // a population, which would price 218.4 customers walking out of a group of
  // 312 that already had 218.4 of them recovered.
  const r = falseDeclineCost({ ...baseInputs, retryRecoverySharePct: 70, walkAwaySharePct: 60 });
  close(r.effectiveWalkAwaySharePct, 30, 1e-9, "clamped walk-away share");
  assert.equal(r.walkAwayClamped, true);
  // 312 x 0.30 = 93.6 customers, and 312 x 0.30 = 93.6 orders lost too,
  // because 70 percent recovered leaves exactly 30 percent.
  close(r.walkAwayCustomers, 93.6, 1e-9, "customers lost after the clamp");
  close(r.lostOrders, 93.6, 1e-9, "orders lost after the clamp");
});

test("falseDeclineCost: if every falsely declined customer retries successfully, nothing is lost", () => {
  // 100 percent recovery leaves zero orders lost and clamps walk-away to zero,
  // so the damage must be exactly zero and the whole fraud saving is net.
  const r = falseDeclineCost({ ...baseInputs, retryRecoverySharePct: 100, walkAwaySharePct: 40 });
  assert.equal(r.lostOrders, 0);
  assert.equal(r.walkAwayCustomers, 0);
  assert.equal(r.totalDamageMonthly, 0);
  assert.equal(r.netPositionMonthly, r.fraudPreventedMonthly);
  assert.equal(r.breakEvenFalseSharePct, null);
});

// ---------------------------------------------------------------------------
// The fraud side
// ---------------------------------------------------------------------------

test("falseDeclineCost: at a 100% margin a blocked fraudulent order saves only the dispute fee", () => {
  // A digital product has no cost of goods, so blocking a fraudulent order
  // saves the $15.00 dispute fee and nothing else. 187.2 x $15.00 = $2,808.00.
  const r = falseDeclineCost({ ...baseInputs, grossMarginPct: 100 });
  assert.equal(r.savedPerBlockedFraudOrder, 15);
  assert.equal(r.fraudPreventedMonthly, 2808);
});

test("falseDeclineCost: the break-even false-decline share actually zeroes the net position", () => {
  // Derived independently: the fraud saving is $13,231.296 a month against
  // damage of 1,560 x share x $71.208. Setting them equal gives
  // 13,231.296 / (1,560 x 71.208) = 11.9110 percent.
  const r = falseDeclineCost(baseInputs);
  assert.ok(r.breakEvenFalseSharePct !== null);
  close(r.breakEvenFalseSharePct as number, 11.911, 0.002, "break-even false-decline share");
  // Feed it back in: the two sides must now agree to within a cent of rounding.
  const atBreakEven = falseDeclineCost({
    ...baseInputs,
    falseDeclineSharePct: r.breakEvenFalseSharePct as number,
  });
  close(atBreakEven.netPositionMonthly, 0, 0.02, "net position at the break-even share");
});

// ---------------------------------------------------------------------------
// Retry recovery
// ---------------------------------------------------------------------------

test("retryRecovery: 60% of 1,560 declines is 936 retryable, and 624 the rules forbid you to touch", () => {
  // By hand: 1,560 x 0.60 = 936 soft, leaving 624 hard declines. A retry
  // programme that reattempts those 624 is a rules breach, not a slow win.
  const r = retryRecovery({
    monthlyAttempts: D.monthlyAttempts,
    approvalRatePct: D.approvalRatePct,
    averageOrderValue: D.averageOrderValue,
    grossMarginPct: D.grossMarginPct,
    softDeclineSharePct: D.softDeclineSharePct,
    retrySuccessRatePct: D.retrySuccessRatePct,
  });
  close(r.retryableDeclines, 936, 1e-9, "retryable declines");
  close(r.hardDeclines, 624, 1e-9, "hard declines");
  // 936 x 0.30 = 280.8 recovered orders, x $96 = $26,956.80 a month.
  close(r.recoveredOrders, 280.8, 1e-9, "recovered orders");
  assert.equal(r.recoveredRevenueMonthly, 26956.8);
  assert.equal(r.recoveredRevenueAnnual, 323481.6);
  // 280.8 x $40.32 = $11,321.856, rounded to $11,321.86.
  assert.equal(r.recoveredGrossProfitMonthly, 11321.86);
  // 280.8 / 12,000 = 2.34 points, taking 87.00 to 89.34 percent.
  close(r.approvalPointsGained, 2.34, 1e-9, "approval points gained");
  close(r.newApprovalRatePct, 89.34, 1e-9, "approval rate after retries");
});

test("retryRecovery: a zero success rate recovers nothing and moves the approval rate not at all", () => {
  const r = retryRecovery({
    monthlyAttempts: D.monthlyAttempts,
    approvalRatePct: D.approvalRatePct,
    averageOrderValue: D.averageOrderValue,
    grossMarginPct: D.grossMarginPct,
    softDeclineSharePct: D.softDeclineSharePct,
    retrySuccessRatePct: 0,
  });
  assert.equal(r.recoveredOrders, 0);
  assert.equal(r.recoveredRevenueMonthly, 0);
  close(r.newApprovalRatePct, D.approvalRatePct, 1e-9, "approval rate unchanged");
});

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

test("approvalPointLadder: approval rate is linear in orders, so two points is exactly twice one", () => {
  // By hand at 12,000 attempts and $96: one point is 120 orders and $11,520 a
  // month; a quarter point is 30 orders and $2,880; two points is 240 and
  // $23,040. Annual gross profit at 42 percent: 120 x 40.32 x 12 = $58,060.80.
  const rows = approvalPointLadder(
    { monthlyAttempts: 12000, averageOrderValue: 96, grossMarginPct: 42 },
    [0.25, 1, 2],
  );
  assert.equal(rows[0]!.extraOrders, 30);
  assert.equal(rows[0]!.extraRevenueMonthly, 2880);
  assert.equal(rows[1]!.extraOrders, 120);
  assert.equal(rows[1]!.extraRevenueMonthly, 11520);
  assert.equal(rows[1]!.extraRevenueAnnual, 138240);
  assert.equal(rows[1]!.extraGrossProfitAnnual, 58060.8);
  assert.equal(rows[2]!.extraRevenueMonthly, rows[1]!.extraRevenueMonthly * 2);
  assert.equal(rows[2]!.extraGrossProfitAnnual, rows[1]!.extraGrossProfitAnnual * 2);
});

test("approvalPointLadder: the rate table published on the page reproduces exactly", () => {
  // These four rows are printed on the page as sourced arithmetic, so they have
  // to be reproducible here. All at $96 average order value and a 42 percent
  // margin, one percentage point of approval rate.
  const cases: [number, number, number, number][] = [
    // attempts, extra orders, extra revenue a year, extra gross profit a year
    [2000, 20, 23040, 9676.8],
    [5000, 50, 57600, 24192],
    [12000, 120, 138240, 58060.8],
    [40000, 400, 460800, 193536],
    [150000, 1500, 1728000, 725760],
  ].map((c) => c as [number, number, number, number]);

  for (const [attempts, orders, revenue, profit] of cases) {
    const row = approvalPointLadder(
      { monthlyAttempts: attempts, averageOrderValue: 96, grossMarginPct: 42 },
      [1],
    )[0]!;
    assert.equal(row.extraOrders, orders, `orders at ${attempts} attempts`);
    assert.equal(row.extraRevenueAnnual, revenue, `annual revenue at ${attempts} attempts`);
    assert.equal(row.extraGrossProfitAnnual, profit, `annual gross profit at ${attempts} attempts`);
  }
});

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

test("DECLINE_CODE_GROUPS: every group carries a source, a share basis and a retry rule", () => {
  assert.ok(DECLINE_CODE_GROUPS.length >= 5);
  for (const g of DECLINE_CODE_GROUPS) {
    assert.ok(g.source.length > 40, `${g.id} needs a real source string`);
    assert.ok(/checked \d/.test(g.source), `${g.id} source must carry a checked date`);
    assert.ok(g.shareBasis.length > 20, `${g.id} must document where its share came from`);
    assert.ok(g.retryRule.length > 20, `${g.id} must state what the rules permit`);
    assert.ok(["never", "fix-first", "timed"].includes(g.retry));
    assert.ok(g.typicalSharePct > 0 && g.typicalSharePct < 100, `${g.id} share out of range`);
  }
});

test("DECLINE_CODE_GROUPS: the default shares sum to 100 and the timed groups match the default soft share", () => {
  const total = DECLINE_CODE_GROUPS.reduce((s, g) => s + g.typicalSharePct, 0);
  assert.equal(total, 100);
  // The widget's default soft-decline share must not contradict the table
  // printed beside it: it is the sum of the groups a merchant may reattempt
  // without the customer doing anything.
  const timed = DECLINE_CODE_GROUPS.filter((g) => g.retry === "timed").reduce(
    (s, g) => s + g.typicalSharePct,
    0,
  );
  assert.equal(timed, FALSE_DECLINE_DEFAULTS.softDeclineSharePct);
});

test("FALSE_DECLINE_BENCHMARKS: every published figure names a document and a checked date", () => {
  assert.ok(FALSE_DECLINE_BENCHMARKS.length >= 6);
  for (const b of FALSE_DECLINE_BENCHMARKS) {
    assert.ok(b.source.length > 40, `${b.metric} needs a real source string`);
    assert.ok(/checked \d/.test(b.source), `${b.metric} source must carry a checked date`);
    assert.ok(b.detail.length > 60, `${b.metric} needs the caveat spelled out`);
  }
});

test("FALSE_DECLINE_DEFAULTS: the shares are internally consistent and inside their ranges", () => {
  assert.ok(D.approvalRatePct > 0 && D.approvalRatePct < 100);
  // Recovery and walk-away describe the same population and must not overlap in
  // the shipped defaults, or the page renders its own clamp warning on load.
  assert.ok(D.retryRecoverySharePct + D.walkAwaySharePct <= 100);
  assert.ok(D.falseDeclineSharePct + D.fraudDeclineSharePct <= 100);
  assert.ok(D.grossMarginPct > 0 && D.grossMarginPct < 100);
  assert.ok(D.softDeclineSharePct > 0 && D.softDeclineSharePct < 100);
});
