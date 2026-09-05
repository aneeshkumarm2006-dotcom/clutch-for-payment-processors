import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOPIFY_RATE_CARD } from "../../../lib/rate-cards/shopify";
import { STRIPE_RATE_CARD } from "../../../lib/rate-cards/stripe";
import { SHOPIFY_PAYMENTS_FEE_TOOL } from "../../../lib/tools-defs/shopify-payments-fee-calculator";
import { channelRate, findChannel } from "../../../lib/tools-rates";

/**
 * Shopify Payments Fee Calculator: rate-card and arithmetic checks.
 *
 * There is no maths module here. `/tools/shopify-payments-fee-calculator`
 * mounts the shared `BrandFeeCalculator`, whose arithmetic is covered
 * elsewhere, so what can go silently wrong on this page is the CARD, and three
 * things in particular.
 *
 * 1. A MISSING PLAN KEY IS SILENT. `channelRate` falls back to the FIRST plan
 *    when a channel has no entry for the plan id it was asked for. Delete the
 *    `advanced-y` row from the in-person channel and the page does not throw,
 *    it quietly quotes an Advanced merchant Basic's 2.6% and looks completely
 *    normal doing it. Every plan-by-channel cell is therefore asserted present.
 *
 * 2. THE THIRD-PARTY CHANNEL IS A SUM AND HALF OF IT LIVES IN ANOTHER FILE.
 *    `third-party-total` is Stripe's published US online rate plus Shopify's
 *    third-party transaction fee. It is written as a literal so that IEEE 754
 *    does not turn 2.9 + 0.6 into 3.5000000000000004, which means it cannot
 *    track a Stripe rate change on its own. The sum is recomputed here against
 *    `STRIPE_RATE_CARD`, so a Stripe repricing fails this test instead of
 *    shipping a stale number.
 *
 * 3. A HAND-WRITTEN NUMBER IN THE COPY CAN DISAGREE WITH THE WIDGET. That has
 *    shipped on this site before. Every dollar figure in the worked example is
 *    recomputed from the card and asserted to appear in the rendered string.
 *
 * Every expected value below is derived INDEPENDENTLY of the card: the
 * published figures are re-typed from the source named beside them, the money
 * is hand computed in integer cents, and each break-even volume is solved from
 * the closed form and then checked by evaluating both plans at that volume.
 */

// ---------------------------------------------------------------------------
// Independent reference values
// ---------------------------------------------------------------------------

/**
 * Re-typed from the Wayback capture of the US shopify.com/pricing page taken
 * 4 September 2026, not read from the module under test. Percentages, then
 * fixed fees in cents, then plan fees in whole dollars.
 */
const PUBLISHED = {
  planMonthly: { basic: 39, grow: 105, advanced: 399 },
  planYearly: { basic: 29, grow: 79, advanced: 299 },
  onlineStandard: { basic: 2.9, grow: 2.7, advanced: 2.5 },
  onlinePremium: { basic: 3.5, grow: 3.3, advanced: 3.1 },
  inPerson: { basic: 2.6, grow: 2.5, advanced: 2.4 },
  inPersonKeyed: 3.5,
  gatewayFee: { basic: 2, grow: 1, advanced: 0.6 },
  onlineFixedCents: 30,
  inPersonFixedCents: 10,
  internationalAddOn: 1,
} as const;

/** Stripe's published US online card rate, re-typed from stripe.com/pricing. */
const STRIPE_ONLINE = { rate: 2.9, fixedCents: 30 } as const;

const TIERS = ["basic", "grow", "advanced"] as const;
type Tier = (typeof TIERS)[number];
const planId = (tier: Tier, term: "m" | "y") => `${tier}-${term}`;

/**
 * A processing fee in integer cents. Money a merchant will check against a
 * statement is never computed in floats here: 4.9% of $80 in floating point is
 * 3.9200000000000004, and rounding that at the wrong moment is how a page ends
 * up a cent away from the widget beside it.
 */
const feeCents = (amountCents: number, ratePct: number, fixedCents: number) =>
  Math.round((amountCents * ratePct) / 100) + fixedCents;

/** A month of processing, in integer cents, matching what the widget adds up. */
const monthCents = (
  volumeCents: number,
  orders: number,
  ratePct: number,
  fixedCents: number,
  planDollars: number,
) => Math.round((volumeCents * ratePct) / 100) + orders * fixedCents + planDollars * 100;

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** What the widget reads for a given plan and channel. */
const cardRate = (channelId: string, plan: string) =>
  channelRate(SHOPIFY_RATE_CARD, findChannel(SHOPIFY_RATE_CARD, channelId), plan);

// ---------------------------------------------------------------------------
// 1. The card matches the published schedule, in every cell
// ---------------------------------------------------------------------------

test("every published Shopify rate is on the card, for both billing terms", () => {
  for (const tier of TIERS) {
    for (const term of ["m", "y"] as const) {
      const id = planId(tier, term);

      const plan = SHOPIFY_RATE_CARD.plans.find((p) => p.id === id);
      assert.ok(plan, `plan ${id} is missing from the card`);
      const expectedFee = term === "m" ? PUBLISHED.planMonthly[tier] : PUBLISHED.planYearly[tier];
      assert.equal(plan.monthly, expectedFee, `${id} plan fee should be $${expectedFee}`);

      const online = cardRate("online", id);
      assert.equal(online.rate, PUBLISHED.onlineStandard[tier], `${id} online rate`);
      assert.equal(Math.round(online.fixed * 100), PUBLISHED.onlineFixedCents, `${id} online fixed fee`);

      const premium = cardRate("online-premium", id);
      assert.equal(premium.rate, PUBLISHED.onlinePremium[tier], `${id} premium card rate`);

      const pos = cardRate("inperson", id);
      assert.equal(pos.rate, PUBLISHED.inPerson[tier], `${id} in person rate`);
      assert.equal(Math.round(pos.fixed * 100), PUBLISHED.inPersonFixedCents, `${id} in person fixed fee`);

      assert.equal(cardRate("inperson-keyed", id).rate, PUBLISHED.inPersonKeyed, `${id} keyed rate`);
      assert.equal(cardRate("third-party-fee", id).rate, PUBLISHED.gatewayFee[tier], `${id} gateway fee`);
      assert.equal(cardRate("third-party-fee", id).fixed, 0, `${id} gateway fee has no fixed component`);
    }
  }

  const intl = SHOPIFY_RATE_CARD.addOns.find((a) => a.id === "intl");
  assert.ok(intl, "the international add-on is missing");
  assert.equal(intl.rate, PUBLISHED.internationalAddOn, "international add-on is +1% on every plan");
});

/**
 * The silent-fallback guard. `channelRate` resolves a missing plan id to the
 * first plan rather than throwing, so a dropped row would be invisible on the
 * page. This asserts the raw `rates` object directly, not through the lookup.
 */
test("no channel relies on the first-plan fallback for any plan", () => {
  const planIds = SHOPIFY_RATE_CARD.plans.map((p) => p.id);
  assert.equal(planIds.length, 6, "six plan rows: three tiers, two billing terms");

  for (const channel of SHOPIFY_RATE_CARD.channels) {
    for (const id of planIds) {
      const entry = channel.rates[id];
      assert.ok(entry, `channel ${channel.id} has no rate for plan ${id}`);
      assert.ok(entry.rate > 0 && entry.rate < 10, `channel ${channel.id}/${id} rate out of range`);
      assert.ok(entry.fixed >= 0 && entry.fixed <= 0.5, `channel ${channel.id}/${id} fixed fee out of range`);
    }
    // Billing term must never move a per-transaction rate: Shopify prices the
    // card rate off the tier, not off how the plan is paid for.
    for (const tier of TIERS) {
      assert.deepEqual(
        channel.rates[planId(tier, "m")],
        channel.rates[planId(tier, "y")],
        `channel ${channel.id} prices ${tier} differently by billing term`,
      );
    }
  }
});

/**
 * Shopify Plus is deliberately not a plan. Shopify publishes no Plus in-person
 * or premium-card rate, and a half-populated Plus plan would silently quote
 * Basic's rate on those channels. If somebody adds one, this fails.
 */
test("Shopify Plus is absent from the selector and disclosed in extras instead", () => {
  for (const plan of SHOPIFY_RATE_CARD.plans) {
    assert.ok(!/plus/i.test(plan.id), `plan ${plan.id} looks like a Plus plan`);
    assert.ok(!/plus/i.test(plan.label), `plan label "${plan.label}" looks like a Plus plan`);
  }
  const plusExtra = SHOPIFY_RATE_CARD.extras.find((e) => /plus/i.test(e.label));
  assert.ok(plusExtra, "the two published Plus figures must still be disclosed in extras");
  assert.match(plusExtra.value, /2,300/, "the Plus starting price should be in the extras line");
});

// ---------------------------------------------------------------------------
// 2. The third-party channel really is Stripe plus Shopify's rent
// ---------------------------------------------------------------------------

test("third-party-total equals Stripe's published rate plus Shopify's gateway fee", () => {
  // Independent source for the Stripe half: its own rate card, not a literal.
  const stripeOnline = STRIPE_RATE_CARD.channels.find((c) => c.id === "online")?.rates["standard"];
  assert.ok(stripeOnline, "Stripe's online channel is missing from its card");
  assert.equal(stripeOnline.rate, STRIPE_ONLINE.rate, "Stripe's US online rate has moved");
  assert.equal(Math.round(stripeOnline.fixed * 100), STRIPE_ONLINE.fixedCents, "Stripe's fixed fee has moved");

  for (const tier of TIERS) {
    for (const term of ["m", "y"] as const) {
      const id = planId(tier, term);
      const combined = cardRate("third-party-total", id);
      // Expected sum computed in basis points so the assertion is exact rather
      // than tolerance-based: 290 + 200 = 490 bps, not 4.9000000000000004.
      const expectedBps: number =
        Math.round(stripeOnline.rate * 100) + Math.round(PUBLISHED.gatewayFee[tier]! * 100);
      assert.equal(
        Math.round(combined.rate * 100),
        expectedBps,
        `${id}: expected ${expectedBps} bps all in, got ${Math.round(combined.rate * 100)}`,
      );
      assert.equal(Math.round(combined.fixed * 100), STRIPE_ONLINE.fixedCents, `${id} all-in fixed fee`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Hand-computed money, in integer cents
// ---------------------------------------------------------------------------

test("a single order costs what it costs, computed by hand", () => {
  // $80 on Basic through Shopify Payments: 2.9% of 8000c = 232c, plus 30c.
  const onBasic = cardRate("online", "basic-m");
  assert.equal(feeCents(8000, onBasic.rate, Math.round(onBasic.fixed * 100)), 262, "$80 online on Basic is $2.62");

  // The same $80 through Stripe on Basic: 4.9% of 8000c = 392c, plus 30c.
  const viaGateway = cardRate("third-party-total", "basic-m");
  assert.equal(
    feeCents(8000, viaGateway.rate, Math.round(viaGateway.fixed * 100)),
    422,
    "$80 through an outside gateway on Basic is $4.22",
  );

  // And the whole difference is Shopify's 2%, which is 160c on an $80 order.
  assert.equal(422 - 262, 160, "the gap between the two is exactly 2% of $80");
  const rentOnly = cardRate("third-party-fee", "basic-m");
  assert.equal(feeCents(8000, rentOnly.rate, 0), 160, "Shopify's third-party fee alone on $80 is $1.60");

  // $40 card present on Basic: 2.6% of 4000c = 104c, plus 10c.
  const inPerson = cardRate("inperson", "basic-m");
  assert.equal(feeCents(4000, inPerson.rate, Math.round(inPerson.fixed * 100)), 114, "$40 in person on Basic is $1.14");
});

test("the worked example month reconciles, cent for cent", () => {
  const volumeCents = 40_000_00;
  const orders = 500;

  const sp = cardRate("online", "basic-m");
  const spTotal = monthCents(volumeCents, orders, sp.rate, Math.round(sp.fixed * 100), 39);
  // 2.9% of $40,000 = $1,160, plus 500 x $0.30 = $150, plus the $39 plan fee.
  assert.equal(spTotal, 116_000 + 15_000 + 3_900, "Shopify Payments month should be $1,349.00");
  assert.equal(spTotal, 134_900);

  const gw = cardRate("third-party-total", "basic-m");
  const gwTotal = monthCents(volumeCents, orders, gw.rate, Math.round(gw.fixed * 100), 39);
  // 4.9% of $40,000 = $1,960, plus the same $150 and the same $39.
  assert.equal(gwTotal, 196_000 + 15_000 + 3_900, "outside-gateway month should be $2,149.00");
  assert.equal(gwTotal, 214_900);

  // The gap is 2% of volume, to the cent, and $9,600 a year.
  assert.equal(gwTotal - spTotal, 80_000, "the monthly gap is exactly $800");
  assert.equal((gwTotal - spTotal) * 12, 960_000, "the annual gap is exactly $9,600");

  // Effective rates, to two decimals, the way the page states them.
  assert.equal(((spTotal / volumeCents) * 100).toFixed(2), "3.37");
  assert.equal(((gwTotal / volumeCents) * 100).toFixed(2), "5.37");
});

test("the annual billing discount is a fixed saving, not a proportional one", () => {
  const saving = (tier: Tier) => (PUBLISHED.planMonthly[tier] - PUBLISHED.planYearly[tier]) * 12;
  assert.equal(saving("basic"), 120, "Basic saves $120 a year on yearly billing");
  assert.equal(saving("grow"), 312, "Grow saves $312 a year");
  assert.equal(saving("advanced"), 1200, "Advanced saves $1,200 a year");

  for (const tier of TIERS) {
    const monthly = SHOPIFY_RATE_CARD.plans.find((p) => p.id === planId(tier, "m"));
    const yearly = SHOPIFY_RATE_CARD.plans.find((p) => p.id === planId(tier, "y"));
    assert.ok(monthly && yearly);
    assert.equal((monthly.monthly - yearly.monthly) * 12, saving(tier), `${tier} discount on the card`);
  }
});

// ---------------------------------------------------------------------------
// 4. The break-even volumes the copy publishes
// ---------------------------------------------------------------------------

/**
 * Closed form, solved independently of the page: the upgrade repays itself when
 * the extra plan fee equals the rate saving on volume, so
 * V = (feeHigher - feeLower) / (rateLower - rateHigher) x 100.
 * The per-order fixed fee is identical across plans on both channels, so it
 * cancels and is deliberately not in the formula.
 */
const breakEven = (feeLow: number, feeHigh: number, rateLow: number, rateHigh: number) =>
  ((feeHigh - feeLow) / (rateLow - rateHigh)) * 100;

test("the Shopify Payments upgrade crossovers are $33,000 and $147,000 a month", () => {
  const basicToGrow = breakEven(
    PUBLISHED.planMonthly.basic,
    PUBLISHED.planMonthly.grow,
    PUBLISHED.onlineStandard.basic,
    PUBLISHED.onlineStandard.grow,
  );
  const growToAdvanced = breakEven(
    PUBLISHED.planMonthly.grow,
    PUBLISHED.planMonthly.advanced,
    PUBLISHED.onlineStandard.grow,
    PUBLISHED.onlineStandard.advanced,
  );
  assert.ok(Math.abs(basicToGrow - 33_000) < 0.01, `Basic to Grow break-even was ${basicToGrow}`);
  assert.ok(Math.abs(growToAdvanced - 147_000) < 0.01, `Grow to Advanced break-even was ${growToAdvanced}`);

  // Confirm by evaluating both plans at that volume through the card itself.
  const at = (plan: string, volumeCents: number, orders: number) => {
    const r = cardRate("online", plan);
    const fee = SHOPIFY_RATE_CARD.plans.find((p) => p.id === plan)?.monthly ?? 0;
    return monthCents(volumeCents, orders, r.rate, Math.round(r.fixed * 100), fee);
  };
  assert.equal(at("basic-m", 33_000_00, 500), at("grow-m", 33_000_00, 500), "Basic and Grow tie at $33,000");
  assert.equal(at("grow-m", 147_000_00, 500), at("advanced-m", 147_000_00, 500), "Grow and Advanced tie at $147,000");
});

test("the outside-gateway crossovers are $6,600 and $73,500 a month", () => {
  const basicToGrow = breakEven(
    PUBLISHED.planMonthly.basic,
    PUBLISHED.planMonthly.grow,
    PUBLISHED.gatewayFee.basic,
    PUBLISHED.gatewayFee.grow,
  );
  const growToAdvanced = breakEven(
    PUBLISHED.planMonthly.grow,
    PUBLISHED.planMonthly.advanced,
    PUBLISHED.gatewayFee.grow,
    PUBLISHED.gatewayFee.advanced,
  );
  assert.ok(Math.abs(basicToGrow - 6_600) < 0.01, `Basic to Grow break-even was ${basicToGrow}`);
  assert.ok(Math.abs(growToAdvanced - 73_500) < 0.01, `Grow to Advanced break-even was ${growToAdvanced}`);

  // And the saving the page quotes at $40,000 a month on an outside gateway:
  // Basic is $39 + 2% = $839, Grow is $105 + 1% = $505, so $334 a month.
  const shopifyCut = (plan: string, tier: Tier, planFee: number) => {
    const r = cardRate("third-party-fee", plan);
    assert.equal(r.rate, PUBLISHED.gatewayFee[tier]);
    return monthCents(40_000_00, 500, r.rate, 0, planFee);
  };
  const onBasic = shopifyCut("basic-m", "basic", PUBLISHED.planMonthly.basic);
  const onGrow = shopifyCut("grow-m", "grow", PUBLISHED.planMonthly.grow);
  assert.equal(onBasic, 83_900, "Basic charges $839 a month in Shopify fees at $40,000");
  assert.equal(onGrow, 50_500, "Grow charges $505 a month at the same volume");
  assert.equal(onBasic - onGrow, 33_400, "the upgrade saves $334 a month");
});

// ---------------------------------------------------------------------------
// 5. The copy agrees with the arithmetic
// ---------------------------------------------------------------------------

/**
 * The defect this guards against has shipped on this site before: a hand-written
 * figure in the prose that the widget on the same page contradicts. Each number
 * below is recomputed from the card and then looked for in the rendered string.
 */
test("every headline figure in the worked example is reproducible from the card", () => {
  const text = `${SHOPIFY_PAYMENTS_FEE_TOOL.workedExample.scenario} ${SHOPIFY_PAYMENTS_FEE_TOOL.workedExample.result}`;

  const sp = cardRate("online", "basic-m");
  const gw = cardRate("third-party-total", "basic-m");
  const spMonth = monthCents(40_000_00, 500, sp.rate, Math.round(sp.fixed * 100), 39);
  const gwMonth = monthCents(40_000_00, 500, gw.rate, Math.round(gw.fixed * 100), 39);
  const singleSp = feeCents(8000, sp.rate, Math.round(sp.fixed * 100));

  const expected = [
    usd(spMonth), // $1,349.00 -> "$1,349.00"
    usd(gwMonth),
    usd(singleSp),
    usd(8000 - singleSp),
    usd(gwMonth - spMonth),
    usd((gwMonth - spMonth) * 12),
  ];
  for (const value of expected) {
    // The prose drops trailing ".00" on whole-dollar figures, as the copy style does.
    const plain = value.replace(/\.00$/, "");
    assert.ok(
      text.includes(value) || text.includes(plain),
      `the worked example never states ${value}, which the card computes`,
    );
  }

  assert.match(text, /3\.37%/, "the worked example should state the 3.37% effective rate");
  assert.match(text, /5\.37%/, "the worked example should state the 5.37% effective rate");
});

test("the tool definition is wired to the right card and obeys the link rules", () => {
  assert.equal(SHOPIFY_PAYMENTS_FEE_TOOL.slug, "shopify-payments-fee-calculator");
  assert.equal(SHOPIFY_PAYMENTS_FEE_TOOL.widget, "brand-fee");
  assert.equal(SHOPIFY_PAYMENTS_FEE_TOOL.rateCard, "shopify");
  assert.equal(SHOPIFY_PAYMENTS_FEE_TOOL.name, "Shopify Payments Fee Calculator");

  const hrefs = SHOPIFY_PAYMENTS_FEE_TOOL.links.map((l) => l.href);
  assert.ok(hrefs.includes("/payment-processors/for-shopify"), "must link to the Shopify facet page");
  assert.ok(hrefs.includes("/processor/stripe"), "must link to the Stripe listing");
  // /processor/shopify does not exist on this site. Linking to it would 404.
  assert.ok(!hrefs.includes("/processor/shopify"), "there is no Shopify listing to link to");

  // The meta title carries no brand suffix: the layout appends the site name.
  assert.ok(SHOPIFY_PAYMENTS_FEE_TOOL.title.length <= 60, "meta title should stay under 60 characters");
  assert.ok(!/Payment Processor Guide/i.test(SHOPIFY_PAYMENTS_FEE_TOOL.title), "no brand suffix in the title");
  const descLength = SHOPIFY_PAYMENTS_FEE_TOOL.description.length;
  assert.ok(descLength >= 140 && descLength <= 158, `meta description was ${descLength} characters`);

  // House rule: no em dash, en dash, hyphen variant or curly quote anywhere in
  // the rendered copy. Written as escapes so this file does not itself contain
  // the characters it bans. U+2010 to U+2015 are the dashes, U+2018 to U+201D
  // the curly quotes, and U+2212 the minus sign people paste in from Word.
  const allCopy = JSON.stringify(SHOPIFY_PAYMENTS_FEE_TOOL) + JSON.stringify(SHOPIFY_RATE_CARD);
  assert.doesNotMatch(
    allCopy,
    /[\u2010-\u2015\u2018\u2019\u201C\u201D\u2212]/u,
    "curly quote or dash in the copy",
  );
});
