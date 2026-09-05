import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays,
  buildClosureSet,
  compoundInterest,
  effectiveAnnualRate,
  grossUp,
  impliedMonthlyLeaseRate,
  involuntaryChurn,
  mcaSchedule,
  payoutDate,
  reserveTimeline,
  simpleInterest,
} from "../../lib/tools-math";
import {
  FED_HOLIDAYS,
  MCC_CODES,
  MCC_GROUPS,
  PAYOUT_PROFILES,
  SURCHARGE_STATES,
} from "../../lib/tools-data";

/**
 * The `/tools/*` calculators publish numbers merchants act on, and every failure
 * mode in this module is SILENT. A rate solver that converges on the wrong
 * branch does not throw, it returns a confident 25,200 percent. A churn rate
 * annualised by multiplying instead of compounding is off by two points and
 * looks entirely reasonable. A gross-up rounded the wrong way is one cent short,
 * which is only noticed by the one user who checks it against a statement.
 *
 * Every reference value below was computed independently of the implementation.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

// ---------------------------------------------------------------------------
// Gross-up
// ---------------------------------------------------------------------------

test("grossUp: $100 net at 2.9% + $0.30 needs a $103.30 charge and lands exactly on target", () => {
  const r = grossUp(100, 2.9, 0.3);
  assert.equal(r.gross, 103.3);
  assert.equal(r.fee, 3.3);
  assert.equal(r.net, 100);
});

test("grossUp: the naive 'just add the percentage' answer lands 38 cents short", () => {
  const r = grossUp(100, 2.9, 0.3);
  assert.equal(r.naive.gross, 102.9);
  assert.equal(r.naive.fee, 3.28);
  assert.equal(r.naive.net, 99.62);
  assert.equal(r.naive.shortfall, 0.38);
});

test("grossUp: never lands short, across a wide sweep of nets, rates and fixed fees", () => {
  for (const net of [1, 4.99, 12.5, 100, 137.77, 999.99, 25000]) {
    for (const rate of [0, 2.29, 2.6, 2.9, 3.49, 4.99]) {
      for (const fixed of [0, 0.05, 0.09, 0.15, 0.3, 0.49]) {
        const r = grossUp(net, rate, fixed);
        assert.ok(
          r.net >= net - 1e-9,
          `net ${net} at ${rate}% + ${fixed} landed at ${r.net}, which is short`,
        );
        // And never overshoots by more than a cent, or the bump loop is running away.
        assert.ok(r.net - net <= 0.01 + 1e-9, `net ${net} at ${rate}% + ${fixed} overshot to ${r.net}`);
      }
    }
  }
});

test("grossUp: a small ticket exposes the fixed fee, which is the whole point of showing an effective rate", () => {
  const r = grossUp(1, 2.9, 0.3);
  assert.equal(r.gross, 1.34);
  close(r.effectiveRate, 25.4, 0.6, "effective rate on a $1 net");
});

test("grossUp: an impossible rate returns zeros rather than Infinity", () => {
  const r = grossUp(100, 100, 0.3);
  assert.equal(r.gross, 0);
  assert.ok(Number.isFinite(r.effectiveRate));
});

// ---------------------------------------------------------------------------
// Merchant cash advance
// ---------------------------------------------------------------------------

const MCA_BASE = {
  advance: 50000,
  factorRate: 1.3,
  originationPct: 2.5,
  mode: "holdback" as const,
  holdbackPct: 10,
  monthlyVolume: 100000,
  fixedAmount: 0,
  fixedFrequency: "daily" as const,
};

test("mcaSchedule: the Federal Reserve's own illustration reproduces exactly", () => {
  const r = mcaSchedule(MCA_BASE);
  assert.equal(r.totalRepayment, 65000);
  assert.equal(r.originationFee, 1250);
  assert.equal(r.netReceived, 48750);
  close(r.dailyPayment, 476.19, 0.01, "daily payment");
  assert.equal(r.bankingDays, 137);
  assert.equal(r.calendarDays, 192);
  close(r.months, 6.52, 0.01, "months");
  close(r.apr, 111.19, 0.05, "APR");
});

test("mcaSchedule: the holdback sets the APR, not the factor rate", () => {
  // Identical dollars, three different prices. This is the page's central claim,
  // so it is asserted rather than merely written down.
  close(mcaSchedule({ ...MCA_BASE, holdbackPct: 20 }).apr, 221.07, 0.1, "APR at a 20% holdback");
  close(mcaSchedule({ ...MCA_BASE, holdbackPct: 5 }).apr, 55.76, 0.1, "APR at a 5% holdback");
  for (const holdbackPct of [5, 10, 20]) {
    assert.equal(mcaSchedule({ ...MCA_BASE, holdbackPct }).totalRepayment, 65000);
  }
});

test("mcaSchedule: stripping the origination fee lowers the APR to 100.90", () => {
  close(mcaSchedule({ ...MCA_BASE, originationPct: 0 }).apr, 100.9, 0.05, "APR with no fee");
});

test("mcaSchedule: the APR solver never returns the wrong-branch garbage value", () => {
  // The documented failure mode: an inverted bisection branch converges on r = 1
  // and reports about 25,200 percent. Nothing about it looks like an error.
  for (const holdbackPct of [3, 5, 8, 10, 15, 20, 25]) {
    for (const factorRate of [1.14, 1.2, 1.3, 1.4, 1.5]) {
      const { apr } = mcaSchedule({ ...MCA_BASE, holdbackPct, factorRate });
      assert.ok(apr > 0 && apr < 2000, `implausible APR ${apr} at holdback ${holdbackPct}, factor ${factorRate}`);
    }
  }
});

test("mcaSchedule: a fixed daily debit reports the holdback it really is", () => {
  const r = mcaSchedule({ ...MCA_BASE, mode: "fixed", fixedAmount: 476.19 });
  close(r.impliedHoldbackPct, 10, 0.01, "implied holdback");
  close(r.apr, 111.19, 0.1, "APR from an equivalent fixed debit");
});

test("mcaSchedule: zero card volume returns zeros rather than NaN", () => {
  const r = mcaSchedule({ ...MCA_BASE, monthlyVolume: 0 });
  assert.equal(r.apr, 0);
  assert.equal(r.bankingDays, 0);
  assert.ok(Number.isFinite(r.dailyPayment));
});

// ---------------------------------------------------------------------------
// Equipment leases
// ---------------------------------------------------------------------------

test("impliedMonthlyLeaseRate: reproduces the reference rates on a $299 terminal over 48 months", () => {
  const cases: [number, number][] = [
    [29.95, 9.9093],
    [39.95, 13.3283],
    [59, 19.729],
    [79, 26.4211],
    [99, 33.1103],
  ];
  for (const [payment, expected] of cases) {
    const i = impliedMonthlyLeaseRate(299, payment, 48);
    assert.ok(i !== null, `no rate found for a $${payment} payment`);
    close((i as number) * 100, expected, 0.01, `monthly rate at $${payment}`);
  }
});

test("impliedMonthlyLeaseRate: returns null when the payments never repay the price", () => {
  assert.equal(impliedMonthlyLeaseRate(299, 5, 48), null);
  assert.equal(impliedMonthlyLeaseRate(0, 59, 48), null);
  assert.equal(impliedMonthlyLeaseRate(299, 59, 0), null);
});

// ---------------------------------------------------------------------------
// Rolling reserve
// ---------------------------------------------------------------------------

test("reserveTimeline: the locked balance plateaus at volume x rate x hold months", () => {
  const { rows, withheldPerMonth, steadyStateLocked } = reserveTimeline({
    monthlyVolume: 100000,
    reservePct: 10,
    holdMonths: 6,
    startMonth: new Date(Date.UTC(2026, 8, 1)),
    months: 12,
  });
  assert.equal(withheldPerMonth, 10000);
  assert.equal(steadyStateLocked, 60000);
  assert.equal(rows[5]?.locked, 60000);
  assert.equal(rows[11]?.locked, 60000);
  // Nothing comes back until the hold period has run.
  assert.equal(rows[5]?.released, 0);
  assert.equal(rows[6]?.released, 10000);
  assert.equal(rows[6]?.firstRelease, true);
});

test("reserveTimeline: a zero month hold locks nothing up", () => {
  const { steadyStateLocked, rows } = reserveTimeline({
    monthlyVolume: 100000,
    reservePct: 10,
    holdMonths: 0,
    startMonth: new Date(Date.UTC(2026, 8, 1)),
    months: 6,
  });
  assert.equal(steadyStateLocked, 0);
  assert.ok(rows.every((r) => r.locked === 0));
});

test("reserveTimeline: winding down drains the balance to zero, hold months after the last batch", () => {
  const { rows } = reserveTimeline({
    monthlyVolume: 100000,
    reservePct: 10,
    holdMonths: 6,
    startMonth: new Date(Date.UTC(2026, 8, 1)),
    months: 18,
    stopAfterMonth: 6,
  });
  assert.equal(rows[5]?.locked, 60000);
  assert.equal(rows[11]?.locked, 0);
  assert.ok(rows.slice(6).every((r) => r.held === 0));
});

// ---------------------------------------------------------------------------
// Payout dates
// ---------------------------------------------------------------------------

test("buildClosureSet: weekend-dated holidays are dropped, never shifted", () => {
  const closures = buildClosureSet(FED_HOLIDAYS);
  // The Fed is OPEN the Friday before a Saturday holiday, so a Saturday-dated
  // entry must close nothing. Shifting it would skip a day that is not skipped.
  assert.equal(closures.has("2026-07-04"), false);
  assert.equal(closures.has("2026-07-03"), false);
  assert.equal(closures.has("2027-06-19"), false);
  assert.equal(closures.has("2027-12-25"), false);
  // A Sunday holiday is pre-resolved to its observed Monday in the data.
  assert.equal(closures.has("2027-07-05"), true);
  assert.equal(closures.size, 19);
});

test("addBusinessDays: skips weekends and Federal Reserve holidays", () => {
  const closures = buildClosureSet(FED_HOLIDAYS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  // Friday 2026-01-02 plus one business day is Monday the 5th.
  assert.equal(iso(addBusinessDays(new Date("2026-01-02T00:00:00Z"), 1, closures)), "2026-01-05");
  // n = 0 anchors forward off a weekend rather than returning the weekend day.
  assert.equal(iso(addBusinessDays(new Date("2026-01-03T00:00:00Z"), 0, closures)), "2026-01-05");
  // Thanksgiving 2026 falls on Thursday 26 November, so Wednesday plus one lands on the Friday.
  assert.equal(closures.has("2026-11-26"), true);
  assert.equal(iso(addBusinessDays(new Date("2026-11-25T00:00:00Z"), 1, closures)), "2026-11-27");
});

test("payoutDate: a Friday sale on a two business day schedule lands on the Tuesday", () => {
  const stripe = PAYOUT_PROFILES.find((p) => p.processorSlug === "stripe");
  assert.ok(stripe, "stripe payout profile missing");
  const r = payoutDate({
    profile: stripe,
    saleDate: "2026-09-04",
    saleTime: "14:00",
    speed: "standard",
    holidays: FED_HOLIDAYS,
  });
  assert.ok(r);
  assert.equal(r.settlement.toISOString().slice(0, 10), "2026-09-09");
  assert.ok(r.skipped.includes("a weekend"));
  assert.ok(r.skipped.some((s) => s.toLowerCase().includes("labor")));
});

test("payoutDate: an instant payout does not wait for a business day", () => {
  const stripe = PAYOUT_PROFILES.find((p) => p.processorSlug === "stripe");
  assert.ok(stripe);
  const r = payoutDate({
    profile: stripe,
    saleDate: "2026-09-05",
    saleTime: "14:00",
    speed: "instant",
    holidays: FED_HOLIDAYS,
  });
  assert.equal(r?.settlement.toISOString().slice(0, 10), "2026-09-05");
});

test("payoutDate: a sale after the cutoff rolls into the next day's batch", () => {
  const withCutoff = PAYOUT_PROFILES.find((p) => p.cutoff !== "none");
  assert.ok(withCutoff, "no processor in the data publishes a cutoff");
  const before = payoutDate({
    profile: withCutoff,
    saleDate: "2026-09-08",
    saleTime: "00:01",
    speed: "standard",
    holidays: FED_HOLIDAYS,
  });
  const after = payoutDate({
    profile: withCutoff,
    saleDate: "2026-09-08",
    saleTime: "23:59",
    speed: "standard",
    holidays: FED_HOLIDAYS,
  });
  assert.ok(before && after);
  assert.equal(before.missedCutoff, false);
  assert.equal(after.missedCutoff, true);
  assert.ok(after.settlement.getTime() > before.settlement.getTime());
});

test("payoutDate: an unparseable date returns null rather than an Invalid Date", () => {
  const p = PAYOUT_PROFILES[0];
  assert.ok(p);
  assert.equal(payoutDate({ profile: p, saleDate: "", saleTime: "12:00", speed: "standard", holidays: FED_HOLIDAYS }), null);
});

// ---------------------------------------------------------------------------
// Involuntary churn
// ---------------------------------------------------------------------------

test("involuntaryChurn: annualises by compounding, not by multiplying by twelve", () => {
  const r = involuntaryChurn({
    subscribers: 2500,
    arpu: 49,
    declineRatePct: 4,
    recoveryRatePct: 53,
    targetRecoveryPct: 71,
  });
  close(r.churnMonthly * 100, 1.88, 0.01, "monthly involuntary churn");
  close(r.churnAnnual * 100, 20.37, 0.02, "annualised involuntary churn");
  // The naive answer, which is what the competing calculators print.
  assert.notEqual(Number((r.churnAnnual * 100).toFixed(2)), 22.56);
  close(r.churnAtTargetMonthly * 100, 1.16, 0.01, "monthly churn at target");
  close(r.churnAtTargetAnnual * 100, 13.07, 0.02, "annualised churn at target");
});

test("involuntaryChurn: dollars line up with the rates", () => {
  const r = involuntaryChurn({
    subscribers: 2500,
    arpu: 49,
    declineRatePct: 4,
    recoveryRatePct: 53,
    targetRecoveryPct: 71,
  });
  assert.equal(r.mrr, 122500);
  close(r.monthlyAtRisk, 4900, 0.01, "monthly at risk");
  close(r.monthlyLost, 2303, 0.5, "monthly lost");
  close(r.monthlyUpside, 882, 0.5, "monthly upside at the target");
});

test("involuntaryChurn: a target below the current recovery rate shows no upside, not a negative one", () => {
  const r = involuntaryChurn({
    subscribers: 2500,
    arpu: 49,
    declineRatePct: 4,
    recoveryRatePct: 60,
    targetRecoveryPct: 40,
  });
  assert.equal(r.monthlyUpside, 0);
  assert.equal(r.annualUpside, 0);
  assert.equal(r.targetBelowCurrent, true);
});

test("involuntaryChurn: empty inputs collapse the dollars but keep the rates defined", () => {
  const r = involuntaryChurn({
    subscribers: 0,
    arpu: 0,
    declineRatePct: 4,
    recoveryRatePct: 53,
    targetRecoveryPct: 71,
  });
  assert.equal(r.mrr, 0);
  assert.equal(r.monthlyLost, 0);
  assert.ok(Number.isFinite(r.churnAnnual) && r.churnAnnual > 0);
});

// ---------------------------------------------------------------------------
// Dataset integrity
// ---------------------------------------------------------------------------

test("datasets: the holiday calendar has not expired", () => {
  // FED_HOLIDAYS is the one dataset with a shelf life. If the last entry is in
  // the past, the payout calculator is silently treating holidays as business
  // days, which is worse than refusing to answer.
  const last = FED_HOLIDAYS.map((h) => h.date).sort().at(-1);
  assert.ok(last, "no holidays in the dataset");
  assert.ok(last >= "2027-12-01", `holiday calendar ends at ${last}, extend it`);
});

test("datasets: every MCC is a real four digit code in a declared group", () => {
  assert.ok(MCC_CODES.length >= 250, `only ${MCC_CODES.length} MCCs`);
  const groups = new Set(MCC_GROUPS);
  const seen = new Set<string>();
  for (const c of MCC_CODES) {
    assert.match(c.code, /^\d{4}$/, `bad MCC code ${c.code}`);
    assert.ok(c.description.trim().length > 0, `MCC ${c.code} has no description`);
    assert.ok(groups.has(c.group), `MCC ${c.code} is in undeclared group ${c.group}`);
    assert.ok(!seen.has(c.code), `duplicate MCC ${c.code}`);
    seen.add(c.code);
  }
});

test("datasets: the surcharge table covers every state plus DC and Puerto Rico", () => {
  assert.equal(SURCHARGE_STATES.length, 52);
  const allowed = new Set(["Permitted", "Permitted with conditions", "Prohibited", "Unclear"]);
  for (const s of SURCHARGE_STATES) {
    assert.ok(allowed.has(s.status), `${s.state} has status ${s.status}`);
    assert.ok(s.detail.trim().length > 0, `${s.state} has no detail`);
    assert.ok(s.source.trim().length > 0, `${s.state} cites no source`);
  }
});

// ---------------------------------------------------------------------------
// Compound interest
// ---------------------------------------------------------------------------

/**
 * Reference values here come from closed forms worked out separately, not from
 * running the implementation and pasting what it said. Where a closed form and
 * this module could share a mistake, the check is anchored on something outside
 * both: Regulation DD's own published example, or an algebraic identity.
 */

test("effectiveAnnualRate: 100% compounded once a year is exactly 100%", () => {
  close(effectiveAnnualRate(100, 1), 1, 1e-12, "EAR at 100%/1");
});

test("effectiveAnnualRate: 12% compounded monthly is 1.01^12 - 1", () => {
  // 1.01^12 = 1.126825030131969, a standard value.
  close(effectiveAnnualRate(12, 12), 0.126825030131969, 1e-12, "EAR at 12%/12");
});

test("effectiveAnnualRate: continuous compounding is e^r - 1", () => {
  // e^0.05 = 1.0512710963760241
  close(effectiveAnnualRate(5, 0), 0.0512710963760241, 1e-12, "EAR at 5% continuous");
  // Continuous is the ceiling: no discrete schedule can beat it at the same nominal rate.
  for (const n of [1, 2, 4, 12, 365, 100000]) {
    assert.ok(
      effectiveAnnualRate(5, n) < effectiveAnnualRate(5, 0) + 1e-12,
      `continuous should dominate n=${n}`,
    );
  }
});

test("effectiveAnnualRate: more frequent compounding never lowers the yield", () => {
  let previous = -Infinity;
  for (const n of [1, 2, 4, 12, 52, 365]) {
    const ear = effectiveAnnualRate(7, n);
    assert.ok(ear > previous, `EAR should rise with frequency, broke at n=${n}`);
    previous = ear;
  }
});

test("compoundInterest: a lump sum with no contributions is P(1+r)^t", () => {
  // 1.05^10 = 1.628894626777442
  const r = compoundInterest({
    principal: 10000,
    annualRatePct: 5,
    years: 10,
    compoundsPerYear: 1,
    contribution: 0,
    contributionsPerYear: 0,
    contributeAtStart: false,
  });
  close(r.finalValue, 16288.94626777442, 1e-6, "lump sum at 5% for 10 years");
  close(r.totalReturns, 6288.94626777442, 1e-6, "interest on the lump sum");
  assert.equal(r.totalContributions, 0);
});

test("compoundInterest: matches the ordinary annuity closed form when the frequencies agree", () => {
  // i = 0.05/12, n = 120. (1+i)^120 = 1.6470094976902801.
  // Lump:      10,000 x 1.6470094976902801        = 16,470.094976902801
  // Annuity:   250 x ((1+i)^120 - 1)/i            = 38,820.569941567...
  const r = compoundInterest({
    principal: 10000,
    annualRatePct: 5,
    years: 10,
    compoundsPerYear: 12,
    contribution: 250,
    contributionsPerYear: 12,
    contributeAtStart: false,
  });
  const i = 0.05 / 12;
  const growth = Math.pow(1 + i, 120);
  const expected = 10000 * growth + 250 * ((growth - 1) / i);
  close(r.finalValue, expected, 1e-6, "lump plus ordinary annuity");
  close(r.finalValue, 55290.66, 0.005, "the figure published on the page");
  assert.equal(r.totalContributions, 30000);
});

test("compoundInterest: an annuity due beats an ordinary annuity by exactly one period of interest", () => {
  const base = {
    principal: 10000,
    annualRatePct: 5,
    years: 10,
    compoundsPerYear: 12,
    contribution: 250,
    contributionsPerYear: 12,
  };
  const ordinary = compoundInterest({ ...base, contributeAtStart: false });
  const due = compoundInterest({ ...base, contributeAtStart: true });
  // Only the annuity part is affected, and it is scaled by (1 + i).
  const i = 0.05 / 12;
  const annuity = 250 * ((Math.pow(1 + i, 120) - 1) / i);
  close(due.finalValue - ordinary.finalValue, annuity * i, 1e-6, "annuity due premium");
  close(due.finalValue - ordinary.finalValue, 161.75, 0.005, "the figure published on the page");
});

test("compoundInterest: the simple-interest twin is the hand-computed arithmetic series", () => {
  // Simple interest never compounds, so:
  //   the opening 10,000 earns 10,000 x 0.05 x 10                       = 5,000.00
  //   deposit k of 120 (end of month) earns for (120-k) months:
  //     250 x (0.05/12) x sum(120-k, k=1..120) = 250 x (0.05/12) x 7,140 = 7,437.50
  const r = compoundInterest({
    principal: 10000,
    annualRatePct: 5,
    years: 10,
    compoundsPerYear: 12,
    contribution: 250,
    contributionsPerYear: 12,
    contributeAtStart: false,
  });
  close(r.simpleFinalValue, 10000 + 30000 + 5000 + 7437.5, 1e-6, "simple-interest twin");
  close(r.simpleFinalValue, 52437.5, 0.005, "the figure published on the page");
  close(r.compoundingPremium, r.finalValue - r.simpleFinalValue, 1e-9, "premium is the difference");
  close(r.compoundingPremium, 2853.16, 0.01, "the figure published on the page");
  // The premium must always be a MINORITY of the interest at these horizons. If a
  // future change makes total interest look like the compounding effect, this fails.
  assert.ok(r.compoundingPremium < r.totalReturns * 0.5, "premium should be a minority of interest");
});

test("compoundInterest: compounding never loses to simple interest at a positive rate", () => {
  for (const rate of [0.38, 1.71, 5, 9, 25]) {
    for (const n of [1, 12, 365, 0]) {
      const r = compoundInterest({
        principal: 5000,
        annualRatePct: rate,
        years: 15,
        compoundsPerYear: n,
        contribution: 100,
        contributionsPerYear: 12,
        contributeAtStart: false,
      });
      assert.ok(
        r.compoundingPremium >= -1e-9,
        `compounding fell behind simple at ${rate}% n=${n}: ${r.compoundingPremium}`,
      );
    }
  }
});

test("compoundInterest: the year-by-year schedule reconciles to the headline", () => {
  const r = compoundInterest({
    principal: 7500,
    annualRatePct: 6.25,
    years: 12,
    compoundsPerYear: 365,
    contribution: 400,
    contributionsPerYear: 4,
    contributeAtStart: true,
  });
  assert.equal(r.schedule.length, 12);
  const paidIn = r.schedule.reduce((a, y) => a + y.contributions, 0);
  const interest = r.schedule.reduce((a, y) => a + y.interest, 0);
  close(paidIn, r.totalContributions, 1e-6, "schedule contributions");
  close(interest, r.totalReturns, 1e-6, "schedule interest");
  close(r.schedule[r.schedule.length - 1]!.endBalance, r.finalValue, 1e-6, "final row");
  close(r.schedule[0]!.startBalance, 7500, 1e-9, "first row opens at the principal");
  // Each row must chain into the next.
  for (let k = 1; k < r.schedule.length; k += 1) {
    close(r.schedule[k]!.startBalance, r.schedule[k - 1]!.endBalance, 1e-6, `row ${k} chains`);
  }
});

test("compoundInterest: a zero rate returns the deposits and nothing else", () => {
  const r = compoundInterest({
    principal: 1000,
    annualRatePct: 0,
    years: 10,
    compoundsPerYear: 12,
    contribution: 50,
    contributionsPerYear: 12,
    contributeAtStart: false,
  });
  close(r.finalValue, 1000 + 6000, 1e-9, "zero rate final value");
  close(r.totalReturns, 0, 1e-9, "zero rate interest");
  close(r.compoundingPremium, 0, 1e-9, "zero rate premium");
  assert.equal(r.doublingYears, Number.POSITIVE_INFINITY);
  assert.equal(r.ruleOf72Years, Number.POSITIVE_INFINITY);
});

test("doubling time: the Rule of 72 crosses over at 8%, overstating below and understating above", () => {
  const exact = (ratePct: number) => Math.log(2) / Math.log(1 + ratePct / 100);
  for (const rate of [1, 2, 4, 6]) {
    const r = compoundInterest({
      principal: 1000,
      annualRatePct: rate,
      years: 1,
      compoundsPerYear: 1,
      contribution: 0,
      contributionsPerYear: 0,
      contributeAtStart: false,
    });
    close(r.doublingYears, exact(rate), 1e-9, `exact doubling at ${rate}%`);
    assert.ok(r.ruleOf72Years > r.doublingYears, `72 should overstate below 8%, failed at ${rate}%`);
  }
  for (const rate of [10, 12, 15, 20]) {
    const r = compoundInterest({
      principal: 1000,
      annualRatePct: rate,
      years: 1,
      compoundsPerYear: 1,
      contribution: 0,
      contributionsPerYear: 0,
      contributeAtStart: false,
    });
    assert.ok(r.ruleOf72Years < r.doublingYears, `72 should understate above 8%, failed at ${rate}%`);
  }
  // At 8% the shortcut is effectively exact: ln(2)/ln(1.08) = 9.006468...
  const at8 = compoundInterest({
    principal: 1000,
    annualRatePct: 8,
    years: 1,
    compoundsPerYear: 1,
    contribution: 0,
    contributionsPerYear: 0,
    contributeAtStart: false,
  });
  close(at8.doublingYears, 9.006468342000588, 1e-9, "exact doubling at 8%");
  assert.ok(Math.abs(at8.ruleOf72Years - at8.doublingYears) < 0.01, "72 is within a week at 8%");
});

test("doubling time: contributions must not shorten it", () => {
  const without = compoundInterest({
    principal: 10000,
    annualRatePct: 5,
    years: 10,
    compoundsPerYear: 12,
    contribution: 0,
    contributionsPerYear: 0,
    contributeAtStart: false,
  });
  const heavy = compoundInterest({
    principal: 10000,
    annualRatePct: 5,
    years: 10,
    compoundsPerYear: 12,
    contribution: 5000,
    contributionsPerYear: 12,
    contributeAtStart: false,
  });
  // A doubling time that quietly counts fresh deposits is a savings plan, not
  // growth, and is how a calculator ends up claiming a savings account doubles
  // money in four years.
  close(heavy.doublingYears, without.doublingYears, 1e-12, "doubling ignores contributions");
});

// ---------------------------------------------------------------------------
// Simple interest
// ---------------------------------------------------------------------------

test("simpleInterest: I = P x r x t on an Actual/365 basis", () => {
  const r = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 180, termUnit: "days", dayBasis: 365 });
  close(r.interest, 25000 * 0.09 * (180 / 365), 1e-9, "180 day interest");
  close(r.interest, 1109.589041, 1e-5, "180 day interest, stated");
  close(r.total, 26109.589041, 1e-5, "180 day total");
  close(r.perDay, 25000 * 0.09 / 365, 1e-9, "daily accrual");
  close(r.effectiveRatePct, 9, 1e-12, "Actual/365 does not change the rate");
});

test("simpleInterest: Actual/360 charges 365/360 of the quoted rate", () => {
  // The canonical demonstration: a full year of days on a 360 day basis.
  const r = simpleInterest({ principal: 100000, annualRatePct: 8, termValue: 365, termUnit: "days", dayBasis: 360 });
  close(r.interest, 100000 * 0.08 * (365 / 360), 1e-9, "365 days on a 360 basis");
  close(r.interest, 8111.111111, 1e-5, "8,111.11 rather than 8,000.00");
  close(r.effectiveRatePct, 8 * (365 / 360), 1e-12, "effective rate");
  close(r.effectiveRatePct, 8.111111, 1e-5, "8.111% rather than 8%");

  const at365 = simpleInterest({ principal: 100000, annualRatePct: 8, termValue: 365, termUnit: "days", dayBasis: 365 });
  close(r.interest - at365.interest, 111.111111, 1e-5, "the convention's annual cost on $100,000");
});

test("simpleInterest: the day basis only applies when days are actually counted", () => {
  const months365 = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 6, termUnit: "months", dayBasis: 365 });
  const months360 = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 6, termUnit: "months", dayBasis: 360 });
  assert.equal(months365.interest, months360.interest);
  close(months365.interest, 25000 * 0.09 * 0.5, 1e-9, "six months is half a year either way");
  close(months365.effectiveRatePct, 9, 1e-12, "no day count, no adjustment");

  const years365 = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 3, termUnit: "years", dayBasis: 365 });
  const years360 = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 3, termUnit: "years", dayBasis: 360 });
  assert.equal(years365.interest, years360.interest);
  close(years365.interest, 6750, 1e-9, "three years at 9% on 25,000");
});

test("simpleInterest: reproduces Regulation DD's own published APY example", () => {
  // Appendix A to 12 CFR Part 1030 states that $30.37 of interest on a $1,000
  // six month certificate over a 182 day period is an annual percentage yield of
  // 6.18%. This is the strongest reference available: it is outside both this
  // module and the closed form it implements.
  const impliedRate = (30.37 / (1000 * (182 / 365))) * 100;
  const r = simpleInterest({
    principal: 1000,
    annualRatePct: impliedRate,
    termValue: 182,
    termUnit: "days",
    dayBasis: 365,
  });
  close(r.interest, 30.37, 1e-9, "the regulation's interest figure");
  assert.equal(r.apy.toFixed(2), "6.18", `expected the regulation's 6.18%, got ${r.apy.toFixed(4)}`);
});

test("simpleInterest: APY equals the stated rate at exactly one year, and only there", () => {
  const oneYear = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 365, termUnit: "days", dayBasis: 365 });
  close(oneYear.apy, 9, 1e-9, "APY at 365 days");

  const short = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 180, termUnit: "days", dayBasis: 365 });
  assert.ok(short.apy > 9, `APY should exceed the rate under a year, got ${short.apy}`);

  const long = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 3, termUnit: "years", dayBasis: 365 });
  assert.ok(long.apy < 9, `APY should fall below the rate over a year, got ${long.apy}`);
  close(long.apy, 8.2932, 0.0001, "three year APY, stated on the page");
});

test("simpleInterest: the APY exponent uses actual days even when accrual used 360", () => {
  // The accrual convention decides how many dollars were earned. The APY formula
  // then annualises those dollars over REAL elapsed time. Putting 360 in the
  // exponent would count the convention twice.
  const r = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 180, termUnit: "days", dayBasis: 360 });
  const expected = (Math.pow(1 + r.interest / 25000, 365 / 180) - 1) * 100;
  close(r.apy, expected, 1e-9, "APY annualises over 365 days, not 360");
});

test("simpleInterest: the gap against compounding is negligible short and material long", () => {
  const p = { principal: 25000, annualRatePct: 9, dayBasis: 365 } as const;
  const thirty = simpleInterest({ ...p, termValue: 30, termUnit: "days" });
  // Under one compounding period, simple interest is marginally AHEAD.
  assert.ok(thirty.compoundingGap < 0, "compounding should trail over 30 days");
  assert.ok(Math.abs(thirty.compoundingGap) < 0.05, "and by less than a nickel");

  const year = simpleInterest({ ...p, termValue: 365, termUnit: "days" });
  close(year.compoundingGap, 95.17, 0.01, "one year gap");

  const three = simpleInterest({ ...p, termValue: 3, termUnit: "years" });
  close(three.compoundingGap, 966.13, 0.01, "three year gap");
  assert.ok(three.compoundingGap > year.compoundingGap * 5, "the gap grows faster than the term");
});

test("simpleInterest: degenerate inputs do not produce a number", () => {
  const noPrincipal = simpleInterest({ principal: 0, annualRatePct: 9, termValue: 180, termUnit: "days", dayBasis: 365 });
  assert.equal(noPrincipal.interest, 0);
  assert.equal(noPrincipal.apy, 0);

  const noTerm = simpleInterest({ principal: 25000, annualRatePct: 9, termValue: 0, termUnit: "days", dayBasis: 365 });
  assert.equal(noTerm.interest, 0);
  assert.equal(noTerm.perDay, 0);
  assert.equal(noTerm.apy, 0);

  const noRate = simpleInterest({ principal: 25000, annualRatePct: 0, termValue: 180, termUnit: "days", dayBasis: 365 });
  assert.equal(noRate.interest, 0);
  assert.equal(noRate.total, 25000);
  assert.equal(noRate.apy, 0);
});
