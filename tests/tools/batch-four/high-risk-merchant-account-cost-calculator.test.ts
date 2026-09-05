import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountCost,
  compareHighRiskCost,
  disputeReductionSaving,
  premiumPaybackMonths,
  type AccountTerms,
  type BusinessProfile,
  type HighRiskCostInput,
} from "../../../lib/calc/high-risk";
import {
  HIGH_RISK_COST_LINES,
  HIGH_RISK_DEFAULTS,
  HIGH_RISK_INDUSTRIES,
} from "../../../lib/tools-data/high-risk";

/**
 * `/tools/high-risk-merchant-account-cost-calculator` publishes the number a
 * merchant takes into an underwriting call, and every failure mode in the model
 * is SILENT.
 *
 *   1. The reserve is neither a fee nor forgone deposit interest. Add the
 *      withheld cash to the cost and the answer is roughly three times too big.
 *      Price it at a savings rate instead of a borrowing rate and it is roughly
 *      twenty times too small. Both wrong answers look entirely reasonable on a
 *      page about expensive accounts.
 *   2. Annual lines divided into months and multiplied back do not come home. A
 *      $500 setup fee over twelve months is $41.666..., which rounds to $41.67
 *      and returns as $500.04.
 *   3. The premium only means anything if the BUSINESS is held constant across
 *      both sides. Same volume, same ticket, same transaction count, same
 *      chargeback count, different terms.
 *
 * Every expected value below is derived INDEPENDENTLY of the implementation:
 * written out here as literal arithmetic on round numbers, or from a closed form
 * worked separately. Nothing asserts "whatever the code returned".
 *
 * The default business is deliberately round: $150,000 a month at a $75 ticket
 * is exactly 2,000 transactions a month and exactly $1,800,000 a year, so every
 * figure in the page's worked example can be checked by hand.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

const D = HIGH_RISK_DEFAULTS;

const BUSINESS: BusinessProfile = {
  monthlyVolume: D.monthlyVolume,
  averageTicket: D.averageTicket,
  chargebackRatePct: D.chargebackRatePct,
};

const HIGH_RISK_TERMS: AccountTerms = {
  ratePct: D.hrRatePct,
  perTransaction: D.hrPerTransaction,
  gatewayPerTransaction: D.hrGatewayPerTransaction,
  monthlyFixed: D.hrMonthlyFixed,
  midCount: 1 + D.extraMids,
  setupFee: D.setupFee,
  setupAmortizeMonths: D.setupAmortizeMonths,
  annualRegistrationFees: D.annualRegistrationFees,
  specialtyVolumeBps: D.specialtyVolumeBps,
  specialtyPerTransaction: D.specialtyPerTransaction,
  specialtySharePct: D.specialtySharePct,
  chargebackFee: D.hrChargebackFee,
  alertsPerMonth: D.alertsPerMonth,
  alertCost: D.alertCost,
  monitoringMonthlyFee: D.monitoringMonthlyFee,
  reservePct: D.reservePct,
  reserveHoldMonths: D.reserveHoldMonths,
  borrowingRatePct: D.borrowingRatePct,
};

const STANDARD_TERMS: AccountTerms = {
  ratePct: D.stdRatePct,
  perTransaction: D.stdPerTransaction,
  gatewayPerTransaction: 0,
  monthlyFixed: D.stdMonthlyFixed,
  midCount: 1,
  setupFee: 0,
  setupAmortizeMonths: D.setupAmortizeMonths,
  annualRegistrationFees: 0,
  specialtyVolumeBps: 0,
  specialtyPerTransaction: 0,
  specialtySharePct: 0,
  chargebackFee: D.stdChargebackFee,
  alertsPerMonth: 0,
  alertCost: 0,
  monitoringMonthlyFee: 0,
  reservePct: 0,
  reserveHoldMonths: 0,
  borrowingRatePct: D.borrowingRatePct,
};

const INPUT: HighRiskCostInput = {
  ...BUSINESS,
  targetChargebackRatePct: D.targetChargebackRatePct,
  highRisk: HIGH_RISK_TERMS,
  standard: STANDARD_TERMS,
};

// ---------------------------------------------------------------------------
// 1. The high risk account, every line written out by hand
// ---------------------------------------------------------------------------

test("accountCost: the high risk default, each monthly line derived by hand", () => {
  const r = accountCost(BUSINESS, HIGH_RISK_TERMS);

  // $150,000 / $75 = 2,000 transactions. 1% of 2,000 = 20 chargebacks.
  assert.equal(r.transactionsPerMonth, 2000);
  assert.equal(r.chargebacksPerMonth, 20);

  // 3.95% of $150,000 = $5,925.00
  assert.equal(r.monthly.discount, 5925);
  // 2,000 x $0.25 = $500.00
  assert.equal(r.monthly.perTransaction, 500);
  // 2,000 x $0.10 = $200.00
  assert.equal(r.monthly.gatewayPerTransaction, 200);
  // $80 x 2 merchant accounts = $160.00
  assert.equal(r.monthly.fixedFees, 160);
  // 10 bps of $150,000 = $150.00, plus 2,000 x $0.02 = $40.00, so $190.00
  assert.equal(r.monthly.networkSpecialty, 190);
  // 20 x $25 = $500.00
  assert.equal(r.monthly.chargebackFees, 500);
  // 20 x $15 = $300.00
  assert.equal(r.monthly.alerts, 300);
  assert.equal(r.monthly.monitoring, 0);

  // 5925 + 500 + 200 + 160 + 190 + 500 + 300 = 7,775.00
  assert.equal(r.monthly.total, 7775);
});

test("accountCost: annual lines are added once, not rounded per month and multiplied back", () => {
  const r = accountCost(BUSINESS, HIGH_RISK_TERMS);

  // $1,950 x 2 accounts
  assert.equal(r.annualRegistrations, 3900);
  // $250 x 2 accounts, spread over 12 months, is the whole $500 inside a year
  assert.equal(r.annualSetupCharge, 500);

  // The bug this pins: 500 / 12 = 41.666..., which rounds to 41.67 and comes
  // back as 500.04 if the annual line is routed through a monthly figure.
  assert.equal(r.annualSetupCharge * 1, 500);

  // 7,775 x 12 = 93,300, plus 3,900, plus 500
  assert.equal(r.annualCashFees, 97700);
});

test("accountCost: the reserve is a carry cost on a locked balance, not a fee and not lost interest", () => {
  const r = accountCost(BUSINESS, HIGH_RISK_TERMS);

  // 10% of $150,000 withheld every month
  assert.equal(r.reserveWithheldPerMonth, 15000);
  // $15,000 x 6 months held = $90,000 permanently locked
  assert.equal(r.reserveSteadyStateLocked, 90000);
  // $90,000 at the 6.75% bank prime loan rate = $6,075.00 a year
  assert.equal(r.reserveAnnualCarryCost, 6075);

  // The two wrong answers, asserted as wrong so nobody quietly ships one:
  // adding the withheld cash itself would be $180,000 a year,
  assert.notEqual(r.reserveAnnualCarryCost, 15000 * 12);
  // and pricing it at a deposit rate near 0.30% would be about $270.
  assert.ok(r.reserveAnnualCarryCost > 20 * (90000 * 0.003), "reserve carry must dwarf a deposit rate figure");

  // 97,700 + 6,075
  assert.equal(r.totalAnnualCost, 103775);
});

test("accountCost: the effective rate is the total over the volume, both with and without the reserve", () => {
  const r = accountCost(BUSINESS, HIGH_RISK_TERMS);

  assert.equal(r.annualVolume, 1800000);
  // 103,775 / 1,800,000 = 0.05765277...
  close(r.effectiveRatePct, 5.7652777, 1e-6, "high risk effective rate");
  // 97,700 / 1,800,000 = 0.05427777...
  close(r.cashEffectiveRatePct, 5.4277777, 1e-6, "high risk cash-only effective rate");
  // 103,775 / 24,000 transactions
  close(r.costPerTransaction, 4.3239583, 1e-6, "cost per transaction");
});

// ---------------------------------------------------------------------------
// 2. The standard account, and the premium between them
// ---------------------------------------------------------------------------

test("accountCost: the standard account on the same business is exactly 3.50%", () => {
  const r = accountCost(BUSINESS, STANDARD_TERMS);

  // 2.9% of 150,000 = 4,350; 2,000 x 0.30 = 600; 20 x 15 = 300. Total 5,250.
  assert.equal(r.monthly.discount, 4350);
  assert.equal(r.monthly.perTransaction, 600);
  assert.equal(r.monthly.chargebackFees, 300);
  assert.equal(r.monthly.total, 5250);
  assert.equal(r.annualCashFees, 63000);
  assert.equal(r.reserveAnnualCarryCost, 0);
  // 63,000 / 1,800,000 is exactly 3.5%
  close(r.effectiveRatePct, 3.5, 1e-9, "standard effective rate");
});

test("compareHighRiskCost: the classification premium, derived independently", () => {
  const c = compareHighRiskCost(INPUT);

  // 103,775 - 63,000
  assert.equal(c.annualPremium, 40775);
  close(c.monthlyPremium, 40775 / 12, 1e-9, "monthly premium");
  // (5.7652777 - 3.5) percentage points, in basis points
  close(c.premiumBps, 226.5277777, 1e-5, "premium in basis points");
  // 40,775 over 24,000 transactions a year
  close(c.premiumPerTransaction, 1.6989583, 1e-6, "premium per transaction");
  // 6,075 of the 40,775 is the reserve carry
  close(c.reserveShareOfPremiumPct, 14.8988, 1e-3, "reserve share of the premium");
});

test("compareHighRiskCost: holds the business constant, so both sides see the same 20 chargebacks", () => {
  const c = compareHighRiskCost(INPUT);
  assert.equal(c.highRisk.transactionsPerMonth, c.standard.transactionsPerMonth);
  assert.equal(c.highRisk.chargebacksPerMonth, c.standard.chargebacksPerMonth);
  assert.equal(c.highRisk.chargebacksPerMonth, 20);
  // The chargeback FEE differs, because the terms differ. 20 x 25 against 20 x 15.
  assert.equal(c.highRisk.monthly.chargebackFees - c.standard.monthly.chargebackFees, 200);
});

test("compareHighRiskCost: a second merchant account duplicates the fixed lines and nothing else", () => {
  const c = compareHighRiskCost(INPUT);
  // 80 x 12 = 960 monthly fixed, plus 1,950 registrations, plus 250 setup
  assert.equal(c.extraMidAnnualCost, 3160);

  // And removing it moves the total by exactly that much.
  const oneMid = compareHighRiskCost({
    ...INPUT,
    highRisk: { ...HIGH_RISK_TERMS, midCount: 1 },
  });
  assert.equal(oneMid.extraMidAnnualCost, 0);
  close(c.highRisk.totalAnnualCost - oneMid.highRisk.totalAnnualCost, 3160, 1e-6, "cost of the second MID");
});

// ---------------------------------------------------------------------------
// 3. What lowering the dispute rate is actually worth
// ---------------------------------------------------------------------------

test("disputeReductionSaving: halving the dispute rate saves fees only, and closes under 12% of the premium", () => {
  const r = disputeReductionSaving(INPUT, 40775);

  // 20 chargebacks a month down to 10 is 120 avoided a year.
  assert.equal(r.chargebacksAvoidedPerYear, 120);
  // 10 x $25 x 12 = $3,000 of chargeback fees, plus 20 alerts halved,
  // 10 x $15 x 12 = $1,800 of alert fees. $4,800.
  close(r.annualFeeSaving, 4800, 1e-9, "annual fee saving");
  // 4,800 / 40,775
  close(r.shareOfPremiumPct, 11.7719, 1e-3, "share of the premium closed by fee savings");
  // The finding the page is built on: fees alone do not close the gap.
  assert.ok(r.shareOfPremiumPct < 15, "fee savings must not be presented as closing the premium");
});

test("disputeReductionSaving: a target above the current rate saves nothing rather than going negative", () => {
  const r = disputeReductionSaving({ ...INPUT, targetChargebackRatePct: 3 }, 40775);
  assert.equal(r.chargebacksAvoidedPerYear, 0);
  assert.equal(r.annualFeeSaving, 0);
  assert.equal(r.targetRatePct, 1);
});

test("premiumPaybackMonths: a one-time spend is priced in months of premium", () => {
  // The premium runs 40,775 / 12 = 3,397.9166 a month.
  close(premiumPaybackMonths(40775, 15000), 15000 / (40775 / 12), 1e-9, "payback on $15,000");
  close(premiumPaybackMonths(40775, 15000), 4.4145, 1e-3, "payback on $15,000, hand-checked");
  // No premium means no payback, reported as Infinity rather than as a number.
  assert.equal(premiumPaybackMonths(0, 15000), Number.POSITIVE_INFINITY);
});

// ---------------------------------------------------------------------------
// 4. Degenerate inputs must not produce confident nonsense
// ---------------------------------------------------------------------------

test("accountCost: a zero ticket produces zero transactions rather than Infinity", () => {
  const r = accountCost({ ...BUSINESS, averageTicket: 0 }, HIGH_RISK_TERMS);
  assert.equal(r.transactionsPerMonth, 0);
  assert.ok(Number.isFinite(r.monthly.total));
  assert.equal(r.costPerTransaction, 0);
});

test("accountCost: zero volume produces a zero effective rate rather than a division by zero", () => {
  const r = accountCost({ ...BUSINESS, monthlyVolume: 0 }, HIGH_RISK_TERMS);
  assert.equal(r.annualVolume, 0);
  assert.equal(r.effectiveRatePct, 0);
  assert.equal(r.cashEffectiveRatePct, 0);
});

test("accountCost: a zero hold period removes the reserve carry entirely", () => {
  const r = accountCost(BUSINESS, { ...HIGH_RISK_TERMS, reserveHoldMonths: 0 });
  assert.equal(r.reserveSteadyStateLocked, 0);
  assert.equal(r.reserveAnnualCarryCost, 0);
  assert.equal(r.totalAnnualCost, r.annualCashFees);
});

// ---------------------------------------------------------------------------
// 5. A second, independent scenario with different round numbers
// ---------------------------------------------------------------------------

test("accountCost: a $40,000 a month merchant at a $40 ticket, worked by hand", () => {
  const business: BusinessProfile = {
    monthlyVolume: 40000,
    averageTicket: 40,
    chargebackRatePct: 0.5,
  };
  const terms: AccountTerms = {
    ...HIGH_RISK_TERMS,
    ratePct: 4,
    perTransaction: 0.3,
    gatewayPerTransaction: 0,
    monthlyFixed: 100,
    midCount: 1,
    setupFee: 0,
    annualRegistrationFees: 950,
    specialtyVolumeBps: 0,
    specialtyPerTransaction: 0,
    specialtySharePct: 0,
    chargebackFee: 30,
    alertsPerMonth: 0,
    alertCost: 0,
    monitoringMonthlyFee: 0,
    reservePct: 5,
    reserveHoldMonths: 6,
    borrowingRatePct: 8,
  };

  const r = accountCost(business, terms);

  // 40,000 / 40 = 1,000 transactions. 0.5% of 1,000 = 5 chargebacks.
  assert.equal(r.transactionsPerMonth, 1000);
  assert.equal(r.chargebacksPerMonth, 5);
  // 4% of 40,000 = 1,600. 1,000 x 0.30 = 300. Fixed 100. 5 x 30 = 150.
  assert.equal(r.monthly.total, 1600 + 300 + 100 + 150);
  // 2,150 x 12 = 25,800, plus 950 of registration
  assert.equal(r.annualCashFees, 26750);
  // 5% of 40,000 = 2,000 a month, x 6 = 12,000 locked, at 8% = 960 a year
  assert.equal(r.reserveSteadyStateLocked, 12000);
  assert.equal(r.reserveAnnualCarryCost, 960);
  assert.equal(r.totalAnnualCost, 27710);
  // 27,710 / 480,000
  close(r.effectiveRatePct, 5.7729166, 1e-6, "second scenario effective rate");
});

// ---------------------------------------------------------------------------
// 6. The reference data
// ---------------------------------------------------------------------------

test("HIGH_RISK_COST_LINES: every row carries a shape, a range, a reason and a source", () => {
  assert.ok(HIGH_RISK_COST_LINES.length >= 12, "expected the full set of cost lines");
  const ids = new Set<string>();
  for (const line of HIGH_RISK_COST_LINES) {
    assert.ok(line.id.length > 0, "every line needs an id");
    assert.ok(!ids.has(line.id), `duplicate cost line id: ${line.id}`);
    ids.add(line.id);
    assert.ok(line.label.length > 0, `${line.id}: needs a label`);
    assert.ok(line.shape.length > 10, `${line.id}: needs a shape`);
    assert.ok(line.typicalRange.length > 5, `${line.id}: needs a range`);
    assert.ok(line.standardComparison.length > 0, `${line.id}: needs a standard comparison`);
    assert.ok(line.why.length > 80, `${line.id}: the reason must actually explain something`);
    assert.ok(/\d{4}/.test(line.source), `${line.id}: the source must carry a year`);
  }
});

test("HIGH_RISK_INDUSTRIES: every entry explains the mechanism and cites a dated source", () => {
  assert.ok(HIGH_RISK_INDUSTRIES.length >= 8, "expected a meaningful set of industries");
  const ids = new Set<string>();
  for (const row of HIGH_RISK_INDUSTRIES) {
    assert.ok(!ids.has(row.id), `duplicate industry id: ${row.id}`);
    ids.add(row.id);
    assert.ok(row.whyClassified.length > 80, `${row.id}: needs a real explanation`);
    assert.ok(/\d{4}/.test(row.source), `${row.id}: the source must carry a year`);
  }
});

test("HIGH_RISK_DEFAULTS: the defaults sit inside the ranges the cost lines publish", () => {
  // Discount rate: sources publish 3.00% to 6.00% and 3.49% to 3.95%.
  assert.ok(D.hrRatePct >= 3 && D.hrRatePct <= 6, "high risk rate outside every published range");
  // Per transaction: $0.10 to $0.50.
  assert.ok(D.hrPerTransaction >= 0.1 && D.hrPerTransaction <= 0.5, "per transaction fee out of range");
  // Chargeback fee: $15 to $35.
  assert.ok(D.hrChargebackFee >= 15 && D.hrChargebackFee <= 35, "chargeback fee out of range");
  // Alert cost: the published prices are $15 for RDR and CDRN, $29 for Ethoca.
  assert.ok(D.alertCost >= 15 && D.alertCost <= 29, "alert cost out of published range");
  // Reserve: 5% to 15%, held 90 to 180 days.
  assert.ok(D.reservePct >= 5 && D.reservePct <= 15, "reserve percentage out of range");
  assert.ok(D.reserveHoldMonths >= 3 && D.reserveHoldMonths <= 6, "reserve hold out of range");
  // Registration: Visa $950 plus Mastercard $1,000 from 1 May 2026.
  assert.equal(D.annualRegistrationFees, 950 + 1000);
  // Mastercard's published specialty fees.
  assert.equal(D.specialtyVolumeBps, 10);
  assert.equal(D.specialtyPerTransaction, 0.02);
  // The standard side is a published low risk flat rate.
  assert.equal(D.stdRatePct, 2.9);
  assert.equal(D.stdPerTransaction, 0.3);
  // The carry rate is a borrowing rate, not a deposit rate.
  assert.ok(D.borrowingRatePct > 3, "the carry rate must be a borrowing rate");
});
