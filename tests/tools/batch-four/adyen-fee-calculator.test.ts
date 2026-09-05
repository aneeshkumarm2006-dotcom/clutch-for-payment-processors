import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adyenFlatRateCrossover,
  adyenMonthlyCost,
  adyenPaymentCost,
  flatRateCost,
  flatRateMonthlyCost,
  type AdyenFeeRates,
} from "../../../lib/calc/adyen";
import {
  ADYEN_DEFAULTS,
  ADYEN_INTERCHANGE_PROFILES,
  ADYEN_PAYMENT_METHODS,
  ADYEN_SCHEME_FEE_NOTES,
} from "../../../lib/tools-data/adyen";
import { ADYEN_RATE_CARD } from "../../../lib/rate-cards/adyen";

/**
 * Every reference value below was derived INDEPENDENTLY of the implementation,
 * by hand from Adyen's published price list and Visa's published interchange
 * schedule, or from a closed form worked out separately. A test that asserts
 * what the code happens to return pins the bug in place.
 *
 * The three failure modes this file exists to catch:
 *
 *  1. The crossover DIRECTION. The ticket size is one division and comes out
 *     plausible in all four cases; the direction flips with the sign of the
 *     percentage gap, and getting it backwards tells a merchant to switch to the
 *     dearer processor. Asserted by evaluating both prices either side of the
 *     computed ticket rather than by trusting the label.
 *  2. Adding interchange and scheme fees to a method Adyen prices with one all
 *     in number. That inflates an American Express payment by about a sixth and
 *     does not throw.
 *  3. Treating the minimum invoice as an extra line rather than a floor, which
 *     overstates a small merchant's bill by the whole of the fees they did
 *     generate.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** Visa Traditional Rewards, card not present, on Adyen's published floor markup. */
const REWARDS: AdyenFeeRates = {
  interchangePlusPlus: true,
  interchangePct: 2.04,
  interchangeFixed: 0.1,
  schemePct: 0.14,
  schemeFixed: 0.0195,
  markupPct: 0.6,
  processingFixed: 0.13,
  methodPct: 0,
  methodFixed: 0,
};

/** Visa Signature Preferred, card not present. Same Adyen price, dearer card. */
const PREFERRED: AdyenFeeRates = { ...REWARDS, interchangePct: 2.5 };

/** American Express, North America: $0.13 + 3.3% + $0.10, and nothing passes through. */
const AMEX: AdyenFeeRates = {
  interchangePlusPlus: false,
  interchangePct: 2.04,
  interchangeFixed: 0.1,
  schemePct: 0.14,
  schemeFixed: 0.0195,
  markupPct: 0.6,
  processingFixed: 0.13,
  methodPct: 3.3,
  methodFixed: 0.1,
};

/** ACH Direct Debit: $0.13 + $0.27, no percentage at all. */
const ACH: AdyenFeeRates = { ...AMEX, methodPct: 0, methodFixed: 0.27 };

// ---------------------------------------------------------------------------
// One payment
// ---------------------------------------------------------------------------

test("adyenPaymentCost: an $85 Visa rewards payment costs $2.61, split $1.97 pass-through and $0.64 Adyen", () => {
  // By hand, from Adyen's published price list and Visa's April 2026 schedule:
  //   interchange  2.04% of 85 = 1.734, plus $0.10          = 1.8340
  //   scheme fee   0.14% of 85 = 0.119, plus $0.0195        = 0.1385
  //   Adyen markup 0.60% of 85                              = 0.5100
  //   Adyen fixed processing fee                            = 0.1300
  //                                                   total = 2.6125 -> $2.61
  const r = adyenPaymentCost(85, REWARDS);
  close(r.interchange, 1.834, 1e-9, "interchange");
  close(r.schemeFee, 0.1385, 1e-9, "scheme fee");
  close(r.markup, 0.51, 1e-9, "Adyen markup");
  close(r.processingFee, 0.13, 1e-9, "Adyen processing fee");
  close(r.passThrough, 1.9725, 1e-9, "pass-through");
  close(r.adyenTake, 0.64, 1e-9, "Adyen's own take");
  assert.equal(r.total, 2.61);
  assert.equal(r.net, 82.39);
  // 2.6125 / 85 = 3.073529...%
  close(r.effectiveRatePct, 3.0735294, 1e-6, "effective rate");
  // 0.64 / 2.6125 = 24.497...%
  close(r.adyenSharePct, 24.4976, 1e-3, "Adyen's share of the total");
});

test("adyenPaymentCost: a blended method gets NO interchange and NO scheme fee added", () => {
  // American Express on Adyen is $0.13 + 3.3% + $0.10 and nothing else.
  //   3.3% of 85 = 2.805, plus $0.10 = 2.905, plus $0.13 = 3.035 -> $3.04
  const r = adyenPaymentCost(85, AMEX);
  assert.equal(r.interchange, 0);
  assert.equal(r.schemeFee, 0);
  assert.equal(r.markup, 0);
  assert.equal(r.split, false);
  close(r.methodFee, 2.905, 1e-9, "method fee");
  assert.equal(r.total, 3.04);
  // The bug this guards: had interchange and scheme fees been added anyway the
  // total would have been 3.035 + 1.9725 = $5.01, a sixth-again too much.
  assert.ok(r.total < 3.5, "blended method must not carry pass-through fees");
});

test("adyenPaymentCost: ACH costs $0.40 whatever the amount, because there is no percentage", () => {
  for (const amount of [40, 400, 4000, 40000]) {
    const r = adyenPaymentCost(amount, ACH);
    assert.equal(r.total, 0.4, `ACH on a $${amount} payment`);
  }
  // The same $4,000 on the rewards card, by hand:
  //   2.04% of 4000 = 81.60, + 0.10 = 81.70
  //   0.14% of 4000 =  5.60, + 0.0195 = 5.6195
  //   0.60% of 4000 = 24.00
  //   processing                        0.13
  //                             total = 111.4495 -> $111.45
  assert.equal(adyenPaymentCost(4000, REWARDS).total, 111.45);
});

// ---------------------------------------------------------------------------
// Crossover, and its direction
// ---------------------------------------------------------------------------

test("crossover: on a plain rewards card Adyen beats 2.9% + $0.30 at every ticket size", () => {
  // Adyen combined: 2.04 + 0.14 + 0.60 = 2.78%, and 0.10 + 0.0195 + 0.13 = $0.2495.
  // Lower on BOTH components than 2.9% + $0.30, so the lines never meet.
  const c = adyenFlatRateCrossover(2.78, 0.2495, 2.9, 0.3);
  assert.equal(c.kind, "adyen-cheaper-everywhere");
  assert.equal(c.ticket, null);
  // Confirmed independently at both ends of a wide sweep.
  for (const amount of [1, 5, 85, 1000, 25000]) {
    const adyen = adyenPaymentCost(amount, REWARDS).total;
    const flat = flatRateCost(amount, 2.9, 0.3);
    assert.ok(adyen < flat, `at $${amount}: Adyen ${adyen} should beat flat ${flat}`);
  }
});

test("crossover: on a Visa Signature Preferred card the flat rate takes over above $14.85", () => {
  // Adyen combined 2.50 + 0.14 + 0.60 = 3.24% and $0.2495.
  // Adyen's percentage is HIGHER and its fixed fee is LOWER, so it wins on small
  // tickets and loses on large ones. By hand:
  //   (0.30 - 0.2495) / ((3.24 - 2.9) / 100) = 0.0505 / 0.0034 = 14.852941...
  const c = adyenFlatRateCrossover(3.24, 0.2495, 2.9, 0.3);
  assert.equal(c.kind, "adyen-cheaper-below");
  assert.ok(c.ticket !== null);
  close(c.ticket ?? 0, 14.8529412, 1e-4, "Signature Preferred crossover");
  // The direction is verified by pricing both sides, not by trusting the label.
  const below = 10;
  const above = 100;
  assert.ok(adyenPaymentCost(below, PREFERRED).total < flatRateCost(below, 2.9, 0.3));
  assert.ok(adyenPaymentCost(above, PREFERRED).total > flatRateCost(above, 2.9, 0.3));
});

test("crossover: American Express on Adyen crosses at exactly $17.50", () => {
  // Adyen's Amex price is 3.3% + $0.10 + $0.13 = 3.3% + $0.23.
  //   (0.30 - 0.23) / ((3.3 - 2.9) / 100) = 0.07 / 0.004 = 17.50 exactly.
  const c = adyenFlatRateCrossover(3.3, 0.23, 2.9, 0.3);
  assert.equal(c.kind, "adyen-cheaper-below");
  close(c.ticket ?? 0, 17.5, 1e-9, "Amex crossover");
  assert.ok(adyenPaymentCost(17, AMEX).total <= flatRateCost(17, 2.9, 0.3));
  assert.ok(adyenPaymentCost(18, AMEX).total >= flatRateCost(18, 2.9, 0.3));
});

test("crossover: the OTHER direction is reported as the other direction", () => {
  // A hypothetical price with a lower percentage and a higher fixed fee: the
  // classic interchange-plus shape, cheaper only once the ticket is large.
  //   (0.50 - 0.30) / ((2.9 - 2.5) / 100) = 0.20 / 0.004 = $50.00 exactly.
  const c = adyenFlatRateCrossover(2.5, 0.5, 2.9, 0.3);
  assert.equal(c.kind, "adyen-cheaper-above");
  close(c.ticket ?? 0, 50, 1e-9, "reverse crossover");
  // At $49 the flat rate wins; at $51 it does not. Computed here from scratch.
  const at = (amount: number) => ({
    adyen: amount * 0.025 + 0.5,
    flat: amount * 0.029 + 0.3,
  });
  assert.ok(at(49).adyen > at(49).flat);
  assert.ok(at(51).adyen < at(51).flat);
});

test("crossover: identical prices, and a strictly worse price, both return no ticket", () => {
  assert.deepEqual(adyenFlatRateCrossover(2.9, 0.3, 2.9, 0.3), { kind: "identical", ticket: null });
  assert.deepEqual(adyenFlatRateCrossover(3.4, 0.4, 2.9, 0.3), {
    kind: "flat-cheaper-everywhere",
    ticket: null,
  });
  // Equal percentages with a fixed-fee difference is a no-crossover case too,
  // not a division by zero.
  const c = adyenFlatRateCrossover(2.9, 0.2495, 2.9, 0.3);
  assert.equal(c.kind, "adyen-cheaper-everywhere");
  assert.equal(c.ticket, null);
});

// ---------------------------------------------------------------------------
// A month of volume
// ---------------------------------------------------------------------------

test("adyenMonthlyCost: $250,000 at an $85 ticket costs $7,683.78, an effective 3.07%", () => {
  // By hand. 250,000 / 85 = 2,941.18, so 2,941 payments.
  //   interchange  2.04% x 250,000 = 5,100.00 + 2,941 x 0.10   = 5,394.10
  //   scheme fee   0.14% x 250,000 =   350.00 + 2,941 x 0.0195 =   407.3495
  //   Adyen markup 0.60% x 250,000                             = 1,500.00
  //   Adyen fixed                    2,941 x 0.13              =   382.33
  //                                                      total = 7,683.7795
  const m = adyenMonthlyCost({
    monthlyVolume: 250000,
    averageTicket: 85,
    minimumInvoice: 120,
    rates: REWARDS,
  });
  assert.equal(m.transactions, 2941);
  close(m.interchange, 5394.1, 1e-6, "monthly interchange");
  close(m.schemeFee, 407.3495, 1e-6, "monthly scheme fees");
  close(m.markup, 1500, 1e-6, "monthly markup");
  close(m.processingFee, 382.33, 1e-6, "monthly processing fees");
  close(m.passThrough, 5801.4495, 1e-6, "monthly pass-through");
  close(m.adyenTake, 1882.33, 1e-6, "monthly Adyen take");
  assert.equal(m.total, 7683.78);
  assert.equal(m.minimumBinds, false);
  assert.equal(m.minimumTopUp, 0);
  // 7,683.7795 / 250,000 = 3.073512%
  close(m.effectiveRatePct, 3.0735118, 1e-6, "monthly effective rate");
  // Flat rate on the same month: 2.9% x 250,000 = 7,250 plus 2,941 x 0.30 = 882.30.
  assert.equal(flatRateMonthlyCost(250000, 2941, 2.9, 0.3), 8132.3);
});

test("adyenMonthlyCost: the minimum invoice is a floor, not an extra line", () => {
  // 2,000 / 85 = 23.53, so 24 payments.
  //   2.78% x 2,000                        = 55.60
  //   24 x (0.10 + 0.0195 + 0.13) = 24 x 0.2495 = 5.988
  //                                  total = 61.588 -> $61.59
  // A $120 minimum tops that up to $120, it does not add $120 to it.
  const m = adyenMonthlyCost({
    monthlyVolume: 2000,
    averageTicket: 85,
    minimumInvoice: 120,
    rates: REWARDS,
  });
  assert.equal(m.transactions, 24);
  assert.equal(m.costBeforeMinimum, 61.59);
  assert.equal(m.minimumBinds, true);
  assert.equal(m.total, 120);
  close(m.minimumTopUp, 58.41, 0.011, "minimum top-up");
  // 120 / 2,000 = 6.00% against a real cost of 3.0794%.
  close(m.effectiveRatePct, 6, 1e-6, "effective rate under the floor");
  close(m.effectiveRateBeforeMinimumPct, 3.0794, 1e-3, "effective rate before the floor");
  // The bug this guards against: 61.588 + 120 = 181.588, which would read as a
  // 9.08% effective rate and is nearly double the truth.
  assert.ok(m.total < 121, "the minimum must replace the fees, not add to them");
});

test("adyenMonthlyCost: the volume that clears the minimum round-trips through the cost function", () => {
  // Closed form, worked separately: cost per dollar of volume at an $85 ticket is
  //   2.78/100 + 0.2495/85 = 0.0278 + 0.00293529 = 0.03073529
  // so the volume that just reaches a $120 minimum is 120 / 0.03073529 = $3,904.4.
  const m = adyenMonthlyCost({
    monthlyVolume: 250000,
    averageTicket: 85,
    minimumInvoice: 120,
    rates: REWARDS,
  });
  assert.ok(m.volumeToClearMinimum !== null);
  const v = m.volumeToClearMinimum ?? 0;
  close(v, 120 / (2.78 / 100 + 0.2495 / 85), 1e-6, "closed-form clearing volume");
  close(v, 3904.4, 1, "clearing volume in dollars");
  // Round-trip: run that volume back through the cost function and the fees
  // should land on the minimum, give or take the rounding of a whole payment.
  const at = adyenMonthlyCost({
    monthlyVolume: v,
    averageTicket: 85,
    minimumInvoice: 120,
    rates: REWARDS,
  });
  close(at.costBeforeMinimum, 120, 0.15, "fees at the clearing volume");
  // A dollar either side of it, the floor stops and starts binding.
  const under = adyenMonthlyCost({ monthlyVolume: v - 200, averageTicket: 85, minimumInvoice: 120, rates: REWARDS });
  const over = adyenMonthlyCost({ monthlyVolume: v + 200, averageTicket: 85, minimumInvoice: 120, rates: REWARDS });
  assert.equal(under.minimumBinds, true);
  assert.equal(over.minimumBinds, false);
});

// ---------------------------------------------------------------------------
// The data modules
// ---------------------------------------------------------------------------

test("data: the rate card and the payment method table cannot drift apart", () => {
  for (const method of ADYEN_PAYMENT_METHODS) {
    const channel = ADYEN_RATE_CARD.channels.find((c) => c.id === method.id);
    assert.ok(channel, `no rate-card channel for payment method ${method.id}`);
    const rate = channel?.rates.standard;
    assert.ok(rate, `channel ${method.id} has no standard rate`);
    close(rate?.rate ?? -1, method.methodPct, 1e-9, `${method.id} percentage`);
    // The card's fixed figure is Adyen's $0.13 processing fee plus whatever the
    // method's own per transaction amount is. Double counting the $0.13 here is
    // the mistake the price list invites, because every row is written "$0.13 + ...".
    close(
      rate?.fixed ?? -1,
      ADYEN_DEFAULTS.processingFixed + method.methodFixed,
      1e-9,
      `${method.id} fixed fee`,
    );
  }
  assert.equal(ADYEN_RATE_CARD.key, "adyen");
  assert.equal(ADYEN_RATE_CARD.processorSlug, "adyen");
});

test("data: every sourced row carries a source, and every rate is in a sane range", () => {
  for (const m of ADYEN_PAYMENT_METHODS) {
    assert.ok(m.source.length > 10, `payment method ${m.id} has no source`);
    assert.ok(m.published.includes("$0.13"), `payment method ${m.id} should quote the $0.13 processing fee`);
    assert.ok(m.methodPct >= 0 && m.methodPct <= 6, `payment method ${m.id} percentage out of range`);
    assert.ok(m.methodFixed >= 0 && m.methodFixed <= 1, `payment method ${m.id} fixed fee out of range`);
  }
  for (const p of ADYEN_INTERCHANGE_PROFILES) {
    assert.ok(p.source.includes("Visa"), `interchange profile ${p.id} must name its network`);
    assert.ok(p.ratePct >= 0 && p.ratePct <= 4, `interchange profile ${p.id} rate out of range`);
    assert.ok(p.fixed >= 0 && p.fixed <= 0.5, `interchange profile ${p.id} fixed fee out of range`);
  }
  for (const s of ADYEN_SCHEME_FEE_NOTES) {
    assert.ok(s.source.length > 10, `scheme fee note ${s.label} has no source`);
  }
  // Exactly three payment methods are interchange++; getting that set wrong is
  // failure mode 2 above.
  const ipp = ADYEN_PAYMENT_METHODS.filter((m) => m.pricing === "interchange-plus-plus").map((m) => m.id);
  assert.deepEqual(ipp, ["visa", "mastercard", "maestro"]);
});

test("data: the defaults resolve, and reproduce the page's worked example", () => {
  const method = ADYEN_PAYMENT_METHODS.find((m) => m.id === ADYEN_DEFAULTS.methodId);
  const profile = ADYEN_INTERCHANGE_PROFILES.find((p) => p.id === ADYEN_DEFAULTS.interchangeProfileId);
  assert.ok(method, "default payment method id does not resolve");
  assert.ok(profile, "default interchange profile id does not resolve");
  assert.equal(method?.pricing, "interchange-plus-plus");

  const rates: AdyenFeeRates = {
    interchangePlusPlus: true,
    interchangePct: profile?.ratePct ?? 0,
    interchangeFixed: profile?.fixed ?? 0,
    schemePct: ADYEN_DEFAULTS.schemePct,
    schemeFixed: ADYEN_DEFAULTS.schemeFixed,
    markupPct: ADYEN_DEFAULTS.markupPct,
    processingFixed: ADYEN_DEFAULTS.processingFixed,
    methodPct: 0,
    methodFixed: 0,
  };
  // The same $2.61 and $7,683.78 the page prints in its worked example.
  assert.equal(adyenPaymentCost(ADYEN_DEFAULTS.amount, rates).total, 2.61);
  assert.equal(
    adyenMonthlyCost({
      monthlyVolume: ADYEN_DEFAULTS.monthlyVolume,
      averageTicket: ADYEN_DEFAULTS.averageTicket,
      minimumInvoice: ADYEN_DEFAULTS.minimumInvoice,
      rates,
    }).total,
    7683.78,
  );
});
