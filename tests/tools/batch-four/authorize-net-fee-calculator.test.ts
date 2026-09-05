import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTHORIZE_NET_RATE_CARD } from "../../../lib/rate-cards/authorize-net";
import { channelRate, findChannel, rateBand } from "../../../lib/tools-rates";

/**
 * Authorize.Net Fee Calculator: rate-card and arithmetic checks.
 *
 * There is no maths module here. `/tools/authorize-net-fee-calculator` mounts
 * the shared `BrandFeeCalculator`, whose arithmetic is already covered, so what
 * can go silently wrong on this page is the CARD, and one thing in particular:
 * the daily batch fee. `RateCard` has no per-batch field, so the gateway-only
 * plans carry the batch fee folded into `monthly` as an annualized figure. If
 * somebody later "tidies" that $27.08 back to the advertised $25.00, nothing
 * throws, no test that merely re-reads the data notices, and the page quietly
 * starts under-counting the one cost every competing calculator already drops.
 *
 * Every expected value below is derived independently of the card: the business
 * day count is recomputed from a calendar, and every dollar figure is hand
 * computed in integer cents and written out in the assertion message. Nothing
 * here asserts what the data happens to say.
 */

// ---------------------------------------------------------------------------
// Independent reference values, computed by hand in integer cents
// ---------------------------------------------------------------------------

/** Published US figures, re-typed from authorize.net/en-us/sign-up/pricing.html, 5 September 2026. */
const PUBLISHED = {
  gatewayMonthlyCents: 2500,
  allInOneRatePct: 2.9,
  allInOneFixedCents: 30,
  gatewayPerTxnCents: 10,
  dailyBatchFeeCents: 10,
} as const;

/**
 * US business days in 2026, recomputed from the calendar rather than trusted.
 * 2026 is a common year starting on a Thursday, so it holds 261 weekdays; all
 * eleven federal holidays (Independence Day observed Friday 3 July) fall on a
 * weekday, leaving 250.
 */
function businessDays2026(): number {
  const observedHolidays = new Set([
    "2026-01-01", // New Year's Day, Thursday
    "2026-01-19", // Martin Luther King Jr Day, Monday
    "2026-02-16", // Washington's Birthday, Monday
    "2026-05-25", // Memorial Day, Monday
    "2026-06-19", // Juneteenth, Friday
    "2026-07-03", // Independence Day observed, Friday
    "2026-09-07", // Labor Day, Monday
    "2026-10-12", // Columbus Day, Monday
    "2026-11-11", // Veterans Day, Wednesday
    "2026-11-26", // Thanksgiving, Thursday
    "2026-12-25", // Christmas Day, Friday
  ]);
  let weekdays = 0;
  let business = 0;
  const d = new Date(Date.UTC(2026, 0, 1));
  while (d.getUTCFullYear() === 2026) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      weekdays += 1;
      if (!observedHolidays.has(d.toISOString().slice(0, 10))) business += 1;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  assert.equal(weekdays, 261, "2026 should hold 261 weekdays");
  return business;
}

const plan = (id: string) => {
  const found = AUTHORIZE_NET_RATE_CARD.plans.find((p) => p.id === id);
  assert.ok(found, `plan ${id} must exist: it is a contract with the page copy`);
  return found;
};

/** The three cost lines `BrandFeeCalculator` models, in integer cents. */
function monthlyCostCents(planId: string, channelId: string, volume: number, count: number) {
  const channel = findChannel(AUTHORIZE_NET_RATE_CARD, channelId);
  const base = channelRate(AUTHORIZE_NET_RATE_CARD, channel, planId);
  const percent = Math.round(volume * base.rate); // volume * rate/100 * 100 cents
  const perItem = Math.round(count * base.fixed * 100);
  const monthly = Math.round(plan(planId).monthly * 100);
  return { percent, perItem, monthly, total: percent + perItem + monthly };
}

// ---------------------------------------------------------------------------
// The batch fee, which is the reason this page exists
// ---------------------------------------------------------------------------

test("the daily batch fee annualizes to exactly one extra month of gateway fee", () => {
  const days = businessDays2026();
  assert.equal(days, 250, "250 US business days in 2026");

  const annualBatchCents = PUBLISHED.dailyBatchFeeCents * days;
  assert.equal(annualBatchCents, 2500, "10 cents x 250 days = $25.00 a year");
  assert.equal(
    annualBatchCents,
    PUBLISHED.gatewayMonthlyCents,
    "a year of batch fees equals one $25.00 monthly gateway fee",
  );

  // $25.00 a year spread monthly is $2.0833, billed to the cent as $2.08.
  const perMonthCents = Math.round(annualBatchCents / 12);
  assert.equal(perMonthCents, 208, "$2.08 a month");

  for (const id of ["gateway", "gateway-190", "gateway-225", "gateway-260"]) {
    assert.equal(
      Math.round(plan(id).monthly * 100),
      PUBLISHED.gatewayMonthlyCents + perMonthCents,
      `${id} must carry $25.00 + $2.08 = $27.08, not the advertised $25.00`,
    );
  }

  assert.equal(
    Math.round(plan("allinone").monthly * 100),
    PUBLISHED.gatewayMonthlyCents,
    "All-in-One carries the bare $25.00: no daily batch fee is listed on that plan",
  );
});

// ---------------------------------------------------------------------------
// The worked example on the page, reproduced line by line
// ---------------------------------------------------------------------------

test("worked example: $40,000 over 320 card sales costs $959.08 on gateway only at 2.25%", () => {
  // By hand, in cents:
  //   percentage   $40,000.00 x 2.25%            = $900.00 =  90000c
  //   per item     320 x $0.10                   =  $32.00 =   3200c
  //   plan         $25.00 gateway + $2.08 batch  =  $27.08 =   2708c
  //   total                                                =  95908c
  const got = monthlyCostCents("gateway-225", "card", 40000, 320);
  assert.equal(got.percent, 90000, "$900.00 of merchant account discount rate");
  assert.equal(got.perItem, 3200, "$32.00 of Authorize.Net per transaction fees");
  assert.equal(got.monthly, 2708, "$27.08 of gateway plus annualized batch fee");
  assert.equal(got.total, 95908, "$959.08 a month");
  assert.equal(got.total * 12, 1150896, "$11,508.96 a year");

  // Effective rate: 95908 / 4000000 = 2.3977%, which rounds to 2.40% for display.
  const effective = (got.total / (40000 * 100)) * 100;
  assert.ok(
    Math.abs(effective - 2.3977) < 0.0001,
    `effective rate should be 2.3977%, got ${effective}`,
  );
  assert.equal(effective.toFixed(2), "2.40");
  assert.equal(rateBand(effective).label, "Average", "2.40% sits in the Average band");
});

test("worked example: the same month on All-in-One costs $1,281.00, a $321.92 gap", () => {
  // By hand, in cents:
  //   percentage   $40,000.00 x 2.9%   = $1,160.00 = 116000c
  //   per item     320 x $0.30         =    $96.00 =   9600c
  //   plan         $25.00              =    $25.00 =   2500c
  //   total                                        = 128100c
  const allInOne = monthlyCostCents("allinone", "card", 40000, 320);
  assert.equal(allInOne.percent, 116000);
  assert.equal(allInOne.perItem, 9600);
  assert.equal(allInOne.monthly, 2500);
  assert.equal(allInOne.total, 128100, "$1,281.00 a month");

  const gateway = monthlyCostCents("gateway-225", "card", 40000, 320);
  assert.equal(allInOne.total - gateway.total, 32192, "$321.92 a month cheaper on gateway only");
  assert.equal((allInOne.total - gateway.total) * 12, 386304, "$3,863.04 a year");

  // 128100 / 4000000 = 3.2025%
  const effective = (allInOne.total / (40000 * 100)) * 100;
  assert.equal(effective.toFixed(4), "3.2025");
  assert.equal(rateBand(effective).label, "Very high", "3.20% or worse is the bottom band");
});

test("worked example: Authorize.Net's own share of the gateway-only month is $59.08", () => {
  // 320 x $0.10 = $32.00, plus $27.08 of gateway and batch fees.
  const anetOnly = monthlyCostCents("gateway", "card", 40000, 320);
  assert.equal(anetOnly.percent, 0, "none of the card percentage is Authorize.Net money");
  assert.equal(anetOnly.total, 5908, "$59.08 a month");
  assert.equal(anetOnly.total * 12, 70896, "$708.96 a year");

  // And the batch fee is 42.3% of that annual bill: $300.00 of the $708.96 is
  // the $25.00 monthly gateway fee, $384.00 is per transaction, $24.96 is batch
  // (12 x $2.08, one four-cent rounding shy of the $25.00 true annual figure).
  assert.equal(300_00 + 384_00 + 24_96, 70896, "the three gateway-only cost lines add up");
});

test("single payment: a $120 card sale is $3.78 on All-in-One and $2.80 at a 2.25% account", () => {
  // All-in-One: $120 x 2.9% = $3.48, plus $0.30 = $3.78. 378/12000 = 3.15%.
  const aChannel = findChannel(AUTHORIZE_NET_RATE_CARD, "card");
  const a = channelRate(AUTHORIZE_NET_RATE_CARD, aChannel, "allinone");
  const aFeeCents = Math.round(120 * a.rate) + Math.round(a.fixed * 100);
  assert.equal(aFeeCents, 378, "$3.78");
  assert.equal(((aFeeCents / 12000) * 100).toFixed(2), "3.15");

  // Gateway only at 2.25%: $120 x 2.25% = $2.70, plus $0.10 = $2.80. 2.3333%.
  const g = channelRate(AUTHORIZE_NET_RATE_CARD, aChannel, "gateway-225");
  const gFeeCents = Math.round(120 * g.rate) + Math.round(g.fixed * 100);
  assert.equal(gFeeCents, 280, "$2.80");
  assert.equal(((gFeeCents / 12000) * 100).toFixed(2), "2.33");

  // Authorize.Net alone takes ten cents of that $120 sale, and nothing else.
  const anet = channelRate(AUTHORIZE_NET_RATE_CARD, aChannel, "gateway");
  assert.equal(anet.rate, 0);
  assert.equal(Math.round(anet.fixed * 100), PUBLISHED.gatewayPerTxnCents);
});

test("crossover: gateway only wins until the merchant account passes 3.0548%", () => {
  // Solve by hand, not by search. Setting the two monthly totals equal:
  //   V*r/100 + 0.10N + 27.08 = V*0.029 + 0.30N + 25.00
  //   V*r/100                 = V*0.029 + 0.20N - 2.08
  //   r                       = 2.9 + (0.20N - 2.08) * 100 / V
  // At V = 40,000 and N = 320: r = 2.9 + (64.00 - 2.08) * 100 / 40000
  //                              = 2.9 + 6192 / 40000 = 2.9 + 0.1548 = 3.0548
  const V = 40000;
  const N = 320;
  const crossover = 2.9 + (0.2 * N - 2.08) * 100 / V;
  assert.equal(Number(crossover.toFixed(4)), 3.0548);

  // At the crossover the two plans cost the same to the cent: $1,221.92 of
  // discount rate plus $32.00 plus $27.08 is $1,281.00.
  const gatewayCents = Math.round(V * crossover) + Math.round(N * 0.1 * 100) + 2708;
  assert.equal(gatewayCents, 128100, "$1,281.00, identical to All-in-One");
  assert.equal(gatewayCents, monthlyCostCents("allinone", "card", V, N).total);

  // Below the crossover gateway only is cheaper, above it All-in-One is.
  assert.ok(monthlyCostCents("gateway-260", "card", V, N).total < 128100);
  assert.ok(monthlyCostCents("gateway-190", "card", V, N).total < 128100);
});

test("the annualized batch fee is 10.4 basis points of a small month and 0.52 of a large one", () => {
  // $2.08 / $2,000 = 0.00104 = 10.4 bps. $2.08 / $40,000 = 0.000052 = 0.52 bps.
  const perMonthCents = 208;
  const small = (perMonthCents / (2000 * 100)) * 10000;
  const large = (perMonthCents / (40000 * 100)) * 10000;
  assert.equal(Number(small.toFixed(2)), 10.4);
  assert.equal(Number(large.toFixed(2)), 0.52);
  assert.ok(small > large * 19, "a fixed fee punishes low volume by an order of magnitude");
});

test("eCheck.Net is 0.75% flat on every plan, with no per transaction fee", () => {
  const channel = findChannel(AUTHORIZE_NET_RATE_CARD, "echeck");
  for (const p of AUTHORIZE_NET_RATE_CARD.plans) {
    const r = channelRate(AUTHORIZE_NET_RATE_CARD, channel, p.id);
    assert.equal(r.rate, 0.75, `eCheck.Net should be 0.75% on ${p.id}`);
    assert.equal(r.fixed, 0, `eCheck.Net carries no published per transaction fee on ${p.id}`);
  }

  // A $5,000 B2B invoice: $37.50 by eCheck.Net against $145.30 on All-in-One
  // cards ($5,000 x 2.9% = $145.00 plus $0.30). Hand computed in cents.
  assert.equal(Math.round(5000 * 0.75), 3750, "$37.50 by eCheck.Net");
  assert.equal(Math.round(5000 * 2.9) + 30, 14530, "$145.30 on a card");
  assert.equal(14530 - 3750, 10780, "$107.80 saved on one invoice");

  // The $10.00 minimum monthly fee bites below $10.00 / 0.0075 of eCheck
  // volume, which is $1,333.33 a month. The page quotes "roughly $1,333".
  const minimumCrossover = 10 / 0.0075;
  assert.equal(Math.floor(minimumCrossover), 1333);
  assert.ok(Math.round(500 * 0.75) < 1000, "a single $500 ACH invoice prices under the $10 floor");
});

// ---------------------------------------------------------------------------
// Card integrity
// ---------------------------------------------------------------------------

test("every channel prices every plan, and every rate is inside a sane band", () => {
  const card = AUTHORIZE_NET_RATE_CARD;
  assert.equal(card.key, "authorize-net");
  assert.equal(card.processorSlug, "authorize-net");
  assert.ok(card.plans.length >= 2, "the two plan shapes are the point of the page");
  assert.ok(card.sources.length >= 1, "an undated, unsourced card is a content bug");

  for (const s of card.sources) {
    assert.match(s.url, /^https:\/\//, `source ${s.label} must be an https URL`);
  }

  const planIds = card.plans.map((p) => p.id);
  for (const channel of card.channels) {
    for (const id of planIds) {
      const r = channel.rates[id];
      assert.ok(r, `channel ${channel.id} must price plan ${id} explicitly, not by fallback`);
      assert.ok(r.rate >= 0 && r.rate <= 10, `${channel.id}/${id} rate out of range: ${r.rate}`);
      assert.ok(r.fixed >= 0 && r.fixed <= 1, `${channel.id}/${id} fixed out of range: ${r.fixed}`);
    }
  }

  // Every gateway-only plan must charge the same $0.10, because that fee is
  // Authorize.Net's and does not move with the merchant account assumption.
  const cardChannel = findChannel(card, "card");
  for (const id of planIds.filter((p) => p.startsWith("gateway"))) {
    assert.equal(
      Math.round(channelRate(card, cardChannel, id).fixed * 100),
      PUBLISHED.gatewayPerTxnCents,
      `${id} must charge the published 10 cent gateway transaction fee`,
    );
  }
});

test("no em dash, en dash or curly quote survives anywhere in the card", () => {
  // `npm run audit:dashes` walks Mongo documents, not source literals, so this
  // is the only thing standing between a typed em dash and production.
  // Built from char codes rather than written as literals, so this file does
  // not itself contain the characters it exists to reject.
  const bannedChars = new Set([0x2013, 0x2014, 0x2015, 0x2018, 0x2019, 0x201c, 0x201d].map((c) => String.fromCharCode(c)));
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      const hit = [...value].find((ch) => bannedChars.has(ch));
      assert.equal(hit, undefined, `banned punctuation at ${path}: ${value}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    }
  };
  walk(AUTHORIZE_NET_RATE_CARD, "AUTHORIZE_NET_RATE_CARD");

  // And the batch fee has to stay visible somewhere a reader can find it.
  const extras = AUTHORIZE_NET_RATE_CARD.extras.map((e) => `${e.label} ${e.value}`).join(" | ");
  assert.match(extras, /\$0\.10 per settled batch/);
  assert.match(extras, /\$25\.00 a year/);
});
