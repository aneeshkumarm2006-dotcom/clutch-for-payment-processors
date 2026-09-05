import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_AMORTIZATION_DEFAULTS,
  SBA_FEE_SCHEDULE,
  SBA_MAX_VARIABLE_SPREADS,
  buildSchedule,
  equivalentFactorRate,
  extraPaymentEffect,
  monthlyPayment,
  sbaGuarantyFee,
  sbaMaxVariableRate,
  solveMonthlyRate,
  type LoanInput,
} from "../../../lib/calc/amortization";

/**
 * Every expected value below is derived INDEPENDENTLY of the implementation:
 * from the closed form worked separately, from a published fee schedule, or
 * from an algebraic identity that has to hold whatever the code does. A test
 * that asserts whatever the function happened to return pins the bug in place.
 *
 * The failure modes being pinned, all of them silent:
 *
 *   1. A SCHEDULE THAT DOES NOT CLOSE ON ZERO. Per period cent rounding leaves a
 *      residue that a level payment never clears, so the final payment has to be
 *      adjusted. The assertion is on the closing balance being exactly 0, and on
 *      the rows summing to the reported totals, so an adjustment that fixes the
 *      display without fixing the arithmetic still fails.
 *   2. THE APR SOLVER ON THE WRONG BRANCH. NPV is decreasing in the rate, so a
 *      positive NPV at the midpoint means the root is above it. Inverting that
 *      comparison still converges and still returns a finite number, roughly
 *      1,200 percent. The control for it is a fee free loan, where the APR must
 *      equal the note rate exactly, computed by nothing but the solver.
 *   3. THE SBA FEE ON THE WRONG BASE. SBA charges the upfront fee on the
 *      GUARANTEED PORTION. Every tier here is checked against a hand computed
 *      figure taken from SBA Information Notice 5000-872051, and the $500,000
 *      case is asserted at $11,250 precisely because applying the rate to the
 *      face amount would give a plausible looking $15,000.
 *   4. NEGATIVE AMORTIZATION LOOPING FOREVER. A payment below one period of
 *      interest is a hung tab, not a wrong number.
 *   5. AN ANNUALIZATION THAT COMPOUNDS. Appendix J to 12 CFR Part 1026 multiplies
 *      the unit period rate by the number of unit periods in a year. Compounding
 *      it would produce a larger, plausible, wrong figure.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

type LoanOverride = Omit<Partial<LoanInput>, "fees"> & { fees?: Partial<LoanInput["fees"]> };

const loan = (over: LoanOverride = {}): LoanInput => ({
  principal: 250_000,
  annualRatePct: 9.25,
  amortizationMonths: 120,
  termMonths: 120,
  extraPayment: 0,
  ...over,
  fees: { originationPct: 0, flatFees: 0, guarantyFee: 0, ...(over.fees ?? {}) },
});

// ---------------------------------------------------------------------------
// The payment formula
// ---------------------------------------------------------------------------

test("monthlyPayment matches the closed form computed separately", () => {
  // Worked outside the module: i = 0.0925 / 12 = 0.00770833333...
  // (1 + i)^-120 computed independently, then P = L * i / (1 - that).
  const i = 0.0925 / 12;
  const expected = (250_000 * i) / (1 - Math.pow(1 + i, -120));
  // Independent value, before rounding: 3200.8177...
  close(expected, 3200.8177, 0.001, "closed form sanity");
  assert.equal(monthlyPayment(250_000, 9.25, 120), 3200.82);
});

test("monthlyPayment on a zero rate note is the principal split evenly, not NaN", () => {
  // 120,000 / 12 = 10,000 exactly. The general formula is 0/0 here, and
  // JavaScript returns NaN rather than throwing, so this branch is load-bearing.
  assert.equal(monthlyPayment(120_000, 0, 12), 10_000);
  assert.ok(Number.isFinite(monthlyPayment(120_000, 0, 12)));
});

test("monthlyPayment reproduces a textbook figure with no relation to this codebase", () => {
  // $100,000 at 10 percent nominal over 60 monthly payments. i = 1/120.
  // Solved by hand: 100000 * (1/120) / (1 - (121/120)^-60) = 2124.7044...
  assert.equal(monthlyPayment(100_000, 10, 60), 2124.7);
});

// ---------------------------------------------------------------------------
// The schedule closes on zero
// ---------------------------------------------------------------------------

test("the schedule closes on exactly zero, and the final payment is the one that differs", () => {
  const s = buildSchedule(loan({ fees: { originationPct: 2, flatFees: 1500 } }));
  assert.equal(s.payments, 120);
  assert.equal(s.rows[119]!.balance, 0);
  // Independent of the implementation: the last payment cannot equal the level
  // payment, because 120 level payments do not retire a balance whose interest
  // was rounded to the cent 120 times.
  assert.notEqual(s.finalPayment, s.scheduledPayment);
  assert.equal(s.finalPayment, 3200.43);
});

test("the printed rows sum to the printed totals, to the cent", () => {
  const s = buildSchedule(loan({ fees: { originationPct: 2, flatFees: 1500 } }));
  const paid = s.rows.reduce((a, r) => a + r.payment, 0);
  const interest = s.rows.reduce((a, r) => a + r.interest, 0);
  const principal = s.rows.reduce((a, r) => a + r.principal + r.extra, 0);
  close(paid, s.totalPaid, 0.005, "row payments against totalPaid");
  close(interest, s.totalInterest, 0.005, "row interest against totalInterest");
  // Principal repaid must equal the FACE amount, never the amount financed. The
  // fees came out of the cash, not off the balance, and confusing the two is the
  // error this whole page exists to correct.
  close(principal, 250_000, 0.005, "principal repaid against the face amount");
});

test("interest plus principal equals the payment on every single row", () => {
  const s = buildSchedule(loan({ extraPayment: 137.5, fees: { originationPct: 1.75 } }));
  for (const r of s.rows) {
    close(r.interest + r.principal + r.extra, r.payment, 0.005, `row ${r.period} does not balance`);
  }
});

test("the first period's interest is the balance times the monthly rate, computed by hand", () => {
  // 250,000 x 0.0925 / 12 = 1,927.0833..., which rounds to 1,927.08.
  // Principal is then 3,200.82 - 1,927.08 = 1,273.74, leaving 248,726.26.
  const s = buildSchedule(loan());
  assert.equal(s.rows[0]!.interest, 1927.08);
  assert.equal(s.rows[0]!.principal, 1273.74);
  assert.equal(s.rows[0]!.balance, 248_726.26);
});

test("the yearly summary is a partition of the period rows, not a second calculation", () => {
  const s = buildSchedule(loan({ fees: { originationPct: 2, flatFees: 1500 } }));
  assert.equal(s.yearly.length, 10);
  close(
    s.yearly.reduce((a, y) => a + y.interest, 0),
    s.totalInterest,
    0.005,
    "yearly interest against the total",
  );
  assert.equal(s.yearly[9]!.endingBalance, 0);
  // Front loading is a property of the mechanism, not of this code: year one has
  // to carry more interest than year ten on any declining balance loan.
  assert.ok(s.yearly[0]!.interest > s.yearly[9]!.interest * 10);
});

// ---------------------------------------------------------------------------
// The APR
// ---------------------------------------------------------------------------

test("with no fees the APR equals the note rate exactly, which is the solver's control", () => {
  // Nothing but the bisection produces this. If the branch direction were
  // inverted, or the annualization compounded, this would not be 9.25.
  const s = buildSchedule(loan());
  close(s.aprPct, 9.25, 0.0005, "APR on a fee free note");
});

test("the APR control holds across a sweep of rates and terms", () => {
  for (const rate of [0.01, 4.5, 7.25, 9.25, 12.75, 24]) {
    for (const months of [12, 36, 60, 120, 300]) {
      const s = buildSchedule(loan({ annualRatePct: rate, amortizationMonths: months, termMonths: months }));
      close(s.aprPct, rate, 0.01, `fee free APR at ${rate}% over ${months} months`);
    }
  }
});

test("fees deducted from the disbursement raise the APR above the note rate", () => {
  const s = buildSchedule(loan({ fees: { originationPct: 2, flatFees: 1500 } }));
  assert.equal(s.amountFinanced, 243_500);
  // Face amount minus prepaid finance charges, per 12 CFR 1026.18(b)(3).
  assert.equal(s.fees.total, 6500);
  assert.ok(s.aprPct > s.noteRatePct, "an APR at or below the note rate means the fee went the wrong way");
  close(s.aprPct, 9.8734, 0.002, "APR with 2 percent plus $1,500 of fees");
});

test("solveMonthlyRate reproduces a rate derived from the annuity identity, not from a schedule", () => {
  // Build the cash flow from the OTHER direction. A 1 percent monthly rate over
  // 24 payments of $1,000 has a present value of
  //   1000 x (1 - 1.01^-24) / 0.01 = 21,243.387...
  // Feed that present value back in and the solver must return 0.01.
  const pv = (1000 * (1 - Math.pow(1.01, -24))) / 0.01;
  close(pv, 21_243.3874, 0.0005, "present value computed outside the module");
  const payments = Array.from({ length: 24 }, () => 100_000); // cents
  const r = solveMonthlyRate(Math.round(pv * 100), payments);
  // The advance is rounded to whole cents before it goes in, so the recovered
  // rate cannot be exact to machine precision. A tenth of a basis point a year
  // is far tighter than the one eighth of a point that 12 CFR 1026.22(a)(2)
  // treats as an accurate APR, and loose enough that the cent rounding shows up
  // as rounding rather than as a failure.
  close(r * 12 * 100, 12, 0.001, "annual rate recovered from a hand computed present value");
});

test("the APR is annualized by multiplying, never by compounding", () => {
  // A monthly rate of 0.01 is 12 percent nominal, and 12.6825 percent compounded.
  // Appendix J to 12 CFR Part 1026 means the first. Construct a note whose
  // monthly rate is exactly 1 percent and check which one comes back.
  const s = buildSchedule(loan({ annualRatePct: 12, amortizationMonths: 24, termMonths: 24 }));
  close(s.aprPct, 12, 0.01, "nominal annualization");
  const compounded = (Math.pow(1.01, 12) - 1) * 100;
  close(compounded, 12.6825, 0.001, "the compounded figure this must NOT return");
  assert.ok(Math.abs(s.aprPct - compounded) > 0.5);
});

test("a shorter term amplifies the same fee, which is the page's central claim", () => {
  // Same 3 percent fee, same rate, two terms. The fee is paid once, so spreading
  // it over more periods has to cost less per year. Direction and rough size are
  // both derivable without running the code.
  const short = buildSchedule(loan({ amortizationMonths: 36, termMonths: 36, fees: { originationPct: 3 } }));
  const long = buildSchedule(loan({ fees: { originationPct: 3 } }));
  assert.ok(short.aprPct - short.noteRatePct > long.aprPct - long.noteRatePct);
  close(short.aprPct, 11.35, 0.01, "3 percent fee over 3 years");
  close(long.aprPct, 9.97, 0.01, "3 percent fee over 10 years");
});

// ---------------------------------------------------------------------------
// Extra payments and balloons
// ---------------------------------------------------------------------------

test("extra principal shortens the loan and the saving is the difference of two schedules", () => {
  const e = extraPaymentEffect(loan({ extraPayment: 250, fees: { originationPct: 2, flatFees: 1500 } }));
  assert.equal(e.baselinePayments, 120);
  assert.equal(e.acceleratedPayments, 107);
  assert.equal(e.monthsSaved, 13);
  close(e.interestSaved, e.baselineInterest - e.acceleratedInterest, 1e-9, "saving is a difference, not a formula");
  close(e.interestSaved, 16_736.67, 0.02, "interest saved by $250 a month");
  // 106 full extra payments of $250 plus the remainder in the final one.
  close(e.extraPaid, 26_500, 0.02, "extra principal actually paid");
});

test("an extra payment can never increase total interest or lengthen the loan", () => {
  for (const extra of [0, 1, 50, 250, 1000, 5000]) {
    const e = extraPaymentEffect(loan({ extraPayment: extra }));
    assert.ok(e.acceleratedInterest <= e.baselineInterest + 1e-9, `extra ${extra} increased interest`);
    assert.ok(e.acceleratedPayments <= e.baselinePayments, `extra ${extra} lengthened the loan`);
  }
});

test("a balloon leaves the balance the regular payments did not retire", () => {
  // Payment sized on 120 months, note matures at 60. The balance after 60
  // regular payments is the balloon. Independent check: the balloon plus the
  // principal retired in the first five years must be the face amount.
  const b = buildSchedule(loan({ termMonths: 60, fees: { originationPct: 2, flatFees: 1500 } }));
  assert.equal(b.payments, 60);
  assert.equal(b.scheduledPayment, 3200.82);
  assert.equal(b.balloonDue, 153_296.45);
  // Every dollar of principal is accounted for: 59 ordinary payments retire
  // their slice, and the sixtieth retires the whole rest of the balance.
  const retired = b.rows.slice(0, 59).reduce((a, r) => a + r.principal, 0);
  close(retired + b.rows[59]!.principal, 250_000, 0.02, "principal retired is the face amount");
  // The last payment is the balance standing after payment 59 plus one more
  // month of interest on it. Both of those are printed rows, so this identity is
  // checkable on the page itself.
  close(b.finalPayment, b.rows[58]!.balance + b.rows[59]!.interest, 0.02, "final payment");
  // The balloon is what that final payment covers OVER a regular payment.
  close(b.balloonDue, b.rows[58]!.balance - (b.scheduledPayment - b.rows[59]!.interest), 0.02, "balloon amount");
  assert.equal(b.finalPayment, 156_497.27);
  assert.equal(b.rows[59]!.balance, 0);
});

test("a balloon note costs less in total interest than the same note fully amortized", () => {
  const b = buildSchedule(loan({ termMonths: 60 }));
  const full = buildSchedule(loan());
  assert.ok(b.totalInterest < full.totalInterest);
  // Its interest must equal the first 60 rows of the fully amortizing schedule,
  // because the payments up to maturity are identical.
  const firstSixty = full.rows.slice(0, 60).reduce((a, r) => a + r.interest, 0);
  close(b.totalInterest, firstSixty, 0.02, "balloon interest against the first 60 rows");
});

// ---------------------------------------------------------------------------
// Degenerate inputs
// ---------------------------------------------------------------------------

test("a payment below one period of interest is flagged rather than looped forever", () => {
  // 60 percent a year on $250,000 is $12,500 of interest in month one. A 600
  // month schedule produces a payment of $12,500.00, which never gets ahead.
  const s = buildSchedule(loan({ annualRatePct: 60, amortizationMonths: 600, termMonths: 600 }));
  assert.equal(s.neverAmortizes, true);
  assert.equal(s.rows.length, 0);
  assert.ok(Number.isFinite(s.aprPct));
});

test("empty and nonsense inputs return zeros rather than NaN", () => {
  for (const input of [
    loan({ principal: 0 }),
    loan({ amortizationMonths: 0 }),
    loan({ principal: Number.NaN }),
    loan({ annualRatePct: Number.NaN }),
  ]) {
    const s = buildSchedule(input);
    assert.ok(Number.isFinite(s.scheduledPayment), "payment is not finite");
    assert.ok(Number.isFinite(s.aprPct), "APR is not finite");
    assert.ok(Number.isFinite(s.totalInterest), "interest is not finite");
  }
});

test("a term longer than the amortization is clamped rather than producing a phantom balloon", () => {
  const s = buildSchedule(loan({ termMonths: 600 }));
  assert.equal(s.payments, 120);
  assert.equal(s.balloonDue, 0);
});

// ---------------------------------------------------------------------------
// The SBA schedule, checked against the published notice
// ---------------------------------------------------------------------------

test("SBA guaranty percentages match the published thresholds", () => {
  assert.equal(sbaGuarantyFee(150_000, 120).guarantyPct, 85);
  assert.equal(sbaGuarantyFee(150_001, 120).guarantyPct, 75);
  assert.equal(SBA_FEE_SCHEDULE.guarantyPct.atOrBelow150k, 85);
  assert.equal(SBA_FEE_SCHEDULE.guarantyPct.above150k, 75);
});

test("the SBA upfront fee is charged on the guaranteed portion, not on the loan", () => {
  // Hand computed from SBA Information Notice 5000-872051, FY 2026:
  //   $150,000 x 85% = $127,500 guaranteed, x 2%   = $2,550
  //   $250,000 x 75% = $187,500 guaranteed, x 3%   = $5,625
  //   $500,000 x 75% = $375,000 guaranteed, x 3%   = $11,250
  // The $500,000 case is the one that matters: 3 percent of the FACE amount
  // would be $15,000, which looks entirely plausible and is a third too high.
  assert.equal(sbaGuarantyFee(150_000, 120).fee, 2550);
  assert.equal(sbaGuarantyFee(250_000, 120).fee, 5625);
  assert.equal(sbaGuarantyFee(500_000, 120).fee, 11_250);
  assert.notEqual(sbaGuarantyFee(500_000, 120).fee, 15_000);
});

test("the top SBA tier is piecewise on the guaranteed portion above one million", () => {
  // $1,000,000 x 75% = $750,000 guaranteed, entirely below the $1m break:
  //   750,000 x 3.5% = $26,250.
  // $2,000,000 x 75% = $1,500,000 guaranteed, so it straddles the break:
  //   1,000,000 x 3.5% = 35,000, plus 500,000 x 3.75% = 18,750, total $53,750.
  assert.equal(sbaGuarantyFee(1_000_000, 300).fee, 26_250);
  assert.equal(sbaGuarantyFee(2_000_000, 300).fee, 53_750);
  assert.equal(sbaGuarantyFee(5_000_000, 300).overProgramMax, false);
  assert.equal(sbaGuarantyFee(5_000_001, 300).overProgramMax, true);
});

test("a maturity of twelve months or less falls in the 0.25 percent short term tier", () => {
  // $250,000 x 75% = $187,500 guaranteed, x 0.25% = $468.75.
  const short = sbaGuarantyFee(250_000, 12);
  assert.equal(short.feePct, 0.25);
  assert.equal(short.fee, 468.75);
  // And the same loan at 13 months is back on the long term tier.
  assert.equal(sbaGuarantyFee(250_000, 13).fee, 5625);
});

test("the SBA maximum variable spreads step down at the published loan sizes", () => {
  const prime = 6.75;
  assert.equal(sbaMaxVariableRate(50_000, prime).spreadPct, 6.5);
  assert.equal(sbaMaxVariableRate(50_001, prime).spreadPct, 6);
  assert.equal(sbaMaxVariableRate(250_001, prime).spreadPct, 4.5);
  assert.equal(sbaMaxVariableRate(350_001, prime).spreadPct, 3);
  // Prime 6.75 plus a 3.0 point spread is 9.75 percent.
  close(sbaMaxVariableRate(400_000, prime).maxRatePct, 9.75, 1e-9, "ceiling above $350,000");
  // The bands must be sorted ascending or `find` returns the wrong one.
  for (let i = 1; i < SBA_MAX_VARIABLE_SPREADS.length; i += 1) {
    assert.ok(SBA_MAX_VARIABLE_SPREADS[i]!.upTo > SBA_MAX_VARIABLE_SPREADS[i - 1]!.upTo);
  }
});

test("the SBA schedule module carries its own source and checked date", () => {
  assert.ok(SBA_FEE_SCHEDULE.notice.includes("5000-872051"), "the notice number must stay on the data");
  assert.match(SBA_FEE_SCHEDULE.checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(SBA_FEE_SCHEDULE.lenderAnnualServiceFeePct, 0.55);
});

// ---------------------------------------------------------------------------
// The merchant cash advance translation
// ---------------------------------------------------------------------------

test("the equivalent factor rate is total repaid over cash received, by definition", () => {
  assert.equal(equivalentFactorRate(50_000, 65_000), 1.3);
  assert.equal(equivalentFactorRate(0, 65_000), 0);
  const s = buildSchedule(loan({ fees: { originationPct: 2, flatFees: 1500 } }));
  close(equivalentFactorRate(s.amountFinanced, s.totalPaid), 384_098.01 / 243_500, 1e-9, "factor on the default loan");
  close(equivalentFactorRate(s.amountFinanced, s.totalPaid), 1.5774, 0.0005, "factor rounded as the page prints it");
});

// ---------------------------------------------------------------------------
// The published copy must agree with the widget's own defaults
// ---------------------------------------------------------------------------

test("the defaults reproduce every figure quoted in the page copy", () => {
  const D = LOAN_AMORTIZATION_DEFAULTS;
  const s = buildSchedule({
    principal: D.principal,
    annualRatePct: D.annualRatePct,
    amortizationMonths: D.amortizationMonths,
    termMonths: D.termMonths,
    extraPayment: 0,
    fees: { originationPct: D.originationPct, flatFees: D.flatFees, guarantyFee: 0 },
  });
  assert.equal(s.scheduledPayment, 3200.82);
  assert.equal(s.finalPayment, 3200.43);
  assert.equal(s.amountFinanced, 243_500);
  assert.equal(s.totalInterest, 134_098.01);
  assert.equal(s.totalPaid, 384_098.01);
  assert.equal(s.totalCostOfCapital, 140_598.01);
  close(s.aprPct, 9.87, 0.005, "APR quoted in the intro and the worked example");
  // 62 basis points, the figure the doc comment and the worked example both use.
  close(s.aprPct - s.noteRatePct, 0.62, 0.005, "APR uplift quoted as 62 basis points");
});

test("the SBA default state reproduces the fee and the ceiling quoted in the copy", () => {
  const D = LOAN_AMORTIZATION_DEFAULTS;
  const fee = sbaGuarantyFee(D.sbaPrincipal, D.sbaTermMonths);
  assert.equal(fee.fee, 5625);
  assert.equal(fee.guaranteedPortion, 187_500);
  const ceiling = sbaMaxVariableRate(D.sbaPrincipal, D.primeRatePct);
  close(ceiling.maxRatePct, 12.75, 1e-9, "ceiling on a $250,000 loan at prime 6.75");
  close(D.primeRatePct + D.sbaSpreadPct, 9.5, 1e-9, "default SBA quote of prime plus 2.75");
});

test("the rate table published on the page is reproducible from the defaults", () => {
  // Rows are origination fee levels, columns are terms. Every cell is an APR on
  // a $250,000 loan at a 9.25 percent note rate.
  const expected: Record<number, Record<number, number>> = {
    0: { 36: 9.25, 60: 9.25, 84: 9.25, 120: 9.25 },
    1: { 36: 9.94, 60: 9.68, 84: 9.57, 120: 9.49 },
    2: { 36: 10.64, 60: 10.12, 84: 9.9, 120: 9.73 },
    3: { 36: 11.35, 60: 10.56, 84: 10.23, 120: 9.97 },
    5: { 36: 12.8, 60: 11.47, 84: 10.9, 120: 10.47 },
  };
  for (const feePct of [0, 1, 2, 3, 5]) {
    for (const months of [36, 60, 84, 120]) {
      const s = buildSchedule(
        loan({ amortizationMonths: months, termMonths: months, fees: { originationPct: feePct } }),
      );
      close(s.aprPct, expected[feePct]![months]!, 0.006, `rate table cell ${feePct}% over ${months} months`);
    }
  }
});
