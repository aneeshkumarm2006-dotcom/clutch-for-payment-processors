import { test } from "node:test";
import assert from "node:assert/strict";
import { CLOVER_RATE_CARD } from "../../../lib/rate-cards/clover";
import { CLOVER_FEE_TOOL } from "../../../lib/tools-defs/clover-fee-calculator";

/**
 * `/tools/clover-fee-calculator` has no maths module of its own: it renders the
 * shared `BrandFeeCalculator` off `CLOVER_RATE_CARD`, so the only thing that can
 * be wrong is the DATA and the prose written around it. Both fail silently. A
 * plan fee typed as 89.95 in the card and quoted as 84.95 in the copy renders
 * perfectly. A crossover volume computed against the wrong plan difference is a
 * five figure number that looks exactly as authoritative as the right one. And
 * NOTES.md records the specific defect this file exists to stop: a hand written
 * figure in a `ToolDef` that disagreed with the widget computing the same thing
 * on the same page.
 *
 * Every expected value below is derived INDEPENDENTLY of the card: by hand from
 * clover.com's published figures, by a closed form worked out separately, or by
 * a brute force search that does not share code with the closed form it checks.
 * Money arithmetic is done in integer cents, because a merchant checks these
 * against a statement.
 */

// --- helpers ---------------------------------------------------------------

/** Look a published rate up out of the card without going through the widget. */
const rateFor = (channelId: string, planId: string) => {
  const channel = CLOVER_RATE_CARD.channels.find((c) => c.id === channelId);
  assert.ok(channel, `no channel ${channelId}`);
  const r = channel.rates[planId];
  assert.ok(r, `no rate for ${channelId}/${planId}`);
  return r;
};

const planFee = (planId: string) => {
  const p = CLOVER_RATE_CARD.plans.find((x) => x.id === planId);
  assert.ok(p, `no plan ${planId}`);
  return p.monthly;
};

/**
 * A month of card fees in whole cents. Written here rather than imported so the
 * assertions do not check the widget against itself.
 */
const monthCents = (volumeCents: number, count: number, planId: string, channelId = "inperson") => {
  const { rate, fixed } = rateFor(channelId, planId);
  // Rounded to a whole cent, because a statement is denominated in whole cents
  // and because `volumeCents * 2.6 / 100` is not exact in binary floating point.
  const percent = Math.round((volumeCents * rate) / 100);
  const perItem = count * Math.round(fixed * 100);
  const plan = Math.round(planFee(planId) * 100);
  return percent + perItem + plan;
};

/**
 * The same cost UNROUNDED and without the per-transaction fee, for the crossover
 * questions. The 10 cent fee is identical on every plan so it cancels, and the
 * crossover is a continuous quantity: rounding it to cents first would smear the
 * answer across a band of volumes rather than locating it.
 */
const costExact = (volumeCents: number, planId: string, channelId = "inperson") =>
  (volumeCents * rateFor(channelId, planId).rate) / 100 + planFee(planId) * 100;

const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// The card itself
// ---------------------------------------------------------------------------

test("rate card: identity, sources and a dated check, because the copy cites them", () => {
  assert.equal(CLOVER_RATE_CARD.key, "clover");
  assert.equal(CLOVER_RATE_CARD.processorSlug, "clover");
  assert.equal(CLOVER_RATE_CARD.processorName, "Clover");
  assert.match(CLOVER_RATE_CARD.checked, /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  assert.ok(CLOVER_RATE_CARD.sources.length >= 2, "a reseller-sold brand needs more than one source page");
  for (const s of CLOVER_RATE_CARD.sources) {
    assert.ok(s.label.length > 0);
    assert.ok(s.url.startsWith("https://www.clover.com/"), `source not a clover.com URL: ${s.url}`);
  }
});

test("rate card: every plan is priced on every channel, and every rate is in a sane band", () => {
  const planIds = CLOVER_RATE_CARD.plans.map((p) => p.id);
  assert.deepEqual(planIds, ["starter", "essentials", "retail-growth", "restaurant-growth", "services-growth"]);

  for (const channel of CLOVER_RATE_CARD.channels) {
    for (const id of planIds) {
      const r = channel.rates[id];
      assert.ok(r, `${channel.id} is missing a rate for ${id}`);
      // No US flat-rate card schedule sits outside this band. A typo that moves
      // a decimal point lands outside it; a typo within it does not, which is
      // what the exact assertions further down are for.
      assert.ok(r.rate > 1 && r.rate < 6, `${channel.id}/${id} rate out of band: ${r.rate}`);
      assert.ok(r.fixed >= 0 && r.fixed < 1, `${channel.id}/${id} fixed out of band: ${r.fixed}`);
    }
  }

  for (const p of CLOVER_RATE_CARD.plans) {
    assert.ok(p.monthly >= 0 && p.monthly < 500, `plan fee out of band: ${p.id} ${p.monthly}`);
  }
});

test("rate card: the exact figures published on clover.com, 5 September 2026", () => {
  // Hand transcribed from the six vertical pricing pages, not read back from
  // any code: Starter 2.6% + 10c, Essentials 2.5% + 10c, all three Growth plans
  // 2.3% + 10c card present; 3.5% + 10c typed in on all five.
  assert.deepEqual(rateFor("inperson", "starter"), { rate: 2.6, fixed: 0.1 });
  assert.deepEqual(rateFor("inperson", "essentials"), { rate: 2.5, fixed: 0.1 });
  assert.deepEqual(rateFor("inperson", "retail-growth"), { rate: 2.3, fixed: 0.1 });
  assert.deepEqual(rateFor("inperson", "restaurant-growth"), { rate: 2.3, fixed: 0.1 });
  assert.deepEqual(rateFor("inperson", "services-growth"), { rate: 2.3, fixed: 0.1 });

  for (const id of CLOVER_RATE_CARD.plans.map((p) => p.id)) {
    assert.deepEqual(rateFor("keyed", id), { rate: 3.5, fixed: 0.1 }, `keyed rate wrong on ${id}`);
  }

  assert.equal(planFee("starter"), 0);
  assert.equal(planFee("essentials"), 29.95);
  assert.equal(planFee("retail-growth"), 84.95);
  assert.equal(planFee("restaurant-growth"), 89.95);
  assert.equal(planFee("services-growth"), 84.95);

  // Clover publishes no stacking percentage surcharge on its US pages. An
  // add-on appearing here later is either newly published or invented.
  assert.deepEqual(CLOVER_RATE_CARD.addOns, []);
});

// ---------------------------------------------------------------------------
// Arithmetic a merchant will check against a statement
// ---------------------------------------------------------------------------

test("single payment: hand computed to the cent on both channels", () => {
  // $100 card present on Starter: 2.6% of $100 is $2.60, plus 10 cents.
  assert.equal(monthCents(10_000, 1, "starter"), 270);
  // $100 typed in on any plan: 3.5% of $100 is $3.50, plus 10 cents.
  assert.equal(monthCents(10_000, 1, "retail-growth", "keyed"), 8_855);
  // That second figure carries the $84.95 plan fee. Strip it for the per-sale
  // number quoted in the FAQ: $3.50 + $0.10 = $3.60.
  assert.equal(monthCents(10_000, 1, "retail-growth", "keyed") - 8_495, 360);

  // $50 card present, the FAQ comparison against Square. Starter $1.40, Growth
  // $1.25 before the plan fee.
  assert.equal(monthCents(5_000, 1, "starter"), 140);
  assert.equal(monthCents(5_000, 1, "retail-growth") - 8_495, 125);

  // A $5 sale on Starter is 13 cents plus 10 cents, an effective 4.6%.
  const five = monthCents(500, 1, "starter");
  assert.equal(five, 23);
  assert.equal(((five / 500) * 100).toFixed(1), "4.6");
});

test("worked example: the copy on the page agrees with the arithmetic to the cent", () => {
  // Bell Street Hardware: $30,000 a month, 600 card present sales.
  // By hand, Starter:  2.6% x 30,000 = 780.00; 600 x 0.10 = 60.00; plan 0.
  // By hand, Growth:   2.3% x 30,000 = 690.00; 600 x 0.10 = 60.00; plan 84.95.
  const starter = monthCents(3_000_000, 600, "starter");
  const growth = monthCents(3_000_000, 600, "retail-growth");
  assert.equal(starter, 84_000);
  assert.equal(growth, 83_495);
  assert.equal(starter - growth, 505);
  assert.equal(((starter / 3_000_000) * 100).toFixed(2), "2.80");
  assert.equal(((growth / 3_000_000) * 100).toFixed(2), "2.78");

  // Doubled: $60,000 across 1,200 sales.
  const starterBig = monthCents(6_000_000, 1200, "starter");
  const growthBig = monthCents(6_000_000, 1200, "retail-growth");
  assert.equal(starterBig, 168_000);
  assert.equal(growthBig, 158_495);
  assert.equal(starterBig - growthBig, 9_505);
  assert.equal(((growthBig / 6_000_000) * 100).toFixed(2), "2.64");

  // And the strings the page actually ships must carry those figures. This is
  // the assertion that would have caught the interchange-plus defect recorded
  // in NOTES.md.
  const result = CLOVER_FEE_TOOL.workedExample.result;
  for (const s of [
    dollars(starter),
    dollars(growth),
    dollars(starter - growth),
    dollars(starterBig),
    dollars(growthBig),
    dollars(starterBig - growthBig),
    "2.80%",
    "2.78%",
    "2.64%",
  ]) {
    assert.ok(result.includes(s), `worked example is missing ${s}`);
  }
  // $60.60 and $1,140.60 are the annualised savings: 505 x 12 and 9,505 x 12.
  assert.ok(result.includes(dollars(505 * 12)), "annualised small saving missing");
  assert.ok(result.includes(dollars(9_505 * 12)), "annualised large saving missing");
});

test("keyed volume: the FAQ's $1,194.95 and 3.98% are reproducible", () => {
  // 3.5% x 30,000 = 1,050.00; 600 x 0.10 = 60.00; plan 84.95.
  const keyed = monthCents(3_000_000, 600, "retail-growth", "keyed");
  assert.equal(keyed, 119_495);
  assert.equal(((keyed / 3_000_000) * 100).toFixed(2), "3.98");
  // The gap against the same volume taken card present is exactly $360.00.
  assert.equal(keyed - monthCents(3_000_000, 600, "retail-growth"), 36_000);
});

// ---------------------------------------------------------------------------
// The plan crossover, which is the claim the page is built on
// ---------------------------------------------------------------------------

test("plan crossover: closed form and brute force search agree, and match the copy", () => {
  // Closed form, worked out by hand and not from the card: the plans differ by
  // 2.6 - 2.3 = 0.30 points, the 10 cent per-item fee is identical on both and
  // cancels, so the fee is covered at 84.95 / 0.003 = 28,316.666... dollars.
  // The published figure is that quotient rounded to the nearest cent.
  const crossover = (feeCents: number, pointsSaved: number) => feeCents / (pointsSaved / 100);
  const published = (feeCents: number, pointsSaved: number) =>
    dollars(Math.round(crossover(feeCents, pointsSaved)));

  assert.equal(published(8_495, 0.3), "$28,316.67");
  // Restaurant Growth at $89.95: 89.95 / 0.003 = 29,983.333... a month.
  assert.equal(published(8_995, 0.3), "$29,983.33");
  // Essentials at $29.95 saves only 0.10 points: 29.95 / 0.001 = 29,950 exactly.
  assert.equal(published(2_995, 0.1), "$29,950.00");

  // Brute force, sharing no code with the closed form: walk cent by cent and
  // find the first whole-cent volume where Growth stops costing more than
  // Starter. It has to land on the cent above the exact crossover.
  let firstWin = -1;
  for (let v = 2_831_600; v <= 2_831_800; v += 1) {
    if (costExact(v, "retail-growth") <= costExact(v, "starter")) {
      firstWin = v;
      break;
    }
  }
  assert.equal(firstWin, 2_831_667);
  assert.equal(firstWin, Math.ceil(crossover(8_495, 0.3)));

  const caption = CLOVER_FEE_TOOL.rateTable?.caption ?? "";
  assert.match(caption, /computed by this page/i, "the computed column must be labelled as computed");

  const table = CLOVER_FEE_TOOL.rateTable?.rows ?? [];
  const find = (label: string) => table.find((r) => r.label === label);
  assert.equal(find("Retail Growth")?.values[3], "$28,316.67 a month");
  assert.equal(find("Services Growth")?.values[3], "$28,316.67 a month");
  assert.equal(find("Restaurant Growth")?.values[3], "$29,983.33 a month");
  assert.equal(find("Essentials")?.values[3], "$29,950.00 a month");
});

test("Essentials is never the cheapest plan on the $84.95 families, and only just is on the $89.95 one", () => {
  // Independent reasoning, no sweep needed to state it: Essentials beats Starter
  // only above 29.95 / 0.001 = $29,950, but a $84.95 Growth plan beats
  // Essentials above 55.00 / 0.002 = $27,500. The windows do not overlap.
  assert.ok(2_995 / 0.001 > 5_500 / 0.002, "the two thresholds must be the wrong way round");

  // Confirmed by a sweep that does not use either threshold.
  let essentialsEverBest = false;
  for (let v = 0; v <= 20_000_000; v += 100) {
    const s = costExact(v, "starter");
    const e = costExact(v, "essentials");
    const g = costExact(v, "retail-growth");
    if (e < s && e < g) essentialsEverBest = true;
  }
  assert.equal(essentialsEverBest, false);

  // On the restaurant family the Growth plan costs $89.95, which pushes its
  // threshold against Essentials out to 60.00 / 0.002 = $30,000, opening a
  // window exactly fifty dollars wide. $29,975 sits inside it.
  const v = 2_997_500;
  assert.ok(costExact(v, "essentials") < costExact(v, "starter"));
  assert.ok(costExact(v, "essentials") < costExact(v, "restaurant-growth"));
  assert.equal(dollars(Math.round(6_000 / 0.002)), "$30,000.00");
});

// ---------------------------------------------------------------------------
// The copy cannot drift away from the card
// ---------------------------------------------------------------------------

test("rate table: every published cell is the figure in the rate card", () => {
  const table = CLOVER_FEE_TOOL.rateTable;
  assert.ok(table, "the page must ship a rate table");
  assert.deepEqual(table.columns, [
    "Monthly software fee",
    "Card tapped, swiped or inserted",
    "Typed in, online or phone",
    "Beats Starter above",
  ]);

  const byLabel: Record<string, string> = {
    Starter: "starter",
    Essentials: "essentials",
    "Retail Growth": "retail-growth",
    "Restaurant Growth": "restaurant-growth",
    "Services Growth": "services-growth",
  };
  assert.equal(table.rows.length, CLOVER_RATE_CARD.plans.length);

  for (const row of table.rows) {
    const id = byLabel[row.label];
    assert.ok(id, `rate table row ${row.label} is not a plan on the card`);
    const fee = planFee(id);
    assert.equal(row.values[0], fee === 0 ? "$0" : `$${fee.toFixed(2)}`, `fee cell wrong on ${row.label}`);
    const cp = rateFor("inperson", id);
    assert.equal(row.values[1], `${cp.rate}% + $${cp.fixed.toFixed(2)}`, `card present cell wrong on ${row.label}`);
    const keyed = rateFor("keyed", id);
    assert.equal(row.values[2], `${keyed.rate}% + $${keyed.fixed.toFixed(2)}`, `keyed cell wrong on ${row.label}`);
  }
});

test("house rules: meta shape, and no dashes or curly quotes anywhere in the copy", () => {
  assert.equal(CLOVER_FEE_TOOL.slug, "clover-fee-calculator");
  assert.equal(CLOVER_FEE_TOOL.widget, "brand-fee");
  assert.equal(CLOVER_FEE_TOOL.rateCard, "clover");
  assert.equal(CLOVER_FEE_TOOL.name, "Clover Fee Calculator");
  assert.ok(CLOVER_FEE_TOOL.title.length <= 60, `title is ${CLOVER_FEE_TOOL.title.length} chars`);
  assert.ok(
    CLOVER_FEE_TOOL.description.length >= 140 && CLOVER_FEE_TOOL.description.length <= 158,
    `description is ${CLOVER_FEE_TOOL.description.length} chars`,
  );
  // The layout appends the site name, so a brand suffix in the title double-prints it.
  assert.doesNotMatch(CLOVER_FEE_TOOL.title, /Payment Processor Guide/i);
  assert.equal(CLOVER_FEE_TOOL.sections.length, 5);
  assert.equal(CLOVER_FEE_TOOL.faqs.length, 6);

  // The product name has to appear in the prose several times: answer engines
  // refer to third-party calculators BY NAME and never by URL.
  const prose = CLOVER_FEE_TOOL.sections.flatMap((s) => s.body).join(" ") + " " + CLOVER_FEE_TOOL.intro;
  const named = prose.split("Clover Fee Calculator").length - 1;
  assert.ok(named >= 3, `product name appears only ${named} times in the prose`);

  // `npm run audit:dashes` walks Mongo documents, not source string literals,
  // so this is the only thing standing between a typed em dash and production.
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(CLOVER_FEE_TOOL);
  walk(CLOVER_RATE_CARD);
  // U+2010 to U+2015 (hyphen, figure dash, en dash, em dash, horizontal bar),
  // the four curly quotes, and the typographic minus. Written as escapes so
  // this guard does not itself put a banned character into the source.
  const banned = /[\u2010-\u2015\u2018\u2019\u201C\u201D\u2212]/;
  for (const s of strings) {
    assert.doesNotMatch(s, banned, `banned dash or curly quote in: ${s.slice(0, 90)}`);
  }
});
