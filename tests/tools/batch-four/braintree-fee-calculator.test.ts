import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAINTREE_RATE_CARD } from "../../../lib/rate-cards/braintree";
import { BRAINTREE_FEE_TOOL } from "../../../lib/tools-defs/braintree-fee-calculator";
import { channelRate, findChannel, defaultPlanId } from "../../../lib/tools-rates";

/**
 * `/tools/braintree-fee-calculator` has no maths module of its own: it mounts the
 * shared `brand-fee` widget, so the only things that can be wrong are the RATE
 * CARD and the hand-written dollar figures in the page copy. Both fail silently.
 * A card carrying 2.59% instead of 2.89% renders identically to a correct one,
 * and a worked example that disagrees with the widget sitting above it on the
 * same page is the defect this project has already shipped once.
 *
 * So the reference values below are derived INDEPENDENTLY of the rate card:
 * every expected number is written out here as literal arithmetic on the figures
 * read from PayPal's published US Braintree fee schedule on 5 September 2026,
 * and then checked against what the card and the copy actually contain. If
 * somebody edits a rate without re-reading the source, these fail.
 *
 * Source figures asserted against (paypal.com/us/enterprise/paypal-braintree-fees,
 * page states last updated 7 May 2026):
 *   cards and third-party digital wallets  2.89% + $0.29
 *   charity, verified 501(c)(3)            2.19% + $0.29
 *   Venmo                                  3.49% + $0.49
 *   ACH direct debit, standard             0.75%, capped at $5.00
 *   ACH direct debit, same day             1.5%  + $0.10
 *   pass-through American Express          $0.15
 *   non-USD currency                       +1%
 *   card issued outside the US             +1%
 *   chargeback                             $15.00
 * and, for the PayPal wallet row Braintree defers on
 * (paypal.com/us/business/paypal-business-fees, states last updated 1 Sept 2026):
 *   PayPal Checkout, US commercial         3.49% + $0.49
 */

const PLAN = "standard";

/** The exact arithmetic `BrandFeeCalculator` performs. Duplicated on purpose:
 *  the widget is a `"use client"` module and cannot be imported here, so this is
 *  a second, independent statement of the same formula. */
const feeOn = (amount: number, rate: number, fixed: number) => (amount * rate) / 100 + fixed;

/** What `money()` renders, so a copy string can be compared to a computed cent. */
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const rateFor = (channelId: string) =>
  channelRate(BRAINTREE_RATE_CARD, findChannel(BRAINTREE_RATE_CARD, channelId), PLAN);

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

// ---------------------------------------------------------------------------
// 1. The rate card carries the published schedule, not a paraphrase of it
// ---------------------------------------------------------------------------

test("rate card: every published US rate matches the source figures written out above", () => {
  const expected: Record<string, { rate: number; fixed: number }> = {
    cards: { rate: 2.89, fixed: 0.29 },
    paypal: { rate: 3.49, fixed: 0.49 },
    venmo: { rate: 3.49, fixed: 0.49 },
    ach: { rate: 0.75, fixed: 0 },
    "ach-same-day": { rate: 1.5, fixed: 0.1 },
    "amex-passthrough": { rate: 0, fixed: 0.15 },
    "charity-cards": { rate: 2.19, fixed: 0.29 },
  };

  assert.equal(BRAINTREE_RATE_CARD.key, "braintree");
  assert.equal(BRAINTREE_RATE_CARD.processorSlug, "braintree");
  assert.equal(defaultPlanId(BRAINTREE_RATE_CARD), PLAN);
  assert.deepEqual(
    BRAINTREE_RATE_CARD.channels.map((c) => c.id).sort(),
    Object.keys(expected).sort(),
    "the card gained or lost a channel without this test being updated",
  );

  for (const [id, want] of Object.entries(expected)) {
    const got = rateFor(id);
    assert.equal(got.rate, want.rate, `${id} percentage`);
    assert.equal(got.fixed, want.fixed, `${id} fixed fee`);
  }

  // Both add-ons are 1%, and they are SEPARATE conditions. Collapsing them into
  // one 1% toggle understates a non-USD payment on a foreign card by a full
  // percentage point, which is the specific error this page calls out.
  assert.equal(BRAINTREE_RATE_CARD.addOns.length, 2);
  for (const a of BRAINTREE_RATE_CARD.addOns) assert.equal(a.rate, 1, `${a.id} add-on`);

  // Provenance. Every figure above is only as good as a source with a date.
  assert.ok(BRAINTREE_RATE_CARD.checked.length > 0);
  assert.ok(BRAINTREE_RATE_CARD.sources.length >= 2, "the PayPal wallet row needs its own source");
  for (const s of BRAINTREE_RATE_CARD.sources) {
    assert.ok(s.url.startsWith("https://"), `source ${s.label} has no https URL`);
    assert.ok(s.label.length > 10, `source ${s.url} has no usable label`);
  }
});

// ---------------------------------------------------------------------------
// 2. Per-payment arithmetic, computed by hand
// ---------------------------------------------------------------------------

test("a $60 order: hand arithmetic on each method matches the card", () => {
  // Worked out longhand, independently of the card:
  //   cards    0.0289 x 60 = 1.734 ; + 0.29 = 2.024
  //   paypal   0.0349 x 60 = 2.094 ; + 0.49 = 2.584
  //   venmo    same as paypal              = 2.584
  //   ach      0.0075 x 60 = 0.45  ; + 0    = 0.45
  //   sameday  0.015  x 60 = 0.90  ; + 0.10 = 1.00
  //   amex     0      x 60 = 0     ; + 0.15 = 0.15
  //   charity  0.0219 x 60 = 1.314 ; + 0.29 = 1.604
  const expected: Record<string, number> = {
    cards: 2.024,
    paypal: 2.584,
    venmo: 2.584,
    ach: 0.45,
    "ach-same-day": 1.0,
    "amex-passthrough": 0.15,
    "charity-cards": 1.604,
  };

  for (const [id, want] of Object.entries(expected)) {
    const r = rateFor(id);
    close(feeOn(60, r.rate, r.fixed), want, 1e-9, `${id} fee on $60`);
  }

  // The whole point of the page: the wallet path costs 56 cents more per order.
  // 2.584 - 2.024 = 0.560, exactly.
  const card = rateFor("cards");
  const wallet = rateFor("paypal");
  close(feeOn(60, wallet.rate, wallet.fixed) - feeOn(60, card.rate, card.fixed), 0.56, 1e-9, "wallet premium");

  // Both 1% add-ons on a card: 4.89% + $0.29 -> 0.0489 x 60 = 2.934 ; + 0.29 = 3.224
  const both = card.rate + BRAINTREE_RATE_CARD.addOns.reduce((s, a) => s + a.rate, 0);
  close(both, 4.89, 1e-9, "card rate with both add-ons stacked");
  close(feeOn(60, both, card.fixed), 3.224, 1e-9, "both add-ons on $60");
  assert.equal(money(feeOn(60, both, card.fixed)), "$3.22");
  close((3.224 / 60) * 100, 5.3733, 0.0001, "effective rate with both add-ons");
});

test("the fixed fee, not the percentage, is what a small ticket pays", () => {
  const { rate, fixed } = rateFor("cards");
  // Hand-computed effective rates: fee / amount x 100.
  //   $5   -> (0.1445 + 0.29) / 5   = 8.69%
  //   $25  -> (0.7225 + 0.29) / 25  = 4.05%
  //   $100 -> (2.89   + 0.29) / 100 = 3.18%
  const cases: [number, number][] = [
    [5, 8.69],
    [25, 4.05],
    [100, 3.18],
  ];
  for (const [amount, want] of cases) {
    close((feeOn(amount, rate, fixed) / amount) * 100, want, 0.005, `effective rate on $${amount}`);
  }
  // And it is monotonically falling, which is the claim the copy makes.
  const eff = (a: number) => feeOn(a, rate, fixed) / a;
  assert.ok(eff(5) > eff(25) && eff(25) > eff(60) && eff(60) > eff(100));
});

// ---------------------------------------------------------------------------
// 3. The ACH cap, which the shared widget does NOT apply
// ---------------------------------------------------------------------------

test("ACH: the $5.00 cap binds at $666.67, and the page says so", () => {
  const { rate, fixed } = rateFor("ach");
  assert.equal(fixed, 0, "a fixed component would change the crossover");
  // 5.00 / 0.0075 = 666.666..., so $666.67 is the first cent at or past the cap.
  const crossover = 5 / (rate / 100);
  close(crossover, 666.6667, 0.0001, "ACH cap crossover");
  assert.ok(feeOn(666.67, rate, fixed) >= 5, "at $666.67 the uncapped fee has reached the cap");
  assert.ok(feeOn(666.66, rate, fixed) < 5, "at $666.66 it has not");

  // On a $2,000 invoice: card 0.0289 x 2000 = 57.80 ; + 0.29 = 58.09. ACH = 5.00.
  const card = rateFor("cards");
  close(feeOn(2000, card.rate, card.fixed), 58.09, 1e-9, "card fee on a $2,000 invoice");
  close(58.09 - 5, 53.09, 1e-9, "ACH saving on a $2,000 invoice");

  // Same-day has no cap: 0.015 x 2000 = 30.00 ; + 0.10 = 30.10.
  const sameDay = rateFor("ach-same-day");
  close(feeOn(2000, sameDay.rate, sameDay.fixed), 30.1, 1e-9, "same-day ACH on $2,000");

  // ACH beats the card rate at EVERY amount here, because ACH carries no fixed
  // fee. If a future edit adds one, this fails and the copy has to change.
  for (const amount of [1, 5, 60, 500, 666.67, 5000]) {
    const achFee = Math.min(feeOn(amount, rate, fixed), 5);
    assert.ok(
      achFee < feeOn(amount, card.rate, card.fixed),
      `ACH is not cheaper than cards at $${amount}`,
    );
  }

  assert.ok(
    BRAINTREE_RATE_CARD.channels.find((c) => c.id === "ach")?.note?.includes("666.67"),
    "the ACH channel must warn that the widget does not apply the cap",
  );
});

// ---------------------------------------------------------------------------
// 4. The worked example, recomputed line by line
// ---------------------------------------------------------------------------

test("worked example: Harbor Lane Goods totals $2,196.44 at a blended 3.66%", () => {
  // Written out independently. 1,000 orders at $60 = $60,000.
  //   620 card    -> $37,200 : 0.0289 x 37200 = 1075.08 ; 620 x 0.29 = 179.80 -> 1254.88
  //   250 paypal  -> $15,000 : 0.0349 x 15000 =  523.50 ; 250 x 0.49 = 122.50 ->  646.00
  //    90 venmo   -> $ 5,400 : 0.0349 x  5400 =  188.46 ;  90 x 0.49 =  44.10 ->  232.56
  //    40 ach     -> $ 2,400 : 0.0075 x  2400 =   18.00 ; no fixed fee        ->   18.00
  //     3 chargebacks x $15.00                                                ->   45.00
  //   total 2196.44 ; 2196.44 / 60000 = 3.6607%
  const legs: [string, number, number][] = [
    ["cards", 37200, 620],
    ["paypal", 15000, 250],
    ["venmo", 5400, 90],
    ["ach", 2400, 40],
  ];
  const expectedLeg: Record<string, number> = {
    cards: 1254.88,
    paypal: 646.0,
    venmo: 232.56,
    ach: 18.0,
  };

  let total = 0;
  for (const [id, volume, count] of legs) {
    const r = rateFor(id);
    const cost = (volume * r.rate) / 100 + count * r.fixed;
    close(cost, expectedLeg[id] as number, 1e-9, `${id} leg`);
    total += cost;
  }
  const chargebacks = 3 * 15;
  assert.equal(chargebacks, 45);
  total += chargebacks;

  close(total, 2196.44, 1e-9, "total monthly Braintree cost");
  assert.equal(money(total), "$2,196.44");
  close((total / 60000) * 100, 3.6607, 0.0001, "blended effective rate");
  assert.equal(((total / 60000) * 100).toFixed(2), "3.66");

  // The counterfactual. All 960 non-ACH orders at the card rate:
  //   960 x 60 = 57600 ; 0.0289 x 57600 = 1664.64 ; 960 x 0.29 = 278.40 -> 1943.04
  const card = rateFor("cards");
  const allCard = (57600 * card.rate) / 100 + 960 * card.fixed;
  close(allCard, 1943.04, 1e-9, "all 960 orders at the card rate");

  const asBilled = expectedLeg.cards! + expectedLeg.paypal! + expectedLeg.venmo!;
  close(asBilled, 2133.44, 1e-9, "the three card-and-wallet legs as billed");
  close(asBilled - allCard, 190.4, 1e-9, "monthly cost of the wallet mix");
  close((asBilled - allCard) * 12, 2284.8, 1e-7, "annual cost of the wallet mix");

  // And it must equal 340 wallet orders times the 56 cent per-order gap, or one
  // of the two figures in the copy is wrong.
  close(340 * 0.56, 190.4, 1e-9, "cross-check: orders x per-order gap");

  // Finally, every figure above has to appear in the shipped copy.
  const copy = BRAINTREE_FEE_TOOL.workedExample.result;
  for (const s of ["$1,254.88", "$646.00", "$232.56", "$18.00", "$2,196.44", "3.66%", "$1,943.04", "$190.40", "$2,284.80"]) {
    assert.ok(copy.includes(s), `worked example is missing ${s}`);
  }
});

// ---------------------------------------------------------------------------
// 5. The rate table's computed column, recomputed from the card
// ---------------------------------------------------------------------------

test("rate table: the $60 column is arithmetic on the card, not typed in", () => {
  const table = BRAINTREE_FEE_TOOL.rateTable;
  assert.ok(table, "the page must ship a rate table");
  assert.equal(table.columns.length, 2);

  const byLabel = (label: string) => table.rows.find((r) => r.label === label);
  const expected: [string, string][] = [
    ["Cards and third-party digital wallets", "cards"],
    ["Cards, verified 501(c)(3) charity", "charity-cards"],
    ["PayPal wallet inside Braintree", "paypal"],
    ["Venmo", "venmo"],
    ["ACH Direct Debit, standard", "ach"],
    ["ACH Direct Debit, same day", "ach-same-day"],
    ["Pass-through American Express", "amex-passthrough"],
  ];

  for (const [label, channelId] of expected) {
    const row = byLabel(label);
    assert.ok(row, `rate table row missing: ${label}`);
    const r = rateFor(channelId);
    assert.equal(row.values[1], money(feeOn(60, r.rate, r.fixed)), `${label} cost column`);
  }

  // The two add-on rows are 1% of $60 = $0.60 each.
  assert.equal(byLabel("Presented in a non-USD currency")?.values[1], "+" + money(0.6));
  assert.equal(byLabel("Customer card issued outside the US")?.values[1], "+" + money(0.6));

  // The caption must say which column is sourced and which is computed here.
  assert.ok(/computed by this page/i.test(table.caption), "caption must disclose the computed column");
});

// ---------------------------------------------------------------------------
// 6. Page contract and house rules
// ---------------------------------------------------------------------------

const allStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, out);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) allStrings(v, out);
  return out;
};

test("ToolDef contract: the wiring names other modules already import", () => {
  assert.equal(BRAINTREE_FEE_TOOL.slug, "braintree-fee-calculator");
  assert.equal(BRAINTREE_FEE_TOOL.widget, "brand-fee");
  assert.equal(BRAINTREE_FEE_TOOL.rateCard, "braintree");
  assert.equal(BRAINTREE_FEE_TOOL.tier, 2);
  assert.equal(BRAINTREE_FEE_TOOL.name, "Braintree Fee Calculator");

  // Meta rules: no brand suffix, title under 60, description in the 140 to 158 band.
  assert.ok(BRAINTREE_FEE_TOOL.title.length < 60, `title is ${BRAINTREE_FEE_TOOL.title.length} chars`);
  assert.ok(
    !/payment processor guide/i.test(BRAINTREE_FEE_TOOL.title),
    "the layout appends the site name; the title must not",
  );
  assert.ok(
    BRAINTREE_FEE_TOOL.description.length >= 140 && BRAINTREE_FEE_TOOL.description.length <= 158,
    `description is ${BRAINTREE_FEE_TOOL.description.length} chars`,
  );
  assert.ok(/braintree fee calculator/i.test(BRAINTREE_FEE_TOOL.title));
  assert.ok(/braintree fee calculator/i.test(BRAINTREE_FEE_TOOL.h1));
  assert.ok(/braintree fees/i.test(BRAINTREE_FEE_TOOL.intro.split(".")[0] ?? ""));

  // An answer engine refers to a calculator by NAME, never by URL, so the
  // product name has to appear in the prose more than once.
  const prose = [
    BRAINTREE_FEE_TOOL.intro,
    ...BRAINTREE_FEE_TOOL.sections.flatMap((s) => [s.heading, ...s.body]),
  ].join(" ");
  const named = prose.split("Braintree Fee Calculator").length - 1;
  assert.ok(named >= 3, `product name appears ${named} times in the prose, wanted at least 3`);

  assert.equal(BRAINTREE_FEE_TOOL.sections.length, 5);
  for (const s of BRAINTREE_FEE_TOOL.sections) {
    assert.ok(s.body.length >= 3, `section "${s.heading}" has only ${s.body.length} paragraphs`);
  }
  assert.equal(BRAINTREE_FEE_TOOL.faqs.length, 6);
  for (const f of BRAINTREE_FEE_TOOL.faqs) {
    const words = f.answer.trim().split(/\s+/).length;
    assert.ok(words >= 40 && words <= 90, `FAQ "${f.question}" answer is ${words} words`);
  }

  const words = BRAINTREE_FEE_TOOL.sections
    .flatMap((s) => s.body)
    .join(" ")
    .trim()
    .split(/\s+/).length;
  assert.ok(words >= 1300 && words <= 1700, `section copy is ${words} words`);

  assert.ok(BRAINTREE_FEE_TOOL.assumptions.length >= 5 && BRAINTREE_FEE_TOOL.assumptions.length <= 7);
  assert.ok(
    BRAINTREE_FEE_TOOL.assumptions.at(-1)?.startsWith("This is an estimate"),
    "the last assumption must be the shared not-advice line",
  );
  // The dated sources belong in the assumptions block, which is what carries E-E-A-T.
  assert.ok(BRAINTREE_FEE_TOOL.assumptions.some((a) => a.includes("5 September 2026")));

  assert.ok((BRAINTREE_FEE_TOOL.related ?? []).length >= 3);
  assert.ok(!(BRAINTREE_FEE_TOOL.related ?? []).includes(BRAINTREE_FEE_TOOL.slug));
  assert.ok(BRAINTREE_FEE_TOOL.links.length >= 4 && BRAINTREE_FEE_TOOL.links.length <= 6);
  for (const l of BRAINTREE_FEE_TOOL.links) {
    assert.ok(l.href.startsWith("/"), `${l.href} is not an internal link`);
    // Anti-cannibalisation: a tool links INTO the pages that own the other
    // intents and never at another /tools page from this block.
    assert.ok(!l.href.startsWith("/tools/"), `${l.href} belongs in related, not links`);
  }
});

test("house rules: no dashes and no curly quotes anywhere in either module", () => {
  const strings = [...allStrings(BRAINTREE_FEE_TOOL), ...allStrings(BRAINTREE_RATE_CARD)];
  assert.ok(strings.length > 50, "the walker found suspiciously few strings");
  // em dash, en dash, horizontal bar, minus sign, curly quotes and apostrophes.
  // Written as escapes so that grepping the SOURCE of this repo for a stray em
  // dash does not keep hitting the detector that exists to forbid one.
  const banned = /[\u2014\u2013\u2015\u2212\u2018\u2019\u201C\u201D]/;
  for (const s of strings) {
    assert.ok(!banned.test(s), `banned glyph in: ${s.slice(0, 120)}`);
  }
  // US spelling, since the audience is US merchants.
  for (const s of strings) {
    assert.ok(!/\b(organisation|analyse|optimise|annualised|amortisation)\b/i.test(s), `UK spelling in: ${s.slice(0, 120)}`);
  }
});
