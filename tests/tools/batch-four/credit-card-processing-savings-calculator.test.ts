import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSavings, type SavingsInput } from "../../../lib/calc/savings";
import {
  PASS_THROUGH_BAND,
  PUBLISHED_MARKUP_BENCHMARKS,
  QUOTED_RATE_ROWS,
  SAVINGS_DEFAULTS,
  SAVINGS_LEVERS,
  SAVINGS_LEVER_IDS,
  SURCHARGE_NETWORK_CAP_PCT,
} from "../../../lib/tools-data/savings";

/**
 * The Processing Savings Calculator publishes a dollar figure a merchant will
 * take into a repricing conversation, and every failure mode in the model is
 * SILENT. Six overlapping levers added up against the original statement do not
 * throw, they return a bigger and entirely plausible number that nobody can
 * collect. A surcharge ceiling taken from the target markup rather than from the
 * merchant's own cost of acceptance is likewise a confident wrong answer.
 *
 * Every expected value below was worked out by hand, from the inputs, before the
 * implementation was consulted. Where a figure comes off a rate sheet, the two
 * quoted rows it is the difference between are asserted as well, so a future
 * edit cannot move a delta without moving the rows it claims to be derived from.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** The page defaults, as the widget assembles them. */
const defaults = (over: Partial<SavingsInput> = {}): SavingsInput => ({
  monthlyVolume: SAVINGS_DEFAULTS.monthlyVolume,
  monthlyTransactions: SAVINGS_DEFAULTS.monthlyTransactions,
  monthlyFees: SAVINGS_DEFAULTS.monthlyFees,
  monthlyFixedFees: SAVINGS_DEFAULTS.monthlyFixedFees,
  passThroughPct: SAVINGS_DEFAULTS.passThroughPct,
  achVolume: SAVINGS_DEFAULTS.achVolume,
  achPayments: SAVINGS_DEFAULTS.achPayments,
  achRatePct: SAVINGS_DEFAULTS.achRatePct,
  achFixed: 0,
  achCap: SAVINGS_DEFAULTS.achCap,
  commercialSharePct: SAVINGS_DEFAULTS.commercialSharePct,
  enhancedDataBps: SAVINGS_DEFAULTS.enhancedDataBps,
  downgradeSharePct: SAVINGS_DEFAULTS.downgradeSharePct,
  downgradeBps: SAVINGS_DEFAULTS.downgradeBps,
  removableFixedFees: SAVINGS_DEFAULTS.removableFixedFees,
  targetMarkupPct: SAVINGS_DEFAULTS.targetMarkupPct,
  targetMarkupPerItem: SAVINGS_DEFAULTS.targetMarkupPerItem,
  surchargeSharePct: SAVINGS_DEFAULTS.surchargeSharePct,
  surchargeRatePct: SAVINGS_DEFAULTS.surchargeRatePct,
  surchargeCapPct: SURCHARGE_NETWORK_CAP_PCT,
  ...over,
});

const lever = (r: ReturnType<typeof computeSavings>, id: string) => {
  const found = r.levers.find((l) => l.id === id);
  assert.ok(found, `lever ${id} is missing from the result`);
  return found;
};

// ---------------------------------------------------------------------------
// 1. The split. Two divisions, done by hand.
// ---------------------------------------------------------------------------

test("splits a statement into pass through and markup: 3780 / 120000 is 3.15%, and 125 bps of it is markup", () => {
  // By hand: 3780 / 120000 = 0.0315 = 3.15%.
  //          1.90% of 120000 = 2280.
  //          3780 - 2280 = 1500, and 1500 / 120000 = 0.0125 = 125 basis points.
  const r = computeSavings(defaults());
  close(r.effectiveRate, 3.15, 1e-9, "effective rate");
  assert.equal(r.passThrough, 2280);
  assert.equal(r.markup, 1500);
  close(r.markupRate, 1.25, 1e-9, "markup rate");
  close(r.markupBps, 125, 1e-9, "markup in basis points");
});

// ---------------------------------------------------------------------------
// 2 and 3. The ACH cap, in both directions. Getting this wrong is the classic
//          silent bug: apply the rate to the month and cap once, and 24 separate
//          invoices are priced as one payment.
// ---------------------------------------------------------------------------

test("ACH: 24 invoices of $1,250 all hit the $5.00 cap, so the month costs $120 rather than $240", () => {
  // By hand: 30000 / 24 = 1250 per invoice.
  //          0.8% of 1250 = 10.00, which is above the 5.00 cap, so 5.00 each.
  //          5.00 x 24 = 120.00.
  //          Card side: variable fees are 3780 - 180 = 3600 on 120000, a 3.00%
  //          variable rate, so 3.00% of 30000 = 900.00.
  //          900.00 - 120.00 = 780.00 a month, 9360.00 a year.
  const r = computeSavings(defaults());
  const ach = lever(r, "ach");
  assert.equal(ach.monthly, 780);
  assert.equal(ach.annual, 9360);
});

test("ACH: the cap does not bind on small payments, and is applied per payment not per month", () => {
  // By hand: 100 payments of 400.00. 0.8% of 400 = 3.20, below the 5.00 cap.
  //          3.20 x 100 = 320.00.
  //          Card side: 3000 of variable fees on 100000 is a 3.00% rate, so
  //          3.00% of 40000 = 1200.00.
  //          1200.00 - 320.00 = 880.00 a month.
  // If the cap were applied to the month instead of the payment, the ACH cost
  // would be 5.00 and the saving 1195.00.
  const r = computeSavings(
    defaults({
      monthlyVolume: 100000,
      monthlyTransactions: 1000,
      monthlyFees: 3000,
      monthlyFixedFees: 0,
      achVolume: 40000,
      achPayments: 100,
      commercialSharePct: 0,
      downgradeSharePct: 0,
      removableFixedFees: 0,
    }),
  );
  assert.equal(lever(r, "ach").monthly, 880);
});

// ---------------------------------------------------------------------------
// 4. The overlap cap between commercial volume and downgraded volume.
// ---------------------------------------------------------------------------

test("downgraded volume is capped at the non-commercial share, so one basis point gap is never sold twice", () => {
  // By hand: 100000 of card volume, no ACH. 80% commercial is 80000, leaving
  //          20000 that is not commercial. The merchant claims 50% downgraded,
  //          which would be 50000, but only 20000 of the volume is eligible.
  //          20000 at 111 basis points = 20000 x 0.0111 = 222.00.
  // Without the cap this returns 50000 x 0.0111 = 555.00.
  const r = computeSavings(
    defaults({
      monthlyVolume: 100000,
      monthlyTransactions: 1000,
      monthlyFees: 3000,
      monthlyFixedFees: 0,
      achVolume: 0,
      achPayments: 0,
      commercialSharePct: 80,
      downgradeSharePct: 50,
      removableFixedFees: 0,
    }),
  );
  assert.equal(lever(r, "downgrades").monthly, 222);
  assert.equal(lever(r, "downgrades").basis, 20000);
});

// ---------------------------------------------------------------------------
// 5. Interchange savings must not leak into the repricing lever.
// ---------------------------------------------------------------------------

test("repricing the markup is worth $409.80 a month, computed off the residual card volume", () => {
  // By hand: after 30000 moves to ACH, 90000 of card volume remains across
  //          900 - 24 = 876 transactions.
  //          Variable fees left: 3600 - 900 = 2700.
  //          Pass through on the residual: 1.90% of 90000 = 1710.
  //          Markup left: 2700 - 1710 = 990.00.
  //          Target: 0.45% of 90000 = 405.00, plus 0.20 x 876 = 175.20, so
  //          580.20.
  //          990.00 - 580.20 = 409.80.
  const r = computeSavings(defaults());
  assert.equal(lever(r, "reprice").monthly, 409.8);
  close(lever(r, "reprice").annual, 4917.6, 1e-9, "annual repricing saving");
});

test("cutting interchange does not change the markup, so enhanced data and downgrade repair cannot be counted twice", () => {
  // Enhanced data and downgrade repair both reduce interchange, which is pass
  // through. They take the same dollars out of the fees and out of the pass
  // through estimate, so the difference between the two, the markup, does not
  // move. If the implementation subtracted them from the fees but not from the
  // pass through, the repricing lever would grow by exactly their sum.
  const base = computeSavings(defaults());
  const doubled = computeSavings(defaults({ enhancedDataBps: 150, downgradeBps: 222 }));

  assert.equal(lever(base, "reprice").monthly, lever(doubled, "reprice").monthly);
  // And the interchange levers themselves did double, so the inputs really did
  // take effect and the assertion above is not vacuous.
  assert.equal(lever(doubled, "enhanced-data").monthly, lever(base, "enhanced-data").monthly * 2);
  assert.equal(lever(doubled, "downgrades").monthly, lever(base, "downgrades").monthly * 2);
});

// ---------------------------------------------------------------------------
// 6. The surcharge ceiling.
// ---------------------------------------------------------------------------

test("a surcharge recovers the merchant's own cost of acceptance, not the 3 percent the merchant asked for", () => {
  // By hand: 100000 of volume, 1000 transactions, 2400 of fees, no fixed fees.
  //          Pass through 1.90% = 1900, so the markup is 500.
  //          Target is 0.50% of 100000 = 500 plus 0.25 x 1000 = 250, so 750.
  //          The markup is already below the target, so repricing returns 0 and
  //          the residual cost of acceptance stays at 1900 + 500 = 2400, which
  //          is 2.40% of volume.
  //          Visa's cap is the LOWER of the requested rate, 3 percent, and the
  //          merchant discount rate. That is 2.40%.
  //          50% of 100000 is 50000 of surchargeable credit volume, so
  //          50000 x 0.0240 = 1200.00 a month.
  // Taking the requested 3 percent instead returns 1500.00.
  const r = computeSavings(
    defaults({
      monthlyVolume: 100000,
      monthlyTransactions: 1000,
      monthlyFees: 2400,
      monthlyFixedFees: 0,
      passThroughPct: 1.9,
      achVolume: 0,
      achPayments: 0,
      commercialSharePct: 0,
      downgradeSharePct: 0,
      removableFixedFees: 0,
      targetMarkupPct: 0.5,
      targetMarkupPerItem: 0.25,
      surchargeSharePct: 50,
      surchargeRatePct: 3,
    }),
  );
  assert.equal(lever(r, "reprice").monthly, 0);
  assert.equal(lever(r, "surcharge").monthly, 1200);
});

// ---------------------------------------------------------------------------
// 7. Do nothing has to be reachable, or the page is a sales tool.
// ---------------------------------------------------------------------------

test("a merchant already at the published target recovers nothing and is told to do nothing", () => {
  // By hand: 50000 of volume, 500 transactions, 1275 of fees, an effective rate
  //          of 2.55%. Pass through 1.90% = 950, so the markup is 325.
  //          Target 0.50% of 50000 = 250 plus 0.25 x 500 = 125, so 375.
  //          325 is below 375, so there is nothing to reprice. Nothing else is
  //          switched on, so the total is zero.
  const r = computeSavings(
    defaults({
      monthlyVolume: 50000,
      monthlyTransactions: 500,
      monthlyFees: 1275,
      monthlyFixedFees: 0,
      achVolume: 0,
      achPayments: 0,
      commercialSharePct: 0,
      downgradeSharePct: 0,
      removableFixedFees: 0,
      targetMarkupPct: 0.5,
      targetMarkupPerItem: 0.25,
    }),
  );
  close(r.effectiveRate, 2.55, 1e-9, "effective rate");
  assert.equal(r.totalMonthly, 0);
  assert.equal(r.totalAnnual, 0);
  assert.equal(r.doNothing, true);
  assert.equal(r.newMonthlyCost, 1275);
});

// ---------------------------------------------------------------------------
// 8. The whole default scenario, which is also the page's worked example.
// ---------------------------------------------------------------------------

test("the default scenario reproduces the worked example to the cent", () => {
  // By hand, adding the six levers computed above:
  //   ACH             780.00
  //   Enhanced data   135.00   (20% of 90000 is 18000, at 75 bps)
  //   Downgrades       79.92   (8% of 90000 is 7200, at 111 bps)
  //   Junk fees       100.00
  //   Repricing       409.80
  //   Surcharging       0.00   (off by default)
  //                 ---------
  //                 1504.72 a month, 18056.64 a year.
  //   3780.00 - 1504.72 = 2275.28 a month.
  //   2275.28 / 120000 = 1.8960666...%
  const r = computeSavings(defaults());
  assert.equal(lever(r, "enhanced-data").monthly, 135);
  assert.equal(lever(r, "downgrades").monthly, 79.92);
  assert.equal(lever(r, "junk-fees").monthly, 100);
  assert.equal(lever(r, "surcharge").monthly, 0);
  assert.equal(r.totalMonthly, 1504.72);
  assert.equal(r.totalAnnual, 18056.64);
  assert.equal(r.newMonthlyCost, 2275.28);
  close(r.newEffectiveRate, 1.8960666666, 1e-6, "effective rate after every fix");
  close(r.improvementBps, 125.3933333, 1e-5, "basis points recovered");
  assert.equal(r.doNothing, false);
});

// ---------------------------------------------------------------------------
// 9. Properties that must hold whatever a user types.
// ---------------------------------------------------------------------------

test("the identified saving can never exceed the bill, and the new cost is never negative", () => {
  // Absurd inputs on purpose: every lever turned up past the point of sense.
  const r = computeSavings(
    defaults({
      monthlyFees: 1200,
      monthlyFixedFees: 1200,
      achVolume: 120000,
      achPayments: 900,
      commercialSharePct: 100,
      enhancedDataBps: 500,
      downgradeSharePct: 100,
      downgradeBps: 500,
      removableFixedFees: 99999,
      targetMarkupPct: 0,
      targetMarkupPerItem: 0,
      surchargeSharePct: 100,
      surchargeRatePct: 99,
    }),
  );
  assert.ok(r.totalMonthly <= 1200, `saving ${r.totalMonthly} exceeded the 1200 bill`);
  assert.ok(r.newMonthlyCost >= 0, `new cost ${r.newMonthlyCost} went negative`);
  for (const l of r.levers) {
    assert.ok(l.monthly >= 0, `lever ${l.id} returned a negative saving`);
    close(l.annual, l.monthly * 12, 1e-6, `lever ${l.id} annualization`);
  }
});

test("zero volume returns zeroes rather than NaN or Infinity", () => {
  const r = computeSavings(defaults({ monthlyVolume: 0, monthlyTransactions: 0, monthlyFees: 0 }));
  for (const value of [r.effectiveRate, r.markupBps, r.totalAnnual, r.newEffectiveRate, r.improvementBps]) {
    assert.ok(Number.isFinite(value), `expected a finite number, got ${value}`);
  }
  assert.equal(r.totalAnnual, 0);
});

// ---------------------------------------------------------------------------
// 10. The data module. Every published claim on the page hangs off these rows.
// ---------------------------------------------------------------------------

test("every lever carries a source, a catch and a saving range in a declared unit", () => {
  assert.equal(SAVINGS_LEVERS.length, SAVINGS_LEVER_IDS.length);
  for (const l of SAVINGS_LEVERS) {
    assert.ok(SAVINGS_LEVER_IDS.includes(l.id), `${l.id} is not in the ordered id list`);
    assert.ok(l.source.length > 20, `${l.id} has no usable source`);
    assert.ok(l.catch.length > 20, `${l.id} has no catch, which means nobody thought about it`);
    assert.ok(["bps", "dollars"].includes(l.saving.unit), `${l.id} has an undeclared saving unit`);
    assert.ok(l.saving.high >= l.saving.low, `${l.id} has an inverted saving range`);
  }
  // The ordered list is the order the model applies them, and the model's
  // correctness depends on ACH being first and surcharging being last.
  assert.equal(SAVINGS_LEVER_IDS[0], "ach");
  assert.equal(SAVINGS_LEVER_IDS[SAVINGS_LEVER_IDS.length - 1], "surcharge");
});

test("the quoted rate sheet rows reproduce the deltas the page publishes", () => {
  // Each row names two programs and a difference. Recompute the difference from
  // the percentages written into the quoted strings, so a future edit cannot
  // change a rate without changing the delta beside it.
  const firstPct = (s: string): number => {
    const m = s.match(/(-?\d+(?:\.\d+)?)%/);
    assert.ok(m && m[1] !== undefined, `no percentage found in: ${s}`);
    return Number.parseFloat(m[1]);
  };
  for (const row of QUOTED_RATE_ROWS) {
    if (!/%/.test(row.to)) continue; // The regulated debit row has no cheaper program.
    close(firstPct(row.from) - firstPct(row.to), row.deltaPct, 1e-9, `delta for: ${row.from}`);
  }
  // And the two the page leans on hardest, spelled out.
  const l3 = QUOTED_RATE_ROWS.find((r) => r.to.includes("Commercial Product 3"));
  assert.ok(l3);
  assert.equal(l3.deltaPct, 0.95); // 2.70 minus 1.75
  const l2Trap = QUOTED_RATE_ROWS.find((r) => r.to.includes("Business Product 3"));
  assert.ok(l2Trap);
  assert.equal(l2Trap.deltaPct, -0.5); // 1.90 minus 2.40. Level 3 costs MORE here.
});

test("the pass through band brackets its own midpoint and the markup benchmarks form a descending ladder", () => {
  assert.ok(PASS_THROUGH_BAND.low < PASS_THROUGH_BAND.mid);
  assert.ok(PASS_THROUGH_BAND.mid < PASS_THROUGH_BAND.high);
  // The default the widget uses must be the midpoint, not a fourth number.
  assert.equal(SAVINGS_DEFAULTS.passThroughPct, PASS_THROUGH_BAND.mid);

  // Published markup falls as volume rises, and the bands tile without a gap.
  for (let i = 1; i < PUBLISHED_MARKUP_BENCHMARKS.length; i += 1) {
    const prev = PUBLISHED_MARKUP_BENCHMARKS[i - 1];
    const cur = PUBLISHED_MARKUP_BENCHMARKS[i];
    assert.ok(prev && cur);
    assert.equal(prev.maxVolume, cur.minVolume);
    assert.ok(cur.markupPct <= prev.markupPct, "markup should not rise with volume");
  }
  const last = PUBLISHED_MARKUP_BENCHMARKS[PUBLISHED_MARKUP_BENCHMARKS.length - 1];
  assert.ok(last);
  assert.equal(last.maxVolume, null);
});
