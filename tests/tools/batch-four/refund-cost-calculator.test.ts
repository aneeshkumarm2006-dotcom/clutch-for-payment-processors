import { test } from "node:test";
import assert from "node:assert/strict";
import { refundCost, refundRateLadder, singleRefund } from "../../../lib/calc/refund";
import {
  REFUND_DEFAULTS,
  REFUND_FEE_POLICIES,
  REFUND_RATE_BENCHMARKS,
  REFUND_SENSITIVITY_LADDER,
  getRefundPolicy,
} from "../../../lib/tools-data/refunds";

/**
 * Every expected value below was derived by hand, on paper, from the stated
 * inputs, before the implementation was consulted. The arithmetic is small
 * enough that this is possible, which is exactly why it is worth doing: a test
 * that asserts whatever the function happened to return pins the bug in place.
 *
 * The failure modes being pinned:
 *
 *   1. THE WRONG DENOMINATOR. The headline output is an effective rate. Divide
 *      the fee bill by gross volume and you get 3.23 percent; divide it by the
 *      revenue that survived the refunds and you get 4.01 percent. Both are
 *      plausible, neither throws, and only the second answers the question the
 *      page asks. Both are asserted, separately, so they cannot be swapped.
 *   2. PRORATING A FIXED FEE. A flat per-transaction fee has no natural
 *      proration, so a partial refund must never return a slice of it. Getting
 *      this wrong understates the cost of the exact case the page is about.
 *   3. ROUNDING THE ORDER COUNT BEFORE THE MONEY. A 19.3 percent return rate on
 *      2,000 orders is 386 orders exactly, but on 1,999 it is 385.807. Rounding
 *      that to 386 before multiplying moves the annual figure by dollars.
 *   4. A LADDER THAT DRIFTS FROM THE HEADLINE. The sensitivity rows must be the
 *      same function as the number printed above them.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

const NOTHING_BACK = { percentReturned: false, fixedReturned: false, refundFee: 0 };

// ---------------------------------------------------------------------------
// One refund, full and partial
// ---------------------------------------------------------------------------

test("singleRefund: a full refund on a $90 order at 2.9% + $0.30 leaves the whole $2.91 behind", () => {
  // By hand: 90 x 0.029 = 2.61, plus 0.30 fixed = 2.91. Nothing comes back.
  const r = singleRefund({ orderValue: 90, refundAmount: 90, ratePct: 2.9, fixedFee: 0.3, policy: NOTHING_BACK });
  assert.equal(r.percentPortion, 2.61);
  assert.equal(r.fixedPortion, 0.3);
  assert.equal(r.originalFee, 2.91);
  assert.equal(r.feeRetained, 2.91);
  assert.equal(r.revenueKept, 0);
  assert.equal(r.isPartial, false);
  // 2.91 / 90 = 0.032333...
  close(r.costAsPctOfRefund, 3.2333, 0.0005, "cost as a share of the refunded amount");
});

test("singleRefund: a full refund reports no rate on revenue kept, rather than a flattering zero", () => {
  const r = singleRefund({ orderValue: 90, refundAmount: 90, ratePct: 2.9, fixedFee: 0.3, policy: NOTHING_BACK });
  assert.equal(r.effectiveRateOnKept, null);
});

test("singleRefund: refunding $60 of a $90 order costs 9.70% of the $30 you kept", () => {
  // By hand: fee 2.91 is retained in full, revenue kept is 90 - 60 = 30,
  // 2.91 / 30 = 0.097 exactly.
  const r = singleRefund({ orderValue: 90, refundAmount: 60, ratePct: 2.9, fixedFee: 0.3, policy: NOTHING_BACK });
  assert.equal(r.isPartial, true);
  assert.equal(r.feeRetained, 2.91);
  assert.equal(r.revenueKept, 30);
  close(r.effectiveRateOnKept ?? -1, 9.7, 0.0001, "effective rate on revenue kept");
  // 2.91 / 60 = 0.0485 exactly.
  close(r.costAsPctOfRefund, 4.85, 0.0001, "cost as a share of the refunded amount");
});

test("singleRefund: a policy that returns the percentage prorates it on the amount handed back", () => {
  // By hand: 60 x 0.029 = 1.74 comes back, so 2.91 - 1.74 = 1.17 is retained,
  // which is 1.17 / 30 = 3.90% of the revenue kept.
  const r = singleRefund({
    orderValue: 90,
    refundAmount: 60,
    ratePct: 2.9,
    fixedFee: 0.3,
    policy: { percentReturned: true, fixedReturned: false, refundFee: 0 },
  });
  assert.equal(r.percentReturnedAmount, 1.74);
  assert.equal(r.fixedReturnedAmount, 0);
  assert.equal(r.feeRetained, 1.17);
  close(r.effectiveRateOnKept ?? -1, 3.9, 0.0001, "effective rate on revenue kept");
});

test("singleRefund: a returnable fixed fee comes back on a full refund and never on a partial one", () => {
  const policy = { percentReturned: false, fixedReturned: true, refundFee: 0 };
  const full = singleRefund({ orderValue: 90, refundAmount: 90, ratePct: 2.9, fixedFee: 0.3, policy });
  const partial = singleRefund({ orderValue: 90, refundAmount: 89.99, ratePct: 2.9, fixedFee: 0.3, policy });
  assert.equal(full.fixedReturnedAmount, 0.3);
  assert.equal(full.feeRetained, 2.61);
  assert.equal(partial.fixedReturnedAmount, 0);
  assert.equal(partial.feeRetained, 2.91);
});

test("singleRefund: a refund fee is added to what was already retained", () => {
  // Authorize.net's 10 cent gateway fee on the refund transaction: 2.91 + 0.10.
  const r = singleRefund({
    orderValue: 90,
    refundAmount: 90,
    ratePct: 2.9,
    fixedFee: 0.3,
    policy: { percentReturned: false, fixedReturned: false, refundFee: 0.1 },
  });
  assert.equal(r.refundFeeCharged, 0.1);
  assert.equal(r.feeRetained, 3.01);
});

test("singleRefund: a refund larger than the order is clamped to the order", () => {
  const r = singleRefund({ orderValue: 90, refundAmount: 500, ratePct: 2.9, fixedFee: 0.3, policy: NOTHING_BACK });
  assert.equal(r.refundAmount, 90);
  assert.equal(r.revenueKept, 0);
  assert.equal(r.isPartial, false);
});

// ---------------------------------------------------------------------------
// A month of trading
// ---------------------------------------------------------------------------

const DEFAULT_INPUTS = {
  monthlyVolume: 180000,
  monthlyTransactions: 2000,
  returnRatePct: 19.3,
  ratePct: 2.9,
  fixedFee: 0.3,
  policy: NOTHING_BACK,
  restockingPerReturn: 0,
  returnShippingPerReturn: 0,
};

test("refundCost: the page defaults, every figure worked by hand first", () => {
  // 180,000 / 2,000 = 90.00 average order.
  // Fee per order: 90 x 0.029 = 2.61 + 0.30 = 2.91.
  // Gross fee: 2,000 x 2.91 = 5,820.00 a month.
  // Refunded orders: 2,000 x 0.193 = 386 exactly. Refunded volume 386 x 90 = 34,740.
  // Fee left behind: 386 x 2.91 = 1,123.26 a month, 13,479.12 a year.
  // Revenue kept: 180,000 - 34,740 = 145,260.
  const r = refundCost(DEFAULT_INPUTS);
  assert.equal(r.averageOrderValue, 90);
  assert.equal(r.feePerOrder, 2.91);
  assert.equal(r.refundedOrdersPerMonth, 386);
  assert.equal(r.refundedVolumeMonthly, 34740);
  assert.equal(r.retainedFeePerRefund, 2.91);
  assert.equal(r.feeOnRefundedMonthly, 1123.26);
  assert.equal(r.feeOnRefundedAnnual, 13479.12);
  assert.equal(r.grossFeeMonthly, 5820);
  assert.equal(r.totalFeeMonthly, 5820);
  assert.equal(r.revenueKeptMonthly, 145260);
});

test("refundCost: the nominal and the true effective rate are both returned, and they differ by 0.77 points", () => {
  // Nominal: 5,820 / 180,000 = 3.233333%.
  // True:    5,820 / 145,260 = 4.006609%.
  const r = refundCost(DEFAULT_INPUTS);
  close(r.nominalEffectiveRate, 3.23333, 0.0005, "nominal effective rate");
  close(r.trueEffectiveRate, 4.00661, 0.0005, "true effective rate");
  close(r.rateGapPoints, 0.77328, 0.0005, "gap between the two");
  assert.ok(r.trueEffectiveRate > r.nominalEffectiveRate, "the true rate must be the higher of the two");
});

test("refundCost: the counterfactual where the percentage came back saves $12,089.52 a year", () => {
  // If only the 30 cent fixed fee were retained: 386 x 0.30 = 115.80 a month,
  // 1,389.60 a year. 13,479.12 - 1,389.60 = 12,089.52.
  const r = refundCost(DEFAULT_INPUTS);
  assert.equal(r.feeOnRefundedAnnualIfPercentReturned, 1389.6);
  assert.equal(r.annualSavingIfPercentReturned, 12089.52);
});

test("refundCost: with no refund fee the processor's total take does not move when returns rise", () => {
  // The fee is charged on every order, so the bill is flat and only the revenue
  // carrying it shrinks. If this ever fails, the model has started refunding
  // fees somewhere it should not.
  const none = refundCost({ ...DEFAULT_INPUTS, returnRatePct: 0 });
  const heavy = refundCost({ ...DEFAULT_INPUTS, returnRatePct: 40 });
  assert.equal(none.totalFeeMonthly, heavy.totalFeeMonthly);
  assert.equal(none.totalFeeMonthly, 5820);
  // At a zero return rate the two rates are the same number by definition.
  close(none.trueEffectiveRate, none.nominalEffectiveRate, 1e-9, "rates at a zero return rate");
});

test("refundCost: a 30 percent return rate turns a 2.9% + $0.30 account into 4.62%", () => {
  // Revenue kept: 180,000 x 0.70 = 126,000. 5,820 / 126,000 = 4.619048%.
  const r = refundCost({ ...DEFAULT_INPUTS, returnRatePct: 30 });
  close(r.trueEffectiveRate, 4.61905, 0.0005, "true effective rate at a 30 percent return rate");
});

test("refundCost: a refund fee is charged on top and does move the total", () => {
  // 386 refunds x 0.10 = 38.60 a month on top of the 5,820.00.
  // Retained per refund becomes 2.91 + 0.10 = 3.01, so 386 x 3.01 = 1,161.86.
  const r = refundCost({
    ...DEFAULT_INPUTS,
    policy: { percentReturned: false, fixedReturned: false, refundFee: 0.1 },
  });
  assert.equal(r.retainedFeePerRefund, 3.01);
  assert.equal(r.feeOnRefundedMonthly, 1161.86);
  assert.equal(r.feeOnRefundedAnnual, 13942.32);
  assert.equal(r.totalFeeMonthly, 5858.6);
});

test("refundCost: handling costs are added per returned order and annualised, not to the fee rate", () => {
  // 386 returns x (6.50 + 8.00) = 5,597.00 a month, 67,164.00 a year.
  // Total cost of refunds: 13,479.12 of fees + 67,164.00 of handling.
  const r = refundCost({ ...DEFAULT_INPUTS, restockingPerReturn: 6.5, returnShippingPerReturn: 8 });
  assert.equal(r.handlingCostMonthly, 5597);
  assert.equal(r.handlingCostAnnual, 67164);
  assert.equal(r.totalRefundCostAnnual, 13479.12 + 67164);
  // Handling is not a processing fee and must not enter the effective rate.
  close(r.trueEffectiveRate, 4.00661, 0.0005, "true effective rate is unchanged by handling cost");
});

test("refundCost: one order priced monthly agrees with the same order priced singly", () => {
  const monthly = refundCost({ ...DEFAULT_INPUTS, monthlyVolume: 90, monthlyTransactions: 1, returnRatePct: 100 });
  const one = singleRefund({ orderValue: 90, refundAmount: 90, ratePct: 2.9, fixedFee: 0.3, policy: NOTHING_BACK });
  assert.equal(monthly.retainedFeePerRefund, one.feeRetained);
  assert.equal(monthly.feePerOrder, one.originalFee);
});

test("refundCost: the order count stays fractional until the money is rounded", () => {
  // 1,999 orders at 19.3 percent is 385.807 refunds, not 386.
  // 385.807 x 291 cents = 112,269.837 cents, which rounds to 1,122.70.
  // Rounding the count up first would give 1,123.26, a 56 cent error a month.
  const r = refundCost({ ...DEFAULT_INPUTS, monthlyVolume: 179910, monthlyTransactions: 1999 });
  assert.equal(r.averageOrderValue, 90);
  close(r.refundedOrdersPerMonth, 385.807, 1e-9, "refunded order count");
  assert.equal(r.feeOnRefundedMonthly, 1122.7);
});

test("refundCost: empty or impossible inputs return zeros rather than NaN", () => {
  for (const bad of [
    { ...DEFAULT_INPUTS, monthlyTransactions: 0 },
    { ...DEFAULT_INPUTS, monthlyVolume: 0 },
    { ...DEFAULT_INPUTS, monthlyVolume: Number.NaN },
  ]) {
    const r = refundCost(bad);
    for (const [key, value] of Object.entries(r)) {
      assert.ok(Number.isFinite(value), `${key} came back as ${value}`);
    }
    assert.equal(r.trueEffectiveRate, 0);
  }
});

test("refundCost: a 100 percent return rate keeps no revenue and reports a zero rate rather than Infinity", () => {
  const r = refundCost({ ...DEFAULT_INPUTS, returnRatePct: 100 });
  assert.equal(r.revenueKeptMonthly, 0);
  assert.ok(Number.isFinite(r.trueEffectiveRate));
  assert.equal(r.feeOnRefundedAnnual, 69840); // 2,000 x 2.91 x 12
});

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

test("refundRateLadder: rises monotonically and agrees with refundCost row by row", () => {
  const rows = refundRateLadder(DEFAULT_INPUTS, REFUND_SENSITIVITY_LADDER);
  assert.equal(rows.length, REFUND_SENSITIVITY_LADDER.length);
  const rates = rows.map((r) => r.trueEffectiveRate);
  for (let i = 1; i < rates.length; i += 1) {
    const prev = rates[i - 1] ?? 0;
    const here = rates[i] ?? 0;
    assert.ok(here > prev, `row ${i} did not rise: ${prev} then ${here}`);
  }
  // Hand-checked ends: 5,820 / 180,000 and 5,820 / 126,000.
  close(rates[0] ?? 0, 3.23333, 0.0005, "ladder at a zero return rate");
  close(rates[rates.length - 1] ?? 0, 4.61905, 0.0005, "ladder at a 30 percent return rate");
  for (const row of rows) {
    const direct = refundCost({ ...DEFAULT_INPUTS, returnRatePct: row.returnRatePct });
    assert.equal(row.trueEffectiveRate, direct.trueEffectiveRate);
    assert.equal(row.feeOnRefundedAnnual, direct.feeOnRefundedAnnual);
  }
});

// ---------------------------------------------------------------------------
// The data module: provenance and internal consistency
// ---------------------------------------------------------------------------

test("every refund policy row carries a dated source and a sane fee", () => {
  assert.ok(REFUND_FEE_POLICIES.length >= 6, "expected at least six processors");
  for (const p of REFUND_FEE_POLICIES) {
    assert.ok(p.slug.length > 2 && p.name.length > 2, `${p.slug}: missing identity`);
    assert.ok(p.source.length > 40, `${p.slug}: source is too thin to be a citation`);
    assert.match(p.source, /\d{1,2} \w+ 2026/, `${p.slug}: source carries no read date`);
    assert.ok(p.status === "verified" || p.status === "unverified", `${p.slug}: bad status`);
    assert.ok(p.refundFee >= 0 && p.refundFee <= 5, `${p.slug}: refund fee of ${p.refundFee} is out of range`);
    assert.ok(p.partialTreatment.length > 40, `${p.slug}: partial refund treatment is not explained`);
    assert.ok(p.note.length > 60, `${p.slug}: note is not useful`);
  }
});

test("a verified row quotes its source and an unverified row does not pretend to", () => {
  for (const p of REFUND_FEE_POLICIES) {
    if (p.status === "verified") {
      assert.ok(p.quote.length > 40, `${p.slug}: verified with no quote`);
      // The class is written with escapes on purpose: this repo bans the
      // characters themselves from source, including from a detector for them.
      assert.ok(
        !new RegExp("[\\u2018\\u2019\\u201C\\u201D]").test(p.quote),
        `${p.slug}: quote carries curly quotes`,
      );
    } else {
      assert.equal(p.quote, "", `${p.slug}: unverified rows must not carry a quote`);
    }
  }
  assert.ok(
    REFUND_FEE_POLICIES.some((p) => p.status === "unverified"),
    "the unverified branch is unexercised, so nothing proves it renders",
  );
});

test("the finding the page is built on: no verified US processor returns the fee", () => {
  const verified = REFUND_FEE_POLICIES.filter((p) => p.status === "verified");
  assert.ok(verified.length >= 6, "expected at least six verified processors");
  for (const p of verified) {
    assert.equal(p.percentReturned, false, `${p.slug} is recorded as returning the percentage`);
    assert.equal(p.fixedReturned, false, `${p.slug} is recorded as returning the fixed fee`);
  }
  // And exactly one of them charges to issue the refund.
  const charging = verified.filter((p) => p.refundFee > 0);
  assert.equal(charging.length, 1);
  assert.equal(charging[0]?.slug, "authorize-net");
  assert.equal(charging[0]?.refundFee, 0.1);
});

test("no source, quote, note or label contains a dash character the house style bans", () => {
  const banned = new RegExp("[\\u2013\\u2014\\u2015]");
  for (const p of REFUND_FEE_POLICIES) {
    for (const field of [p.name, p.note, p.quote, p.source, p.partialTreatment]) {
      assert.ok(!banned.test(field), `${p.slug}: banned dash in "${field}"`);
    }
  }
  for (const b of REFUND_RATE_BENCHMARKS) {
    assert.ok(!banned.test(b.label) && !banned.test(b.source), `benchmark ${b.label}: banned dash`);
  }
});

test("the benchmarks are one publisher's own comparable figures, in a plausible range", () => {
  assert.ok(REFUND_RATE_BENCHMARKS.length >= 3);
  for (const b of REFUND_RATE_BENCHMARKS) {
    assert.ok(b.ratePct > 0 && b.ratePct < 60, `${b.label}: ${b.ratePct} percent is out of range`);
    assert.match(b.source, /National Retail Federation/, `${b.label}: benchmark is not attributed`);
    assert.match(b.source, /checked 5 September 2026/, `${b.label}: benchmark has no checked date`);
  }
  const online = REFUND_RATE_BENCHMARKS.find((b) => b.label === "US online sales");
  const all = REFUND_RATE_BENCHMARKS.find((b) => b.label === "All US retail sales");
  assert.ok(online && all && online.ratePct > all.ratePct, "online returns should exceed all-retail returns");
});

test("the widget defaults are internally consistent and point at a real policy row", () => {
  const d = REFUND_DEFAULTS;
  assert.ok(getRefundPolicy(d.processorSlug), "default processor is not in the table");
  assert.equal(d.monthlyVolume / d.monthlyTransactions, 90, "defaults do not produce a round average order");
  assert.equal(d.orderValue, 90, "the single-refund default should match the derived average order");
  assert.equal(d.refundAmount, d.orderValue, "the single-refund default should start as a full refund");
  assert.equal(d.restockingPerReturn, 0, "handling costs must default to a figure nobody invented");
  assert.equal(d.returnShippingPerReturn, 0, "handling costs must default to a figure nobody invented");
  const benchmark = REFUND_RATE_BENCHMARKS.find((b) => b.label === "US online sales");
  assert.equal(d.returnRatePct, benchmark?.ratePct, "the default return rate should be the sourced online figure");
});

test("the sensitivity ladder starts at zero, rises, and spans the published US return rates", () => {
  assert.equal(REFUND_SENSITIVITY_LADDER[0], 0);
  for (let i = 1; i < REFUND_SENSITIVITY_LADDER.length; i += 1) {
    const prev = REFUND_SENSITIVITY_LADDER[i - 1] ?? 0;
    const here = REFUND_SENSITIVITY_LADDER[i] ?? 0;
    assert.ok(here > prev, "ladder is not ascending");
  }
  const top = REFUND_SENSITIVITY_LADDER[REFUND_SENSITIVITY_LADDER.length - 1] ?? 0;
  for (const b of REFUND_RATE_BENCHMARKS) {
    assert.ok(top >= b.ratePct, `the ladder stops below the published ${b.label} rate`);
  }
});
