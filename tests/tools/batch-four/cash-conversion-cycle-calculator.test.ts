import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CASH_CYCLE_DEFAULTS,
  balanceFor,
  cashConversionCycle,
  cashCycle,
  countbackDso,
  cycleRatios,
  daysInventoryOutstanding,
  daysPayableOutstanding,
  daysSalesOutstanding,
  purchasesFor,
  settlementImpact,
  workingCapitalImpact,
  type CycleInputs,
} from "../../../lib/calc/cash-cycle";

/**
 * Every expected value below was derived on paper from the stated inputs, from
 * the published closed form, or from a deliberately trivial case whose answer is
 * known before the module is consulted. A test that asserts whatever the code
 * happened to return would pin a bug in place rather than catch it, and every
 * failure mode in this module is silent.
 *
 * The failure modes being pinned:
 *
 *   1. THE WRONG DENOMINATOR ON A DAY. A day of DSO is a day of CREDIT SALES; a
 *      day of DIO or DPO is a day of COST OF GOODS SOLD. At a 40 percent gross
 *      margin, valuing all three at sales overstates the last two by exactly
 *      66.67 percent. Both the correct figure and the ratio between the two
 *      denominators are asserted, so a regression to a single denominator cannot
 *      pass.
 *   2. THE SIGN ON DPO. DSO and DIO improve by going DOWN, DPO improves by going
 *      UP. A uniform signed "change in days" gets payables backwards and reports
 *      cash released when the business paid its suppliers sooner. Asserted by
 *      requiring all three positive inputs to release positive cash.
 *   3. THE BALANCE CONVENTION SILENTLY SWITCHING. Average and ending are both
 *      defensible and they do not agree. Both are computed from the defaults by
 *      hand here, and the 3.0416666 day spread between them is asserted directly.
 *   4. THE COUNTBACK RETIRING THE WRONG MONTHS. Month order is load bearing and
 *      reversing it does not throw. The reversed answer is asserted to be a
 *      different, specific, hand computed number.
 *   5. THE COUNTBACK QUIETLY EXTRAPOLATING. A balance that outruns the supplied
 *      window can only be extrapolated. The flag and the extrapolated tail are
 *      both asserted so the widget cannot present one as a measurement.
 *   6. RESERVE DRAG BEING TREATED AS A ONE OFF. A reserve of r percent released
 *      after h days holds r x h days of card revenue at STEADY STATE, which is
 *      an entirely different quantity from one payout cycle. Asserted against
 *      the identity.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

const D = CASH_CYCLE_DEFAULTS;

/** The default state, in the shape `cashCycle` takes. Mirrors the widget exactly. */
const defaultInputs: CycleInputs = {
  creditSales: D.creditSales,
  cogs: D.cogs,
  receivables: { opening: D.arOpening, ending: D.arEnding },
  inventory: { opening: D.invOpening, ending: D.invEnding },
  payables: { opening: D.apOpening, ending: D.apEnding },
  daysInPeriod: D.daysInPeriod,
  convention: D.convention,
  borrowingRatePct: D.borrowingRatePct,
  improvementDays: D.improvementDays,
};

// ---------------------------------------------------------------------------
// The three ratios, on numbers chosen so the answer is obvious without a machine
// ---------------------------------------------------------------------------

test("daysSalesOutstanding: receivables that are a tenth of annual credit sales are 36.5 days", () => {
  // 100,000 / 1,000,000 = 0.1 of a year. A tenth of 365 is 36.5. No calculator needed.
  close(daysSalesOutstanding(100_000, 1_000_000, 365), 36.5, 1e-9, "DSO");
  // A quarter, same balance, same run rate: 250,000 of sales in 91 days.
  close(daysSalesOutstanding(100_000, 250_000, 91), 36.4, 1e-9, "DSO, quarterly");
});

test("daysInventoryOutstanding and daysPayableOutstanding run on cost of goods sold, not sales", () => {
  // 90,000 / 720,000 = 0.125 of a year. An eighth of 365 is 45.625.
  close(daysInventoryOutstanding(90_000, 720_000, 365), 45.625, 1e-9, "DIO");
  close(daysPayableOutstanding(90_000, 720_000, 365), 45.625, 1e-9, "DPO");
  // The trap: the same balance measured against a 40 percent margin revenue line
  // of 1,200,000 gives 27.375 days, which is 0.6x the true figure and looks fine.
  close(daysInventoryOutstanding(90_000, 1_200_000, 365), 27.375, 1e-9, "DIO on revenue");
});

test("cashConversionCycle is the plain sum and is allowed to be negative", () => {
  close(cashConversionCycle(36.5, 45.625, 45.625), 36.5, 1e-9, "CCC");
  // A supermarket: five days of receivables, twenty of stock, sixty of payables.
  close(cashConversionCycle(5, 20, 60), -35, 1e-9, "negative CCC");
});

test("purchasesFor adds the inventory build to cost of goods sold, and DPO on purchases is lower", () => {
  // 1,440,000 + (240,000 - 220,000) = 1,460,000.
  assert.equal(purchasesFor({ cogs: D.cogs, inventory: { opening: D.invOpening, ending: D.invEnding } }), 1_460_000);
  // 180,000 / 1,460,000 x 365. 1,460,000 / 365 = 4,000 a day, so 180,000 / 4,000 = 45 days exactly.
  close(daysPayableOutstanding(180_000, 1_460_000, 365), 45, 1e-9, "DPO on purchases");
});

// ---------------------------------------------------------------------------
// The two conventions
// ---------------------------------------------------------------------------

test("balanceFor picks the closing balance under 'ending' and the midpoint under 'average'", () => {
  assert.equal(balanceFor({ opening: 260_000, ending: 300_000 }, "ending"), 300_000);
  assert.equal(balanceFor({ opening: 260_000, ending: 300_000 }, "average"), 280_000);
});

test("average and ending conventions disagree by 3.0416666 days on the default figures", () => {
  // Hand derivation, average convention:
  //   AR  (260,000 + 300,000) / 2 = 280,000; 280,000 / 2,400,000 x 365 = 42.5833333
  //   INV (220,000 + 240,000) / 2 = 230,000; 230,000 / 1,440,000 x 365 = 58.2986111
  //   AP  (170,000 + 190,000) / 2 = 180,000; 180,000 / 1,440,000 x 365 = 45.625
  //   CCC = 42.5833333 + 58.2986111 - 45.625                            = 55.2569444
  const avg = cycleRatios(defaultInputs, "average");
  close(avg.dso, 42.5833333, 1e-6, "average DSO");
  close(avg.dio, 58.2986111, 1e-6, "average DIO");
  close(avg.dpo, 45.625, 1e-9, "average DPO");
  close(avg.ccc, 55.2569444, 1e-6, "average CCC");
  assert.equal(avg.workingCapitalInvested, 330_000); // 280 + 230 - 180

  // Hand derivation, ending convention:
  //   AR  300,000 / 2,400,000 x 365 = 45.625
  //   INV 240,000 / 1,440,000 x 365 = 60.8333333
  //   AP  190,000 / 1,440,000 x 365 = 48.1597222
  //   CCC = 45.625 + 60.8333333 - 48.1597222 = 58.2986111
  const end = cycleRatios(defaultInputs, "ending");
  close(end.dso, 45.625, 1e-9, "ending DSO");
  close(end.dio, 60.8333333, 1e-6, "ending DIO");
  close(end.dpo, 48.1597222, 1e-6, "ending DPO");
  close(end.ccc, 58.2986111, 1e-6, "ending CCC");
  assert.equal(end.workingCapitalInvested, 350_000); // 300 + 240 - 190

  // The spread the page publishes. 58.2986111 - 55.2569444 = 3.0416666.
  const full = cashCycle(defaultInputs);
  close(full.conventionGapDays, 3.0416666, 1e-6, "convention gap");
  // And the convention actually selected is the one returned as `chosen`.
  assert.equal(full.chosen.convention, "average");
  close(full.chosen.ccc, full.average.ccc, 1e-12, "chosen follows the input convention");
});

test("the financing carry is simple interest on the chosen convention's working capital", () => {
  const full = cashCycle(defaultInputs);
  // 330,000 x 6.75% = 22,275. Divided across 365 days = 61.0273..., rounded to 61.03.
  assert.equal(full.annualFinancingCost, 22_275);
  assert.equal(full.dailyFinancingCost, 61.03);
  // Switching convention must move the carry, because it moves the balance:
  // 350,000 x 6.75% = 23,625.
  assert.equal(cashCycle({ ...defaultInputs, convention: "ending" }).annualFinancingCost, 23_625);
});

// ---------------------------------------------------------------------------
// Days into dollars: the denominators and the signs
// ---------------------------------------------------------------------------

test("a day of DSO is a day of credit sales; a day of DIO or DPO is a day of cost of goods sold", () => {
  const impact = workingCapitalImpact({
    creditSales: 2_400_000,
    cogs: 1_440_000,
    daysInPeriod: 365,
    dsoDaysImproved: 1,
    dioDaysImproved: 1,
    dpoDaysImproved: 1,
    borrowingRatePct: 6.75,
  });
  // 2,400,000 / 365 = 6,575.3424..., snapped to the cent.
  assert.equal(impact.dsoCash, 6575.34);
  // 1,440,000 / 365 = 3,945.2054..., snapped to the cent.
  assert.equal(impact.dioCash, 3945.21);
  assert.equal(impact.dpoCash, 3945.21);
  // The identity that catches a single-denominator regression: cost of goods
  // sold is 60 percent of credit sales here, so a cost day must be 0.6 of a
  // sales day. 6,575.34 x 0.6 = 3,945.204.
  close(impact.dioCash / impact.dsoCash, 0.6, 1e-4, "cost day against sales day");
  // All three improvements release cash. If DPO had the sign flipped, this total
  // would come out at 6,575.34 + 3,945.21 - 3,945.21 = 6,575.34 instead.
  // The total is rounded ONCE from the exact sum rather than being the sum of
  // the rounded parts: 6,575.3424 + 3,945.2054 + 3,945.2054 = 14,465.7534, which
  // snaps to 14,465.75 and not to the 14,465.76 the displayed lines add up to.
  assert.equal(impact.totalCash, 14_465.75);
  assert.equal(impact.cccDaysImproved, 3);
});

test("five days off every component releases $72,328.77 and saves $4,882.19 a year", () => {
  // Hand derivation: 5 x 6,575.3424 = 32,876.712 -> 32,876.71
  //                  5 x 3,945.2054 = 19,726.027 -> 19,726.03, twice
  //                  total 32,876.71 + 19,726.03 + 19,726.03 = 72,328.77
  //                  carry 72,328.767 x 0.0675 = 4,882.192 -> 4,882.19
  const full = cashCycle(defaultInputs);
  assert.equal(full.improvement.dsoCash, 32_876.71);
  assert.equal(full.improvement.dioCash, 19_726.03);
  assert.equal(full.improvement.dpoCash, 19_726.03);
  assert.equal(full.improvement.totalCash, 72_328.77);
  assert.equal(full.improvement.totalFinancing, 4882.19);
});

// ---------------------------------------------------------------------------
// Countback DSO
// ---------------------------------------------------------------------------

test("countbackDso retires the balance newest first and reports 58.9 days on falling sales", () => {
  // Hand derivation. Balance 300,000.
  //   Month 1: 120,000 of sales, 31 days. 300,000 > 120,000, so the whole month
  //            counts: 31 days, 180,000 left.
  //   Month 2: 200,000 of sales, 31 days. 180,000 < 200,000, so 180/200 = 0.9 of
  //            the month: 0.9 x 31 = 27.9 days, 0 left.
  //   Countback = 31 + 27.9 = 58.9 days.
  // Simple formula over the same window: window sales 120 + 200 + 260 = 580,000
  // across 31 + 31 + 30 = 92 days. 300,000 / 580,000 x 92 = 47.5862069.
  const r = countbackDso({
    receivables: D.countbackReceivables,
    months: [
      { creditSales: D.month1Sales, days: D.month1Days },
      { creditSales: D.month2Sales, days: D.month2Days },
      { creditSales: D.month3Sales, days: D.month3Days },
    ],
  });
  close(r.countbackDso, 58.9, 1e-9, "countback DSO");
  close(r.simpleDso, 47.5862069, 1e-6, "simple DSO");
  close(r.gapDays, 11.3137931, 1e-6, "gap");
  // Valued at the window's own daily sales rate: 580,000 / 92 = 6,304.3478 a day,
  // x 11.3137931 = 71,326.086 -> 71,326.09.
  assert.equal(r.gapCash, 71_326.09);
  assert.equal(r.exhausted, false);
  assert.equal(r.unexplained, 0);
  assert.equal(r.months[0]!.daysCounted, 31);
  close(r.months[1]!.daysCounted, 27.9, 1e-9, "partial month days");
  assert.equal(r.months[2]!.daysCounted, 0);
});

test("countbackDso: month order is load bearing and reversing it returns a different number", () => {
  // Same balance, same three months, entered oldest first. Now the 260,000 month
  // is retired first: 300,000 > 260,000, so 30 whole days, 40,000 left. Then
  // 40,000 / 200,000 = 0.2 of a 31 day month = 6.2 days. Total 36.2 days.
  const reversed = countbackDso({
    receivables: 300_000,
    months: [
      { creditSales: 260_000, days: 30 },
      { creditSales: 200_000, days: 31 },
      { creditSales: 120_000, days: 31 },
    ],
  });
  close(reversed.countbackDso, 36.2, 1e-9, "reversed countback");
  // The simple formula cannot tell the difference, which is the point.
  close(reversed.simpleDso, 47.5862069, 1e-6, "simple DSO is order blind");
});

test("countbackDso flags a balance that outruns the supplied window and extrapolates the tail", () => {
  // Balance 700,000 against 580,000 of sales in the window. Every month is
  // consumed whole: 92 days, with 120,000 unexplained. The tail can only be
  // extrapolated at the window's own rate, 580,000 / 92 = 6,304.3478 a day,
  // so 120,000 / 6,304.3478 = 19.0345 days, for 111.0345 in total.
  const r = countbackDso({
    receivables: 700_000,
    months: [
      { creditSales: 120_000, days: 31 },
      { creditSales: 200_000, days: 31 },
      { creditSales: 260_000, days: 30 },
    ],
  });
  assert.equal(r.exhausted, true);
  assert.equal(r.unexplained, 120_000);
  close(r.countbackDso, 111.0344828, 1e-6, "extrapolated countback");
});

test("countbackDso: on level sales the countback and the simple formula agree", () => {
  // Three identical 30 day months of 90,000, and a balance of 135,000.
  //   Countback: 90,000 consumes month one whole (30 days), 45,000 left, which
  //   is half of month two: 15 days. Total 45 days.
  //   Simple: 135,000 / 270,000 x 90 = 45 days.
  // If they ever disagree on a flat series, the countback has a bug in it.
  const r = countbackDso({
    receivables: 135_000,
    months: [
      { creditSales: 90_000, days: 30 },
      { creditSales: 90_000, days: 30 },
      { creditSales: 90_000, days: 30 },
    ],
  });
  close(r.countbackDso, 45, 1e-9, "flat countback");
  close(r.simpleDso, 45, 1e-9, "flat simple");
  close(r.gapDays, 0, 1e-9, "no gap on flat sales");
});

// ---------------------------------------------------------------------------
// The payments half
// ---------------------------------------------------------------------------

test("settlementImpact: a five to two day payout returns three days of card revenue", () => {
  // Card revenue 2,400,000 x 60% = 1,440,000. Per day 1,440,000 / 365 = 3,945.2054.
  // Float at five days: 5 x 3,945.2054 = 19,726.027 -> 19,726.03.
  // Released: 3 x 3,945.2054 = 11,835.616 -> 11,835.62.
  // Carry saved: 11,835.616 x 0.0675 = 798.904 -> 798.90.
  const r = settlementImpact({
    annualRevenue: 2_400_000,
    cardSharePct: 60,
    settlementDays: 5,
    improvedSettlementDays: 2,
    invoiceCollectionDays: 45,
    reservePct: 0,
    reserveHoldDays: 180,
    borrowingRatePct: 6.75,
    daysInPeriod: 365,
  });
  assert.equal(r.cardRevenue, 1_440_000);
  assert.equal(r.cardRevenuePerDay, 3945.21);
  assert.equal(r.settlementFloat, 19_726.03);
  assert.equal(r.cashReleased, 11_835.62);
  assert.equal(r.annualFinancingSaving, 798.9);
  // Blended DSO is the revenue weighted average: 0.6 x 5 + 0.4 x 45 = 21.
  close(r.blendedDso, 21, 1e-9, "blended DSO");
  close(r.improvedBlendedDso, 19.2, 1e-9, "improved blended DSO"); // 0.6 x 2 + 18
  close(r.blendedDsoDaysSaved, 1.8, 1e-9, "blended days saved"); // 0.6 x 3
  // Nothing was withheld, so there is no reserve drag at all.
  assert.equal(r.reserveDragDays, 0);
  assert.equal(r.reserveBalance, 0);
});

test("settlementImpact: a rolling reserve holds reservePct x holdDays of card revenue at steady state", () => {
  // The identity: 10% released after 180 days holds 0.10 x 180 = 18 days.
  // 18 x 3,945.2054 = 71,013.699 -> 71,013.70, which is six times the 11,835.62
  // a faster payout returns. This is the number the page leads the section with.
  const r = settlementImpact({
    annualRevenue: 2_400_000,
    cardSharePct: 60,
    settlementDays: 5,
    improvedSettlementDays: 2,
    invoiceCollectionDays: 45,
    reservePct: 10,
    reserveHoldDays: 180,
    borrowingRatePct: 6.75,
    daysInPeriod: 365,
  });
  close(r.reserveDragDays, 18, 1e-9, "reserve drag days");
  assert.equal(r.reserveBalance, 71_013.7);
  // The reserve sits inside the card share's own DSO: 5 settlement + 18 reserve.
  close(r.cardDsoDays, 23, 1e-9, "card DSO with reserve");
  close(r.cardDsoDaysImproved, 20, 1e-9, "card DSO with reserve, faster payout");
  // A payout schedule does not touch the reserve, so the cash released is
  // unchanged from the no-reserve case.
  assert.equal(r.cashReleased, 11_835.62);
});

test("settlementImpact: the collections gap is measured DSO less the DSO terms and payouts imply", () => {
  // Measured DSO on the default average convention is 42.5833333. Terms and
  // payouts imply 21. The gap is 21.5833333 days, valued at total revenue per
  // day: 2,400,000 / 365 = 6,575.3424, x 21.5833333 = 141,917.808 -> 141,917.81.
  const measured = cashCycle(defaultInputs).chosen.dso;
  const r = settlementImpact({
    annualRevenue: 2_400_000,
    cardSharePct: 60,
    settlementDays: 5,
    improvedSettlementDays: 2,
    invoiceCollectionDays: 45,
    reservePct: 0,
    reserveHoldDays: 180,
    borrowingRatePct: 6.75,
    daysInPeriod: 365,
    measuredDsoDays: measured,
  });
  assert.notEqual(r.collectionsGapDays, null);
  close(r.collectionsGapDays as number, 21.5833333, 1e-6, "collections gap days");
  assert.equal(r.collectionsGapCash, 141_917.81);
});

test("settlementImpact: with no measured DSO supplied the collections gap is null, not zero", () => {
  // A zero would render as "no collections problem", which is a different claim
  // from "not measured". The widget branches on null for exactly that reason.
  const r = settlementImpact({
    annualRevenue: 2_400_000,
    cardSharePct: 60,
    settlementDays: 5,
    improvedSettlementDays: 2,
    invoiceCollectionDays: 45,
    reservePct: 0,
    reserveHoldDays: 180,
    borrowingRatePct: 6.75,
    daysInPeriod: 365,
  });
  assert.equal(r.collectionsGapDays, null);
  assert.equal(r.collectionsGapCash, null);
});

// ---------------------------------------------------------------------------
// Guards and defaults
// ---------------------------------------------------------------------------

test("a zero denominator returns zero rather than Infinity or NaN", () => {
  assert.equal(daysSalesOutstanding(100_000, 0, 365), 0);
  assert.equal(daysInventoryOutstanding(100_000, 0, 365), 0);
  const empty = cashCycle({ ...defaultInputs, creditSales: 0, cogs: 0 });
  assert.ok(Number.isFinite(empty.chosen.ccc));
  assert.equal(empty.chosen.ccc, 0);
  const noMonths = countbackDso({ receivables: 300_000, months: [] });
  assert.ok(Number.isFinite(noMonths.countbackDso));
  assert.equal(noMonths.simpleDso, 0);
});

test("the shipped defaults describe the business the page copy describes", () => {
  // The worked example and the FAQs quote these figures verbatim, so a change to
  // the defaults that is not mirrored in the copy must fail here.
  assert.equal(D.creditSales, 2_400_000);
  assert.equal(D.cogs, 1_440_000);
  assert.equal(D.daysInPeriod, 365);
  assert.equal(D.borrowingRatePct, 6.75);
  assert.equal(D.improvementDays, 5);
  assert.equal(D.invoiceCollectionDays, 45);
  assert.equal(D.settlementDays, 5);
  assert.equal(D.improvedSettlementDays, 2);
  assert.equal(D.cardSharePct, 60);
  // A 40 percent gross margin, which is what makes the denominator trap visible.
  close(1 - D.cogs / D.creditSales, 0.4, 1e-12, "gross margin");
  // The countback months must fall away from the year's average, or the seasonal
  // tab renders a zero gap and demonstrates nothing.
  assert.ok(D.month1Sales < D.month2Sales && D.month2Sales < D.month3Sales);
});
