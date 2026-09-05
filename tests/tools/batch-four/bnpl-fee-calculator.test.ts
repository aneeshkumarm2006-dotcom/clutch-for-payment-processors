import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bnplMonthly,
  compareProviders,
  feeCents,
  requiredAovUplift,
  singleOrder,
} from "../../../lib/calc/bnpl";
import { BNPL_DEFAULTS, BNPL_PROVIDERS, getBnplProvider } from "../../../lib/tools-data/bnpl";

/**
 * Every expected value below was derived independently of the implementation:
 * by hand from the stated inputs, or from a closed form worked separately. The
 * arithmetic is small enough that this is possible, which is exactly why it is
 * worth doing. A test that asserts whatever the function happened to return
 * pins the bug in place.
 *
 * The failure modes being pinned, all of them silent:
 *
 *   1. THE WRONG DENOMINATOR. This is the defect the whole page exists to
 *      correct. Compute the return on TOTAL BNPL volume and a method that
 *      destroys margin looks profitable, because the gross margin on sales you
 *      already had dwarfs a three point fee. The switched population and the
 *      incremental population are asserted separately so they cannot be merged.
 *   2. A BREAK-EVEN SOLVED ON THE WRONG BRANCH. `requiredAovUplift` divides by
 *      gross margin minus the BNPL rate. When margin is below the rate that
 *      denominator flips sign and the formula returns a confident negative
 *      number that reads as "the basket has to SHRINK". Both signs are asserted.
 *   3. ROUNDING THE FEE ONCE INSTEAD OF PER ORDER. A processor prices each
 *      transaction separately. Rounding the monthly total once moves the answer
 *      by up to half a cent per order, which is dollars at any real volume.
 *   4. TWO BREAK-EVENS THAT DISAGREE. The break-even order count and the
 *      break-even incremental share describe the same indifference point from
 *      two directions. Feeding one back into the model has to produce the other.
 *   5. A DATA ROW WITHOUT A SOURCE, or a rate outside the range any US BNPL
 *      provider actually publishes.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

// ---------------------------------------------------------------------------
// Per-order fee arithmetic
// ---------------------------------------------------------------------------

test("feeCents: a $120 order at 5.99% + $0.30 costs 749 cents, computed by hand", () => {
  // 120.00 x 0.0599 = 7.188, which is 718.8 cents, rounding half up to 719.
  // Plus the 30 cent fixed fee = 749 cents.
  assert.equal(feeCents(120, 5.99, 0.3), 749);
});

test("feeCents: the same order on a card at 2.9% + $0.30 costs 378 cents", () => {
  // 120.00 x 0.029 = 3.48 exactly, 348 cents, plus 30 = 378.
  assert.equal(feeCents(120, 2.9, 0.3), 378);
});

test("feeCents: rounds the percentage half UP, the direction a processor rounds", () => {
  // 8.35 x 0.06 = 0.501, which is 50.1 cents and must round to 50, not 51.
  assert.equal(feeCents(8.35, 6, 0), 50);
  // 8.42 x 0.06 = 0.5052 -> 50.52 cents -> 51.
  assert.equal(feeCents(8.42, 6, 0), 51);
  // Exactly half: 25.00 x 0.062 = 1.55 exactly. No rounding needed, 155 cents.
  assert.equal(feeCents(25, 6.2, 0), 155);
});

test("singleOrder: a $40 basket makes BNPL 1.85 times the card fee, not 'three points more'", () => {
  // Card:   40 x 0.029  = 1.16 exactly, 116 cents, + 30 = 146 cents = $1.46.
  // Klarna: 40 x 0.0599 = 2.396, which is 239.6 cents rounding half up to 240,
  //         + 30 = 270 cents = $2.70.
  // 2.70 / 1.46 = 1.84931...  Effective rates: 3.65% and 6.75%.
  const r = singleOrder({
    orderValue: 40,
    cardRatePct: 2.9,
    cardFixedFee: 0.3,
    bnplRatePct: 5.99,
    bnplFixedFee: 0.3,
  });
  assert.equal(r.cardFee, 1.46);
  assert.equal(r.bnplFee, 2.7);
  assert.equal(r.extraFee, 1.24);
  close(r.multipleOfCard, 1.8493, 0.0005, "multiple of card on a $40 basket");
  close(r.cardEffectiveRatePct, 3.65, 0.005, "card effective rate on $40");
  close(r.bnplEffectiveRatePct, 6.75, 0.005, "BNPL effective rate on $40");
  assert.equal(r.netAfterBnpl, 37.3);
});

test("singleOrder: PayPal Pay Later's 49 cent fixed fee costs more than the rate gap on a small basket", () => {
  // Pay Later 4.99% + 0.49 against Klarna 5.99% + 0.30 on a $15 basket.
  // Pay Later: 15 x 0.0499 = 0.7485 -> 74.85 cents -> 75, + 49 = 124 cents.
  // Klarna:    15 x 0.0599 = 0.8985 -> 89.85 cents -> 90, + 30 = 120 cents.
  // The lower rate is the more expensive method here, by 4 cents.
  const payLater = singleOrder({
    orderValue: 15,
    cardRatePct: 2.9,
    cardFixedFee: 0.3,
    bnplRatePct: 4.99,
    bnplFixedFee: 0.49,
  });
  const klarna = singleOrder({
    orderValue: 15,
    cardRatePct: 2.9,
    cardFixedFee: 0.3,
    bnplRatePct: 5.99,
    bnplFixedFee: 0.3,
  });
  assert.equal(payLater.bnplFee, 1.24);
  assert.equal(klarna.bnplFee, 1.2);
  assert.ok(payLater.bnplFee > klarna.bnplFee, "the cheaper percentage should lose on a small basket");
});

// ---------------------------------------------------------------------------
// The month, and the two populations
// ---------------------------------------------------------------------------

/**
 * The page defaults, worked entirely by hand first.
 *
 * 1,200 orders, $120 basket, card 2.9% + $0.30, Klarna 5.99% + $0.30,
 * 12 percent BNPL mix, 25 percent of those genuinely new, no basket uplift,
 * 45 percent gross margin.
 *
 *   BNPL orders        1,200 x 0.12          = 144
 *   Incremental        144 x 0.25            = 36
 *   Switched           144 - 36              = 108
 *   Card orders        1,200 - 144           = 1,056
 *   Baseline orders    1,056 + 108           = 1,164
 *   Card fee           $3.78   (asserted above)
 *   Klarna fee         $7.49   (asserted above)
 *   Card contribution  120 x 0.45 - 3.78     = 54.00 - 3.78 = $50.22
 *   BNPL contribution  120 x 0.45 - 7.49     = 54.00 - 7.49 = $46.51
 *   Switching margin   46.51 - 50.22         = -$3.71 per switched order
 *   Cannibalization    108 x 3.71            = $400.68 a month
 *   Incremental profit 36 x 46.51            = $1,674.36 a month
 *   Net                1,674.36 - 400.68     = $1,273.68 a month
 */
const DEFAULTS = {
  monthlyOrders: 1200,
  averageOrderValue: 120,
  cardRatePct: 2.9,
  cardFixedFee: 0.3,
  bnplRatePct: 5.99,
  bnplFixedFee: 0.3,
  bnplSharePct: 12,
  incrementalSharePct: 25,
  aovUpliftPct: 0,
  grossMarginPct: 45,
};

test("bnplMonthly: splits the populations exactly as the hand calculation does", () => {
  const r = bnplMonthly(DEFAULTS);
  assert.equal(r.bnplOrders, 144);
  assert.equal(r.incrementalOrders, 36);
  assert.equal(r.switchedOrders, 108);
  assert.equal(r.cardOrders, 1056);
  assert.equal(r.baselineOrders, 1164);
});

test("bnplMonthly: the cannibalization bill is $400.68, and it is NOT the net answer", () => {
  const r = bnplMonthly(DEFAULTS);
  close(r.cannibalizationCost, 400.68, 0.005, "cannibalization cost");
  close(r.switchingMarginPerOrder, -3.71, 0.0005, "switching margin per order");
  close(r.incrementalProfit, 1674.36, 0.005, "incremental profit");
  close(r.netMonthlyEffect, 1273.68, 0.005, "net monthly effect");
  close(r.netAnnualEffect, 15284.16, 0.05, "net annual effect");
  assert.equal(r.alreadyPaysForItself, true);
});

test("bnplMonthly: the wrong denominator would report five times the truth", () => {
  // The defect this page corrects. Running the margin on ALL 144 BNPL orders
  // instead of the 36 incremental ones gives 144 x 46.51 = $6,697.44, which is
  // 5.26x the honest $1,273.68. Both numbers are plausible on a page about BNPL.
  const r = bnplMonthly(DEFAULTS);
  const wrong = r.bnplOrders * r.incrementalMarginPerOrder;
  close(wrong, 6697.44, 0.01, "the naive total-volume answer");
  assert.ok(wrong > r.netMonthlyEffect * 5, "the naive answer should be more than five times the honest one");
});

test("bnplMonthly: at zero incrementality the whole thing is pure cost", () => {
  // Every BNPL order would have happened anyway: 144 switched orders at -$3.71.
  // 144 x 3.71 = $534.24 of pure loss, and nothing offsets it.
  const r = bnplMonthly({ ...DEFAULTS, incrementalSharePct: 0 });
  assert.equal(r.incrementalOrders, 0);
  assert.equal(r.switchedOrders, 144);
  close(r.netMonthlyEffect, -534.24, 0.005, "net at zero incrementality");
  assert.equal(r.alreadyPaysForItself, false);
});

test("bnplMonthly: the blended effective rate rises from 3.15% to 3.52%", () => {
  // Baseline: 1,164 orders x $3.78 = $4,399.92 of fees on 1,164 x $120 =
  // $139,680 of revenue. 4399.92 / 139680 = 3.1500%.
  // With BNPL: 1,056 x 3.78 + 144 x 7.49 = 3,991.68 + 1,078.56 = $5,070.24 on
  // 1,200 x $120 = $144,000. 5070.24 / 144000 = 3.5210%.
  const r = bnplMonthly(DEFAULTS);
  close(r.baselineEffectiveRatePct, 3.15, 0.002, "baseline blended rate");
  close(r.blendedEffectiveRatePct, 3.521, 0.002, "blended rate with BNPL");
  close(r.baselineFeeBill, 4399.92, 0.01, "baseline monthly fee bill");
  close(r.feeBill, 5070.24, 0.01, "monthly fee bill with BNPL");
});

// ---------------------------------------------------------------------------
// The two break-evens, and the requirement that they agree
// ---------------------------------------------------------------------------

test("bnplMonthly: 8.61 extra orders a month pay for 108 cannibalized ones", () => {
  // 400.68 deficit / 46.51 contribution per new order = 8.6149... orders.
  // Against 1,164 baseline orders that is a 0.740 percent lift. Nine orders.
  const r = bnplMonthly(DEFAULTS);
  close(r.breakEvenIncrementalOrders, 8.6149, 0.001, "break-even incremental orders");
  close(r.breakEvenOrderLiftPct, 0.74, 0.002, "break-even order lift");
  assert.equal(Math.ceil(r.breakEvenIncrementalOrders), 9);
});

test("bnplMonthly: the break-even incremental share matches the closed form 7.39%", () => {
  // s* = -T1 / (T2 - T1) = 3.71 / (46.51 + 3.71) = 3.71 / 50.22 = 0.0738749...
  const r = bnplMonthly(DEFAULTS);
  close(r.breakEvenIncrementalSharePct, 7.3875, 0.001, "break-even incremental share");
});

test("bnplMonthly: feeding the break-even share back in produces a net of exactly zero", () => {
  // The two break-evens describe one indifference point. If they disagree, one
  // of them is wrong and neither would look wrong on the page.
  const r = bnplMonthly(DEFAULTS);
  const atBreakEven = bnplMonthly({
    ...DEFAULTS,
    incrementalSharePct: r.breakEvenIncrementalSharePct,
  });
  close(atBreakEven.netMonthlyEffect, 0, 0.0001, "net at the break-even share");
});

test("requiredAovUplift: the basket has to grow 7.92% with no extra orders at all", () => {
  // x = [A(g - c) - cf + bf] / (g - b)
  //   = [120(0.45 - 0.029) - 0.30 + 0.30] / (0.45 - 0.0599)
  //   = 50.52 / 0.3901 = 129.5052...
  // 129.5052 / 120 - 1 = 0.079210 -> 7.9210 percent, $9.51 of extra basket.
  const r = requiredAovUplift({
    averageOrderValue: 120,
    cardRatePct: 2.9,
    cardFixedFee: 0.3,
    bnplRatePct: 5.99,
    bnplFixedFee: 0.3,
    grossMarginPct: 45,
  });
  assert.equal(r.solvable, true);
  close(r.requiredOrderValue, 129.5052, 0.001, "required order value");
  close(r.requiredAovUpliftPct, 7.921, 0.002, "required AOV uplift");
  close(r.requiredExtraDollars, 9.5052, 0.001, "required extra dollars of basket");
});

test("requiredAovUplift: the required uplift is far below every vendor's claim, which is the point", () => {
  // Klarna claims 40 percent, Afterpay 58 percent, Sezzle 50 percent or more.
  // The break-even at these inputs is under 8 percent. If any vendor claim were
  // causal the decision would be trivial, which is why the claim is the thing to
  // test rather than the arithmetic.
  const r = requiredAovUplift({
    averageOrderValue: 120,
    cardRatePct: 2.9,
    cardFixedFee: 0.3,
    bnplRatePct: 5.99,
    bnplFixedFee: 0.3,
    grossMarginPct: 45,
  });
  assert.ok(r.requiredAovUpliftPct < 40, "break-even uplift should sit below the smallest vendor claim");
});

test("requiredAovUplift: refuses to answer when gross margin is below the BNPL rate", () => {
  // A 5 percent gross margin grocer offered a 5.99 percent method. The
  // denominator 0.05 - 0.0599 is negative, so the closed form returns a negative
  // required basket, which would render as "shrink the basket by 105 percent".
  const r = requiredAovUplift({
    averageOrderValue: 120,
    cardRatePct: 2.9,
    cardFixedFee: 0.3,
    bnplRatePct: 5.99,
    bnplFixedFee: 0.3,
    grossMarginPct: 5,
  });
  assert.equal(r.solvable, false);
  assert.equal(r.requiredAovUpliftPct, 0);
});

test("bnplMonthly: below-margin BNPL is flagged, and even new orders lose money there", () => {
  const r = bnplMonthly({ ...DEFAULTS, grossMarginPct: 5 });
  assert.equal(r.marginBelowBnplRate, true);
  // Contribution on a new order: 120 x 0.05 - 7.49 = 6.00 - 7.49 = -$1.49.
  close(r.incrementalMarginPerOrder, -1.49, 0.0005, "contribution on a new order at 5% margin");
  assert.equal(r.breakEvenIncrementalOrders, 0, "no order count can fix a negative contribution");
});

test("bnplMonthly: a real basket uplift can make switching profitable, and the model says so", () => {
  // At a 20 percent uplift the BNPL basket is $144.
  // Fee: 144 x 0.0599 = 8.6256 -> 862.56 cents -> 863, + 30 = 893 cents = $8.93.
  // Contribution: 144 x 0.45 - 8.93 = 64.80 - 8.93 = $55.87 against $50.22.
  // Switching margin per order = +$5.65, so cannibalization stops being a cost.
  const r = bnplMonthly({ ...DEFAULTS, aovUpliftPct: 20 });
  assert.equal(r.bnplOrderValue, 144);
  close(r.bnplFeePerOrder, 8.93, 0.0005, "fee on a $144 basket");
  close(r.switchingMarginPerOrder, 5.65, 0.0005, "switching margin at a 20% uplift");
  assert.equal(r.breakEvenIncrementalOrders, 0, "nothing to break even on when switching already pays");
  // The extra FEE is still real and still reported: 8.93 - 3.78 = 5.15 on 108
  // switched orders = $556.20. A page that reported only the net would hide it.
  close(r.cannibalizationCost, 556.2, 0.005, "extra fee even when the swap is profitable");
});

test("bnplMonthly: order counts are never rounded before the money is multiplied", () => {
  // 12 percent of 1,199 orders is 143.88 BNPL orders, not 144. Rounding first
  // would move the fee bill by roughly a cent per order and make the outputs
  // stop reconciling with each other.
  const r = bnplMonthly({ ...DEFAULTS, monthlyOrders: 1199 });
  close(r.bnplOrders, 143.88, 1e-9, "fractional BNPL order count");
  close(r.incrementalOrders, 35.97, 1e-9, "fractional incremental order count");
  // And the parts still add up to the whole.
  close(
    r.netMonthlyEffect,
    r.switchedOrders * r.switchingMarginPerOrder + r.incrementalProfit,
    1e-9,
    "net reconciles with its own components",
  );
});

test("bnplMonthly: revenue and fees reconcile with the populations at every mix", () => {
  for (const share of [0, 5, 12, 33, 60, 100]) {
    for (const inc of [0, 25, 50, 100]) {
      const r = bnplMonthly({ ...DEFAULTS, bnplSharePct: share, incrementalSharePct: inc });
      close(
        r.revenue,
        r.cardOrders * DEFAULTS.averageOrderValue + r.bnplOrders * r.bnplOrderValue,
        1e-6,
        `revenue at ${share}% mix, ${inc}% incremental`,
      );
      close(
        r.feeBill,
        r.cardOrders * r.cardFeePerOrder + r.bnplOrders * r.bnplFeePerOrder,
        1e-6,
        `fee bill at ${share}% mix, ${inc}% incremental`,
      );
      assert.ok(r.blendedEffectiveRatePct >= 0, "blended rate should never go negative");
    }
  }
});

// ---------------------------------------------------------------------------
// Provider comparison
// ---------------------------------------------------------------------------

test("compareProviders: sorts by fee and prices Zip cheapest, Sezzle dearest, on $120", () => {
  const rows = compareProviders(
    120,
    2.9,
    0.3,
    144,
    BNPL_PROVIDERS.map((p) => ({ id: p.id, name: p.name, ratePct: p.ratePct, fixedFee: p.fixedFee })),
  );
  assert.equal(rows.length, 6);
  // By hand on a $120 basket:
  //   Zip      4.50% + 0.30 -> 540 + 30 = 570 cents = $5.70
  //   PayPal   4.99% + 0.49 -> 598.8 -> 599 + 49 = 648 cents = $6.48
  //   Klarna   5.99% + 0.30 -> 718.8 -> 719 + 30 = 749 cents = $7.49
  //   Afterpay 6.00% + 0.30 -> 720 + 30 = 750 cents = $7.50
  //   Affirm   6.00% + 0.30 -> 750 cents = $7.50
  //   Sezzle   6.10% + 0.30 -> 732 + 30 = 762 cents = $7.62
  assert.equal(rows[0]?.id, "zip");
  assert.equal(rows[0]?.fee, 5.7);
  assert.equal(rows[1]?.id, "paypal-pay-later");
  assert.equal(rows[1]?.fee, 6.48);
  assert.equal(rows[rows.length - 1]?.id, "sezzle");
  assert.equal(rows[rows.length - 1]?.fee, 7.62);
  // Sezzle against a 2.9% + $0.30 card on the same basket: 7.62 / 3.78 = 2.0159x
  close(rows[rows.length - 1]?.multipleOfCard ?? 0, 2.0159, 0.001, "Sezzle as a multiple of the card fee");
  // And the monthly extra on 144 BNPL orders: (7.62 - 3.78) x 144 = $552.96
  close(rows[rows.length - 1]?.monthlyExtraFee ?? 0, 552.96, 0.005, "Sezzle monthly extra fee");
});

test("compareProviders: every published US BNPL rate is at least 1.5x a 2.9% card on a $120 basket", () => {
  const rows = compareProviders(
    120,
    2.9,
    0.3,
    144,
    BNPL_PROVIDERS.map((p) => ({ id: p.id, name: p.name, ratePct: p.ratePct, fixedFee: p.fixedFee })),
  );
  for (const row of rows) {
    assert.ok(
      row.multipleOfCard >= 1.5,
      `${row.name} priced at only ${row.multipleOfCard.toFixed(2)}x the card fee, which contradicts the page`,
    );
  }
});

// ---------------------------------------------------------------------------
// The dataset
// ---------------------------------------------------------------------------

test("BNPL_PROVIDERS: every row carries a source, a rate note, a settlement line and a liability line", () => {
  assert.ok(BNPL_PROVIDERS.length >= 6, "the page promises at least six providers");
  for (const p of BNPL_PROVIDERS) {
    assert.ok(p.source.length > 40, `${p.name} has no usable source string`);
    assert.ok(/20\d\d/.test(p.source), `${p.name} source carries no year`);
    assert.ok(p.rateNote.length > 40, `${p.name} has no rate note`);
    assert.ok(p.settlement.length > 20, `${p.name} has no settlement line`);
    assert.ok(p.liability.length > 40, `${p.name} has no liability line`);
    assert.ok(p.upliftClaim.length > 20, `${p.name} has no uplift claim recorded`);
  }
});

test("BNPL_PROVIDERS: every rate sits inside the range US BNPL providers actually publish", () => {
  for (const p of BNPL_PROVIDERS) {
    assert.ok(p.ratePct >= 4 && p.ratePct <= 8, `${p.name} rate ${p.ratePct}% is outside 4% to 8%`);
    assert.ok(p.ratePctHigh >= p.ratePct, `${p.name} range is inverted`);
    assert.ok(p.ratePctHigh <= 10, `${p.name} top of range ${p.ratePctHigh}% is implausible`);
    assert.ok(p.fixedFee >= 0 && p.fixedFee <= 1, `${p.name} fixed fee ${p.fixedFee} is implausible`);
  }
});

test("BNPL_PROVIDERS: ids are unique, and the default provider id resolves", () => {
  const ids = new Set(BNPL_PROVIDERS.map((p) => p.id));
  assert.equal(ids.size, BNPL_PROVIDERS.length);
  const provider = getBnplProvider(BNPL_DEFAULTS.providerId, BNPL_PROVIDERS);
  assert.equal(provider.id, "klarna");
  assert.equal(provider.ratePct, 5.99);
});

test("BNPL_DEFAULTS: the defaults are conservative rather than flattering", () => {
  // A vendor uplift number as the default would make the calculator agree with
  // the marketing before the merchant typed anything.
  assert.equal(BNPL_DEFAULTS.aovUpliftPct, 0);
  assert.ok(BNPL_DEFAULTS.incrementalSharePct <= 50, "the default must not assume most BNPL sales are new");
  assert.ok(BNPL_DEFAULTS.grossMarginPct > BNPL_DEFAULTS.cardRatePct);
});

test("BNPL_DEFAULTS: the server-rendered default state produces the worked example figures", () => {
  // The single most embarrassing defect available on this site is a hand-written
  // number in the copy that the widget on the same page contradicts. This test
  // is the guard: it runs the SHIPPED defaults, not a local copy of them.
  const provider = getBnplProvider(BNPL_DEFAULTS.providerId, BNPL_PROVIDERS);
  const r = bnplMonthly({
    monthlyOrders: BNPL_DEFAULTS.monthlyOrders,
    averageOrderValue: BNPL_DEFAULTS.averageOrderValue,
    cardRatePct: BNPL_DEFAULTS.cardRatePct,
    cardFixedFee: BNPL_DEFAULTS.cardFixedFee,
    bnplRatePct: provider.ratePct,
    bnplFixedFee: provider.fixedFee,
    bnplSharePct: BNPL_DEFAULTS.bnplSharePct,
    incrementalSharePct: BNPL_DEFAULTS.incrementalSharePct,
    aovUpliftPct: BNPL_DEFAULTS.aovUpliftPct,
    grossMarginPct: BNPL_DEFAULTS.grossMarginPct,
  });
  close(r.cannibalizationCost, 400.68, 0.005, "worked example cannibalization cost");
  close(r.netMonthlyEffect, 1273.68, 0.005, "worked example net monthly effect");
  close(r.breakEvenIncrementalOrders, 8.6149, 0.001, "worked example break-even orders");
  close(r.breakEvenIncrementalSharePct, 7.3875, 0.001, "worked example break-even share");
  close(r.blendedEffectiveRatePct, 3.521, 0.002, "worked example blended rate");
});
