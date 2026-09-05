import { test } from "node:test";
import assert from "node:assert/strict";
import { downgradeCost, enhancedDataUplift } from "../../../lib/calc/downgrade";
import {
  CEDP_PARTICIPATION_FEE_PCT,
  DOWNGRADE_DEFAULTS,
  DOWNGRADE_REASONS,
  ENHANCED_DATA_LADDERS,
} from "../../../lib/tools-data/downgrades";

/**
 * Every expected value below was derived independently of the implementation:
 * either by hand from the two published rate sheets, or by parsing the rates out
 * of the quoted program strings, which is a different route to the same number
 * than the `deltaPct` field the code multiplies by.
 *
 * The failure modes being pinned:
 *
 *   1. DOUBLE COUNTING. A transaction clears in exactly one interchange program,
 *      so the causes have to be allocated, not summed. A summing implementation
 *      returns a bigger, entirely plausible number and never throws.
 *   2. A commercial cause escaping the commercial share. A Level 3 requirement
 *      cannot be missed by a consumer card.
 *   3. A missing rung being filled in from its neighbour. Visa retired the
 *      general Commercial Level II program and Mastercard publishes no small
 *      business Data Rate III, so those moves have no price and must say so
 *      rather than quietly returning the Level 1 rate.
 *   4. The Visa participation fee being applied to a move that was already
 *      paying it.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

const reason = (id: string) => {
  const r = DOWNGRADE_REASONS.find((x) => x.id === id);
  assert.ok(r, `no reason with id ${id}`);
  return r;
};

// ---------------------------------------------------------------------------
// The data module: shape, provenance, and internal consistency
// ---------------------------------------------------------------------------

test("every downgrade reason carries a dated source, a trigger and a fix", () => {
  assert.ok(DOWNGRADE_REASONS.length >= 6, "expected at least six named causes");
  for (const r of DOWNGRADE_REASONS) {
    assert.ok(r.source.length > 40, `${r.id}: source is too thin to be a citation`);
    assert.match(r.source, /checked \d+ \w+ 2026/, `${r.id}: source has no checked date`);
    assert.ok(r.trigger.length > 60, `${r.id}: trigger does not explain what fires it`);
    assert.ok(r.fix.length > 60, `${r.id}: fix is not actionable`);
    assert.ok(r.basis === "all" || r.basis === "commercial", `${r.id}: bad basis`);
    assert.ok(r.deltaPct > 0 && r.deltaPct < 3, `${r.id}: delta of ${r.deltaPct} points is out of range`);
    assert.ok(r.deltaCents >= 0 && r.deltaCents <= 50, `${r.id}: cents delta out of range`);
    assert.ok(r.defaultSharePct >= 0 && r.defaultSharePct <= 100, `${r.id}: bad default share`);
  }
  const ids = new Set(DOWNGRADE_REASONS.map((r) => r.id));
  assert.equal(ids.size, DOWNGRADE_REASONS.length, "duplicate reason ids");
});

test("each delta equals the two quoted published rows, parsed back out of the strings", () => {
  // Independent of `deltaPct`: this reads the rates out of the human-readable
  // program names the page renders, so a typo in either the field or the quote
  // fails the test.
  const parse = (s: string) => {
    const m = s.match(/([\d.]+)%\s*\+\s*\$([\d.]+)/);
    assert.ok(m, `no rate found in "${s}"`);
    return { pct: Number.parseFloat(m[1]!), cents: Math.round(Number.parseFloat(m[2]!) * 100) };
  };

  for (const r of DOWNGRADE_REASONS) {
    const from = parse(r.fromProgram);
    const to = parse(r.toProgram);
    close(r.deltaPct, to.pct - from.pct, 1e-9, `${r.id} percentage delta`);
    assert.equal(r.deltaCents, to.cents - from.cents, `${r.id} cents delta`);
    assert.ok(to.pct > from.pct || to.cents > from.cents, `${r.id}: the fall is not a downgrade`);
  }
});

test("the corporate ladder holds the four rates read off the April 2026 sheets", () => {
  const corporate = ENHANCED_DATA_LADDERS.find((l) => l.id === "corporate");
  assert.ok(corporate);
  const rung = (id: string) => corporate.rungs.find((r) => r.id === id);

  // Visa USA Interchange Reimbursement Fees, 18 April 2026, section E.
  assert.equal(rung("level1")?.visaPct, 2.7);
  assert.equal(rung("level3")?.visaPct, 1.75);
  // Visa retired the general Commercial Level II row in April 2026. A number
  // here would be an invention.
  assert.equal(rung("level2")?.visaPct, null);

  // Mastercard 2026 to 2027 U.S. Region, 17 April 2026, Large Market Credit.
  assert.equal(rung("level1")?.mcPct, 2.7);
  assert.equal(rung("level2")?.mcPct, 2.5);
  assert.equal(rung("level3")?.mcPct, 1.9);
});

test("the small business ladder records that Level 3 is not the cheap rung there", () => {
  const smb = ENHANCED_DATA_LADDERS.find((l) => l.id === "smallbusiness");
  assert.ok(smb);
  const rung = (id: string) => smb.rungs.find((r) => r.id === id);

  // Visa Business Product 1 and 2 match Mastercard Data Rate I and II to the
  // cent at the base tier. That agreement is the evidence for reading Visa's
  // Product numbering as the data level, so it is asserted rather than assumed.
  assert.equal(rung("level1")?.visaPct, 2.65);
  assert.equal(rung("level1")?.mcPct, 2.65);
  assert.equal(rung("level2")?.visaPct, 1.9);
  assert.equal(rung("level2")?.mcPct, 1.9);

  // Visa prices Product 3 ABOVE Product 2 on business credit, and Mastercard
  // publishes no small business Data Rate III at all.
  assert.equal(rung("level3")?.visaPct, 2.4);
  assert.equal(rung("level3")?.mcPct, null);
  assert.ok(
    (rung("level3")?.visaPct ?? 0) > (rung("level2")?.visaPct ?? 0),
    "Visa Business Product 3 should be more expensive than Product 2",
  );
});

// ---------------------------------------------------------------------------
// downgradeCost
// ---------------------------------------------------------------------------

test("the default state costs $1,426.25 a month, worked by hand from the three deltas", () => {
  // $250,000 a month, 1,000 transactions, 45% commercial.
  //   late batch,       5% of all volume     = $12,500  x 1.50pp = $187.50
  //   Level 1 only,   100% of 45% commercial = $112,500 x 0.95pp = $1,068.75
  //   keyed at till,    8% of all volume     = $20,000  x 0.85pp = $170.00
  //                                                       total  = $1,426.25
  const r = downgradeCost(
    {
      monthlyVolume: DOWNGRADE_DEFAULTS.monthlyVolume,
      monthlyTransactions: DOWNGRADE_DEFAULTS.monthlyTransactions,
      commercialSharePct: DOWNGRADE_DEFAULTS.commercialSharePct,
      selections: DOWNGRADE_REASONS.filter((x) => x.defaultOn).map((x) => ({
        id: x.id,
        sharePct: x.defaultSharePct,
      })),
    },
    DOWNGRADE_REASONS,
  );

  assert.equal(r.monthlyTotal, 1426.25);
  assert.equal(r.annualTotal, 17115);
  assert.equal(r.averageTicket, 250);
  close(r.totalBps, 57.05, 0.01, "total basis points on volume");
  close(r.downgradedSharePct, 58, 1e-9, "share of volume downgraded");
  assert.equal(r.anyClipped, false);

  // Worst first: the late batch has the biggest per-dollar delta even though it
  // is not the biggest line.
  assert.equal(r.lines[0]!.id, "late-batch");
  assert.equal(r.lines[0]!.monthlyCost, 187.5);
  assert.equal(r.lines[1]!.id, "commercial-no-enhanced-data");
  assert.equal(r.lines[1]!.monthlyCost, 1068.75);
  assert.equal(r.lines[1]!.affectedVolume, 112500);
  assert.equal(r.lines[1]!.affectedTransactions, 450);
  assert.equal(r.lines[2]!.id, "keyed-card-present");
  assert.equal(r.lines[2]!.monthlyCost, 170);
});

test("a transaction cannot downgrade twice: overlapping causes are allocated, not summed", () => {
  // $100,000 a month, 100 transactions, all commercial.
  //   late batch     50% of volume, 1.50pp  -> takes 50%,  $50,000 x 1.50pp = $750
  //   Level 1 only  100% of volume, 0.95pp  -> only 50% left, $50,000 x 0.95pp = $475
  // Allocated total $1,225. Summed independently it would be $750 + $950 = $1,700,
  // which is the number every competing calculator prints.
  const r = downgradeCost(
    {
      monthlyVolume: 100000,
      monthlyTransactions: 100,
      commercialSharePct: 100,
      selections: [
        { id: "commercial-no-enhanced-data", sharePct: 100 },
        { id: "late-batch", sharePct: 50 },
      ],
    },
    DOWNGRADE_REASONS,
  );

  assert.equal(r.monthlyTotal, 1225);
  assert.equal(r.naiveMonthlyTotal, 1700);
  assert.equal(r.anyClipped, true);
  close(r.downgradedSharePct, 100, 1e-9, "downgraded share is capped at the whole book");

  const level1 = r.lines.find((l) => l.id === "commercial-no-enhanced-data");
  assert.ok(level1);
  assert.equal(level1.clipped, true);
  assert.equal(level1.requestedSharePct, 100);
  close(level1.appliedSharePct, 50, 1e-9, "clipped applied share");
});

test("a commercial cause can never reach more of the book than the commercial share", () => {
  // 10% commercial share, cause claimed at 100% of commercial volume.
  // $500,000 x 10% = $50,000 affected, x 0.95pp = $475 a month.
  const r = downgradeCost(
    {
      monthlyVolume: 500000,
      monthlyTransactions: 2000,
      commercialSharePct: 10,
      selections: [{ id: "commercial-no-enhanced-data", sharePct: 100 }],
    },
    DOWNGRADE_REASONS,
  );

  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0]!.affectedVolume, 50000);
  assert.equal(r.lines[0]!.affectedTransactions, 200);
  assert.equal(r.monthlyTotal, 475);
  assert.equal(r.annualTotal, 5700);
  // And the naive total agrees here, because nothing was clipped.
  assert.equal(r.naiveMonthlyTotal, 475);
});

test("the per-transaction cents delta is charged per transaction, not per dollar", () => {
  // Visa Business Product 1 2.65% + $0.10 falling to Business Non-Qualified
  // 3.15% + $0.20 is 0.50 points AND ten cents a transaction.
  // $60,000 x 0.50pp = $300.00, plus 200 transactions x $0.10 = $20.00.
  const r = downgradeCost(
    {
      monthlyVolume: 60000,
      monthlyTransactions: 200,
      commercialSharePct: 100,
      selections: [{ id: "business-non-qualified", sharePct: 100 }],
    },
    DOWNGRADE_REASONS,
  );

  assert.equal(reason("business-non-qualified").deltaCents, 10);
  assert.equal(r.monthlyTotal, 320);
  assert.equal(r.annualTotal, 3840);
});

test("zero volume, zero transactions and unknown ids degrade to zero rather than NaN", () => {
  const empty = downgradeCost(
    { monthlyVolume: 0, monthlyTransactions: 0, commercialSharePct: 45, selections: [] },
    DOWNGRADE_REASONS,
  );
  assert.equal(empty.monthlyTotal, 0);
  assert.equal(empty.totalBps, 0);
  assert.equal(empty.averageTicket, 0);

  const junk = downgradeCost(
    {
      monthlyVolume: Number.NaN,
      monthlyTransactions: 100,
      commercialSharePct: 250,
      selections: [
        { id: "not-a-real-cause", sharePct: 100 },
        { id: "late-batch", sharePct: -20 },
      ],
    },
    DOWNGRADE_REASONS,
  );
  assert.equal(junk.lines.length, 0);
  assert.equal(junk.monthlyTotal, 0);
  assert.ok(Number.isFinite(junk.totalBps));
});

// ---------------------------------------------------------------------------
// enhancedDataUplift
// ---------------------------------------------------------------------------

test("Level 1 to Level 3 on corporate cards: $12,150 a year on Visa, $10,800 on Mastercard", () => {
  // $112,500 a month of commercial volume, 450 commercial transactions.
  // Visa:       2.70% -> 1.75% is 0.95pp, less the 0.05pp CEDP participation
  //             fee, so 0.90pp. $112,500 x 0.90% = $1,012.50 a month.
  // Mastercard: 2.70% -> 1.90% is 0.80pp, no participation fee.
  //             $112,500 x 0.80% = $900.00 a month.
  // Both fixed fees are $0.10 either side, so the per-transaction term is zero.
  const corporate = ENHANCED_DATA_LADDERS.find((l) => l.id === "corporate");
  assert.ok(corporate);

  const u = enhancedDataUplift(corporate, "level1", "level3", 112500, 450, CEDP_PARTICIPATION_FEE_PCT);

  const visa = u.legs.find((l) => l.network === "Visa");
  const mc = u.legs.find((l) => l.network === "Mastercard");
  assert.ok(visa && mc);

  assert.equal(visa.available, true);
  assert.equal(visa.monthlySaving, 1012.5);
  assert.equal(visa.annualSaving, 12150);
  close(visa.rateSavingPct, 0.95, 1e-9, "Visa rate saving before the fee");
  close(visa.participationFeePct, 0.05, 1e-9, "Visa participation fee applied once");

  assert.equal(mc.available, true);
  assert.equal(mc.monthlySaving, 900);
  assert.equal(mc.annualSaving, 10800);
  assert.equal(mc.participationFeePct, 0);

  assert.equal(u.annualLow, 10800);
  assert.equal(u.annualHigh, 12150);
  assert.equal(u.empty, false);
});

test("a rung with no published program returns no saving instead of borrowing its neighbour", () => {
  const corporate = ENHANCED_DATA_LADDERS.find((l) => l.id === "corporate");
  const smb = ENHANCED_DATA_LADDERS.find((l) => l.id === "smallbusiness");
  assert.ok(corporate && smb);

  // Visa has no general Commercial Level II row after April 2026.
  const visaGap = enhancedDataUplift(corporate, "level1", "level2", 100000, 400, CEDP_PARTICIPATION_FEE_PCT);
  const visaLeg = visaGap.legs.find((l) => l.network === "Visa");
  assert.ok(visaLeg);
  assert.equal(visaLeg.available, false);
  assert.equal(visaLeg.monthlySaving, 0);
  assert.ok(visaLeg.unavailableNote.length > 0);
  // Mastercard still publishes Data Rate II here: 2.70% -> 2.50% is 0.20pp,
  // $100,000 x 0.20% = $200 a month.
  const mcLeg = visaGap.legs.find((l) => l.network === "Mastercard");
  assert.ok(mcLeg);
  assert.equal(mcLeg.monthlySaving, 200);
  assert.equal(visaGap.annualLow, 2400);
  assert.equal(visaGap.annualHigh, 2400);

  // Mastercard has no small business Data Rate III.
  const mcGap = enhancedDataUplift(smb, "level2", "level3", 100000, 400, CEDP_PARTICIPATION_FEE_PCT);
  assert.equal(mcGap.legs.find((l) => l.network === "Mastercard")?.available, false);
});

test("the Visa participation fee is not charged twice on a Level 2 to Level 3 move", () => {
  // Small business: Business Product 2 1.90% -> Business Product 3 2.40%. Both
  // rungs carry enhanced data, so the fee is already being paid and the net fee
  // delta is zero. The move is a 0.50 point LOSS on Visa, which the calculator
  // has to be willing to report.
  const smb = ENHANCED_DATA_LADDERS.find((l) => l.id === "smallbusiness");
  assert.ok(smb);

  const u = enhancedDataUplift(smb, "level2", "level3", 100000, 400, CEDP_PARTICIPATION_FEE_PCT);
  const visa = u.legs.find((l) => l.network === "Visa");
  assert.ok(visa);
  assert.equal(visa.participationFeePct, 0);
  close(visa.rateSavingPct, -0.5, 1e-9, "Visa Product 2 to Product 3 is a loss");
  assert.equal(visa.monthlySaving, -500);
  assert.equal(visa.annualSaving, -6000);
});

test("small business Level 1 to Level 2 is worth $8,400 a year on Visa at $100,000 a month", () => {
  // Visa Business Product 1 2.65% -> Business Product 2 1.90% is 0.75pp, less
  // the 0.05pp participation fee, so 0.70pp. $100,000 x 0.70% = $700 a month.
  // Mastercard Data Rate I 2.65% -> Data Rate II 1.90% is a clean 0.75pp,
  // $750 a month, with no participation fee.
  const smb = ENHANCED_DATA_LADDERS.find((l) => l.id === "smallbusiness");
  assert.ok(smb);

  const u = enhancedDataUplift(smb, "level1", "level2", 100000, 400, CEDP_PARTICIPATION_FEE_PCT);
  assert.equal(u.legs.find((l) => l.network === "Visa")?.annualSaving, 8400);
  assert.equal(u.legs.find((l) => l.network === "Mastercard")?.annualSaving, 9000);
  assert.equal(u.annualLow, 8400);
  assert.equal(u.annualHigh, 9000);
});
