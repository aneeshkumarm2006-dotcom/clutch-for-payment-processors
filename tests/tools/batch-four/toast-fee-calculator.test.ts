import { test } from "node:test";
import assert from "node:assert/strict";
import { TOAST_RATE_CARD } from "../../../lib/rate-cards/toast";
import { TOAST_FEE_TOOL } from "../../../lib/tools-defs/toast-fee-calculator";

/**
 * `/tools/toast-fee-calculator` has no maths module of its own: it mounts the
 * shared `brand-fee` widget, which is already tested through the Stripe, PayPal
 * and Square cards. What is untested, and what actually ships wrong on pages
 * like this one, is the DATA and the hand written copy beside it.
 *
 * Three failure modes, all silent:
 *
 * 1. A rate card whose channel rows do not cover every plan id. `channelRate`
 *    falls back to the first plan rather than throwing, so a missing row renders
 *    a plausible number from the wrong plan.
 * 2. A worked example or a rate table cell that disagrees with what the widget
 *    on the same page computes from the same card. That has shipped here before
 *    (see NOTES.md: the interchange-plus example claimed a break-even near
 *    $6,400 while the widget said $2,769) and it is invisible to a reader who
 *    does not run both.
 * 3. An em dash, an en dash or a curly quote in source copy. `npm run
 *    audit:dashes` walks Mongo documents, not TypeScript string literals, so
 *    nothing else catches these.
 *
 * Every expected value below was derived independently of the widget: by hand
 * from Toast's two published rates, or from a closed form worked separately.
 * Toast publishes 3.09 percent on the Pay-as-you-Go Starter Kit and 2.49 percent
 * on the Traditional Starter Kit, both card present, both with NO per
 * transaction fee. Those two numbers are the only inputs the arithmetic here
 * needs.
 */

// The widget's formula, restated here from `BrandFeeCalculator` rather than
// imported, so a change to the widget cannot silently redefine what "correct"
// means for this page's published figures.
const monthlyCost = (volume: number, rate: number, count: number, fixed: number, plan: number) =>
  (volume * rate) / 100 + count * fixed + plan;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

// ---------------------------------------------------------------------------
// The rate card
// ---------------------------------------------------------------------------

test("TOAST_RATE_CARD: keys, slug and plan ids are the contract the route depends on", () => {
  assert.equal(TOAST_RATE_CARD.key, "toast");
  assert.equal(TOAST_RATE_CARD.processorSlug, "toast");
  assert.equal(TOAST_RATE_CARD.plans.length, 2);
  assert.deepEqual(
    TOAST_RATE_CARD.plans.map((p) => p.id),
    ["payg", "traditional"],
  );
  // Plan order matters: the widget defaults to plans[0], so the server rendered
  // default state is the Pay-as-you-Go plan. Reorder these and the page's
  // prerendered dollar figures change without anyone editing the copy.
  assert.equal(TOAST_RATE_CARD.plans[0]?.monthly, 0);
  assert.equal(TOAST_RATE_CARD.plans[1]?.monthly, 69);
});

test("TOAST_RATE_CARD: every channel prices every plan, so channelRate never falls back", () => {
  const planIds = TOAST_RATE_CARD.plans.map((p) => p.id);
  assert.ok(TOAST_RATE_CARD.channels.length > 0);
  for (const channel of TOAST_RATE_CARD.channels) {
    for (const id of planIds) {
      const row = channel.rates[id];
      assert.ok(row, `channel ${channel.id} has no row for plan ${id}`);
      assert.ok(row.rate > 0 && row.rate < 10, `channel ${channel.id}/${id} rate out of range`);
    }
  }
});

test("TOAST_RATE_CARD: the two published rates are 3.09% and 2.49%, card present", () => {
  const inPerson = TOAST_RATE_CARD.channels.find((c) => c.id === "inperson");
  assert.ok(inPerson);
  assert.equal(inPerson.rates.payg?.rate, 3.09);
  assert.equal(inPerson.rates.traditional?.rate, 2.49);
});

test("TOAST_RATE_CARD: no per transaction fee anywhere, because Toast publishes none", () => {
  // Deliberate, and the single most common error on competing pages, which
  // print "2.49% + $0.15". Neither of Toast's two published rates carries a
  // fixed component. If Toast ever publishes one, this test is the thing that
  // has to change first.
  for (const channel of TOAST_RATE_CARD.channels) {
    for (const [planId, row] of Object.entries(channel.rates)) {
      assert.equal(row.fixed, 0, `channel ${channel.id}/${planId} has a fixed fee`);
    }
  }
  assert.deepEqual(TOAST_RATE_CARD.addOns, []);
});

test("TOAST_RATE_CARD: the card not present channel is a floor, never cheaper than card present", () => {
  // Toast states that card not present costs more but publishes no rate, so the
  // online channel repeats the card present rate as an explicit floor. It must
  // never dip BELOW card present, which would make the page claim online is
  // cheaper than the counter.
  const cp = TOAST_RATE_CARD.channels.find((c) => c.id === "inperson");
  const cnp = TOAST_RATE_CARD.channels.find((c) => c.id === "cnp");
  assert.ok(cp && cnp);
  for (const id of ["payg", "traditional"]) {
    const a = cp.rates[id];
    const b = cnp.rates[id];
    assert.ok(a && b);
    assert.ok(b.rate >= a.rate, `cnp ${id} is below card present`);
  }
  assert.match(cnp.note ?? "", /FLOOR/);
});

test("TOAST_RATE_CARD: every source is an https Toast URL and the checked date is recorded", () => {
  assert.equal(TOAST_RATE_CARD.checked, "5 September 2026");
  assert.ok(TOAST_RATE_CARD.sources.length >= 3);
  for (const s of TOAST_RATE_CARD.sources) {
    assert.ok(s.label.length > 5, `source label too thin: ${s.label}`);
    assert.match(s.url, /^https:\/\/[a-z.]*toasttab\.com\//, `not a Toast URL: ${s.url}`);
  }
});

// ---------------------------------------------------------------------------
// The arithmetic the page publishes
// ---------------------------------------------------------------------------

/**
 * The worked example restaurant, restated from the page copy so the constants
 * below are visible rather than buried in a string:
 *
 *   food and drink sales      $80,000 a month
 *   share settled on cards    88 percent      ->  $70,400
 *   tip rate                  19.3 percent    ->  $13,587.20
 *   gross processed volume                        $83,987.20
 *
 * Hand computed once, outside the implementation:
 *   83,987.20 x 0.0309                        =   $2,595.20448
 *   83,987.20 x 0.0249                        =   $2,091.28128
 *   13,587.20 x 0.0309                        =   $419.84448
 */
const CARD_FOOD_AND_DRINK = 80000 * 0.88;
const TIPS = CARD_FOOD_AND_DRINK * 0.193;
const PROCESSED = CARD_FOOD_AND_DRINK + TIPS;

test("worked example: the tip inclusive volume is $83,987.20, not $70,400", () => {
  close(CARD_FOOD_AND_DRINK, 70400, 1e-9, "card food and drink sales");
  close(TIPS, 13587.2, 1e-9, "tips");
  close(PROCESSED, 83987.2, 1e-9, "gross processed volume");
  // The share of processed volume that is tip money: 0.193 / 1.193.
  close((TIPS / PROCESSED) * 100, 16.1777, 0.001, "tip share of processed volume");
});

test("worked example: Pay-as-you-Go costs $2,595.20 a month and $31,142.45 a year", () => {
  const monthly = monthlyCost(PROCESSED, 3.09, 1650, 0, 0);
  close(monthly, 2595.20448, 0.00001, "Pay-as-you-Go monthly");
  assert.equal(usd.format(monthly), "$2,595.20");
  assert.equal(usd.format(monthly * 12), "$31,142.45");
  // The transaction count cannot move the answer, because there is no fixed fee.
  assert.equal(monthlyCost(PROCESSED, 3.09, 1, 0, 0), monthly);
});

test("worked example: the fee on the tip line alone is $419.84 a month, $5,038.13 a year", () => {
  const tipFee = TIPS * 0.0309;
  close(tipFee, 419.84448, 0.00001, "monthly fee on tips");
  assert.equal(usd.format(tipFee), "$419.84");
  assert.equal(usd.format(tipFee * 12), "$5,038.13");
  // And it is 16.2 percent of the whole card bill, the figure the copy quotes.
  close((tipFee / (PROCESSED * 0.0309)) * 100, 16.1777, 0.001, "tip share of the bill");
});

test("worked example: Traditional costs $2,160.28 a month, so the free plan costs $5,219.08 a year more", () => {
  const payg = monthlyCost(PROCESSED, 3.09, 1650, 0, 0);
  const traditional = monthlyCost(PROCESSED, 2.49, 1650, 0, 69);
  close(traditional, 2160.28128, 0.00001, "Traditional monthly");
  assert.equal(usd.format(traditional), "$2,160.28");
  assert.equal(usd.format(traditional * 12), "$25,923.38");
  assert.equal(usd.format(payg - traditional), "$434.92");
  assert.equal(usd.format((payg - traditional) * 12), "$5,219.08");
});

test("worked example: the effective rate is 3.09% on card volume and 3.24% on all sales", () => {
  const monthly = monthlyCost(PROCESSED, 3.09, 1650, 0, 0);
  // Exactly the headline rate, because there is no fixed fee. This is the one
  // brand card on the site where those two numbers agree, and the copy says so.
  close((monthly / PROCESSED) * 100, 3.09, 1e-9, "effective rate on card volume");
  close((monthly / 80000) * 100, 3.244, 0.001, "effective rate on all food and drink sales");
});

test("plan crossover: the two plans cost exactly the same at $11,500 of monthly volume", () => {
  // Derived independently of the $69 / 0.006 shortcut the copy quotes: solve by
  // equating the two published plans at the claimed volume and check they meet.
  const crossover = 11500;
  const payg = monthlyCost(crossover, 3.09, 0, 0, 0);
  const traditional = monthlyCost(crossover, 2.49, 0, 0, 69);
  close(payg, 355.35, 1e-9, "Pay-as-you-Go at the crossover");
  close(traditional, 355.35, 1e-9, "Traditional at the crossover");
  assert.equal(payg, traditional);
  // Below the line the free plan wins, above it the paid one does.
  assert.ok(monthlyCost(8000, 3.09, 0, 0, 0) < monthlyCost(8000, 2.49, 0, 0, 69));
  assert.ok(monthlyCost(20000, 3.09, 0, 0, 0) > monthlyCost(20000, 2.49, 0, 0, 69));
});

test("rate table: every computed dollar cell is reproducible from the two published rates", () => {
  const table = TOAST_FEE_TOOL.rateTable;
  assert.ok(table);
  const cell = (label: string, index: number) => {
    const row = table.rows.find((r) => r.label === label);
    assert.ok(row, `no rate table row labeled ${label}`);
    return row.values[index];
  };

  // Rows one and two: the worked example restaurant on each published plan.
  assert.equal(cell("Starter Kit, Pay-as-you-Go", 2), "$2,595.20");
  assert.equal(cell("Starter Kit, Pay-as-you-Go", 3), "$31,142.45");
  assert.equal(cell("Starter Kit, Traditional", 2), "$2,160.28");
  assert.equal(cell("Starter Kit, Traditional", 3), "$25,923.38");

  // The tip sweep. Hand computed: $70,400 x (1 + t) x 0.0309.
  const sweep: [string, number][] = [
    ["Same restaurant, no tips at all", 0],
    ["Same restaurant, tips at 15%", 0.15],
    ["Same restaurant, tips at 18%", 0.18],
    ["Same restaurant, tips at 20%", 0.2],
  ];
  for (const [label, tipRate] of sweep) {
    const volume = CARD_FOOD_AND_DRINK * (1 + tipRate);
    const monthly = monthlyCost(volume, 3.09, 0, 0, 0);
    assert.equal(cell(label, 2), usd.format(monthly), `${label} monthly`);
    assert.equal(cell(label, 3), usd.format(monthly * 12), `${label} annual`);
  }

  // And the tip-only fee quoted in each row's note.
  const tipOnly: [string, number][] = [
    ["Same restaurant, tips at 15%", 0.15],
    ["Same restaurant, tips at 18%", 0.18],
    ["Same restaurant, tips at 20%", 0.2],
  ];
  for (const [label, tipRate] of tipOnly) {
    const fee = CARD_FOOD_AND_DRINK * tipRate * 0.0309;
    const row = table.rows.find((r) => r.label === label);
    assert.ok(row?.note?.includes(usd.format(fee)), `${label} note is missing ${usd.format(fee)}`);
    assert.ok(row?.note?.includes(usd.format(fee * 12)), `${label} note is missing the annual figure`);
  }
});

test("rate table: quoted rows say so rather than carrying a made up number", () => {
  const table = TOAST_FEE_TOOL.rateTable;
  assert.ok(table);
  for (const label of ["Point of Sale plan", "Build Your Own plan"]) {
    const row = table.rows.find((r) => r.label === label);
    assert.ok(row, `no rate table row labeled ${label}`);
    assert.ok(
      row.values.some((v) => /Quoted|Not published|Custom/.test(v)),
      `${label} should be marked as quoted`,
    );
    assert.ok(
      !row.values.some((v) => /^\d/.test(v) || /^\$\d/.test(v)),
      `${label} carries a point value Toast does not publish`,
    );
  }
});

test("worked example prose carries the same figures the arithmetic produces", () => {
  // The defect this guards against is a hand written number in the copy that
  // disagrees with what the widget computes from the same card on the same page.
  const prose = TOAST_FEE_TOOL.workedExample.result;
  for (const figure of [
    "$70,400",
    "$13,587.20",
    "$83,987.20",
    "$2,595.20",
    "$31,142.45",
    "$419.84",
    "$5,038.13",
    "$2,091.28",
    "$2,160.28",
    "$25,923.38",
    "$434.92",
    "$5,219.08",
    "$11,500",
    "3.09 percent",
    "2.49 percent",
    "3.24 percent",
  ]) {
    assert.ok(prose.includes(figure), `worked example is missing ${figure}`);
  }
});

// ---------------------------------------------------------------------------
// Copy hygiene and the anti-cannibalisation rule
// ---------------------------------------------------------------------------

const allStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) allStrings(v, out);
  return out;
};

test("no em dash, en dash, horizontal bar or curly quote in any published string", () => {
  // Written as escapes on purpose: U+2010 to U+2015 (hyphen, figure dash, en
  // dash, em dash, horizontal bar) and the four curly quotes. Typing the
  // characters here would put the very things this test bans into the repo.
  const banned = /[\u2010-\u2015\u2018\u2019\u201C\u201D]/;
  for (const source of [TOAST_FEE_TOOL, TOAST_RATE_CARD]) {
    for (const s of allStrings(source)) {
      assert.ok(!banned.test(s), `banned punctuation in: ${s.slice(0, 90)}`);
    }
  }
});

test("meta: the title leads with the keyword, is under 60 characters and carries no brand suffix", () => {
  assert.equal(TOAST_FEE_TOOL.slug, "toast-fee-calculator");
  assert.equal(TOAST_FEE_TOOL.name, "Toast Fee Calculator");
  assert.equal(TOAST_FEE_TOOL.widget, "brand-fee");
  assert.equal(TOAST_FEE_TOOL.rateCard, "toast");
  assert.ok(TOAST_FEE_TOOL.title.length <= 60, `title is ${TOAST_FEE_TOOL.title.length} characters`);
  assert.match(TOAST_FEE_TOOL.title, /^Toast fee calculator/);
  assert.ok(!/Payment Processor Guide/i.test(TOAST_FEE_TOOL.title));
  assert.ok(
    TOAST_FEE_TOOL.description.length >= 140 && TOAST_FEE_TOOL.description.length <= 158,
    `description is ${TOAST_FEE_TOOL.description.length} characters`,
  );
  assert.match(TOAST_FEE_TOOL.description, /Toast fee calculator/i);
  assert.match(TOAST_FEE_TOOL.h1, /Toast fee calculator/i);
  assert.match(TOAST_FEE_TOOL.intro, /^The Toast Fee Calculator/);
});

test("page shape: five sections, six FAQs, and an assumptions block that ends with the not-advice line", () => {
  assert.equal(TOAST_FEE_TOOL.sections.length, 5);
  for (const s of TOAST_FEE_TOOL.sections) {
    assert.ok(s.body.length >= 3, `section "${s.heading}" has only ${s.body.length} paragraphs`);
    for (const p of s.body) assert.ok(p.length > 200, `thin paragraph in "${s.heading}"`);
  }
  assert.ok(
    TOAST_FEE_TOOL.sections.some((s) => /toast fee calculator/i.test(s.heading)),
    "no section heading carries the primary keyword",
  );
  assert.equal(TOAST_FEE_TOOL.faqs.length, 6);
  assert.equal(TOAST_FEE_TOOL.assumptions.length, 7);
  assert.equal(
    TOAST_FEE_TOOL.assumptions.at(-1),
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  );
  // The assumptions block is what carries the E-E-A-T, so it has to name a date.
  assert.ok(
    TOAST_FEE_TOOL.assumptions.some((a) => a.includes("5 September 2026")),
    "assumptions do not state the date the rates were read",
  );
});

test("links point only at pages this site owns, and never at another calculator", () => {
  const allowed = [
    "/processor/toast",
    "/category/restaurants",
    "/blog/how-to-lower-payment-processing-fees",
    "/glossary/effective-rate",
    "/glossary/card-present",
    "/glossary/surcharge",
  ];
  assert.ok(TOAST_FEE_TOOL.links.length >= 4 && TOAST_FEE_TOOL.links.length <= 6);
  for (const link of TOAST_FEE_TOOL.links) {
    assert.ok(allowed.includes(link.href), `unexpected outbound link: ${link.href}`);
    assert.ok(!link.href.startsWith("/tools/"), "a tool must not link sideways into another tool here");
  }
  const related = TOAST_FEE_TOOL.related ?? [];
  assert.ok(related.length >= 3 && related.length <= 5);
  assert.ok(!related.includes("toast-fee-calculator"), "related points at itself");
  assert.deepEqual(new Set(related).size, related.length, "related has duplicates");
});
