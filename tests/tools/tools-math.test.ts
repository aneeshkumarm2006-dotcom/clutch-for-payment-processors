import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays,
  buildClosureSet,
  grossUp,
  impliedMonthlyLeaseRate,
  involuntaryChurn,
  mcaSchedule,
  payoutDate,
  reserveTimeline,
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
