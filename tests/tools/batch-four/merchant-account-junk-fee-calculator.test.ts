import { test } from "node:test";
import assert from "node:assert/strict";
import { junkFeeByVolume, junkFeeTotals } from "../../../lib/calc/junk-fees";
import type { JunkFeeCalcInput, JunkFeeLineInput } from "../../../lib/calc/junk-fees";
import { JUNK_FEES, JUNK_FEE_DEFAULTS } from "../../../lib/tools-data/junk-fees";

/**
 * Every expected value below was worked out on paper from the stated inputs
 * before the implementation was consulted. The arithmetic is deliberately small
 * enough that this is possible, because a test that asserts whatever the
 * function happened to return pins the bug in place instead of catching it.
 *
 * The failure modes being pinned:
 *
 *   1. TREATING A MONTHLY MINIMUM AS A FLAT FEE. It is a floor on the processing
 *      charge, so a merchant above the floor pays it nothing. Adding it flat
 *      overstates the default scenario by $240 a year and nothing throws. Both
 *      sides of the floor are asserted: zero above it, the exact shortfall below.
 *   2. CHARGING A ONE-OFF TWELVE TIMES. An early termination fee is not a
 *      monthly line. It is spread across the months left on the term, and a term
 *      with no months left costs nothing.
 *   3. BANKING DAYS DRIFTING. A batch fee is charged per settlement. 21 a month
 *      and 252 a year is the site's convention and 21 x 12 = 252 exactly, so a
 *      per-day line's monthly figure times twelve must equal its annual figure
 *      with no residue.
 *   4. A TOTAL THAT DOES NOT MATCH ITS OWN BREAKDOWN. The annual figure is the
 *      authority and the monthly is derived from it. The sum of the line annuals
 *      has to equal the headline to the cent.
 *   5. AN UNSOURCED DOLLAR FIGURE SHIPPING AS IF IT WERE PUBLISHED. Any row the
 *      widget ticks by default must carry a real amount read off a real
 *      document, and any row with no published figure must default to zero.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

const toLine = (id: string): JunkFeeLineInput => {
  const fee = JUNK_FEES.find((f) => f.id === id);
  assert.ok(fee, `no fee row with id ${id}`);
  return {
    id: fee.id,
    label: fee.label,
    amount: fee.defaultAmount,
    frequency: fee.frequency,
    model: fee.model,
  };
};

const defaultInput = (): JunkFeeCalcInput => ({
  monthlyVolume: JUNK_FEE_DEFAULTS.monthlyVolume,
  effectiveRatePct: JUNK_FEE_DEFAULTS.effectiveRatePct,
  remainingTermMonths: JUNK_FEE_DEFAULTS.remainingTermMonths,
  lines: JUNK_FEES.filter((f) => f.defaultOn).map((f) => toLine(f.id)),
});

// ---------------------------------------------------------------------------
// The default scenario, line by line
// ---------------------------------------------------------------------------

/**
 * Worked by hand from the published amounts in the data module:
 *
 *   monthly account or service fee   9.95 x 12   =   119.40
 *   monthly minimum                  floor, see below   0.00
 *   PCI compliance program fee      10.00 x 12   =   120.00
 *   PCI non-compliance fee          19.95 x 12   =   239.40
 *   annual fee                      99.00 x  1   =    99.00
 *   batch fee                        0.10 x 252  =    25.20
 *   gateway fee                     25.00 x 12   =   300.00
 *   terminal rental                 35.00 x 12   =   420.00
 *                                                  --------
 *                                                  1,323.00
 *
 * The floor: $15,000 a month at 2.90 percent is $435.00 of discount fees, which
 * clears the $20.00 minimum, so the minimum costs nothing.
 */
const EXPECTED_ANNUAL_BY_ID: Record<string, number> = {
  "account-maintenance": 119.4,
  "monthly-minimum": 0,
  "pci-compliance": 120,
  "pci-non-compliance": 239.4,
  "annual-fee": 99,
  "batch-fee": 25.2,
  "gateway-fee": 300,
  "terminal-rental": 420,
};

test("junkFeeTotals: the default statement costs $1,323.00 a year, line by line", () => {
  const r = junkFeeTotals(defaultInput());

  for (const [id, expected] of Object.entries(EXPECTED_ANNUAL_BY_ID)) {
    const line = r.lines.find((l) => l.id === id);
    assert.ok(line, `missing line ${id}`);
    close(line.annualCost, expected, 0.005, `annual cost of ${id}`);
  }

  // Which is also the exact set of lines the widget starts with.
  assert.equal(r.lines.length, Object.keys(EXPECTED_ANNUAL_BY_ID).length);
  close(r.annualTotal, 1323, 0.005, "annual total");
});

test("junkFeeTotals: $1,323.00 a year is $110.25 a month and 73.5 basis points on $180,000", () => {
  // 1323 / 12 = 110.25 exactly.
  // Annual volume 15,000 x 12 = 180,000. 1323 / 180000 = 0.00735 = 73.5 bps.
  // 2.90 percent stated plus 0.735 percent of drag is 3.635 percent all in.
  const r = junkFeeTotals(defaultInput());
  close(r.monthlyTotal, 110.25, 0.005, "monthly total");
  assert.equal(r.annualVolume, 180000);
  close(r.addedBps, 73.5, 0.0005, "added basis points");
  close(r.addedRatePct, 0.735, 0.000005, "added rate");
  close(r.allInRatePct, 3.635, 0.000005, "all-in rate");
});

test("junkFeeTotals: the headline equals the sum of its own lines, to the cent", () => {
  const r = junkFeeTotals(defaultInput());
  const summed = r.lines.reduce((s, l) => s + l.annualCost, 0);
  close(summed, r.annualTotal, 0.005, "sum of lines against the headline");
  // And the shares add to 100.
  const shares = r.lines.reduce((s, l) => s + l.shareOfTotalPct, 0);
  close(shares, 100, 0.0005, "sum of the per-line shares");
});

// ---------------------------------------------------------------------------
// The monthly minimum, on both sides of the floor
// ---------------------------------------------------------------------------

test("junkFeeTotals: a monthly minimum costs nothing above the floor", () => {
  // $15,000 at 2.90 percent is $435.00 of discount fees against a $20.00 floor.
  const r = junkFeeTotals({
    monthlyVolume: 15000,
    effectiveRatePct: 2.9,
    remainingTermMonths: 24,
    lines: [toLine("monthly-minimum")],
  });
  close(r.monthlyProcessingCharge, 435, 0.005, "monthly processing charge");
  assert.equal(r.annualTotal, 0);
  assert.equal(r.lines[0]!.dormant, true);
});

test("junkFeeTotals: below the floor a monthly minimum costs the shortfall and only the shortfall", () => {
  // $500 a month at 2.90 percent is $14.50 of discount fees. The $20.00 floor
  // therefore charges 20.00 - 14.50 = $5.50 a month, which is $66.00 a year.
  // A model that treated the minimum as a flat fee would say $240.00.
  const r = junkFeeTotals({
    monthlyVolume: 500,
    effectiveRatePct: 2.9,
    remainingTermMonths: 24,
    lines: [toLine("monthly-minimum")],
  });
  close(r.monthlyProcessingCharge, 14.5, 0.005, "monthly processing charge");
  close(r.annualTotal, 66, 0.005, "annual cost of the minimum");
  close(r.monthlyTotal, 5.5, 0.005, "monthly cost of the minimum");
  assert.equal(r.lines[0]!.dormant, false);
});

// ---------------------------------------------------------------------------
// The early termination fee
// ---------------------------------------------------------------------------

test("junkFeeTotals: a $495 exit fee with 24 months left is $247.50 a year", () => {
  // 495 spread over 24 months is 20.625 a month, so 495 x 12 / 24 = 247.50.
  const r = junkFeeTotals({
    monthlyVolume: 15000,
    effectiveRatePct: 2.9,
    remainingTermMonths: 24,
    lines: [toLine("early-termination")],
  });
  close(r.annualTotal, 247.5, 0.005, "annualized exit fee");
  close(r.monthlyTotal, 20.625, 0.005, "monthly share of the exit fee");
});

test("junkFeeTotals: halving the remaining term doubles what the exit fee costs a year", () => {
  const base = { monthlyVolume: 15000, effectiveRatePct: 2.9, lines: [toLine("early-termination")] };
  const twelve = junkFeeTotals({ ...base, remainingTermMonths: 12 });
  const six = junkFeeTotals({ ...base, remainingTermMonths: 6 });
  close(twelve.annualTotal, 495, 0.005, "one year left");
  close(six.annualTotal, 990, 0.005, "six months left");
});

test("junkFeeTotals: a term that has run out carries no exit fee to spread", () => {
  const r = junkFeeTotals({
    monthlyVolume: 15000,
    effectiveRatePct: 2.9,
    remainingTermMonths: 0,
    lines: [toLine("early-termination")],
  });
  assert.equal(r.annualTotal, 0);
});

// ---------------------------------------------------------------------------
// Banking days
// ---------------------------------------------------------------------------

test("junkFeeTotals: a 10 cent batch fee is $25.20 a year and $2.10 a month, with no drift", () => {
  // 0.10 x 252 banking days = 25.20 a year. 0.10 x 21 banking days = 2.10 a
  // month. 2.10 x 12 = 25.20 exactly, because 21 x 12 = 252.
  const r = junkFeeTotals({
    monthlyVolume: 15000,
    effectiveRatePct: 2.9,
    remainingTermMonths: 24,
    lines: [toLine("batch-fee")],
  });
  close(r.annualTotal, 25.2, 0.005, "annual batch cost");
  close(r.monthlyTotal, 2.1, 0.005, "monthly batch cost");
  close(r.monthlyTotal * 12, r.annualTotal, 1e-9, "monthly times twelve against annual");
});

// ---------------------------------------------------------------------------
// Basis points are a rate, so they move with volume
// ---------------------------------------------------------------------------

test("junkFeeByVolume: the same bill is 220.5 bps at $5,000 a month and 11.03 bps at $100,000", () => {
  // The bill is fixed at $1,323.00 a year at every volume in this ladder,
  // because the only volume-sensitive line is the minimum and it is dormant at
  // all of them. 1323 / (5000 x 12) = 0.02205 = 220.5 bps.
  // 1323 / (100000 x 12) = 0.00110250 = 11.025 bps.
  const rows = junkFeeByVolume(defaultInput(), [5000, 15000, 100000]);
  close(rows[0]!.addedBps, 220.5, 0.005, "bps at $5,000 a month");
  close(rows[1]!.addedBps, 73.5, 0.005, "bps at $15,000 a month");
  close(rows[2]!.addedBps, 11.025, 0.005, "bps at $100,000 a month");
  for (const row of rows) close(row.annualTotal, 1323, 0.005, `annual total at ${row.monthlyVolume}`);
});

test("junkFeeByVolume: the ladder re-runs the model rather than dividing the headline", () => {
  // At $500 a month the $20.00 minimum stops being dormant and adds $66.00, so a
  // ladder that just divided the headline by volume would be wrong here.
  const rows = junkFeeByVolume(defaultInput(), [500]);
  close(rows[0]!.annualTotal, 1323 + 66, 0.005, "annual total at $500 a month");
});

test("junkFeeTotals: zero volume returns zeros rather than Infinity or NaN", () => {
  const r = junkFeeTotals({ ...defaultInput(), monthlyVolume: 0 });
  assert.ok(Number.isFinite(r.addedBps));
  assert.equal(r.addedBps, 0);
  assert.ok(Number.isFinite(r.allInRatePct));
});

// ---------------------------------------------------------------------------
// The reference data itself
// ---------------------------------------------------------------------------

test("JUNK_FEES: every row carries a source, a removal route and a justified verdict", () => {
  const verdicts = new Set(["pass-through", "real-service", "mixed", "margin"]);
  const negotiability = new Set(["remove", "negotiate", "replace", "fixed"]);
  const frequencies = new Set(["monthly", "annual", "per-business-day", "amortized"]);
  const models = new Set(["flat", "floor", "termination"]);

  const ids = new Set<string>();
  for (const fee of JUNK_FEES) {
    assert.ok(fee.id.length > 0, "every row has an id");
    assert.equal(ids.has(fee.id), false, `duplicate id ${fee.id}`);
    ids.add(fee.id);
    assert.ok(fee.source.length > 40, `${fee.id} needs a real source string`);
    assert.ok(fee.removal.length > 40, `${fee.id} needs a removal route`);
    assert.ok(fee.verdictNote.length > 40, `${fee.id} needs to justify its verdict`);
    assert.ok(fee.statementLabels.length > 0, `${fee.id} needs statement labels`);
    assert.ok(verdicts.has(fee.verdict), `${fee.id} has an unknown verdict`);
    assert.ok(negotiability.has(fee.negotiability), `${fee.id} has an unknown negotiability`);
    assert.ok(frequencies.has(fee.frequency), `${fee.id} has an unknown frequency`);
    assert.ok(models.has(fee.model), `${fee.id} has an unknown model`);
  }

  // The page has to cover the whole long tail, not a convenient half of it.
  for (const required of [
    "statement-fee",
    "monthly-minimum",
    "pci-compliance",
    "pci-non-compliance",
    "annual-fee",
    "batch-fee",
    "gateway-fee",
    "irs-report-fee",
    "account-maintenance",
    "network-access-fee",
    "early-termination",
    "terminal-rental",
  ]) {
    assert.ok(ids.has(required), `the brief requires a ${required} row`);
  }
});

test("JUNK_FEES: no unsourced dollar figure ships, and nothing unsourced is ticked by default", () => {
  for (const fee of JUNK_FEES) {
    if (!fee.sourced) {
      assert.equal(fee.defaultAmount, 0, `${fee.id} has no published figure so it must default to zero`);
      assert.equal(fee.defaultOn, false, `${fee.id} is unsourced and must not be ticked by default`);
    } else {
      assert.ok(fee.defaultAmount > 0, `${fee.id} claims to be sourced but has no amount`);
    }
    if (fee.defaultOn) {
      assert.equal(fee.sourced, true, `${fee.id} is ticked by default so it must be sourced`);
    }
  }
  // At least one genuine pass-through row, or the page is calling everything junk.
  assert.ok(JUNK_FEES.some((f) => f.verdict === "pass-through"), "a pass-through row must exist");
  assert.ok(JUNK_FEES.some((f) => f.verdict === "real-service"), "a real-service row must exist");
});

test("JUNK_FEES: exactly one monthly minimum, modelled as a floor rather than a flat fee", () => {
  const floors = JUNK_FEES.filter((f) => f.model === "floor");
  assert.equal(floors.length, 1);
  assert.equal(floors[0]!.id, "monthly-minimum");
  const terminations = JUNK_FEES.filter((f) => f.model === "termination");
  assert.equal(terminations.length, 1);
  assert.equal(terminations[0]!.id, "early-termination");
});

test("JUNK_FEE_DEFAULTS: the opening state puts the merchant above the monthly minimum", () => {
  // Deliberate: the default has to demonstrate the floor coming to zero, because
  // that is the arithmetic every competing page gets wrong.
  const charge = (JUNK_FEE_DEFAULTS.monthlyVolume * JUNK_FEE_DEFAULTS.effectiveRatePct) / 100;
  const minimum = JUNK_FEES.find((f) => f.id === "monthly-minimum");
  assert.ok(minimum);
  assert.ok(charge > minimum.defaultAmount, "the default scenario must clear the floor");
  assert.ok(JUNK_FEE_DEFAULTS.remainingTermMonths > 0, "a term is needed to spread an exit fee");
});

// ---------------------------------------------------------------------------
// The ranked removal list
// ---------------------------------------------------------------------------

test("junkFeeTotals: the ranked list is most expensive first and stable", () => {
  // By hand from the table above: terminal rental 420.00, gateway 300.00,
  // PCI non-compliance 239.40, PCI compliance 120.00, account fee 119.40,
  // annual fee 99.00, batch 25.20, monthly minimum 0.00.
  const r = junkFeeTotals(defaultInput());
  assert.deepEqual(
    r.ranked.map((l) => l.id),
    [
      "terminal-rental",
      "gateway-fee",
      "pci-non-compliance",
      "pci-compliance",
      "account-maintenance",
      "annual-fee",
      "batch-fee",
      "monthly-minimum",
    ],
  );
  close(r.ranked[0]!.shareOfTotalPct, 31.746, 0.001, "terminal rental share of the bill");
});

test("junkFeeTotals: killing the two most avoidable lines takes 36.6 basis points off", () => {
  // Drop the PCI non-compliance fee (239.40) and the terminal rental (420.00):
  // 1323.00 - 659.40 = 663.60 a year, which on $180,000 is 36.8666... bps.
  // The saving is 659.40 / 180000 = 36.633 bps.
  const full = junkFeeTotals(defaultInput());
  const trimmed = junkFeeTotals({
    ...defaultInput(),
    lines: defaultInput().lines.filter(
      (l) => l.id !== "pci-non-compliance" && l.id !== "terminal-rental",
    ),
  });
  close(trimmed.annualTotal, 663.6, 0.005, "annual total after the two cuts");
  close(trimmed.addedBps, 36.8667, 0.001, "basis points after the two cuts");
  close(full.addedBps - trimmed.addedBps, 36.6333, 0.001, "basis points saved");
});
