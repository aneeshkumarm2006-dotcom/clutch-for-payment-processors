import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualChargebackCost,
  monitoringEscalationCost,
  perChargebackCost,
  representmentEconomics,
  type ChargebackCostInput,
} from "../../../lib/calc/chargeback-cost";
import {
  CHARGEBACK_COST_DEFAULTS,
  CHARGEBACK_MONITORING_ESCALATION,
  REPRESENTMENT_WIN_RATES,
} from "../../../lib/tools-data/chargeback-cost";

/**
 * `/tools/chargeback-cost-calculator` publishes numbers a merchant takes into a
 * budget meeting, and every failure mode in the model is SILENT.
 *
 * Three in particular, all of which return a confident and plausible figure when
 * they are wrong:
 *
 *   1. The two win rates have to be COMPOUNDED. 44.6 percent at the first cycle
 *      with 19 percent of those wins reversed at the second is 36.126 percent,
 *      not 44.6 and not 25.6. All three numbers look reasonable on a page.
 *   2. A refundable dispute countered fee belongs on both sides of the expected
 *      value. Put it only on the cost side and the page tells merchants to give
 *      up on cases worth fighting.
 *   3. The break-even sales figure has to divide by GROSS MARGIN, not revenue.
 *      Dividing by revenue understates the answer by roughly a factor of two on
 *      any normal retail margin, and the wrong answer is the smaller, more
 *      comfortable one.
 *
 * Every expected value below is derived INDEPENDENTLY of the implementation:
 * either written out here as literal arithmetic, or from a closed form solved
 * separately. Nothing asserts "whatever the code returned".
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** The widget's opening state, as a model input. */
const BASE: ChargebackCostInput = {
  averageOrderValue: CHARGEBACK_COST_DEFAULTS.averageOrderValue,
  costOfGoods: CHARGEBACK_COST_DEFAULTS.costOfGoods,
  fulfillment: CHARGEBACK_COST_DEFAULTS.fulfillment,
  processingRatePct: CHARGEBACK_COST_DEFAULTS.processingRatePct,
  processingFixed: CHARGEBACK_COST_DEFAULTS.processingFixed,
  chargebackFee: CHARGEBACK_COST_DEFAULTS.chargebackFee,
  counterFee: CHARGEBACK_COST_DEFAULTS.counterFee,
  counterFeeRefundedOnWin: CHARGEBACK_COST_DEFAULTS.counterFeeRefundedOnWin,
  staffMinutes: CHARGEBACK_COST_DEFAULTS.staffMinutes,
  fightMinutes: CHARGEBACK_COST_DEFAULTS.fightMinutes,
  staffHourlyRate: CHARGEBACK_COST_DEFAULTS.staffHourlyRate,
  monthlyChargebacks: CHARGEBACK_COST_DEFAULTS.monthlyChargebacks,
  monthlyTransactions: CHARGEBACK_COST_DEFAULTS.monthlyTransactions,
  fightSharePct: CHARGEBACK_COST_DEFAULTS.fightSharePct,
  firstCycleWinRatePct: CHARGEBACK_COST_DEFAULTS.firstCycleWinRatePct,
  secondCycleLossPct: CHARGEBACK_COST_DEFAULTS.secondCycleLossPct,
};

// ---------------------------------------------------------------------------
// 1. One chargeback, hand-computed
// ---------------------------------------------------------------------------

test("perChargebackCost: the default scenario, every line derived by hand", () => {
  const r = perChargebackCost(BASE);

  // Processing already paid on the sale: 2.9% of $120.00 is $3.48, plus $0.30.
  assert.equal(r.processingFeeRetained, 3.78);
  // 45 minutes at $46.60 an hour is 46.60 x 0.75 = $34.95.
  assert.equal(r.staffCost, 34.95);
  assert.equal(r.goodsAndFulfillment, 57);
  assert.equal(r.chargebackFee, 15);

  // 48.00 + 9.00 + 3.78 + 15.00 + 34.95
  assert.equal(r.cashOut, 110.73);
  // ...plus the $120.00 sale that was reversed.
  assert.equal(r.totalExposure, 230.73);
  close(r.multipleOfOrder, 230.73 / 120, 1e-9, "multiple of order value");

  // 120.00 - 48.00 - 9.00 - 3.78
  assert.equal(r.grossMarginPerOrder, 59.22);
  close(r.grossMarginPct, (59.22 / 120) * 100, 1e-9, "gross margin percent");
  close(r.salesToBreakEven, 110.73 / 59.22, 1e-9, "orders needed to replace one chargeback");
});

test("perChargebackCost: money is integer cents, so a fee that lands on a half cent rounds like a processor's", () => {
  // 2.9% of $19.99 is $0.579710, which rounds half up to 58 cents, plus $0.30.
  const r = perChargebackCost({ ...BASE, averageOrderValue: 19.99 });
  assert.equal(r.processingFeeRetained, 0.88);

  // And a sweep: no output may ever carry a sub-cent tail on a money line.
  for (const aov of [1, 7.77, 19.99, 33.33, 120, 999.99, 4999.95]) {
    const s = perChargebackCost({ ...BASE, averageOrderValue: aov });
    for (const [label, v] of Object.entries({
      cashOut: s.cashOut,
      totalExposure: s.totalExposure,
      processingFeeRetained: s.processingFeeRetained,
      grossMarginPerOrder: s.grossMarginPerOrder,
    })) {
      assert.ok(
        Math.abs(Math.round(v * 100) - v * 100) < 1e-6,
        `${label} at AOV ${aov} is not a whole number of cents: ${v}`,
      );
    }
  }
});

test("perChargebackCost: a merchant selling below variable cost gets zero, not a negative order count", () => {
  const r = perChargebackCost({ ...BASE, costOfGoods: 200 });
  assert.ok(r.grossMarginPerOrder < 0, "the scenario must actually be loss-making");
  assert.equal(r.salesToBreakEven, 0);
});

// ---------------------------------------------------------------------------
// 2. Representment: the compounding that everyone gets wrong
// ---------------------------------------------------------------------------

test("representmentEconomics: the two win rates COMPOUND, they do not subtract", () => {
  const r = representmentEconomics(BASE);

  // 0.446 x (1 - 0.19) = 0.36126
  close(r.finalWinRatePct, 36.126, 1e-9, "final win rate");

  // The two ways of getting it wrong, both of which look plausible on a page.
  assert.notEqual(Number(r.finalWinRatePct.toFixed(3)), 44.6);
  assert.notEqual(Number(r.finalWinRatePct.toFixed(3)), 25.6);
  assert.ok(r.finalWinRatePct > 25.6 && r.finalWinRatePct < 44.6, "and it sits between them");
});

test("representmentEconomics: expected value of fighting the default case, derived by hand", () => {
  const r = representmentEconomics(BASE);

  // 60 minutes at $46.60 plus a $15.00 countered fee.
  assert.equal(r.costToFightOne, 61.6);

  // A win returns the $120.00 order and, on this processor, the $15.00 countered
  // fee. 0.36126 x 135 = 48.7701.
  close(r.expectedRecoveryPerFight, 0.36126 * 135, 1e-9, "expected recovery per case fought");
  close(r.expectedValuePerFight, 0.36126 * 135 - 61.6, 1e-9, "expected value per case fought");

  // At a $120 order this merchant loses money fighting the average dispute.
  assert.ok(r.expectedValuePerFight < 0, "fighting a $120 dispute at these costs is value-destroying");
});

test("representmentEconomics: break-even order value matches the closed form solved separately", () => {
  const r = representmentEconomics(BASE);

  // p x (A + refundedFee) = labor + fee  =>  A = (labor + fee) / p - refundedFee
  const p = 0.446 * (1 - 0.19);
  const expected = (46.6 + 15) / p - 15;
  close(r.breakEvenOrderValue, expected, 1e-6, "break-even order value");
  close(r.breakEvenOrderValue, 155.5146, 0.001, "break-even order value, to the cent");

  // And the closed form is the real crossover: an order a cent above it has a
  // positive expected value, an order a cent below it does not.
  const above = representmentEconomics({ ...BASE, averageOrderValue: expected + 0.5 });
  const below = representmentEconomics({ ...BASE, averageOrderValue: expected - 0.5 });
  assert.ok(above.expectedValuePerFight > 0, "just above break-even must pay");
  assert.ok(below.expectedValuePerFight < 0, "just below break-even must not");
});

test("representmentEconomics: a refundable countered fee shifts break-even by exactly the fee", () => {
  // The probability weight cancels in the algebra:
  //   refundable:     A = (L + f) / p - f
  //   not refundable: A = (L + f) / p
  // so the gap is f, whatever p is. Asserted at two different win rates.
  for (const first of [44.6, 70]) {
    const refundable = representmentEconomics({ ...BASE, firstCycleWinRatePct: first });
    const not = representmentEconomics({
      ...BASE,
      firstCycleWinRatePct: first,
      counterFeeRefundedOnWin: false,
    });
    close(
      not.breakEvenOrderValue - refundable.breakEvenOrderValue,
      15,
      1e-6,
      `refund gap at a ${first}% first-cycle rate`,
    );
  }
});

test("representmentEconomics: a zero win rate means no order value makes fighting pay", () => {
  const r = representmentEconomics({ ...BASE, firstCycleWinRatePct: 0 });
  assert.equal(r.breakEvenOrderValue, Number.POSITIVE_INFINITY);
  assert.equal(r.disputesWonPerYear, 0);
});

// ---------------------------------------------------------------------------
// 3. The year, and the margin denominator
// ---------------------------------------------------------------------------

test("annualChargebackCost: the default year, built up independently line by line", () => {
  const a = annualChargebackCost(BASE);

  const perYear = 60 * 12; // 720
  assert.equal(a.chargebacksPerYear, perYear);
  close(a.disputeRatePct, (60 / 5000) * 100, 1e-9, "dispute rate");

  const baseCashOut = 110.73 * perYear; // 79,725.60
  close(a.baseCashOut, baseCashOut, 1e-6, "base cash out");

  const fought = perYear * 0.6; // 432
  const cost = 61.6 * fought; // 26,611.20
  const recovered = 0.446 * 0.81 * 135 * fought;
  close(a.representmentCost, cost, 1e-6, "cost of representment");
  close(a.representmentRecovered, recovered, 1e-6, "recovered by representment");
  close(a.netAnnualCost, baseCashOut + cost - recovered, 1e-6, "net annual cost");

  // 5,000 orders a month at $120 for twelve months.
  assert.equal(a.annualRevenue, 7_200_000);
  close(a.pctOfRevenue, ((baseCashOut + cost - recovered) / 7_200_000) * 100, 1e-9, "share of revenue");
});

test("annualChargebackCost: break-even sales divide by MARGIN, and revenue is the comfortable wrong answer", () => {
  const a = annualChargebackCost(BASE);
  const net = a.netAnnualCost;

  // Gross margin per order is $59.22, computed by hand above.
  close(a.extraSalesNeeded, net / 59.22, 1e-6, "extra orders needed at margin");
  close(a.extraRevenueNeeded, (net / 59.22) * 120, 1e-6, "extra revenue needed");

  // The mistake: dividing by the $120 order value instead of the $59.22 margin.
  // It understates the answer by the margin ratio, which is 2.03x here.
  const wrong = net / 120;
  assert.ok(a.extraSalesNeeded > wrong * 2, "the margin answer must be more than twice the revenue answer");
  close(a.extraSalesNeeded / wrong, 120 / 59.22, 1e-6, "the ratio between the two is AOV over margin");
});

test("annualChargebackCost: fighting nothing versus fighting everything, at an order value where fighting pays", () => {
  // Above the break-even order value, more representment must lower the net cost.
  const rich = { ...BASE, averageOrderValue: 400 };
  const none = annualChargebackCost({ ...rich, fightSharePct: 0 });
  const all = annualChargebackCost({ ...rich, fightSharePct: 100 });
  assert.ok(all.netAnnualCost < none.netAnnualCost, "fighting must help above break-even");

  // Below it, more representment must raise the net cost. This is the direction
  // check that catches a sign error in the expected-value term.
  const thin = { ...BASE, averageOrderValue: 60 };
  const thinNone = annualChargebackCost({ ...thin, fightSharePct: 0 });
  const thinAll = annualChargebackCost({ ...thin, fightSharePct: 100 });
  assert.ok(thinAll.netAnnualCost > thinNone.netAnnualCost, "fighting must hurt below break-even");
});

// ---------------------------------------------------------------------------
// 4. Monitoring program escalation
// ---------------------------------------------------------------------------

const program = (id: string) => {
  const p = CHARGEBACK_MONITORING_ESCALATION.find((x) => x.id === id);
  assert.ok(p, `program ${id} must exist`);
  return p;
};

test("monitoringEscalationCost: the Mastercard ECM ladder over twelve months, summed by hand", () => {
  const r = monitoringEscalationCost(program("mastercard-ecm"), 60, 60, 12);

  // 0 + 1,000 + 1,000 + (5,000 x 3) + (25,000 x 5) + 50,000
  const expected = 0 + 1000 + 1000 + 5000 * 3 + 25000 * 5 + 50000;
  assert.equal(expected, 192_000);
  assert.equal(r.twelveMonthTotal, expected);

  // Month 1 is free, which is the trap: a merchant who reads "USD 1,000" off a
  // program guide and budgets one payment is out by a factor of nearly 200.
  assert.equal(r.months[0]!.total, 0);
  assert.equal(r.firstChargedMonth, 2);
  assert.equal(r.months[1]!.total, 1000);
  assert.equal(r.months[6]!.total, 25000);
  assert.equal(r.months[11]!.total, 50000);
});

test("monitoringEscalationCost: HECM is higher at every step and carries issuer recovery above 300 chargebacks", () => {
  const at60 = monitoringEscalationCost(program("mastercard-hecm"), 60, 60, 12);
  // 0 + 1,000 + 2,000 + (10,000 x 3) + (50,000 x 5) + 100,000
  assert.equal(at60.twelveMonthTotal, 0 + 1000 + 2000 + 10000 * 3 + 50000 * 5 + 100000);
  assert.equal(at60.twelveMonthTotal, 383_000);
  // Below 300 chargebacks a month there is no issuer recovery at all.
  assert.equal(at60.months.reduce((s, m) => s + m.issuerRecovery, 0), 0);

  // At 400 a month it starts in month 4: 100 chargebacks over the line at $5,
  // for nine of the twelve months.
  const at400 = monitoringEscalationCost(program("mastercard-hecm"), 400, 400, 12);
  const ir = at400.months.reduce((s, m) => s + m.issuerRecovery, 0);
  assert.equal(ir, (400 - 300) * 5 * 9);
  assert.equal(ir, 4500);
  assert.equal(at400.twelveMonthTotal, 383_000 + 4500);
  assert.equal(at400.months[2]!.issuerRecovery, 0, "nothing before month 4");
  assert.equal(at400.months[3]!.issuerRecovery, 500, "month 4 is the first");

  // And HECM must dominate ECM month for month.
  const ecm = monitoringEscalationCost(program("mastercard-ecm"), 400, 400, 12);
  for (let i = 0; i < 12; i += 1) {
    assert.ok(at400.months[i]!.total >= ecm.months[i]!.total, `HECM must not be cheaper in month ${i + 1}`);
  }
});

test("monitoringEscalationCost: the Visa program charges per event from month one, with no ladder", () => {
  const r = monitoringEscalationCost(program("visa-vamp-excessive"), 60, 90, 12);
  // $8 x 90 events x 12 months. Note the event count is fraud reports PLUS
  // disputes, so it is deliberately larger than the chargeback count.
  assert.equal(r.twelveMonthTotal, 8 * 90 * 12);
  assert.equal(r.twelveMonthTotal, 8640);
  assert.equal(r.firstChargedMonth, 1, "there is no free first month here");
  assert.equal(r.months[0]!.total, r.months[11]!.total, "flat, not a ladder");
});

// ---------------------------------------------------------------------------
// 5. Data module integrity
// ---------------------------------------------------------------------------

test("REPRESENTMENT_WIN_RATES: exactly one sourced rate, and everything carries a source", () => {
  assert.ok(REPRESENTMENT_WIN_RATES.length >= 5, "there must be enough categories to be useful");

  const sourced = REPRESENTMENT_WIN_RATES.filter((r) => r.sourced);
  assert.equal(sourced.length, 1, "only the all-disputes average is a published figure");
  assert.equal(sourced[0]!.id, "all");
  assert.equal(sourced[0]!.winRatePct, 44.6);

  const ids = new Set<string>();
  for (const r of REPRESENTMENT_WIN_RATES) {
    assert.ok(!ids.has(r.id), `duplicate category id ${r.id}`);
    ids.add(r.id);
    assert.ok(r.winRatePct > 0 && r.winRatePct <= 100, `${r.id} win rate out of range`);
    assert.ok(r.source.length > 40, `${r.id} needs a real source string`);
    assert.ok(r.mechanism.length > 80, `${r.id} needs a mechanism explanation`);
    if (!r.sourced) {
      assert.equal(
        r.winRatePct,
        sourced[0]!.winRatePct,
        `${r.id} must repeat the average rather than assert a category figure`,
      );
      assert.ok(/No win rate is published/.test(r.source), `${r.id} must say the figure is not published`);
    }
  }
});

test("CHARGEBACK_MONITORING_ESCALATION: ladders are contiguous, non-decreasing, and every row is attributed", () => {
  assert.ok(CHARGEBACK_MONITORING_ESCALATION.length >= 3);

  for (const p of CHARGEBACK_MONITORING_ESCALATION) {
    assert.ok(p.source.length > 60, `${p.id} needs a real source string`);
    assert.equal(p.published, false, "no network publishes these, and the flag must say so");

    if (p.ladder.length === 0) {
      assert.ok(p.perEventUsd !== null, `${p.id} has no ladder so it must charge per event`);
      continue;
    }

    assert.equal(p.ladder[0]!.fromMonth, 1, `${p.id} ladder must start at month 1`);
    assert.equal(p.ladder[p.ladder.length - 1]!.toMonth, null, `${p.id} ladder must be open-ended`);
    for (let i = 1; i < p.ladder.length; i += 1) {
      const prev = p.ladder[i - 1]!;
      const cur = p.ladder[i]!;
      assert.equal(prev.toMonth !== null ? prev.toMonth + 1 : -1, cur.fromMonth, `${p.id} has a gap at band ${i}`);
      assert.ok(cur.monthlyUsd >= prev.monthlyUsd, `${p.id} ladder must not step down at band ${i}`);
    }
  }
});

test("CHARGEBACK_COST_DEFAULTS: the sourced defaults are the figures the page cites", () => {
  // Chargebacks911 2026 Chargeback Field Report, published 30 June 2026.
  assert.equal(CHARGEBACK_COST_DEFAULTS.firstCycleWinRatePct, 44.6);
  assert.equal(CHARGEBACK_COST_DEFAULTS.secondCycleLossPct, 19);
  // BLS Employer Costs for Employee Compensation, March 2026, released 12 June 2026.
  assert.equal(CHARGEBACK_COST_DEFAULTS.staffHourlyRate, 46.6);
  // And the defaults must produce the dispute rate the page copy quotes.
  close(
    (CHARGEBACK_COST_DEFAULTS.monthlyChargebacks / CHARGEBACK_COST_DEFAULTS.monthlyTransactions) * 100,
    1.2,
    1e-9,
    "default dispute rate",
  );
});
