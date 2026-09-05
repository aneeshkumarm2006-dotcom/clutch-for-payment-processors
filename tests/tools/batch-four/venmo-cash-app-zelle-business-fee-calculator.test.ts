import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareMonthly,
  comparePayout,
  comparePerPayment,
  feeCrossover,
  payoutFee,
  sellerFeeCents,
  type P2pOption,
} from "../../../lib/calc/p2p";
import { P2P_DEFAULTS, P2P_INSTANT_TRANSFER, P2P_SERVICES } from "../../../lib/tools-data/p2p";

/**
 * Every reference value below was worked out by hand from the published fee
 * shape, BEFORE running the implementation, and several of them are properties
 * rather than outputs: a crossover checked by evaluating both fee shapes either
 * side of it, a cap checked against the amount at which it starts binding.
 * Asserting whatever the code happens to return would pin a bug in place.
 *
 * The failure modes this file exists for are all silent:
 *
 *   1. 2.99 percent of $50 is $1.495. In a double it is 1.4949999999999999, so a
 *      naive toFixed rounds DOWN to $1.49 while Venmo rounds UP to $1.50. One
 *      cent, on the one page a merchant opens to check a statement line.
 *   2. Pricing a month as rate x volume plus ONE fixed fee understates a 120
 *      payment month on Cash App by $17.85 and looks entirely plausible.
 *   3. Applying a payout cap before the minimum floor can return a fee below the
 *      published minimum on a small withdrawal, and neither number looks wrong.
 */

const option = (id: string): P2pOption => {
  const s = P2P_SERVICES.find((x) => x.id === id);
  assert.ok(s, `no service ${id}`);
  return {
    id: s.id,
    label: s.label,
    kind: s.kind,
    seller: s.seller,
    payout: P2P_INSTANT_TRANSFER.find((i) => i.serviceId === s.id)?.fee ?? null,
    buyerDisputeRight: s.buyerDisputeRight,
    disputeFee: s.disputeFee,
  };
};

const ALL: P2pOption[] = P2P_SERVICES.map((s) => option(s.id));

const row = <T extends { id: string }>(rows: T[], id: string): T => {
  const r = rows.find((x) => x.id === id);
  assert.ok(r, `no row ${id}`);
  return r;
};

// ---------------------------------------------------------------------------
// One payment: hand-computed against each published fee shape
// ---------------------------------------------------------------------------

test("one $50 payment: each published rate, worked by hand", () => {
  const r = comparePerPayment(ALL, 50);

  // Venmo business profile, 1.9% + $0.10. 0.019 x 50 = 0.95, plus 0.10 = 1.05.
  assert.equal(row(r, "venmo-business").fee, 1.05);
  assert.equal(row(r, "venmo-business").net, 48.95);

  // Cash App Business, 2.6% + $0.15. 0.026 x 50 = 1.30, plus 0.15 = 1.45.
  assert.equal(row(r, "cashapp-business").fee, 1.45);
  assert.equal(row(r, "cashapp-business").net, 48.55);

  // Card reference, 2.9% + $0.30. 0.029 x 50 = 1.45, plus 0.30 = 1.75.
  assert.equal(row(r, "card-standard").fee, 1.75);

  // Zelle charges nothing, at any amount.
  assert.equal(row(r, "zelle").fee, 0);
  assert.equal(row(r, "zelle").net, 50);
});

test("2.99% of $50 rounds UP to $1.50, which binary floating point does not do on its own", () => {
  // 0.0299 x 50 = 1.495 exactly in decimal. A double holds it as 1.4949999999999999,
  // so Number(1.495).toFixed(2) is "1.49" and the merchant is a cent out.
  assert.equal(Number((0.0299 * 50).toFixed(2)), 1.49, "the float trap this test guards is real");
  assert.equal(row(comparePerPayment(ALL, 50), "venmo-personal-gs").fee, 1.5);
});

test("the fixed fee dominates a small ticket, which is the whole reason to show an effective rate", () => {
  // $8 on a Venmo business profile: 0.019 x 8 = 0.152, rounds to $0.15, plus $0.10 = $0.25.
  // $0.25 / $8 = 3.125%, so a headline 1.9% product costs 3.13% on this sale.
  const r = comparePerPayment(ALL, 8);
  assert.equal(row(r, "venmo-business").fee, 0.25);
  assert.ok(Math.abs(row(r, "venmo-business").effectiveRate - 3.125) < 0.0001);

  // $8 on Cash App: 0.026 x 8 = 0.208, rounds to $0.21, plus $0.15 = $0.36. 4.50%.
  assert.equal(row(r, "cashapp-business").fee, 0.36);
  assert.ok(Math.abs(row(r, "cashapp-business").effectiveRate - 4.5) < 0.0001);
});

test("a fee can never exceed the payment, across a sweep of tiny amounts", () => {
  for (const amount of [0, 0.01, 0.05, 0.1, 0.25, 1, 3.33]) {
    for (const r of comparePerPayment(ALL, amount)) {
      assert.ok(r.fee <= r.amount + 1e-9, `${r.id} charged ${r.fee} on ${r.amount}`);
      assert.ok(r.net >= 0, `${r.id} returned a negative net on ${r.amount}`);
    }
  }
});

// ---------------------------------------------------------------------------
// A month of sales
// ---------------------------------------------------------------------------

test("a $6,000 month across 120 payments, with no instant transfers", () => {
  const m = compareMonthly(ALL, {
    monthlyVolume: 6000,
    transactions: 120,
    instantPayout: false,
    payoutsPerMonth: 4,
  });

  // Average ticket is $50. Per payment fees are the hand figures above, x 120.
  assert.equal(row(m, "venmo-business").averageTicket, 50);
  assert.equal(row(m, "venmo-business").totalHigh, 126); // 1.05 x 120
  assert.equal(row(m, "cashapp-business").totalHigh, 174); // 1.45 x 120
  assert.equal(row(m, "venmo-personal-gs").totalHigh, 180); // 1.50 x 120
  assert.equal(row(m, "card-standard").totalHigh, 210); // 1.75 x 120
  assert.equal(row(m, "zelle").totalHigh, 0);

  // Effective rates: 126/6000 = 2.10%, 210/6000 = 3.50%.
  assert.ok(Math.abs(row(m, "venmo-business").effectiveRateHigh - 2.1) < 0.0001);
  assert.ok(Math.abs(row(m, "card-standard").effectiveRateHigh - 3.5) < 0.0001);

  // Annualized is a plain x 12, not a compounding of anything.
  assert.equal(row(m, "venmo-business").annualTotalHigh, 1512);
});

test("pricing the month as rate x volume plus one fixed fee understates Cash App by exactly $17.85", () => {
  // The error every competing calculator makes: 0.026 x 6000 + 0.15 = $156.15.
  const naive = 0.026 * 6000 + 0.15;
  assert.ok(Math.abs(naive - 156.15) < 1e-9);

  const correct = row(
    compareMonthly(ALL, { monthlyVolume: 6000, transactions: 120, instantPayout: false, payoutsPerMonth: 4 }),
    "cashapp-business",
  ).totalHigh;

  assert.equal(correct, 174);
  // The gap is the fixed fee charged on every payment after the first: 119 x $0.15.
  assert.ok(Math.abs(correct - naive - 119 * 0.15) < 1e-9);
});

test("the monthly total is exactly the seller fee plus the payout fee, at both ends of the band", () => {
  const m = compareMonthly(ALL, {
    monthlyVolume: 6000,
    transactions: 120,
    instantPayout: true,
    payoutsPerMonth: 4,
  });
  for (const r of m) {
    assert.ok(Math.abs(r.totalLow - (r.sellerFeeMonthly + r.payoutFeeLow)) < 1e-9, `${r.id} low`);
    assert.ok(Math.abs(r.totalHigh - (r.sellerFeeMonthly + r.payoutFeeHigh)) < 1e-9, `${r.id} high`);
    assert.ok(r.totalLow <= r.totalHigh + 1e-9, `${r.id} band inverted`);
  }
});

test("zero transactions produces zeros rather than NaN or Infinity", () => {
  const m = compareMonthly(ALL, {
    monthlyVolume: 0,
    transactions: 0,
    instantPayout: true,
    payoutsPerMonth: 0,
  });
  for (const r of m) {
    assert.ok(Number.isFinite(r.totalHigh) && r.totalHigh === 0, `${r.id} total`);
    assert.ok(Number.isFinite(r.effectiveRateHigh) && r.effectiveRateHigh === 0, `${r.id} rate`);
  }
});

// ---------------------------------------------------------------------------
// Instant payout: the cap, the floor, and the band
// ---------------------------------------------------------------------------

test("Venmo's $25 instant transfer cap binds above $1,428.57 and not below it", () => {
  // 1.75% of X equals the $25 cap at X = 25 / 0.0175 = $1,428.5714...
  // So $1,428 is under the cap and $1,429 is over it.
  const shape = P2P_INSTANT_TRANSFER.find((i) => i.serviceId === "venmo-business")?.fee ?? null;
  assert.ok(shape);

  const under = payoutFee(1428, shape);
  assert.equal(under.cappedAtHigh, false);
  assert.equal(under.high, 24.99); // 0.0175 x 1428 = 24.99

  const over = payoutFee(1429, shape);
  assert.equal(over.cappedAtHigh, true);
  assert.equal(over.high, 25);

  // And well above it the fee simply stops growing.
  assert.equal(payoutFee(25000, shape).high, 25);
});

test("Cash App's published band is carried as a band, not collapsed to a midpoint", () => {
  // 0.5% to 2.5% of $1,500 is $7.50 to $37.50.
  const p = row(comparePayout(ALL, 1500), "cashapp-business");
  assert.equal(p.feeLow, 7.5);
  assert.equal(p.feeHigh, 37.5);
  assert.equal(p.netLow, 1462.5);
  assert.equal(p.netHigh, 1492.5);
});

test("the minimum floor applies before the cap, so a tiny withdrawal never lands below the published minimum", () => {
  // Cash App: 0.5% of $10 is $0.05, below the $0.25 published minimum.
  const p = row(comparePayout(ALL, 10), "cashapp-business");
  assert.equal(p.feeLow, 0.25);
  assert.equal(p.flooredAtLow, true);

  // Venmo: 1.75% of $5 is $0.0875, below its own $0.25 minimum.
  assert.equal(row(comparePayout(ALL, 5), "venmo-business").feeHigh, 0.25);
});

test("Zelle has no payout step at all, which is different from a payout that costs zero", () => {
  const p = row(comparePayout(ALL, 1500), "zelle");
  assert.equal(p.applicable, false);
  assert.equal(p.feeHigh, 0);
  assert.equal(p.netLow, 1500);
});

// ---------------------------------------------------------------------------
// Crossover
// ---------------------------------------------------------------------------

test("the Venmo business profile passes the 2.99% personal rate at $9.17, verified either side", () => {
  const biz = P2P_SERVICES.find((s) => s.id === "venmo-business")?.seller;
  const gs = P2P_SERVICES.find((s) => s.id === "venmo-personal-gs")?.seller;
  assert.ok(biz && gs);

  // Closed form worked separately: 0.10 + 0.019x = 0.0299x, so x = 0.10 / 0.0109 = 9.1743...
  const x = feeCrossover(biz, gs);
  assert.ok(x !== null);
  assert.ok(Math.abs(x - 0.1 / 0.0109) < 1e-9, `expected 9.1743, got ${x}`);

  // Property check, independent of the formula: below it the personal rate is
  // cheaper, above it the business profile is.
  const at = (amount: number) => {
    const r = comparePerPayment(ALL, amount);
    return { biz: row(r, "venmo-business").fee, gs: row(r, "venmo-personal-gs").fee };
  };
  const below = at(5);
  assert.ok(below.gs < below.biz, `at $5 expected the 2.99% rate to be cheaper, got ${below.gs} vs ${below.biz}`);
  const above = at(50);
  assert.ok(above.biz < above.gs, `at $50 expected the business profile to be cheaper, got ${above.biz} vs ${above.gs}`);
});

test("a crossover that does not exist returns null rather than a negative dollar amount", () => {
  const biz = P2P_SERVICES.find((s) => s.id === "venmo-business")?.seller;
  const card = P2P_SERVICES.find((s) => s.id === "card-standard")?.seller;
  assert.ok(biz && card);
  // The business profile is both cheaper per percent AND cheaper per fixed fee,
  // so it wins from the first cent and there is no threshold to publish.
  assert.equal(feeCrossover(biz, card), null);
  // Identical shapes are parallel lines, never a crossing.
  assert.equal(feeCrossover(biz, biz), null);
});

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

test("every service row carries a dated source and a rate in range", () => {
  const ids = new Set<string>();
  for (const s of P2P_SERVICES) {
    assert.ok(!ids.has(s.id), `duplicate service id ${s.id}`);
    ids.add(s.id);
    assert.ok(s.seller.ratePct >= 0 && s.seller.ratePct <= 100, `${s.id} rate out of range`);
    assert.ok(s.seller.fixed >= 0 && s.seller.fixed < 5, `${s.id} fixed fee out of range`);
    assert.match(s.source, /(checked|capture)/i, `${s.id} source records no verification`);
    assert.match(s.source, /20(2[5-9]|3\d)/, `${s.id} source records no year`);
    for (const field of [s.disputeMechanism, s.businessUse, s.taxReporting, s.standardPayout]) {
      assert.ok(field.length > 20, `${s.id} has a stub field`);
    }
  }
});

test("instant transfer rows line up one to one with the services, and their bands are ordered", () => {
  const serviceIds = P2P_SERVICES.map((s) => s.id).sort();
  const transferIds = P2P_INSTANT_TRANSFER.map((i) => i.serviceId).sort();
  assert.deepEqual(transferIds, serviceIds);

  for (const i of P2P_INSTANT_TRANSFER) {
    assert.match(i.source, /(checked|capture)/i, `${i.serviceId} transfer source records no verification`);
    if (!i.fee) continue;
    assert.ok(i.fee.ratePctLow <= i.fee.ratePctHigh, `${i.serviceId} band inverted`);
    assert.ok(i.fee.minFee >= 0, `${i.serviceId} negative minimum`);
    if (i.fee.maxFee !== null) {
      assert.ok(i.fee.maxFee > i.fee.minFee, `${i.serviceId} cap below its own floor`);
    }
  }
});

test("exactly one service gives the buyer no dispute route, and it is Zelle", () => {
  const noRecourse = P2P_SERVICES.filter((s) => !s.buyerDisputeRight);
  assert.equal(noRecourse.length, 1);
  assert.equal(noRecourse[0]?.id, "zelle");
});

test("the widget defaults describe a $50 average ticket, which is what the page copy claims", () => {
  assert.equal(P2P_DEFAULTS.monthlyVolume / P2P_DEFAULTS.transactions, 50);
  assert.equal(P2P_DEFAULTS.singlePayment, 50);
  assert.ok(P2P_DEFAULTS.payoutsPerMonth >= 1);
});

test("no em dash, en dash or curly quote in any published string in the data module", () => {
  // `npm run audit:dashes` walks Mongo documents, not source literals, so the
  // house rule has no other enforcement on this file.
  // Written as escapes so this file does not itself contain the characters a
  // grep of `components/public/tools/*` and `lib/tools-defs/*` looks for.
  const banned = /[\u2013\u2014\u2015\u2018\u2019\u201C\u201D]/;
  const strings: string[] = [];
  for (const s of P2P_SERVICES) {
    strings.push(s.label, s.disputeMechanism, s.businessUse, s.taxReporting, s.standardPayout, s.note, s.source);
  }
  for (const i of P2P_INSTANT_TRANSFER) {
    strings.push(i.label, i.speed, i.source);
  }
  for (const str of strings) {
    assert.ok(!banned.test(str), `banned punctuation in: ${str.slice(0, 90)}`);
  }
});

test("sellerFeeCents adds the fixed fee after rounding the percentage, not before", () => {
  // $9.99 at 2.6% is 25.974 cents. Rounded half up that is 26 cents, plus the
  // 15 cent fixed fee, so 41 cents. Folding the fixed fee into the percentage
  // base first would give a different answer and would not match a statement.
  assert.equal(sellerFeeCents(999, { ratePct: 2.6, fixed: 0.15 }), 41);
  // And a pure percentage product is unaffected by the fixed-fee path.
  assert.equal(sellerFeeCents(5000, { ratePct: 2.99, fixed: 0 }), 150);
  assert.equal(sellerFeeCents(5000, { ratePct: 0, fixed: 0 }), 0);
});
