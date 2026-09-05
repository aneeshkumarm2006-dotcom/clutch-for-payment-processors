import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FACTORING_DAYS_PER_YEAR,
  discountPctOfFace,
  factoringAprGrid,
  factoringFacility,
  factoringInvoice,
  factoringLadder,
  type FactoringFeeTerms,
} from "../../../lib/calc/factoring";
import {
  FACTORING_ANCILLARY_FEES,
  FACTORING_DAY_LADDER,
  FACTORING_DEFAULTS,
  FACTORING_FEE_STRUCTURES,
  FACTORING_RATE_LADDER,
} from "../../../lib/tools-data/factoring";

/**
 * Every expected value below was derived on paper from the stated inputs, or
 * from a closed form written out separately, before the implementation was
 * consulted. The arithmetic is small enough that this is possible, which is
 * exactly why it is worth doing: a test that asserts whatever the function
 * happened to return pins the bug in place.
 *
 * The failure modes being pinned:
 *
 *   1. THE WRONG DENOMINATOR. The fee is charged on the invoice face value; the
 *      merchant only ever receives the advance. Annualize on face and the answer
 *      is 40.96 percent; annualize on the advance and it is 48.22 percent. Both
 *      are plausible, neither throws, and only the second describes money that
 *      existed. Both are asserted separately so they cannot be swapped, and the
 *      exact ratio between them is asserted as a third check, because that ratio
 *      IS the advance rate and nothing else can produce it.
 *   2. PRORATING A TIER. A factoring fee schedule is a staircase. Day 41 under a
 *      30 plus 10 structure buys the whole 41 to 50 block. Rounding to nearest,
 *      or interpolating, makes day 44 cheaper than day 41, which is not a price
 *      any contract charges, and the number stays entirely plausible.
 *   3. CHARGING PRIME PLUS ON THE FACE VALUE. Two of the three structures are
 *      priced on face and one is priced on funds employed. Applying face to all
 *      three overstates a prime plus quote by 1 divided by the advance rate,
 *      about 18 percent at 85, and the result still looks like a factoring cost.
 *   4. COMPOUNDING WHAT THE DISCLOSURE RULES ANNUALIZE. Appendix J multiplies.
 *      Compounding the same periodic cost gives 59.74 percent where the
 *      disclosure figure is 48.22, and the page publishes both, labeled.
 *   5. A LADDER OR A FACILITY THAT DRIFTS FROM THE HEADLINE. The sensitivity
 *      rows and the annual mode must be the same arithmetic as the number
 *      printed above them, which is asserted by deriving both from the same
 *      closed form rather than from each other.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** The widget's default fee terms, read from the data module rather than retyped. */
const defaultTerms = (): FactoringFeeTerms => ({
  structure: FACTORING_DEFAULTS.structure,
  flatPct: FACTORING_DEFAULTS.flatPct,
  initialPct: FACTORING_DEFAULTS.initialPct,
  initialDays: FACTORING_DEFAULTS.initialDays,
  stepPct: FACTORING_DEFAULTS.stepPct,
  stepDays: FACTORING_DEFAULTS.stepDays,
  benchmarkPct: FACTORING_DEFAULTS.benchmarkPct,
  marginPct: FACTORING_DEFAULTS.marginPct,
  dayCountBasis: FACTORING_DEFAULTS.dayCountBasis,
});

/** The widget's default single invoice, which is also the page's worked example. */
const defaultInvoice = () => ({
  faceValue: FACTORING_DEFAULTS.faceValue,
  advanceRatePct: FACTORING_DEFAULTS.advanceRatePct,
  daysToPayment: FACTORING_DEFAULTS.daysToPayment,
  terms: defaultTerms(),
  transferFee: FACTORING_DEFAULTS.transferFee,
  upfrontFees: 0,
  settlementFees: 0,
});

// ---------------------------------------------------------------------------
// The tier is a staircase, not a slope
// ---------------------------------------------------------------------------

test("discountPctOfFace: a 3% opening tier plus 1% per 10 days steps at the boundary, never between", () => {
  const t = defaultTerms();
  // By hand. The opening tier covers days 0 to 30 inclusive. After that, each
  // started block of 10 days costs a further 1 percent, so:
  //   31 to 40 -> 4, 41 to 50 -> 5, 51 to 60 -> 6, 61 to 70 -> 7.
  assert.equal(discountPctOfFace(0, t), 3);
  assert.equal(discountPctOfFace(30, t), 3);
  assert.equal(discountPctOfFace(31, t), 4);
  assert.equal(discountPctOfFace(40, t), 4);
  assert.equal(discountPctOfFace(41, t), 5);
  assert.equal(discountPctOfFace(45, t), 5);
  assert.equal(discountPctOfFace(50, t), 5);
  assert.equal(discountPctOfFace(51, t), 6);
  assert.equal(discountPctOfFace(90, t), 9);
});

test("discountPctOfFace: the tier is monotonic and never interpolates, so day 44 is never cheaper than day 41", () => {
  const t = defaultTerms();
  let previous = 0;
  for (let d = 0; d <= 120; d += 1) {
    const p = discountPctOfFace(d, t);
    assert.ok(p >= previous, `day ${d} priced at ${p} after ${previous}, which is a fall`);
    // A step schedule takes only whole multiples of the step above the opening tier.
    const above = p - t.initialPct;
    assert.ok(
      Math.abs(above / t.stepPct - Math.round(above / t.stepPct)) < 1e-9,
      `day ${d} priced at ${p}, which is not a whole number of steps above the opening tier`,
    );
    previous = p;
  }
});

test("discountPctOfFace: a flat structure ignores the clock entirely, which is the whole trap", () => {
  const t: FactoringFeeTerms = { ...defaultTerms(), structure: "flat", flatPct: 3 };
  for (const d of [1, 15, 30, 60, 90, 120]) {
    assert.equal(discountPctOfFace(d, t), 3, `flat rate moved at ${d} days`);
  }
});

// ---------------------------------------------------------------------------
// The worked example, computed by hand
// ---------------------------------------------------------------------------

test("factoringInvoice: the page's worked example reproduces to the cent", () => {
  // By hand, from the page copy:
  //   advance   50,000 x 0.85            = 42,500.00
  //   reserve   50,000 - 42,500          =  7,500.00
  //   fee       day 45 -> 3 + 1 + 1 = 5% of 50,000 = 2,500.00
  //   funding   42,500 - 25 wire         = 42,475.00
  //   release    7,500 - 2,500           =  5,000.00
  //   cost       2,500 + 25              =  2,525.00
  const r = factoringInvoice(defaultInvoice());
  assert.equal(r.advance, 42500);
  assert.equal(r.reserveHeld, 7500);
  assert.equal(r.discountPctApplied, 5);
  assert.equal(r.discountFee, 2500);
  assert.equal(r.cashAtFunding, 42475);
  assert.equal(r.cashAtSettlement, 5000);
  assert.equal(r.totalCost, 2525);
  assert.equal(r.netProceeds, 47475);
  // The regulator's two definitions: amount financed is the advance net of the
  // prepaid wire fee, finance charge is everything charged.
  assert.equal(r.amountFinanced, 42475);
  assert.equal(r.financeCharge, 2525);
  // 2,525 / 50,000 = 5.05%. 2,525 / 42,500 = 5.941176...%.
  close(r.costPctOfFace, 5.05, 1e-9, "cost as a share of face value");
  close(r.costPctOfAdvance, 5.9411764706, 1e-9, "cost as a share of the advance");
});

test("factoringInvoice: the two annualizations are 48.22% and 40.96%, and neither is the other", () => {
  const r = factoringInvoice(defaultInvoice());
  // Closed form, written out separately from the implementation:
  //   Appendix J (b)(5): one unit period, w = 365/45 = 8.1111...
  //   i = 2525 / 42475 = 0.059446733...
  //   APR = w x i = 0.482179... -> 48.2179%
  const expectedOnAdvance = (2525 / 42475) * (365 / 45) * 100;
  const expectedOnFace = (2525 / 50000) * (365 / 45) * 100;
  close(r.aprOnAdvance, expectedOnAdvance, 1e-9, "APR on the cash advanced");
  close(r.aprOnAdvance, 48.2179059578, 1e-8, "APR on the cash advanced, to the fourth decimal");
  close(r.aprOnFace, expectedOnFace, 1e-9, "APR on the invoice face value");
  close(r.aprOnFace, 40.9611111111, 1e-8, "APR on the face value, to the fourth decimal");
  // The gap the page publishes, 7.26 points.
  close(r.aprOnAdvance - r.aprOnFace, 7.2568, 0.0001, "the understatement from dividing by face");
});

test("factoringInvoice: dividing by face understates by exactly the advance rate, at every advance rate", () => {
  // The identity being pinned: with no prepaid fees, aprOnFace / aprOnAdvance is
  // the advance rate and nothing else. If either denominator is wrong, this
  // breaks; if both are wrong in the same way, the absolute assertions above
  // catch it.
  for (const advanceRatePct of [70, 75, 80, 85, 90, 95, 100]) {
    const r = factoringInvoice({ ...defaultInvoice(), advanceRatePct, transferFee: 0 });
    close(
      r.aprOnFace / r.aprOnAdvance,
      advanceRatePct / 100,
      1e-9,
      `ratio of the two annualizations at a ${advanceRatePct}% advance`,
    );
  }
});

test("factoringInvoice: the compounded figure is always above the disclosure figure below one year", () => {
  const r = factoringInvoice(defaultInvoice());
  // (1 + 2525/42475)^(365/45) - 1, computed from the raw inputs.
  const i = 2525 / 42475;
  const expected = (Math.pow(1 + i, 365 / 45) - 1) * 100;
  close(r.effectiveAnnualRate, expected, 1e-9, "compounded annual equivalent");
  close(r.effectiveAnnualRate, 59.7421698872, 1e-8, "compounded annual equivalent, to the fourth decimal");
  for (const days of [15, 30, 45, 90, 180, 364]) {
    const x = factoringInvoice({ ...defaultInvoice(), daysToPayment: days });
    assert.ok(
      x.effectiveAnnualRate > x.aprOnAdvance,
      `at ${days} days compounding (${x.effectiveAnnualRate}) did not exceed the nominal APR (${x.aprOnAdvance})`,
    );
  }
});

test("factoringInvoice: the 3% on 30 days headline the intro publishes is 42.94% on the advance", () => {
  // (3 / 85) x (365 / 30) x 100. Hand computed: 0.0352941176 x 12.1666667 = 0.4294118.
  const r = factoringInvoice({
    ...defaultInvoice(),
    daysToPayment: 30,
    terms: { ...defaultTerms(), structure: "flat", flatPct: 3 },
    transferFee: 0,
  });
  close(r.aprOnAdvance, 42.9411764706, 1e-8, "3% flat over 30 days at an 85% advance");
  close(r.aprOnFace, 36.5, 1e-9, "the same fee annualized over face value");
  // And the far ends of a flat quote's range, which the copy calls 86 and 14.
  const fast = factoringInvoice({
    ...defaultInvoice(),
    daysToPayment: 15,
    terms: { ...defaultTerms(), structure: "flat", flatPct: 3 },
    transferFee: 0,
  });
  const slow = factoringInvoice({
    ...defaultInvoice(),
    daysToPayment: 90,
    terms: { ...defaultTerms(), structure: "flat", flatPct: 3 },
    transferFee: 0,
  });
  close(fast.aprOnAdvance, 85.8823529412, 1e-8, "a flat 3% paid in 15 days");
  close(slow.aprOnAdvance, 14.3137254902, 1e-8, "a flat 3% paid in 90 days");
});

test("factoringInvoice: a zero day term returns zero rather than Infinity", () => {
  const r = factoringInvoice({ ...defaultInvoice(), daysToPayment: 0 });
  assert.ok(Number.isFinite(r.aprOnAdvance));
  assert.ok(Number.isFinite(r.effectiveAnnualRate));
  assert.equal(r.aprOnAdvance, 0);
  assert.equal(r.aprOnFace, 0);
});

// ---------------------------------------------------------------------------
// Prime plus is priced on a different base
// ---------------------------------------------------------------------------

test("factoringInvoice: prime plus accrues on funds employed, not on the invoice", () => {
  // By hand: 42,500 x (6.75 + 3.5)% x 45 / 360 = 42,500 x 0.1025 x 0.125 = 544.53125,
  // which rounds half up to $544.53. Charging the same rate on the $50,000 face
  // would give 50,000 x 0.1025 x 0.125 = $640.63, which is the bug.
  const r = factoringInvoice({
    ...defaultInvoice(),
    terms: { ...defaultTerms(), structure: "prime-plus" },
  });
  assert.equal(r.discountFee, 544.53);
  assert.equal(r.totalCost, 569.53);
  const expectedApr = (569.53 / 42475) * (365 / 45) * 100;
  close(r.aprOnAdvance, expectedApr, 1e-9, "prime plus APR on the advance");
  close(r.aprOnAdvance, 10.8759, 0.0002, "prime plus APR, roughly prime + margin grossed up");
});

test("factoringInvoice: a 360 day accrual basis costs exactly 365/360 of a 365 day one", () => {
  const base = { ...defaultInvoice(), transferFee: 0 };
  const on360 = factoringInvoice({
    ...base,
    terms: { ...defaultTerms(), structure: "prime-plus", dayCountBasis: 360 },
  });
  const on365 = factoringInvoice({
    ...base,
    terms: { ...defaultTerms(), structure: "prime-plus", dayCountBasis: 365 },
  });
  // 42,500 x 0.1025 x 45 / 365 = 537.0719..., which rounds to $537.07.
  assert.equal(on365.discountFee, 537.07);
  assert.equal(on360.discountFee, 544.53);
  close(on360.aprOnAdvance / on365.aprOnAdvance, 365 / 360, 1e-4, "the 360 day gross up");
});

// ---------------------------------------------------------------------------
// The ladder and the grid cannot drift from the headline
// ---------------------------------------------------------------------------

test("factoringLadder: every row matches a single invoice priced at the same day count", () => {
  const input = defaultInvoice();
  const rows = factoringLadder(input, FACTORING_DAY_LADDER);
  assert.equal(rows.length, FACTORING_DAY_LADDER.length);
  for (const row of rows) {
    const direct = factoringInvoice({ ...input, daysToPayment: row.days });
    close(row.aprOnAdvance, direct.aprOnAdvance, 1e-12, `ladder row at ${row.days} days`);
    assert.equal(row.cost, direct.totalCost);
  }
  // The finding the copy leans on: because the fee steps, the annualized cost is
  // NOT monotonic in the payment date. Day 45 is dearer than day 30 AND dearer
  // than day 90. Hand check: 5% over 45 days beats 3% over 30 and 9% over 90.
  const at30 = rows.find((r) => r.days === 30);
  const at45 = rows.find((r) => r.days === 45);
  const at90 = rows.find((r) => r.days === 90);
  assert.ok(at30 && at45 && at90);
  close(at30.aprOnAdvance, (1525 / 42475) * (365 / 30) * 100, 1e-9, "day 30 of the ladder");
  close(at90.aprOnAdvance, (4525 / 42475) * (365 / 90) * 100, 1e-9, "day 90 of the ladder");
  assert.ok(at45.aprOnAdvance > at30.aprOnAdvance, "day 45 should be dearer than day 30");
  assert.ok(at45.aprOnAdvance > at90.aprOnAdvance, "day 45 should be dearer than day 90");
});

test("factoringAprGrid: every published rate table cell equals (pct / advance rate) x (365 / days)", () => {
  const days = [30, 45, 60, 90];
  const grid = factoringAprGrid(85, FACTORING_RATE_LADDER, days);
  for (const row of grid) {
    row.aprs.forEach((apr, i) => {
      const expected = (row.discountPct / 85) * (FACTORING_DAYS_PER_YEAR / days[i]!) * 100;
      close(apr, expected, 1e-9, `grid cell ${row.discountPct}% at ${days[i]} days`);
    });
  }
  // The four corners the page prints, to two decimals.
  const first = grid[0]!;
  const last = grid[grid.length - 1]!;
  close(first.aprs[0]!, 21.47, 0.005, "1.5% paid in 30 days");
  close(first.aprs[3]!, 7.16, 0.005, "1.5% paid in 90 days");
  close(last.aprs[0]!, 71.57, 0.005, "5% paid in 30 days");
  close(last.aprs[3]!, 23.86, 0.005, "5% paid in 90 days");
});

// ---------------------------------------------------------------------------
// A year on the facility
// ---------------------------------------------------------------------------

test("factoringFacility: the annual rate on funds employed equals the single invoice APR when fees are off", () => {
  // Derived separately. Annual discount = V x f. Average funds employed is
  // Little's law: (V x a) x (d / 365). The ratio is (f / a) x (365 / d), which is
  // the same closed form as the single invoice APR with no fees. If either the
  // fee base or the funds employed formula is wrong, these stop agreeing.
  const r = factoringFacility({
    monthlyFactoredVolume: 150000,
    averageInvoice: 12500,
    advanceRatePct: 85,
    daysToPayment: 45,
    terms: defaultTerms(),
    transferFee: 0,
    applicationFee: 0,
    dueDiligenceFee: 0,
    monthlyMinimumFee: 0,
    minimumIsFloor: true,
    lockboxMonthlyFee: 0,
    terminationFee: 0,
    includeTermination: false,
  });
  assert.equal(r.annualFactoredVolume, 1800000);
  assert.equal(r.advancesPerYear, 144);
  // 1,800,000 x 5% = 90,000.
  assert.equal(r.annualDiscountFees, 90000);
  // 1,530,000 x 45/365 = 188,630.136986...
  close(r.averageFundsEmployed, 188630.1369863, 1e-6, "average funds employed");
  close(r.annualizedRateOnFunds, (5 / 85) * (365 / 45) * 100, 1e-6, "annualized rate on funds employed");
  close(r.annualizedRateOnFunds, 47.7124183007, 1e-6, "annualized rate, to the fourth decimal");
});

test("factoringFacility: the widget defaults produce $93,600 a year and 49.62%", () => {
  // By hand: discount 1,800,000 x 5% = 90,000; wires 144 x $25 = 3,600; nothing
  // else. Total 93,600 over average funds of 188,630.1369863 = 49.6209%.
  const r = factoringFacility({
    monthlyFactoredVolume: FACTORING_DEFAULTS.monthlyFactoredVolume,
    averageInvoice: FACTORING_DEFAULTS.averageInvoice,
    advanceRatePct: FACTORING_DEFAULTS.advanceRatePct,
    daysToPayment: FACTORING_DEFAULTS.daysToPayment,
    terms: defaultTerms(),
    transferFee: FACTORING_DEFAULTS.transferFee,
    applicationFee: FACTORING_DEFAULTS.applicationFee,
    dueDiligenceFee: FACTORING_DEFAULTS.dueDiligenceFee,
    monthlyMinimumFee: FACTORING_DEFAULTS.monthlyMinimumFee,
    minimumIsFloor: FACTORING_DEFAULTS.minimumIsFloor,
    lockboxMonthlyFee: FACTORING_DEFAULTS.lockboxMonthlyFee,
    terminationFee: FACTORING_DEFAULTS.terminationFee,
    includeTermination: FACTORING_DEFAULTS.includeTermination,
  });
  assert.equal(r.annualTransferFees, 3600);
  assert.equal(r.annualTotalCost, 93600);
  assert.equal(r.annualNetProceeds, 1706400);
  close(r.costPctOfVolume, 5.2, 1e-9, "cost as a share of volume factored");
  close(r.annualizedRateOnFunds, (93600 / 188630.1369863) * 100, 1e-6, "rate on funds employed");
  close(r.annualizedRateOnFunds, 49.6209150327, 1e-6, "rate on funds employed, to the fourth decimal");
});

test("factoringFacility: a monthly minimum is a floor by default and an addition when told to be", () => {
  const base = {
    monthlyFactoredVolume: 10000,
    averageInvoice: 10000,
    advanceRatePct: 85,
    daysToPayment: 30,
    terms: defaultTerms(),
    transferFee: 0,
    applicationFee: 0,
    dueDiligenceFee: 0,
    monthlyMinimumFee: 1000,
    lockboxMonthlyFee: 0,
    terminationFee: 0,
    includeTermination: false,
  };
  // $10,000 a month at the 3% opening tier is $300 of fees, well under the
  // $1,000 minimum. As a floor the year costs 12 x 1,000 = 12,000, of which
  // 12 x 700 = 8,400 is the minimum rather than usage. Added instead, it is
  // 12 x 1,300 = 15,600, and the whole 12 x 1,000 = 12,000 minimum is a charge
  // unrelated to usage, because nothing about it was earned by factoring.
  const asFloor = factoringFacility({ ...base, minimumIsFloor: true });
  assert.equal(asFloor.annualDiscountFees, 12000);
  assert.equal(asFloor.minimumTopUp, 8400);
  const asAddition = factoringFacility({ ...base, minimumIsFloor: false });
  assert.equal(asAddition.annualDiscountFees, 15600);
  assert.equal(asAddition.minimumTopUp, 12000);
  // And a busy month is above the floor, so the floor stops biting entirely.
  const busy = factoringFacility({ ...base, monthlyFactoredVolume: 200000, minimumIsFloor: true });
  assert.equal(busy.annualDiscountFees, 200000 * 0.03 * 12);
  assert.equal(busy.minimumTopUp, 0);
});

test("factoringFacility: one time fees land once, not twelve times", () => {
  const base = {
    monthlyFactoredVolume: 150000,
    averageInvoice: 12500,
    advanceRatePct: 85,
    daysToPayment: 45,
    terms: defaultTerms(),
    transferFee: 25,
    applicationFee: 500,
    dueDiligenceFee: 250,
    monthlyMinimumFee: 0,
    minimumIsFloor: true,
    lockboxMonthlyFee: 250,
    terminationFee: 10000,
    includeTermination: false,
  };
  const r = factoringFacility(base);
  // 90,000 discount + 3,600 wires + 3,000 lockbox + 750 one time = 97,350.
  assert.equal(r.oneTimeFees, 750);
  assert.equal(r.annualLockboxFees, 3000);
  assert.equal(r.annualTotalCost, 97350);
  const withExit = factoringFacility({ ...base, includeTermination: true });
  assert.equal(withExit.oneTimeFees, 10750);
  assert.equal(withExit.annualTotalCost, 107350);
});

// ---------------------------------------------------------------------------
// The reference data itself
// ---------------------------------------------------------------------------

test("FACTORING_FEE_STRUCTURES: every structure is sourced, dated and declares its charge base", () => {
  assert.equal(FACTORING_FEE_STRUCTURES.length, 3);
  const ids = FACTORING_FEE_STRUCTURES.map((s) => s.id).sort();
  assert.deepEqual(ids, ["flat", "prime-plus", "tiered"]);
  for (const s of FACTORING_FEE_STRUCTURES) {
    assert.ok(s.source.length > 20, `${s.id} has no usable source`);
    assert.ok(/20\d\d/.test(s.source), `${s.id} source carries no year: ${s.source}`);
    assert.ok(s.howItIsQuoted.length > 40, `${s.id} does not say how it is quoted`);
    assert.ok(s.whatItHides.length > 40, `${s.id} does not say what it hides`);
    assert.ok(
      s.chargedOn === "face" || s.chargedOn === "funds-employed",
      `${s.id} has no charge base, which is the field the calculator reads`,
    );
  }
  // The distinction the module exists for: only the prime plus structure is
  // priced on funds employed.
  assert.equal(FACTORING_FEE_STRUCTURES.filter((s) => s.chargedOn === "funds-employed").length, 1);
  assert.equal(
    FACTORING_FEE_STRUCTURES.find((s) => s.id === "prime-plus")?.chargedOn,
    "funds-employed",
  );
});

test("FACTORING_ANCILLARY_FEES: every row carries a source, a timing and a unique id", () => {
  assert.ok(FACTORING_ANCILLARY_FEES.length >= 8, "the ancillary list is the point of the page");
  const ids = new Set<string>();
  for (const f of FACTORING_ANCILLARY_FEES) {
    assert.ok(!ids.has(f.id), `duplicate ancillary fee id ${f.id}`);
    ids.add(f.id);
    assert.ok(f.source.length > 20, `${f.id} has no usable source`);
    assert.ok(/20\d\d/.test(f.source), `${f.id} source carries no year: ${f.source}`);
    assert.ok(f.when.length > 10, `${f.id} does not say when it is charged`);
    assert.ok(f.typical.length > 5, `${f.id} has no published range or a statement that there is none`);
  }
  // The four the copy names explicitly must exist under these ids.
  for (const id of ["wire", "monthly-minimum", "termination", "misdirected"]) {
    assert.ok(ids.has(id), `the copy names the ${id} fee but the data module does not carry it`);
  }
});

test("FACTORING_DEFAULTS: the defaults sit inside the ranges the page cites", () => {
  const d = FACTORING_DEFAULTS;
  // altLINE publishes 80 to 90 percent advance rates for general factoring.
  assert.ok(d.advanceRatePct >= 80 && d.advanceRatePct <= 90, "advance rate outside the cited range");
  // The tiered default is modeled, not quoted, and the page says so. It has to
  // sit inside altLINE's published 1 to 5 percent of invoice value, and its step
  // has to sit between the two published examples the copy names: altLINE's own
  // 0.50 percent every 10 days below, and eCapital's 1.0 percent per further
  // period above. A default outside that bracket would be an invented figure.
  assert.ok(d.initialPct >= 1 && d.initialPct <= 5, "opening tier outside altLINE's published range");
  assert.ok(d.stepPct >= 0.5 && d.stepPct <= 1.0, "tier step outside the bracket the copy cites");
  // altLINE publishes $15 to $30 per wire.
  assert.ok(d.transferFee >= 15 && d.transferFee <= 30, "wire fee outside the cited range");
  // The prime benchmark is the H.15 bank prime loan rate this site already uses.
  assert.equal(d.benchmarkPct, 6.75);
  // The fees with no defensible published midpoint start at zero, on purpose.
  assert.equal(d.applicationFee, 0);
  assert.equal(d.dueDiligenceFee, 0);
  assert.equal(d.monthlyMinimumFee, 0);
  assert.equal(d.lockboxMonthlyFee, 0);
  assert.equal(d.terminationFee, 0);
  assert.equal(d.includeTermination, false);
  // The default structure must be one the data module actually carries.
  assert.ok(FACTORING_FEE_STRUCTURES.some((s) => s.id === d.structure));
  // The ladders must be sorted and positive, or the rendered table reads wrong.
  for (const list of [FACTORING_DAY_LADDER, FACTORING_RATE_LADDER]) {
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(list[i]! > list[i - 1]!, "ladder is not strictly increasing");
    }
    assert.ok(list[0]! > 0, "ladder starts at or below zero");
  }
});
