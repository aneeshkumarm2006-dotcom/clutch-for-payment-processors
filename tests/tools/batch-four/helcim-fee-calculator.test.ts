import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocateWholeUnits,
  helcimCostAtTier,
  helcimDefaultInterchange,
  helcimMonthlyCost,
  helcimNextTierStep,
  helcimSinglePayment,
  helcimTierForVolume,
  tierRate,
  type HelcimChannel,
  type HelcimInput,
} from "../../../lib/calc/helcim";
import {
  HELCIM_BAND_IDS,
  HELCIM_DEFAULTS,
  HELCIM_INTERCHANGE_ASSUMPTIONS,
  HELCIM_VOLUME_TIERS,
} from "../../../lib/tools-data/helcim";
import { HELCIM_RATE_CARD } from "../../../lib/rate-cards/helcim";

/**
 * Every reference value below was derived INDEPENDENTLY of the implementation,
 * by multiplying the published rates out by hand, and every one of them is
 * written into the test as the arithmetic rather than as a bare number.
 *
 * That matters more here than on a flat-rate calculator, because an
 * interchange-plus bill has six moving parts and every way of getting it wrong
 * is silent:
 *
 *   - Split a mixed card portfolio at one blended interchange rate and a
 *     debit-heavy merchant is overcharged by more than a point.
 *   - Round each band's share of the volume independently and the parts no
 *     longer sum to the whole, so up to four transactions vanish out of the
 *     count and every per-item fee quietly shrinks.
 *   - Read Helcim's published 0.40% as a price rather than as a margin and the
 *     answer is out by roughly two percentage points, in the direction that
 *     makes Helcim look free.
 *
 * The last group of tests pins the numbers printed in the page copy
 * (`lib/tools-defs/helcim-fee-calculator.ts`) against the same functions the
 * widget calls, because a hand-written worked example that disagrees with the
 * widget beside it has shipped on this site before.
 */

const mixSum = HELCIM_BAND_IDS.reduce((s, id) => s + HELCIM_DEFAULTS.mix[id], 0);

const buildInput = (over: Partial<HelcimInput> = {}): HelcimInput => {
  const channel: HelcimChannel = over.channel ?? HELCIM_DEFAULTS.channel;
  return {
    monthlyVolume: HELCIM_DEFAULTS.monthlyVolume,
    monthlyTransactions: HELCIM_DEFAULTS.monthlyTransactions,
    channel,
    mix: HELCIM_DEFAULTS.mix,
    interchange: helcimDefaultInterchange(HELCIM_INTERCHANGE_ASSUMPTIONS, channel),
    assessmentRate: HELCIM_DEFAULTS.assessmentRate,
    assessmentFixed: HELCIM_DEFAULTS.assessmentFixed,
    tiers: HELCIM_VOLUME_TIERS,
    ...over,
  };
};

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

// ---------------------------------------------------------------------------
// The allocator
// ---------------------------------------------------------------------------

test("allocateWholeUnits: an exact split comes back exactly", () => {
  // 25 + 16 + 24 + 30 + 5 = 100, so a 100 unit total needs no remainder pass.
  assert.deepEqual(allocateWholeUnits(100, [25, 16, 24, 30, 5]), [25, 16, 24, 30, 5]);
});

test("allocateWholeUnits: thirds of seven are 3, 2, 2 and never 2, 2, 2", () => {
  // 7/3 = 2.333 each. Floors give 2, 2, 2 and leave one unit; the largest
  // remainder wins ties by position, so the first slot takes it.
  assert.deepEqual(allocateWholeUnits(7, [1, 1, 1]), [3, 2, 2]);
  // 101/3 = 33.667 each. Floors give 33 three times and leave two units.
  assert.deepEqual(allocateWholeUnits(101, [1, 1, 1]), [34, 34, 33]);
});

test("allocateWholeUnits: the parts always sum to the whole, across a sweep", () => {
  const shapes = [
    [25, 16, 24, 30, 5],
    [33, 33, 34, 0, 0],
    [1, 1, 1, 1, 1],
    [99, 1, 0, 0, 0],
    [7, 11, 13, 17, 19],
  ];
  for (const shares of shapes) {
    for (const total of [0, 1, 7, 100, 3_000_000, 12_345_679]) {
      const parts = allocateWholeUnits(total, shares);
      assert.equal(
        parts.reduce((a, b) => a + b, 0),
        total,
        `shares ${shares.join("/")} at total ${total} did not sum back to the total`,
      );
      assert.ok(parts.every((p) => Number.isInteger(p) && p >= 0));
    }
  }
});

test("allocateWholeUnits: a zero total or a zero mix gives zeros rather than NaN", () => {
  assert.deepEqual(allocateWholeUnits(0, [1, 2, 3]), [0, 0, 0]);
  assert.deepEqual(allocateWholeUnits(500, [0, 0, 0]), [0, 0, 0]);
});

// ---------------------------------------------------------------------------
// Tier selection
// ---------------------------------------------------------------------------

test("helcimTierForVolume: bands are half-open, so a boundary lands in the cheaper band", () => {
  const at = (v: number) => helcimTierForVolume(v, HELCIM_VOLUME_TIERS).id;
  assert.equal(at(0), "t1");
  assert.equal(at(49_999.99), "t1");
  assert.equal(at(50_000), "t2");
  assert.equal(at(99_999), "t2");
  assert.equal(at(100_000), "t3");
  assert.equal(at(499_999), "t3");
  assert.equal(at(500_000), "t4");
  assert.equal(at(999_999), "t4");
  assert.equal(at(1_000_000), "t5");
  // Above the published ladder Helcim quotes custom pricing. The tool holds the
  // top published band rather than inventing a sixth.
  assert.equal(at(9_000_000), "t5");
});

// ---------------------------------------------------------------------------
// The monthly bill, worked out by hand
// ---------------------------------------------------------------------------

test("helcimMonthlyCost: the card-present default month matches hand arithmetic to the cent", () => {
  const r = helcimMonthlyCost(buildInput());

  // Helcim margin, entry band, card present: 0.40% + $0.08.
  const markup = 30_000 * 0.004 + 500 * 0.08; // 120 + 40
  assert.equal(markup, 160);
  assert.equal(r.markup, 160);

  // Assessments: 0.13% of volume + $0.02 an authorization.
  const assessments = 30_000 * 0.0013 + 500 * 0.02; // 39 + 10
  assert.equal(assessments, 49);
  assert.equal(r.assessments, 49);

  // Interchange, band by band, at the default 25/16/24/30/5 mix. Each band takes
  // its share of BOTH the volume and the transaction count.
  const regulatedDebit = 7_500 * 0.0005 + 125 * 0.22; // 3.75 + 27.50
  const exemptDebit = 4_800 * 0.008 + 80 * 0.15; // 38.40 + 12.00
  const consumerCredit = 7_200 * 0.0151 + 120 * 0.1; // 108.72 + 12.00
  const rewardsCredit = 9_000 * 0.021 + 150 * 0.1; // 189.00 + 15.00
  const commercial = 1_500 * 0.025 + 25 * 0.1; // 37.50 + 2.50
  close(regulatedDebit, 31.25, 1e-9, "regulated debit interchange");
  close(exemptDebit, 50.4, 1e-9, "exempt debit interchange");
  close(consumerCredit, 120.72, 1e-9, "consumer credit interchange");
  close(rewardsCredit, 204, 1e-9, "rewards credit interchange");
  close(commercial, 40, 1e-9, "commercial interchange");

  const interchange = regulatedDebit + exemptDebit + consumerCredit + rewardsCredit + commercial;
  close(interchange, 446.37, 1e-9, "total interchange");
  assert.equal(r.interchange, 446.37);

  assert.equal(r.total, 655.37);
  close(r.effectiveRatePct, (655.37 / 30_000) * 100, 1e-9, "effective rate");
  close(r.effectiveRatePct, 2.1845667, 1e-5, "effective rate against the printed figure");
  close(r.perTransaction, 655.37 / 500, 1e-9, "cost per sale");
  assert.equal(r.averageTicket, 60);
  assert.equal(r.tier.id, "t1");
});

test("helcimMonthlyCost: the keyed and online month uses the card-not-present bands", () => {
  const r = helcimMonthlyCost(buildInput({ channel: "online" }));

  // Helcim margin, entry band, keyed and online: 0.50% + $0.25.
  close(r.markup, 30_000 * 0.005 + 500 * 0.25, 1e-9, "online markup"); // 150 + 125
  assert.equal(r.markup, 275);
  assert.equal(r.assessments, 49);

  const interchange =
    (7_500 * 0.0005 + 125 * 0.22) + // regulated debit, unchanged by channel
    (4_800 * 0.0165 + 80 * 0.15) + // exempt debit, 1.65% + $0.15 card not present
    (7_200 * 0.0189 + 120 * 0.1) + // consumer credit, 1.89% + $0.10
    (9_000 * 0.022 + 150 * 0.1) + // rewards credit, 2.20% + $0.10
    (1_500 * 0.027 + 25 * 0.1); // commercial, 2.70% + $0.10
  close(interchange, 526.53, 1e-9, "online interchange");
  assert.equal(r.interchange, 526.53);
  assert.equal(r.total, 850.53);
  close(r.effectiveRatePct, 2.8351, 1e-4, "online effective rate");
});

test("helcimMonthlyCost: an all-regulated-debit month is far cheaper than an all-rewards one", () => {
  const only = (id: (typeof HELCIM_BAND_IDS)[number]) => {
    const mix = { regulatedDebit: 0, exemptDebit: 0, consumerCredit: 0, rewardsCredit: 0, commercial: 0 };
    mix[id] = 100;
    return helcimMonthlyCost(buildInput({ mix }));
  };

  // 30,000 x 0.05% + 500 x $0.22 = 15 + 110 = 125 of interchange, plus 49 of
  // assessments and 160 of margin.
  const debit = only("regulatedDebit");
  assert.equal(debit.interchange, 125);
  assert.equal(debit.total, 334);
  close(debit.effectiveRatePct, 1.11333, 1e-4, "all regulated debit effective rate");

  // 30,000 x 2.10% + 500 x $0.10 = 630 + 50 = 680, plus 49 plus 160.
  const rewards = only("rewardsCredit");
  assert.equal(rewards.interchange, 680);
  assert.equal(rewards.total, 889);
  close(rewards.effectiveRatePct, 2.96333, 1e-4, "all rewards effective rate");

  // Identical volume, identical Helcim margin, 185 basis points apart.
  close(rewards.effectiveRatePct - debit.effectiveRatePct, 1.85, 1e-4, "spread between the two mixes");
});

test("helcimMonthlyCost: a small average ticket is dominated by the per-item fees", () => {
  // $4,000 across 500 sales is an $8 ticket. Every per-item component now
  // matters more than every percentage.
  const r = helcimMonthlyCost(buildInput({ monthlyVolume: 4_000, monthlyTransactions: 500 }));
  const markup = 4_000 * 0.004 + 500 * 0.08; // 16 + 40
  assert.equal(markup, 56);
  assert.equal(r.markup, 56);
  // The page says the rate "goes past 4.7%" at this ticket size.
  assert.ok(
    r.effectiveRatePct > 4.7,
    `an $8 ticket should clear 4.7 percent, got ${r.effectiveRatePct}`,
  );
});

test("a bigger online ticket pulls the rate under Helcim's own below-2.5% claim", () => {
  // $30,000 across 200 sales is a $150 ticket. The page contrasts this with the
  // 2.84% the same volume costs at a $60 ticket online.
  const r = helcimMonthlyCost(buildInput({ channel: "online", monthlyTransactions: 200 }));
  assert.equal(r.averageTicket, 150);
  assert.equal(r.effectiveRatePct.toFixed(2), "2.43");
  assert.ok(r.effectiveRatePct < 2.5);
});

// ---------------------------------------------------------------------------
// The volume ladder
// ---------------------------------------------------------------------------

test("helcimMonthlyCost: the ladder differs only by Helcim's margin", () => {
  const r = helcimMonthlyCost(buildInput());
  for (const row of r.ladder) {
    // Interchange and assessments are the same charges on the same cards in
    // every band, so the whole difference between two rows is the margin.
    close(
      row.total - row.markup,
      r.interchange + r.assessments,
      1e-9,
      `network cost under ${row.tier.id}`,
    );
  }
  // And the margins are the published ones multiplied out by hand.
  const expected = [
    30_000 * 0.004 + 500 * 0.08,
    30_000 * 0.0035 + 500 * 0.07,
    30_000 * 0.0025 + 500 * 0.07,
    30_000 * 0.002 + 500 * 0.06,
    30_000 * 0.0015 + 500 * 0.06,
  ];
  assert.deepEqual(
    r.ladder.map((row) => row.markup),
    [160, 140, 110, 90, 75],
  );
  r.ladder.forEach((row, i) => close(row.markup, expected[i] ?? -1, 1e-9, `ladder markup ${i}`));

  // Strictly cheaper as volume rises, in both dollars and rate.
  for (let i = 1; i < r.ladder.length; i += 1) {
    const prev = r.ladder[i - 1];
    const here = r.ladder[i];
    assert.ok(prev && here);
    assert.ok(here.total < prev.total, `band ${i} should cost less than band ${i - 1}`);
    assert.ok(here.effectiveRatePct < prev.effectiveRatePct);
  }
});

test("helcimNextTierStep: crossing $50,000 is worth $33.33 a month on a $60 ticket", () => {
  const input = buildInput();
  const step = helcimNextTierStep(input, helcimTierForVolume(input.monthlyVolume, HELCIM_VOLUME_TIERS));
  assert.ok(step, "there is a band above the entry band");
  assert.equal(step.tier.id, "t2");
  assert.equal(step.thresholdVolume, 50_000);
  assert.equal(step.extraVolumeNeeded, 20_000);
  // $50,000 at a $60 ticket is 833.33 sales, rounded to 833.
  assert.equal(step.transactionsAtThreshold, 833);
  close(step.markupAtThresholdNow, 50_000 * 0.004 + 833 * 0.08, 1e-9, "margin at the threshold today"); // 200 + 66.64
  close(step.markupAtThresholdNext, 50_000 * 0.0035 + 833 * 0.07, 1e-9, "margin at the threshold next band"); // 175 + 58.31
  assert.equal(step.markupAtThresholdNow, 266.64);
  assert.equal(step.markupAtThresholdNext, 233.31);
  assert.equal(step.monthlySaving, 33.33);
  assert.equal(step.annualSaving, 399.96);
  close(step.savingBps, (33.33 / 50_000) * 10_000, 1e-9, "saving in basis points");
});

test("helcimNextTierStep: the top published band has no next step", () => {
  const input = buildInput({ monthlyVolume: 2_000_000, monthlyTransactions: 20_000 });
  const top = helcimTierForVolume(input.monthlyVolume, HELCIM_VOLUME_TIERS);
  assert.equal(top.id, "t5");
  assert.equal(helcimNextTierStep(input, top), null);
});

// ---------------------------------------------------------------------------
// A single payment
// ---------------------------------------------------------------------------

test("helcimSinglePayment: $100 on the entry band, worked out by hand for every card type", () => {
  const input = buildInput();
  const tier = HELCIM_VOLUME_TIERS[0];
  assert.ok(tier);
  const margin = 100 * 0.004 + 0.08; // 0.48
  const assess = 100 * 0.0013 + 0.02; // 0.15
  close(margin, 0.48, 1e-9, "Helcim margin on $100 card present at the entry band");
  close(assess, 0.15, 1e-9, "assessments on $100");

  const expected: [string, number, number][] = [
    // band id, interchange percent, interchange per item
    ["regulatedDebit", 0.05, 0.22],
    ["exemptDebit", 0.8, 0.15],
    ["consumerCredit", 1.51, 0.1],
    ["rewardsCredit", 2.1, 0.1],
    ["commercial", 2.5, 0.1],
  ];

  for (const [id, ratePct, fixed] of expected) {
    const band = HELCIM_BAND_IDS.find((b) => b === id);
    assert.ok(band, `${id} is a known band`);
    const r = helcimSinglePayment(input, band, 100, tier);
    const hand = Math.round((100 * (ratePct / 100) + fixed + assess + margin) * 100) / 100;
    assert.equal(r.total, hand, `${id} fee on $100`);
    close(r.net, 100 - hand, 1e-9, `${id} net on $100`);
    close(r.effectiveRatePct, hand, 1e-9, `${id} effective rate on $100 equals the fee in dollars`);
  }

  // Spot checks against the figures printed on the page.
  const rewards = helcimSinglePayment(input, "rewardsCredit", 100, tier);
  assert.equal(rewards.total, 2.83);
  const debit = helcimSinglePayment(input, "regulatedDebit", 100, tier);
  assert.equal(debit.total, 0.9);
});

// ---------------------------------------------------------------------------
// The reference data itself
// ---------------------------------------------------------------------------

test("HELCIM_VOLUME_TIERS: the ladder is contiguous, sourced and monotonically cheaper", () => {
  assert.equal(HELCIM_VOLUME_TIERS.length, 5);
  HELCIM_VOLUME_TIERS.forEach((t, i) => {
    assert.ok(t.source.length > 20, `${t.id} carries a source`);
    assert.ok(t.source.includes("helcim.com"), `${t.id} names where the figure came from`);
    const prev = HELCIM_VOLUME_TIERS[i - 1];
    if (prev) {
      assert.equal(t.minVolume, prev.maxVolume, `${t.id} starts where ${prev.id} ends`);
      assert.ok(t.inPerson.rate <= prev.inPerson.rate, `${t.id} card-present margin does not rise`);
      assert.ok(t.online.rate <= prev.online.rate, `${t.id} online margin does not rise`);
      assert.ok(t.inPerson.fixed <= prev.inPerson.fixed);
      assert.ok(t.online.fixed <= prev.online.fixed);
    }
    // Card present is cheaper than keyed and online at every band, which is the
    // whole reason the widget asks which channel you are in.
    assert.ok(t.inPerson.rate <= t.online.rate, `${t.id} card present is not dearer than online`);
    assert.ok(t.inPerson.fixed <= t.online.fixed);
    // A markup, not a price. Anything above one percent would mean the figures
    // were read as a total rate.
    assert.ok(t.inPerson.rate > 0 && t.inPerson.rate < 1, `${t.id} card-present markup is a margin`);
    assert.ok(t.online.rate > 0 && t.online.rate < 1, `${t.id} online markup is a margin`);
  });
  assert.equal(HELCIM_VOLUME_TIERS[0]?.minVolume, 0);
  assert.equal(HELCIM_VOLUME_TIERS[4]?.maxVolume, null);
});

test("HELCIM_INTERCHANGE_ASSUMPTIONS: every band is sourced and every default sits inside its own band", () => {
  assert.equal(HELCIM_INTERCHANGE_ASSUMPTIONS.length, HELCIM_BAND_IDS.length);
  for (const band of HELCIM_INTERCHANGE_ASSUMPTIONS) {
    assert.ok(HELCIM_BAND_IDS.includes(band.id), `${band.id} is in the iteration order`);
    assert.ok(band.source.includes("Visa"), `${band.id} cites Visa`);
    assert.ok(band.source.includes("Mastercard"), `${band.id} cites Mastercard`);
    assert.ok(band.source.includes("2026"), `${band.id} carries a dated source`);
    for (const side of [band.cardPresent, band.cardNotPresent]) {
      assert.ok(side.program.length > 5, `${band.id} names the program the default came from`);
      assert.ok(side.low <= side.rate && side.rate <= side.high, `${band.id} default is inside its band`);
      // Nothing in US interchange is negative or above the Standard programs,
      // the dearest of which is Mastercard commercial Standard at 3.30%.
      assert.ok(side.low >= 0 && side.high <= 3.4, `${band.id} band is inside the published range`);
      assert.ok(side.fixed >= 0 && side.fixed <= 1, `${band.id} per-item fee is plausible`);
    }
  }

  const byId = (id: string) => HELCIM_INTERCHANGE_ASSUMPTIONS.find((b) => b.id === id);
  // The Durbin cap is a hard published number, not an estimate, so it is the one
  // band with no width to it.
  const regulated = byId("regulatedDebit");
  assert.ok(regulated);
  assert.equal(regulated.cardPresent.rate, 0.05);
  assert.equal(regulated.cardPresent.fixed, 0.22);
  assert.equal(regulated.cardNotPresent.rate, 0.05);

  // And the ordering the whole page rests on: debit is cheaper than plain
  // credit, which is cheaper than rewards, which is cheaper than commercial.
  const order = ["regulatedDebit", "exemptDebit", "consumerCredit", "rewardsCredit", "commercial"];
  for (let i = 1; i < order.length; i += 1) {
    const prev = byId(order[i - 1] ?? "");
    const here = byId(order[i] ?? "");
    assert.ok(prev && here);
    assert.ok(
      here.cardPresent.rate > prev.cardPresent.rate,
      `${order[i]} should cost more than ${order[i - 1]} card present`,
    );
  }
});

test("HELCIM_DEFAULTS: the mix sums to 100 and the assessment default is inside the published band", () => {
  assert.equal(mixSum, 100);
  // 41 percent debit, 59 percent credit, which is the 2024 US value split the
  // Federal Reserve Payments Study reports.
  assert.equal(HELCIM_DEFAULTS.mix.regulatedDebit + HELCIM_DEFAULTS.mix.exemptDebit, 41);
  assert.equal(
    HELCIM_DEFAULTS.mix.consumerCredit + HELCIM_DEFAULTS.mix.rewardsCredit + HELCIM_DEFAULTS.mix.commercial,
    59,
  );
  // Assessments run 0.13% to 0.14% plus about two cents an authorization.
  assert.ok(HELCIM_DEFAULTS.assessmentRate >= 0.13 && HELCIM_DEFAULTS.assessmentRate <= 0.14);
  assert.ok(HELCIM_DEFAULTS.assessmentFixed >= 0.015 && HELCIM_DEFAULTS.assessmentFixed <= 0.04);
  assert.equal(helcimTierForVolume(HELCIM_DEFAULTS.monthlyVolume, HELCIM_VOLUME_TIERS).id, "t1");
});

test("HELCIM_RATE_CARD and HELCIM_VOLUME_TIERS cannot drift apart", () => {
  assert.equal(HELCIM_RATE_CARD.key, "helcim");
  assert.equal(HELCIM_RATE_CARD.processorSlug, "helcim");
  assert.equal(HELCIM_RATE_CARD.plans.length, HELCIM_VOLUME_TIERS.length);

  const inPerson = HELCIM_RATE_CARD.channels.find((c) => c.id === "inPerson");
  const online = HELCIM_RATE_CARD.channels.find((c) => c.id === "online");
  assert.ok(inPerson && online, "the card carries both channels the widget offers");

  HELCIM_VOLUME_TIERS.forEach((tier, i) => {
    const plan = HELCIM_RATE_CARD.plans[i];
    assert.ok(plan);
    assert.equal(plan.id, tier.id, "plan ids track tier ids in order");
    assert.equal(plan.label, tier.label);
    // Helcim has no plan fee at any volume. A non-zero figure here would mean
    // the plans slot had been repurposed for something else again.
    assert.equal(plan.monthly, 0);
    assert.deepEqual(inPerson.rates[tier.id], tier.inPerson, `${tier.id} card-present markup agrees`);
    assert.deepEqual(online.rates[tier.id], tier.online, `${tier.id} online markup agrees`);
  });

  assert.deepEqual(tierRate(HELCIM_VOLUME_TIERS[0]!, "inPerson"), { rate: 0.4, fixed: 0.08 });
  assert.deepEqual(tierRate(HELCIM_VOLUME_TIERS[0]!, "online"), { rate: 0.5, fixed: 0.25 });
});

// ---------------------------------------------------------------------------
// The figures printed in the page copy
// ---------------------------------------------------------------------------

test("the worked example on the page is the number the widget computes", () => {
  const input = buildInput();
  const r = helcimMonthlyCost(input);

  // "Interchange $446.37, assessments $49.00, Helcim margin $160.00,
  //  total $655.37, 2.18 percent, $1.31 a sale."
  assert.equal(r.interchange, 446.37);
  assert.equal(r.assessments, 49);
  assert.equal(r.markup, 160);
  assert.equal(r.total, 655.37);
  assert.equal(r.effectiveRatePct.toFixed(2), "2.18");
  assert.equal(r.perTransaction.toFixed(2), "1.31");

  // "Helcim keeps 24 percent of the bill."
  assert.equal(Math.round((r.markup / r.total) * 100), 24);

  // "$33.33 a month, $399.96 a year, 7 basis points."
  assert.ok(r.nextTier);
  assert.equal(r.nextTier.monthlySaving, 33.33);
  assert.equal(r.nextTier.annualSaving, 399.96);
  assert.equal(Math.round(r.nextTier.savingBps), 7);

  // The per-band interchange lines quoted in the copy.
  const line = (id: string) => r.bands.find((b) => b.id === id);
  assert.equal(line("regulatedDebit")?.interchange, 31.25);
  assert.equal(line("exemptDebit")?.interchange, 50.4);
  assert.equal(line("consumerCredit")?.interchange, 120.72);
  assert.equal(line("rewardsCredit")?.interchange, 204);
  assert.equal(line("commercial")?.interchange, 40);
});

test("the rate table on the page is the ladder the widget computes", () => {
  const inPerson = helcimMonthlyCost(buildInput());
  const online = helcimMonthlyCost(buildInput({ channel: "online" }));

  assert.deepEqual(
    inPerson.ladder.map((row) => `${row.effectiveRatePct.toFixed(2)}%`),
    ["2.18%", "2.12%", "2.02%", "1.95%", "1.90%"],
  );
  assert.deepEqual(
    online.ladder.map((row) => `${row.effectiveRatePct.toFixed(2)}%`),
    ["2.84%", "2.70%", "2.60%", "2.42%", "2.32%"],
  );
  assert.deepEqual(online.ladder.map((row) => row.markup), [275, 235, 205, 150, 120]);
});

test("the flat-rate comparisons in the copy are arithmetic on published rates", () => {
  const inPerson = helcimMonthlyCost(buildInput());
  const online = helcimMonthlyCost(buildInput({ channel: "online" }));

  // Square Free in person, 2.6% + $0.15 on the same month.
  const square = 30_000 * 0.026 + 500 * 0.15;
  assert.equal(square, 855);
  close(square - inPerson.total, 199.63, 1e-9, "monthly saving against Square Free in person");
  close((square - inPerson.total) * 12, 2_395.56, 1e-9, "annual saving against Square Free");

  // Stripe online, 2.9% + $0.30 on the same month.
  const stripe = 30_000 * 0.029 + 500 * 0.3;
  assert.equal(stripe, 1_020);
  close(stripe - online.total, 169.47, 1e-9, "monthly saving against Stripe online");
  close((stripe - online.total) * 12, 2_033.64, 1e-9, "annual saving against Stripe online");
});

test("helcimCostAtTier reprices a month at any band without touching the network cost", () => {
  const input = buildInput();
  const t1 = HELCIM_VOLUME_TIERS[0];
  const t5 = HELCIM_VOLUME_TIERS[4];
  assert.ok(t1 && t5);
  const cheap = helcimCostAtTier(input, t5);
  const dear = helcimCostAtTier(input, t1);
  assert.equal(dear.interchange, cheap.interchange);
  assert.equal(dear.assessments, cheap.assessments);
  close(dear.total - cheap.total, 160 - 75, 1e-9, "the whole difference is the margin");
});
