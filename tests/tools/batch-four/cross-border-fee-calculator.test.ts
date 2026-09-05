import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessmentCost,
  assessmentTotalPct,
  blendedMonth,
  crossBorderPayment,
  fromUsdPerUnit,
  fxForward,
  fxMarkup,
  toUsdPerUnit,
  type CrossBorderRates,
} from "../../../lib/calc/fx";
import {
  CROSS_BORDER_FEES,
  FX_DEFAULTS,
  FX_MARKUP_BANDS,
  FX_REFERENCE_RATES,
  NETWORK_CROSS_BORDER_ASSESSMENTS,
} from "../../../lib/tools-data/fx";

/**
 * Every reference value below was derived INDEPENDENTLY of the implementation:
 * by hand from the published rate, or from a closed form worked out separately.
 * A test that asserts what the code happens to return pins the bug in place.
 *
 * The four failure modes this file exists to catch:
 *
 *  1. THE DIRECTION OF A QUOTE. The Federal Reserve prints the euro as dollars
 *     per euro and the yen as yen per dollar. Inverting one does not throw, it
 *     returns a confident number. Asserted by expressing the SAME economic
 *     situation both ways round and requiring an identical markup, and against a
 *     closed form (a rate 3% worse costs 1 - 1/1.03 of the value).
 *  2. THE BASE THE MARKUP IS MEASURED AGAINST. (mid - received)/mid and
 *     (mid - received)/received differ by about 3% of themselves and both are
 *     used in public. Both are asserted, separately, against hand arithmetic.
 *  3. DOUBLE COUNTING THE NETWORK ASSESSMENT. On flat rate pricing the
 *     processor add-on replaces the assessment. Charging both inflates a foreign
 *     card by roughly 145 basis points and looks entirely plausible.
 *  4. A MISTYPED COMPONENT INSIDE A CORRECT LOOKING TOTAL. The network totals
 *     are summed from their published components and asserted against figures
 *     hand added from the Wells Fargo pass-through schedule.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** Stripe's published US online rates, which are also the widget's opening state. */
const STRIPE: CrossBorderRates = {
  basePct: 2.9,
  baseFixed: 0.3,
  internationalPct: 1.5,
  fxMarkupPct: 1,
  networkPct: 1.45,
  networkFixed: 0.02,
};

// ---------------------------------------------------------------------------
// One payment
// ---------------------------------------------------------------------------

test("crossBorderPayment: a $180 converted foreign card on Stripe costs $10.02, hand computed", () => {
  // 2.9% of 180 = 5.20 + 0.02 = 5.22, plus the 30 cent fixed fee = 5.52.
  // 1.5% of 180 = 2.70. 1% of 180 = 1.80. 5.52 + 2.70 + 1.80 = 10.02.
  const r = crossBorderPayment({
    amount: 180,
    foreignCard: true,
    currencyConverted: true,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  assert.equal(r.baseFee, 5.52);
  assert.equal(r.internationalFee, 2.7);
  assert.equal(r.conversionCost, 1.8);
  assert.equal(r.total, 10.02);
  assert.equal(r.net, 169.98);
  close(r.effectiveRatePct, (10.02 / 180) * 100, 1e-9, "all-in rate");
  close(r.effectiveRatePct, 5.5666666, 1e-5, "all-in rate against the hand figure");
});

test("crossBorderPayment: the cross border premium is $4.50, which is 2.5% of the sale and 81.5% of the domestic fee", () => {
  const r = crossBorderPayment({
    amount: 180,
    foreignCard: true,
    currencyConverted: true,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  // 10.02 - 5.52 = 4.50. 4.50 / 180 = 2.5%. 4.50 / 5.52 = 81.5217%.
  assert.equal(r.domesticTotal, 5.52);
  assert.equal(r.crossBorderPremium, 4.5);
  close(r.crossBorderPremiumPct, 2.5, 1e-9, "premium as a share of the sale");
  close(r.premiumAsShareOfDomesticFeePct, 81.5217391, 1e-4, "premium against the domestic fee");
});

test("crossBorderPayment: geography and currency are independent, so three of the four combinations differ", () => {
  const at = (foreignCard: boolean, currencyConverted: boolean) =>
    crossBorderPayment({ amount: 180, foreignCard, currencyConverted, passThroughNetwork: false, rates: STRIPE })
      .total;
  // Hand computed: base 5.52; +2.70 foreign; +1.80 converted.
  assert.equal(at(false, false), 5.52);
  assert.equal(at(true, false), 8.22);
  assert.equal(at(false, true), 7.32);
  assert.equal(at(true, true), 10.02);
});

test("crossBorderPayment: interchange plus swaps the processor add-on for the network assessment, it does not add both", () => {
  const flat = crossBorderPayment({
    amount: 180,
    foreignCard: true,
    currencyConverted: false,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  const passThrough = crossBorderPayment({
    amount: 180,
    foreignCard: true,
    currencyConverted: false,
    passThroughNetwork: true,
    rates: STRIPE,
  });
  // Flat rate: 5.52 + 1.5% of 180 = 8.22.
  // Pass-through: 5.52 + 1.45% of 180 (= 2.61) + $0.02 = 8.15.
  assert.equal(flat.total, 8.22);
  assert.equal(passThrough.internationalFee, 0);
  assert.equal(passThrough.networkAssessment, 2.63);
  assert.equal(passThrough.total, 8.15);
  // The bug this guards: 5.52 + 2.70 + 2.63 = 10.85, about 145 bps too much.
  assert.notEqual(passThrough.total, 10.85);
});

test("crossBorderPayment: a zero amount returns zeros rather than NaN or Infinity", () => {
  const r = crossBorderPayment({
    amount: 0,
    foreignCard: true,
    currencyConverted: true,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  assert.equal(r.effectiveRatePct, 0);
  assert.ok(Number.isFinite(r.crossBorderPremiumPct));
  assert.ok(Number.isFinite(r.premiumAsShareOfDomesticFeePct));
});

// ---------------------------------------------------------------------------
// A month of mixed volume
// ---------------------------------------------------------------------------

test("blendedMonth: $60,000 with 18% foreign and 12% converted blends to 3.4567% on Stripe, hand computed", () => {
  // 333.3333 payments. 2.9% of 60,000 = 1,740.00, plus 333.3333 x 0.30 = 100.00,
  // so the baseline is 1,840.00 and 3.0667%. 1.5% of 10,800 = 162.00.
  // 1% of 7,200 = 72.00. Total 2,074.00, which is 3.456667% of 60,000.
  const r = blendedMonth({
    monthlyVolume: 60000,
    averageTicket: 180,
    foreignSharePct: 18,
    convertedSharePct: 12,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  close(r.transactions, 60000 / 180, 1e-9, "transaction count");
  assert.equal(r.baselineCost, 1840);
  assert.equal(r.internationalCost, 162);
  assert.equal(r.conversionCost, 72);
  assert.equal(r.totalMonthlyCost, 2074);
  close(r.blendedRatePct, 3.4566666, 1e-5, "blended rate");
  close(r.baselineRatePct, 3.0666666, 1e-5, "baseline rate");
});

test("blendedMonth: the rate premium is exactly the cross border cost divided by volume", () => {
  const r = blendedMonth({
    monthlyVolume: 60000,
    averageTicket: 180,
    foreignSharePct: 18,
    convertedSharePct: 12,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  // 162 + 72 = 234 a month, 234/60,000 = 0.39 percentage points, 2,808 a year.
  assert.equal(r.crossBorderCostMonthly, 234);
  assert.equal(r.crossBorderCostAnnual, 2808);
  close(r.ratePremiumPct, 0.39, 1e-9, "rate premium in percentage points");
  close(r.ratePremiumPct, (234 / 60000) * 100, 1e-9, "premium identity");
});

test("blendedMonth: with no foreign and no converted volume the blended rate equals the baseline", () => {
  const r = blendedMonth({
    monthlyVolume: 60000,
    averageTicket: 180,
    foreignSharePct: 0,
    convertedSharePct: 0,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  assert.equal(r.crossBorderCostMonthly, 0);
  close(r.ratePremiumPct, 0, 1e-12, "no mix means no premium");
  close(r.blendedRatePct, r.baselineRatePct, 1e-12, "rates agree");
});

test("blendedMonth: shares above 100 are clamped rather than producing more foreign volume than volume", () => {
  const r = blendedMonth({
    monthlyVolume: 10000,
    averageTicket: 100,
    foreignSharePct: 400,
    convertedSharePct: -20,
    passThroughNetwork: false,
    rates: STRIPE,
  });
  assert.equal(r.foreignVolume, 10000);
  assert.equal(r.convertedVolume, 0);
  assert.equal(r.domesticVolume, 0);
});

// ---------------------------------------------------------------------------
// Rate direction
// ---------------------------------------------------------------------------

test("toUsdPerUnit: inverts only the quotes that need inverting, and round trips", () => {
  close(toUsdPerUnit(1.1598, "usd-per-unit"), 1.1598, 1e-12, "euro is already dollars per unit");
  close(toUsdPerUnit(159.97, "unit-per-usd"), 1 / 159.97, 1e-15, "yen inverts");
  close(fromUsdPerUnit(toUsdPerUnit(159.97, "unit-per-usd"), "unit-per-usd"), 159.97, 1e-10, "round trip");
  assert.equal(toUsdPerUnit(0, "usd-per-unit"), 0);
  assert.equal(toUsdPerUnit(-3, "unit-per-usd"), 0);
});

// ---------------------------------------------------------------------------
// The implied markup
// ---------------------------------------------------------------------------

test("fxMarkup: 1,000 euros at 1.1250 against a 1.1598 reference loses $34.80, a 3.00% markup", () => {
  // 1,000 x 1.1598 = 1,159.80. 1,000 x 1.1250 = 1,125.00. Difference 34.80.
  // 34.80 / 1,159.80 = 3.0005%. 34.80 / 1,125.00 = 3.0933%.
  const r = fxMarkup({ foreignAmount: 1000, midRate: 1.1598, receivedRate: 1.125, direction: "usd-per-unit" });
  assert.equal(r.midValue, 1159.8);
  assert.equal(r.receivedValue, 1125);
  assert.equal(r.spreadCost, 34.8);
  close(r.markupPct, 3.00051733, 1e-6, "markup on the value measure");
  close(r.rateSpreadPct, 3.09333333, 1e-6, "markup on the rate measure");
  assert.equal(r.favorable, false);
});

test("fxMarkup: the SAME situation quoted the other way round gives the identical markup", () => {
  // The inversion bug lives here. 1/1.1598 euros per dollar against 1/1.1250.
  const asUsdPerUnit = fxMarkup({
    foreignAmount: 1000,
    midRate: 1.1598,
    receivedRate: 1.125,
    direction: "usd-per-unit",
  });
  const asUnitPerUsd = fxMarkup({
    foreignAmount: 1000,
    midRate: 1 / 1.1598,
    receivedRate: 1 / 1.125,
    direction: "unit-per-usd",
  });
  close(asUnitPerUsd.markupPct, asUsdPerUnit.markupPct, 1e-9, "markup is direction invariant");
  close(asUnitPerUsd.spreadCost, asUsdPerUnit.spreadCost, 0.01, "dollars are direction invariant");
});

test("fxMarkup: adding 3% to a yen-per-dollar quote costs 1 - 1/1.03 of the value, not 3%", () => {
  // Closed form, worked separately: 1 - 1/1.03 = 0.029126213592233...
  const mid = 159.97;
  const received = mid * 1.03;
  const r = fxMarkup({ foreignAmount: 500000, midRate: mid, receivedRate: received, direction: "unit-per-usd" });
  close(r.markupPct, (1 - 1 / 1.03) * 100, 1e-9, "value measure against the closed form");
  close(r.rateSpreadPct, 3, 1e-9, "rate measure is exactly the 3% that was added");
});

test("fxMarkup: a better-than-reference rate is flagged rather than reported as a negative fee", () => {
  const r = fxMarkup({ foreignAmount: 1000, midRate: 1.1598, receivedRate: 1.17, direction: "usd-per-unit" });
  assert.equal(r.favorable, true);
  assert.ok(r.markupPct < 0, "a favorable rate should read as a negative markup, not as zero");
});

test("fxMarkup: a zero or negative rate returns zeros rather than Infinity", () => {
  const r = fxMarkup({ foreignAmount: 1000, midRate: 0, receivedRate: 1.125, direction: "usd-per-unit" });
  assert.equal(r.markupPct, 0);
  assert.equal(r.spreadCost, 0);
  assert.ok(Number.isFinite(r.rateSpreadPct));
});

// ---------------------------------------------------------------------------
// Running it forward
// ---------------------------------------------------------------------------

test("fxForward: a 3% markup on 1,000 euros at 1.1598 costs $34.79 a payment and $20,876.40 a year", () => {
  // 1,000 x 1.1598 = 1,159.80. 3% of that is 34.794, which bills at 34.79.
  // 600 payments x 34.794 = 20,876.40. Annual converted volume 600 x 1,159.80 = 695,880.
  const r = fxForward({
    midRate: 1.1598,
    direction: "usd-per-unit",
    markupPct: 3,
    foreignAmount: 1000,
    transactionsPerYear: 600,
  });
  assert.equal(r.midValuePerTransaction, 1159.8);
  assert.equal(r.costPerTransaction, 34.79);
  assert.equal(r.costPerYear, 20876.4);
  assert.equal(r.annualConvertedVolume, 695880);
  close(r.receivedQuoted, 1.1598 * 0.97, 1e-12, "rate you would receive");
});

test("fxForward and fxMarkup are inverses of each other on the value measure", () => {
  for (const m of [0.25, 0.5, 1, 1.5, 2, 3, 4, 7.5]) {
    for (const direction of ["usd-per-unit", "unit-per-usd"] as const) {
      const midQuoted = direction === "usd-per-unit" ? 1.1598 : 159.97;
      const forward = fxForward({
        midRate: midQuoted,
        direction,
        markupPct: m,
        foreignAmount: 1000,
        transactionsPerYear: 1,
      });
      const back = fxMarkup({
        foreignAmount: 1000,
        midRate: midQuoted,
        receivedRate: forward.receivedQuoted,
        direction,
      });
      close(back.markupPct, m, 1e-9, `round trip at ${m}% quoted as ${direction}`);
    }
  }
});

test("fxForward: an impossible markup returns zeros rather than a negative exchange rate", () => {
  const r = fxForward({
    midRate: 1.1598,
    direction: "usd-per-unit",
    markupPct: 140,
    foreignAmount: 1000,
    transactionsPerYear: 600,
  });
  assert.equal(r.receivedUsdPerUnit, 0);
  assert.equal(r.costPerYear, 0);
});

// ---------------------------------------------------------------------------
// The network layer
// ---------------------------------------------------------------------------

test("assessmentTotalPct: every network total matches the figure hand added from the acquirer schedule", () => {
  // Visa: International Service Fee Base 1.00% + International Acquirer Fee 0.45%.
  // Visa, not settled in USD: Enhanced 1.40% + 0.45%.
  // Mastercard: U.S. Cross Border USD 0.60% + Global Acquirer Fee 0.85%.
  // Mastercard, not settled in USD: 1.00% + 0.85%.
  // Discover: International Service Fee 0.80%.
  const expected: Record<string, number> = {
    "visa-usd": 1.45,
    "visa-nonusd": 1.85,
    "mc-usd": 1.45,
    "mc-nonusd": 1.85,
    discover: 0.8,
  };
  assert.equal(NETWORK_CROSS_BORDER_ASSESSMENTS.length, Object.keys(expected).length);
  for (const a of NETWORK_CROSS_BORDER_ASSESSMENTS) {
    const want = expected[a.id];
    assert.ok(want !== undefined, `unexpected assessment id ${a.id}`);
    close(assessmentTotalPct(a), want, 1e-9, `${a.id} total`);
  }
});

test("assessmentTotalPct: Visa and Mastercard reach the same total by different routes, and both add 40 bps off USD", () => {
  const byId = (id: string) => NETWORK_CROSS_BORDER_ASSESSMENTS.find((a) => a.id === id);
  const visaUsd = byId("visa-usd");
  const visaNon = byId("visa-nonusd");
  const mcUsd = byId("mc-usd");
  const mcNon = byId("mc-nonusd");
  assert.ok(visaUsd && visaNon && mcUsd && mcNon);
  close(assessmentTotalPct(visaUsd), assessmentTotalPct(mcUsd), 1e-9, "USD settled totals agree");
  close(assessmentTotalPct(visaNon), assessmentTotalPct(mcNon), 1e-9, "non-USD totals agree");
  close(assessmentTotalPct(visaNon) - assessmentTotalPct(visaUsd), 0.4, 1e-9, "Visa currency step");
  close(assessmentTotalPct(mcNon) - assessmentTotalPct(mcUsd), 0.4, 1e-9, "Mastercard currency step");
});

test("assessmentCost: 1.45% of a $180 sale plus two cents is $2.63", () => {
  const visaUsd = NETWORK_CROSS_BORDER_ASSESSMENTS.find((a) => a.id === "visa-usd");
  assert.ok(visaUsd);
  // 1.45% of 180 = 2.61, plus the 2 cent per item step = 2.63.
  assert.equal(assessmentCost(visaUsd, 180), 2.63);
});

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

test("CROSS_BORDER_FEES: every row is sourced, dated, and inside a believable range", () => {
  assert.ok(CROSS_BORDER_FEES.length >= 6, "the comparison needs enough rows to be a comparison");
  for (const p of CROSS_BORDER_FEES) {
    assert.ok(p.source.length > 30, `${p.processorSlug} needs a real source string`);
    assert.match(p.source, /202\d/, `${p.processorSlug} source must carry a date`);
    assert.ok(p.basePct >= 0 && p.basePct <= 6, `${p.processorSlug} base rate out of range`);
    assert.ok(p.baseFixed >= 0 && p.baseFixed <= 1, `${p.processorSlug} fixed fee out of range`);
    assert.ok(
      p.internationalPct >= 0 && p.internationalPct <= 3,
      `${p.processorSlug} international add-on out of range`,
    );
    if (p.fxMarkupLowPct !== null) {
      assert.ok(p.fxMarkupHighPct !== null, `${p.processorSlug} has a low markup but no high`);
      assert.ok(
        p.fxMarkupLowPct <= (p.fxMarkupHighPct ?? 0),
        `${p.processorSlug} markup range is the wrong way round`,
      );
      assert.ok(p.fxMarkupLowPct >= 0 && (p.fxMarkupHighPct ?? 0) <= 6, `${p.processorSlug} markup out of range`);
    } else {
      assert.equal(p.fxMarkupHighPct, null, `${p.processorSlug} has a high markup but no low`);
      assert.ok(p.fxMarkupPublished.length > 10, `${p.processorSlug} must say why no markup is published`);
    }
    // A processor that passes network fees through must not also carry its own add-on.
    if (p.passesNetworkFeesThrough) {
      assert.equal(p.internationalPct, 0, `${p.processorSlug} would double count the assessment`);
    }
  }
});

test("NETWORK_CROSS_BORDER_ASSESSMENTS: every row is sourced and every component is a real percentage", () => {
  for (const a of NETWORK_CROSS_BORDER_ASSESSMENTS) {
    assert.match(a.source, /Wells Fargo/, `${a.id} must name the acquirer schedule it came from`);
    assert.match(a.source, /202\d/, `${a.id} source must carry a date`);
    assert.ok(a.components.length >= 1, `${a.id} has no components to sum`);
    for (const c of a.components) {
      assert.ok(c.pct > 0 && c.pct < 3, `${a.id} component ${c.name} out of range`);
    }
    assert.ok(a.incrementalFixed >= 0 && a.incrementalFixed < 0.1, `${a.id} per item step out of range`);
  }
});

test("FX_REFERENCE_RATES: every rate is positive, dated to the Federal Reserve release, and usable in both directions", () => {
  assert.ok(FX_REFERENCE_RATES.length >= 6);
  for (const r of FX_REFERENCE_RATES) {
    assert.ok(r.published > 0, `${r.code} must carry a positive published rate`);
    assert.match(r.source, /H\.10/, `${r.code} must name the H.10 release`);
    const usd = toUsdPerUnit(r.published, r.publishedAs);
    assert.ok(usd > 0 && Number.isFinite(usd), `${r.code} does not normalize`);
    close(fromUsdPerUnit(usd, r.publishedAs), r.published, 1e-9, `${r.code} round trips`);
  }
});

test("FX_MARKUP_BANDS: bands ascend, cover every markup, and always resolve", () => {
  let previous = 0;
  for (const b of FX_MARKUP_BANDS) {
    assert.ok(b.maxPct > previous, `band ${b.label} does not ascend`);
    previous = b.maxPct;
    assert.ok(b.note.length > 30, `band ${b.label} needs a real note`);
  }
  assert.equal(previous, Number.POSITIVE_INFINITY, "the last band must be open ended");
  for (const markup of [-1, 0, 0.24, 1, 1.4, 2.5, 3.4, 12]) {
    const band = FX_MARKUP_BANDS.find((b) => markup < b.maxPct);
    assert.ok(band, `no band matched ${markup}`);
  }
});

test("FX_DEFAULTS: the opening state matches the Stripe row it claims to be, so the page cannot drift from the widget", () => {
  const stripe = CROSS_BORDER_FEES.find((p) => p.processorSlug === FX_DEFAULTS.processorSlug);
  assert.ok(stripe);
  assert.equal(FX_DEFAULTS.basePct, stripe.basePct);
  assert.equal(FX_DEFAULTS.baseFixed, stripe.baseFixed);
  assert.equal(FX_DEFAULTS.internationalPct, stripe.internationalPct);
  assert.equal(FX_DEFAULTS.fxMarkupPct, stripe.fxMarkupLowPct);
  assert.equal(FX_DEFAULTS.passThroughNetwork, stripe.passesNetworkFeesThrough);

  const eur = FX_REFERENCE_RATES.find((r) => r.code === FX_DEFAULTS.currencyCode);
  assert.ok(eur);
  assert.equal(FX_DEFAULTS.midRate, eur.published);
  assert.equal(FX_DEFAULTS.quoteDirection, eur.publishedAs);
  // The default received rate is the reference less exactly the default markup,
  // rounded to four places the way the widget writes it.
  const seeded = Number((eur.published * (1 - FX_DEFAULTS.statedMarkupPct / 100)).toFixed(4));
  assert.equal(FX_DEFAULTS.receivedRate, seeded);
});
