import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APR_APY_DEFAULTS,
  COMPOUNDING_FREQUENCIES,
  aprToApy,
  apyToApr,
  convertRate,
  frequencyLadder,
  normalizePeriods,
  periodicRate,
  restateNominal,
} from "../../../lib/calc/apr-apy";
import { effectiveAnnualRate } from "../../../lib/tools-math";

/**
 * Reference values here come from three places, none of them the implementation:
 *
 *   1. REGULATION DD ITSELF. Appendix A to 12 CFR Part 1030 publishes a worked
 *      example: $30.37 of interest on a $1,000 principal over a 182 day term is
 *      an annual percentage yield of 6.18 percent. That reference sits entirely
 *      outside this module and outside the closed form it implements, which is
 *      worth more than any number of self-consistent assertions.
 *   2. A CLOSED FORM COMPUTED A DIFFERENT WAY. The module deliberately uses
 *      `Math.expm1` and `Math.log1p`, never `Math.pow(x, n) - 1`. The tests below
 *      use the `Math.pow` form. Two different expressions for the same identity
 *      have to agree, and if one is ever rewritten the other still pins it.
 *   3. HAND ARITHMETIC. 1.01 to the twelfth is small enough to check on paper.
 *
 * THE FAILURE MODE BEING PINNED. Inverting the two directions does not throw and
 * does not look wrong. Feed 24.99 percent through `apyToApr` when you meant
 * `aprToApy` and you get 22.28 percent instead of 28.38 percent: same order of
 * magnitude, still plausible, and $610 a year out on a $10,000 balance. The
 * monotonicity sweeps below exist to make that impossible to ship.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** The naive closed form, written the way a spreadsheet would. Deliberately NOT how the module computes it. */
const naiveApy = (aprPct: number, n: number): number =>
  n <= 0 ? (Math.exp(aprPct / 100) - 1) * 100 : (Math.pow(1 + aprPct / 100 / n, n) - 1) * 100;

const naiveApr = (apyPct: number, n: number): number =>
  n <= 0 ? Math.log(1 + apyPct / 100) * 100 : n * (Math.pow(1 + apyPct / 100, 1 / n) - 1) * 100;

const RATES = [0.01, 0.38, 1.71, 4.5, 6, 8, 12, 18, 24.99, 36, 79.9, 150];
const INTEGER_FREQUENCIES = [1, 2, 4, 12, 24, 26, 52, 365];

// ---------------------------------------------------------------------------
// The regulation's own example
// ---------------------------------------------------------------------------

test("aprToApy reproduces the worked example published in Appendix A to 12 CFR Part 1030", () => {
  // Regulation DD states: $30.37 of interest on a $1,000 principal over a 182
  // day term is an annual percentage yield of 6.18 percent. Expressed as a
  // nominal rate on a 182 day period, the period count is 365/182 and the rate
  // is (30.37/1000) x (365/182), which is 6.090687 percent. Converting that
  // nominal rate at that period count must land on the regulation's figure.
  const days = 182;
  const periods = 365 / days;
  const nominalPct = (30.37 / 1000) * periods * 100;
  close(nominalPct, 6.090687, 1e-6, "the nominal rate implied by the regulation's dollars");

  const apy = aprToApy(nominalPct, periods);
  assert.equal(apy.toFixed(2), "6.18", `expected the regulation's 6.18%, got ${apy.toFixed(4)}`);

  // And the direct Appendix A form, 100[(1 + I/P)^(365/days) - 1], agrees.
  close(apy, (Math.pow(1 + 30.37 / 1000, 365 / days) - 1) * 100, 1e-9, "Appendix A closed form");
});

// ---------------------------------------------------------------------------
// Agreement with lib/tools-math, so two pages cannot print different answers
// ---------------------------------------------------------------------------

test("aprToApy agrees with effectiveAnnualRate on every rate and frequency the widget can produce", () => {
  // `effectiveAnnualRate` powers /tools/compound-interest-calculator and
  // /tools/simple-interest-calculator. If these ever diverge, two pages on this
  // site publish different APYs for the same inputs.
  for (const rate of RATES) {
    for (const f of COMPOUNDING_FREQUENCIES) {
      const mine = aprToApy(rate, f.periodsPerYear);
      const theirs = effectiveAnnualRate(rate, f.periodsPerYear) * 100;
      close(mine, theirs, 1e-9, `APY at ${rate}% compounded ${f.label}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Hand-checkable values
// ---------------------------------------------------------------------------

test("aprToApy: 12 percent compounded monthly is 1.01 to the twelfth, minus 1", () => {
  // 1% a month, twelve times. 1.01^12 = 1.12682503013196... by hand.
  close(aprToApy(12, 12), 12.6825030131969, 1e-10, "12% compounded monthly");
});

test("aprToApy: continuous compounding is e to the power of the rate, minus 1", () => {
  close(aprToApy(5, 0), 5.12710963760241, 1e-10, "5% continuous");
  close(aprToApy(24.99, 0), (Math.exp(0.2499) - 1) * 100, 1e-10, "24.99% continuous");
});

test("aprToApy: annual compounding leaves the rate exactly alone", () => {
  for (const rate of RATES) {
    assert.equal(aprToApy(rate, 1), rate, `annual compounding changed ${rate}`);
    assert.equal(apyToApr(rate, 1), rate, `annual decompounding changed ${rate}`);
  }
});

test("apyToApr: a 4.50 percent APY compounded monthly is a nominal 4.409771 percent", () => {
  // By the closed form: 12 x (1.045^(1/12) - 1). 1.045^(1/12) = 1.003674809...
  const expected = 12 * (Math.pow(1.045, 1 / 12) - 1) * 100;
  close(expected, 4.409771, 1e-6, "the hand-computed nominal rate");
  close(apyToApr(4.5, 12), expected, 1e-11, "apyToApr at 4.5% monthly");
  // And the monthly periodic rate the page prints beside it.
  close(periodicRate(apyToApr(4.5, 12), 12) ?? 0, 0.367481, 1e-6, "monthly periodic rate");
});

// ---------------------------------------------------------------------------
// The identity, both directions, against an independently written closed form
// ---------------------------------------------------------------------------

test("both directions match a closed form written with Math.pow instead of expm1", () => {
  for (const rate of RATES) {
    for (const n of [...INTEGER_FREQUENCIES, 0]) {
      close(aprToApy(rate, n), naiveApy(rate, n), 1e-8, `APY at ${rate}% n=${n}`);
      close(apyToApr(rate, n), naiveApr(rate, n), 1e-8, `APR at ${rate}% n=${n}`);
    }
  }
});

test("converting a rate and converting it straight back returns what was entered", () => {
  let worst = 0;
  for (const rate of RATES) {
    for (const n of [...INTEGER_FREQUENCIES, 0]) {
      worst = Math.max(worst, Math.abs(apyToApr(aprToApy(rate, n), n) - rate));
      worst = Math.max(worst, Math.abs(aprToApy(apyToApr(rate, n), n) - rate));
    }
  }
  assert.ok(worst < 1e-10, `worst round trip drift was ${worst}, which is visible at four decimal places`);
});

// ---------------------------------------------------------------------------
// The direction guard: the property that catches an inverted call
// ---------------------------------------------------------------------------

test("aprToApy never returns less than its input and apyToApr never returns more", () => {
  for (const rate of RATES) {
    for (const n of [...INTEGER_FREQUENCIES, 0]) {
      assert.ok(aprToApy(rate, n) >= rate - 1e-12, `aprToApy(${rate}, ${n}) went down`);
      assert.ok(apyToApr(rate, n) <= rate + 1e-12, `apyToApr(${rate}, ${n}) went up`);
    }
  }
});

test("more frequent compounding never lowers the yield, and continuous is the ceiling", () => {
  for (const rate of RATES) {
    const ceiling = aprToApy(rate, 0);
    let previous = -Infinity;
    for (const n of INTEGER_FREQUENCIES) {
      const apy = aprToApy(rate, n);
      assert.ok(apy >= previous - 1e-12, `APY fell going to n=${n} at ${rate}%`);
      assert.ok(apy <= ceiling + 1e-12, `APY at n=${n} beat the continuous ceiling at ${rate}%`);
      previous = apy;
    }
  }
});

// ---------------------------------------------------------------------------
// Restating a rate across schedules
// ---------------------------------------------------------------------------

test("restateNominal: 24.99 percent daily and 25.243 percent monthly are the same deal", () => {
  // Independently: take the daily APY by the pow form, then decompound it monthly.
  const dailyApy = Math.pow(1 + 0.2499 / 365, 365) - 1;
  const expected = 12 * (Math.pow(1 + dailyApy, 1 / 12) - 1) * 100;
  close(expected, 25.243293, 1e-6, "the hand-computed monthly equivalent");
  close(restateNominal(24.99, 365, 12), expected, 1e-10, "restated onto monthly");

  // Restating onto annual compounding must return the APY itself, by definition.
  close(restateNominal(24.99, 365, 1), aprToApy(24.99, 365), 1e-12, "restated onto annual");
  // And restating onto the schedule it is already on must change nothing.
  close(restateNominal(24.99, 365, 365), 24.99, 1e-10, "restated onto itself");
});

// ---------------------------------------------------------------------------
// Dollars, in integer cents
// ---------------------------------------------------------------------------

test("convertRate: the figures the page publishes on its default state", () => {
  // Hand-checked. 24.99% compounded daily on $10,000 for a year:
  //   APY   = (1 + 0.2499/365)^365 - 1 = 0.2837872...  ->  $2,837.87 of interest
  //   APR   = 0.2499                                    ->  $2,499.00 of interest
  //   gap   = $338.87
  const r = convertRate({
    direction: "aprToApy",
    ratePct: APR_APY_DEFAULTS.aprPct,
    compoundsPerYear: APR_APY_DEFAULTS.compoundsPerYear,
    targetCompoundsPerYear: APR_APY_DEFAULTS.targetCompoundsPerYear,
    balance: APR_APY_DEFAULTS.balance,
    years: APR_APY_DEFAULTS.years,
  });

  assert.equal(r.aprPct, 24.99);
  assert.equal(r.apyPct.toFixed(3), "28.379");
  assert.equal(r.spreadPct.toFixed(3), "3.389");
  assert.equal(r.compoundedYearOne, 2837.87);
  assert.equal(r.nominalYearOne, 2499);
  assert.equal(r.yearOneGap, 338.87);
  // The gap must be the difference between the two printed figures, to the cent.
  assert.equal(r.yearOneGap, Number((r.compoundedYearOne - r.nominalYearOne).toFixed(2)));
  close(r.periodicRatePct ?? 0, 24.99 / 365, 1e-12, "daily periodic rate");
  close(r.ceilingCapturedPct, 99.9613, 1e-3, "share of the continuous ceiling");
});

test("convertRate: the deposit direction, and the dollars the worked example quotes", () => {
  // A 4.50% APY compounded monthly on $10,000 for a year:
  //   interest at the APY  = 10,000 x 0.045      = $450.00
  //   interest at the APR  = 10,000 x 0.0440977  = $440.98
  //   compounding is worth                         $9.02
  const r = convertRate({
    direction: "apyToApr",
    ratePct: APR_APY_DEFAULTS.apyPct,
    compoundsPerYear: 12,
    targetCompoundsPerYear: 12,
    balance: 10000,
    years: 1,
  });
  assert.equal(r.apyPct, 4.5);
  assert.equal(r.aprPct.toFixed(3), "4.410");
  assert.equal(r.compoundedYearOne, 450);
  assert.equal(r.nominalYearOne, 440.98);
  assert.equal(r.yearOneGap, 9.02);
});

test("convertRate: a multi-year balance compounds while the nominal twin stays linear", () => {
  // By hand, $10,000 at 24.99% daily for 5 years:
  //   compounded = 10,000 x (1.2837872...)^5
  //   simple     = 10,000 x (1 + 0.2499 x 5) = $22,495.00 exactly
  const r = convertRate({
    direction: "aprToApy",
    ratePct: 24.99,
    compoundsPerYear: 365,
    targetCompoundsPerYear: 12,
    balance: 10000,
    years: 5,
  });
  assert.equal(r.nominalValue, 22495);
  const expected = 10000 * Math.pow(Math.pow(1 + 0.2499 / 365, 365), 5);
  close(r.compoundedValue, expected, 0.01, "five years compounded daily");
  close(r.termGap, expected - 22495, 0.01, "five year gap");
});

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

test("frequencyLadder: nine rows, the annual row is the base, and the dollars rise with frequency", () => {
  const rows = frequencyLadder(24.99, 10000);
  assert.equal(rows.length, 9);

  const annual = rows.find((r) => r.periodsPerYear === 1);
  assert.ok(annual, "no annual row");
  assert.equal(annual?.gapVsAnnual, 0);
  assert.equal(annual?.interestOneYear, 2499);

  // Hand-checked against the rate table published on the page.
  const at = (n: number) => rows.find((r) => r.periodsPerYear === n);
  assert.equal(at(4)?.apyPct.toFixed(3), "27.431");
  assert.equal(at(12)?.apyPct.toFixed(3), "28.061");
  assert.equal(at(365)?.apyPct.toFixed(3), "28.379");
  assert.equal(at(0)?.apyPct.toFixed(3), "28.390");
  assert.equal(at(365)?.gapVsAnnual, 338.87);
  assert.equal(at(12)?.gapVsAnnual, 307.06);

  // Continuous is last and has no periodic rate to quote.
  assert.equal(rows[rows.length - 1]?.periodsPerYear, 0);
  assert.equal(rows[rows.length - 1]?.periodicRatePct, null);
  for (const row of rows) {
    if (row.periodsPerYear === 0) continue;
    close(row.periodicRatePct ?? 0, 24.99 / row.periodsPerYear, 1e-12, `periodic rate at n=${row.periodsPerYear}`);
  }
});

test("frequencyLadder: at a low rate the whole annual to daily spread is small change", () => {
  // The page claims $10.25 across a year on $10,000 at 4.50%. That claim is the
  // argument for taking a better rate over a better schedule, so it is pinned.
  const rows = frequencyLadder(4.5, 10000);
  assert.equal(rows.find((r) => r.periodsPerYear === 365)?.gapVsAnnual, 10.25);
});

// ---------------------------------------------------------------------------
// Degenerate inputs
// ---------------------------------------------------------------------------

test("normalizePeriods: anything under one period a year means continuous", () => {
  assert.equal(normalizePeriods(0), 0);
  assert.equal(normalizePeriods(-4), 0);
  assert.equal(normalizePeriods(0.5), 0);
  assert.equal(normalizePeriods(Number.NaN), 0);
  assert.equal(normalizePeriods(12), 12);
  // Fractional counts above one are preserved, which is what lets the
  // Regulation DD 182 day example work.
  close(normalizePeriods(365 / 182), 2.0054945, 1e-6, "fractional period count");
});

test("periodicRate: continuous compounding has no period and must not report zero", () => {
  assert.equal(periodicRate(24.99, 0), null);
  assert.equal(periodicRate(24.99, 12), 24.99 / 12);
});

test("a zero rate, a zero balance and a zero term all produce zeros rather than NaN", () => {
  const zeroRate = convertRate({
    direction: "aprToApy",
    ratePct: 0,
    compoundsPerYear: 365,
    targetCompoundsPerYear: 12,
    balance: 10000,
    years: 1,
  });
  assert.equal(zeroRate.apyPct, 0);
  assert.equal(zeroRate.yearOneGap, 0);
  assert.equal(zeroRate.compoundedValue, 10000);
  assert.equal(zeroRate.ceilingCapturedPct, 0);

  const zeroBalance = convertRate({
    direction: "aprToApy",
    ratePct: 24.99,
    compoundsPerYear: 365,
    targetCompoundsPerYear: 12,
    balance: 0,
    years: 1,
  });
  assert.equal(zeroBalance.compoundedYearOne, 0);
  assert.equal(zeroBalance.yearOneGap, 0);
  assert.equal(zeroBalance.apyPct.toFixed(3), "28.379");

  const zeroTerm = convertRate({
    direction: "aprToApy",
    ratePct: 24.99,
    compoundsPerYear: 365,
    targetCompoundsPerYear: 12,
    balance: 10000,
    years: 0,
  });
  assert.equal(zeroTerm.compoundedValue, 10000);
  assert.equal(zeroTerm.nominalValue, 10000);
  assert.equal(zeroTerm.termGap, 0);
});

test("every compounding option is a distinct, parseable frequency", () => {
  const seen = new Set<number>();
  for (const f of COMPOUNDING_FREQUENCIES) {
    assert.equal(Number(f.value), f.periodsPerYear, `${f.label} value does not parse to its period count`);
    assert.ok(!seen.has(f.periodsPerYear), `${f.label} duplicates a frequency`);
    seen.add(f.periodsPerYear);
    assert.ok(f.label.length > 0 && f.periodName.length > 0, `${f.label} is missing copy`);
  }
  assert.equal(COMPOUNDING_FREQUENCIES.length, 9);
});
