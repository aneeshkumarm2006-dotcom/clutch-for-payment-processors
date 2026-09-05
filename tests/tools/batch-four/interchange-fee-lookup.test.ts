import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRates, formatProgramRate, interchangeCost } from "../../../lib/calc/interchange";
import {
  INTERCHANGE_CATEGORIES,
  INTERCHANGE_DEFAULTS,
  INTERCHANGE_NETWORKS,
  INTERCHANGE_RATES,
} from "../../../lib/tools-data/interchange";

/**
 * The Interchange Fee Lookup publishes numbers merchants reconcile against a
 * statement, and almost nothing here throws when it is wrong.
 *
 * Every expected value below was derived independently of the implementation:
 * by hand from the published rate, from a figure the Federal Reserve or a
 * network printed, or from an algebraic property the code does not compute.
 * A test that asserts whatever the function happened to return would pin the
 * bug in place, which is the specific failure NOTES.md records twice.
 */

// ---------------------------------------------------------------------------
// interchangeCost: percentage plus fixed
// ---------------------------------------------------------------------------

test("interchangeCost: Visa CPS/Retail Debit, 0.80% + $0.15, on a $50 sale is $0.55", () => {
  // 0.80% of $50.00 is $0.40 exactly. $0.40 + $0.15 = $0.55.
  const r = interchangeCost(50, { ratePct: 0.8, fixed: 0.15 });
  assert.equal(r.cents, 55);
  assert.equal(r.fee, 0.55);
  assert.equal(r.capped, false);
  assert.equal(r.floored, false);
});

test("interchangeCost: Mastercard Merit I Core, 1.95% + $0.10, on $100 is $2.05", () => {
  // 1.95% of $100.00 is $1.95 exactly, plus a dime.
  const r = interchangeCost(100, { ratePct: 1.95, fixed: 0.1 });
  assert.equal(r.fee, 2.05);
  assert.equal(Number(r.effectivePct.toFixed(2)), 2.05);
});

test("interchangeCost: rounds the total once, half up, rather than component by component", () => {
  // 1.43% of $50.00 is 71.5 cents. Plus a 10 cent fixed component the raw total
  // is 81.5 cents, which rounds up to 82. Rounding the percentage component
  // first would give 72 + 10 = 82 here, but the two disagree at other amounts:
  // 1.65% of $50 is 82.5 (-> 83) + 10 = 93, versus 92.5 rounded once (-> 93).
  // Both land on 93 only because half-up is used consistently.
  assert.equal(interchangeCost(50, { ratePct: 1.43, fixed: 0.1 }).cents, 82);
  assert.equal(interchangeCost(50, { ratePct: 1.65, fixed: 0.1 }).cents, 93);
});

// ---------------------------------------------------------------------------
// The Durbin cap, against a figure the Federal Reserve published
// ---------------------------------------------------------------------------

test("interchangeCost: regulated debit on the Fed's own average US debit ticket", () => {
  // 12 CFR 235.3(b): 21 cents plus 5 basis points of the transaction value.
  // The Federal Reserve reported an average US debit transaction value of
  // $46.32 for 2024. 0.05% of $46.32 is 2.316 cents; 21 + 2.316 = 23.316,
  // which rounds to 23 cents.
  const r = interchangeCost(46.32, { ratePct: 0.05, fixed: 0.21 });
  assert.equal(r.cents, 23);
  // And with the 1 cent fraud-prevention adjustment of 235.4, 24 cents.
  assert.equal(interchangeCost(46.32, { ratePct: 0.05, fixed: 0.22 }).cents, 24);
});

test("interchangeCost: the regulated cap is nearly flat, which is the whole point of it", () => {
  // Hand computed: 21 + 0.05% of the amount, in cents.
  // $10   -> 21 + 0.5   = 21.5  -> 22
  // $100  -> 21 + 5     = 26
  // $1000 -> 21 + 50    = 71
  assert.equal(interchangeCost(10, { ratePct: 0.05, fixed: 0.21 }).cents, 22);
  assert.equal(interchangeCost(100, { ratePct: 0.05, fixed: 0.21 }).cents, 26);
  assert.equal(interchangeCost(1000, { ratePct: 0.05, fixed: 0.21 }).cents, 71);
  // A hundredfold increase in ticket size raises interchange 3.2 times, not 100.
  const small = interchangeCost(10, { ratePct: 0.05, fixed: 0.21 }).cents;
  const large = interchangeCost(1000, { ratePct: 0.05, fixed: 0.21 }).cents;
  assert.ok(large / small < 3.3 && large / small > 3.1, `ratio was ${large / small}`);
});

// ---------------------------------------------------------------------------
// Caps and minimums, the two operators that are not addition
// ---------------------------------------------------------------------------

test("interchangeCost: a cap ceilings the WHOLE fee, not just the percentage", () => {
  // Visa CPS/Automated Fuel Dispenser Debit: 0.80% + $0.15, $0.95 cap.
  // $50  -> 40 + 15 = 55 cents, under the cap.
  // $200 -> 160 + 15 = 175 cents, so the cap binds at 95 cents.
  // Capping only the percentage component would wrongly report 95 + 15 = 110.
  const under = interchangeCost(50, { ratePct: 0.8, fixed: 0.15, cap: 0.95 });
  assert.equal(under.cents, 55);
  assert.equal(under.capped, false);

  const over = interchangeCost(200, { ratePct: 0.8, fixed: 0.15, cap: 0.95 });
  assert.equal(over.cents, 95);
  assert.equal(over.capped, true);
});

test("interchangeCost: a minimum floors the fee and is never added to it", () => {
  // Visa Restaurant 2, Traditional Rewards: 2.10% (min. $0.04), no fixed fee.
  // $1.00  -> 2.1 cents, below the floor, so 4 cents.
  // $10.00 -> 21 cents, above the floor, so 21 cents and NOT 25.
  const tiny = interchangeCost(1, { ratePct: 2.1, fixed: 0, min: 0.04 });
  assert.equal(tiny.cents, 4);
  assert.equal(tiny.floored, true);

  const normal = interchangeCost(10, { ratePct: 2.1, fixed: 0, min: 0.04 });
  assert.equal(normal.cents, 21);
  assert.equal(normal.floored, false);

  // The crossover is exactly $1.9047..., so $1.91 clears the floor and $1.90
  // does not: 2.10% of $1.90 is 3.99 cents.
  assert.equal(interchangeCost(1.9, { ratePct: 2.1, fixed: 0, min: 0.04 }).cents, 4);
  assert.equal(interchangeCost(1.91, { ratePct: 2.1, fixed: 0, min: 0.04 }).floored, false);
});

test("interchangeCost: a flat program has no percentage component at any amount", () => {
  // Visa CPS/Supermarket Debit is a flat $0.30 and Visa CPS/Utility on consumer
  // credit is a flat $0.75. The fee must not move with the amount at all.
  for (const amount of [1, 25, 300, 5000]) {
    assert.equal(interchangeCost(amount, { ratePct: 0, fixed: 0.3 }).cents, 30);
    assert.equal(interchangeCost(amount, { ratePct: 0, fixed: 0.75 }).cents, 75);
  }
});

test("interchangeCost: a non-positive amount returns zero rather than a negative fee", () => {
  assert.equal(interchangeCost(0, { ratePct: 1.65, fixed: 0.1 }).cents, 0);
  assert.equal(interchangeCost(-40, { ratePct: 1.65, fixed: 0.1 }).cents, 0);
  assert.equal(interchangeCost(Number.NaN, { ratePct: 1.65, fixed: 0.1 }).cents, 0);
});

// ---------------------------------------------------------------------------
// The worked example on the page, asserted line by line
// ---------------------------------------------------------------------------

test("the page's worked example: the same $50 card present sale, five ways", () => {
  const at50 = (p: Parameters<typeof interchangeCost>[1]) => interchangeCost(50, p).fee;

  // Regulated debit, 0.05% + $0.21:      2.5 + 21   = 23.5 -> 24 cents
  assert.equal(at50({ ratePct: 0.05, fixed: 0.21 }), 0.24);
  // Exempt debit CPS/Retail, 0.80% + $0.15: 40 + 15 = 55 cents
  assert.equal(at50({ ratePct: 0.8, fixed: 0.15 }), 0.55);
  // Small Merchant Product 2, 1.43% + $0.10: 71.5 + 10 = 81.5 -> 82 cents
  assert.equal(at50({ ratePct: 1.43, fixed: 0.1 }), 0.82);
  // Product 2, 1.65% + $0.10:            82.5 + 10 = 92.5 -> 93 cents
  assert.equal(at50({ ratePct: 1.65, fixed: 0.1 }), 0.93);
  // Non-Qualified Consumer Credit, 3.15% + $0.10: 157.5 + 10 = 167.5 -> 168
  assert.equal(at50({ ratePct: 3.15, fixed: 0.1 }), 1.68);

  // And the spread the copy claims: $1.68 is 7.0 times $0.24.
  assert.equal(Number((1.68 / 0.24).toFixed(1)), 7);
});

test("the page's worked example: the rows it names exist in the dataset with those rates", () => {
  const find = (network: string, programName: string, cardType: string) => {
    const row = INTERCHANGE_RATES.find(
      (r) => r.network === network && r.programName === programName && r.cardType === cardType,
    );
    assert.ok(row, `missing row: ${network} / ${programName} / ${cardType}`);
    return row;
  };

  assert.equal(find("Visa", "CPS/Retail, Debit", "Consumer debit, exempt issuer").ratePct, 0.8);
  assert.equal(find("Visa", "CPS/Retail, Debit", "Consumer debit, exempt issuer").fixed, 0.15);

  const regulated = find("Visa", "Regulated Visa Check Card", "Consumer debit or prepaid, covered issuer");
  assert.equal(regulated.ratePct, 0.05);
  assert.equal(regulated.fixed, 0.21);

  const smallMerchant = find("Visa", "Small Merchant Product 2", "Consumer credit, Traditional Rewards");
  assert.equal(smallMerchant.ratePct, 1.43);
  assert.equal(smallMerchant.fixed, 0.1);

  const product2 = find("Visa", "Product 2", "Consumer credit, Traditional Rewards");
  assert.equal(product2.ratePct, 1.65);
  assert.equal(product2.fixed, 0.1);

  const nonQual = find("Visa", "Non-Qualified Consumer Credit", "Consumer credit, all consumer products");
  assert.equal(nonQual.ratePct, 3.15);
  assert.equal(nonQual.fixed, 0.1);
});

// ---------------------------------------------------------------------------
// formatProgramRate
// ---------------------------------------------------------------------------

test("formatProgramRate: renders each of the four published shapes correctly", () => {
  assert.equal(formatProgramRate({ ratePct: 1.65, fixed: 0.1 }), "1.65% + $0.10");
  assert.equal(formatProgramRate({ ratePct: 0, fixed: 0.3 }), "$0.30");
  assert.equal(formatProgramRate({ ratePct: 2.1, fixed: 0, min: 0.04 }), "2.10% (min $0.04)");
  assert.equal(formatProgramRate({ ratePct: 0.8, fixed: 0.15, cap: 0.95 }), "0.80% + $0.15 (cap $0.95)");
});

// ---------------------------------------------------------------------------
// filterRates
// ---------------------------------------------------------------------------

const ALL: import("../../../lib/calc/interchange").InterchangeFilter = {
  query: "",
  network: "all",
  category: "all",
  channel: "all",
};

test("filterRates: an empty filter returns every row, and a network filter partitions the table", () => {
  assert.equal(filterRates(INTERCHANGE_RATES, ALL).length, INTERCHANGE_RATES.length);

  const visa = filterRates(INTERCHANGE_RATES, { ...ALL, network: "Visa" });
  const mc = filterRates(INTERCHANGE_RATES, { ...ALL, network: "Mastercard" });
  assert.equal(visa.length + mc.length, INTERCHANGE_RATES.length);
  assert.ok(visa.every((r) => r.network === "Visa"));
  assert.ok(mc.every((r) => r.network === "Mastercard"));
});

test("filterRates: free text matches the notes, so an MCC number is findable", () => {
  // 6513 is the real estate MCC and appears only in a note, never in a program
  // name. If notes stop being searched, this returns nothing and the page
  // silently loses its most useful lookup.
  const hits = filterRates(INTERCHANGE_RATES, { ...ALL, query: "6513" });
  assert.ok(hits.length >= 1, "expected at least one row mentioning MCC 6513");
  assert.ok(hits.some((r) => r.network === "Mastercard" && r.programName.includes("Real Estate")));
});

test("filterRates: the channel filter keeps rows the sheet does not restrict", () => {
  const cardPresent = filterRates(INTERCHANGE_RATES, { ...ALL, channel: "Card present" });
  assert.ok(cardPresent.every((r) => r.channel === "Card present" || r.channel === "Any"));
  assert.ok(
    cardPresent.some((r) => r.channel === "Any"),
    "rows the sheet does not restrict to a channel must survive a channel filter",
  );
  assert.ok(cardPresent.every((r) => r.channel !== "Card not present"));
});

test("filterRates: filters compose, and the search is case insensitive", () => {
  const a = filterRates(INTERCHANGE_RATES, {
    query: "SUPERMARKET",
    network: "Visa",
    category: "Supermarket and grocery",
    channel: "all",
  });
  assert.ok(a.length > 0);
  assert.ok(a.every((r) => r.network === "Visa" && r.category === "Supermarket and grocery"));
});

// ---------------------------------------------------------------------------
// Dataset integrity. The dataset IS the product on this page.
// ---------------------------------------------------------------------------

test("dataset: the table is large enough to be worth publishing and every id is unique", () => {
  assert.ok(
    INTERCHANGE_RATES.length >= 150,
    `expected at least 150 published programs, got ${INTERCHANGE_RATES.length}`,
  );
  const ids = new Set(INTERCHANGE_RATES.map((r) => r.id));
  assert.equal(ids.size, INTERCHANGE_RATES.length, "duplicate row id: React keys and search anchors would collide");
});

test("dataset: every row carries a source naming a document and a checked date", () => {
  for (const r of INTERCHANGE_RATES) {
    assert.ok(r.source.length > 40, `${r.id}: source is too short to name a document`);
    assert.ok(/checked [A-Z][a-z]+ \d{1,2}, 2026/.test(r.source), `${r.id}: source has no checked date`);
    assert.ok(
      r.source.includes("Visa") || r.source.includes("Mastercard") || r.source.includes("Federal Reserve"),
      `${r.id}: source names no publisher`,
    );
    assert.ok(r.notes.length > 20, `${r.id}: notes are empty`);
  }
});

test("dataset: every rate is inside the range the published US schedules occupy", () => {
  for (const r of INTERCHANGE_RATES) {
    // The published US schedules run from 0.00% to 3.15%. Anything outside that
    // is a transcription error, most likely a misplaced decimal.
    assert.ok(r.ratePct >= 0 && r.ratePct <= 3.3, `${r.id}: ratePct ${r.ratePct} is out of range`);
    // Fixed components are cents, except the large ticket programs at $35 and $39.
    assert.ok(r.fixed >= 0 && r.fixed <= 39, `${r.id}: fixed ${r.fixed} is out of range`);
    if (r.fixed > 2) {
      assert.ok(
        /Large Ticket/i.test(r.programName),
        `${r.id}: only large ticket programs carry a fixed fee above $2`,
      );
    }
    assert.ok(INTERCHANGE_NETWORKS.includes(r.network), `${r.id}: unknown network`);
    assert.ok(INTERCHANGE_CATEGORIES.includes(r.category), `${r.id}: unknown category ${r.category}`);
    assert.ok(["Card present", "Card not present", "Any"].includes(r.channel), `${r.id}: unknown channel`);
  }
});

test("dataset: a cap is never below the fixed component, and a minimum never above the cap", () => {
  for (const r of INTERCHANGE_RATES) {
    if (r.cap !== undefined) {
      assert.ok(r.cap > 0, `${r.id}: cap must be positive`);
      assert.ok(r.cap >= r.fixed, `${r.id}: cap ${r.cap} sits below the fixed component ${r.fixed}`);
    }
    if (r.min !== undefined) {
      assert.ok(r.min > 0, `${r.id}: minimum must be positive`);
      assert.ok(r.cap === undefined || r.min <= r.cap, `${r.id}: minimum exceeds cap`);
      assert.equal(r.fixed, 0, `${r.id}: a program with a minimum must not also carry a fixed fee`);
    }
  }
});

test("dataset: the regulated rows carry the Regulation II formula exactly", () => {
  const regulated = INTERCHANGE_RATES.filter((r) => r.category === "Regulated debit");
  assert.ok(regulated.length >= 4, "both networks should publish a regulated row with and without the adjustment");
  for (const r of regulated) {
    // 12 CFR 235.3(b): 21 cents plus 5 basis points. 235.4: plus at most 1 cent.
    assert.equal(r.ratePct, 0.05, `${r.id}: the ad valorem component is 5 basis points`);
    assert.ok(r.fixed === 0.21 || r.fixed === 0.22, `${r.id}: the base component is 21 cents, 22 with the adjustment`);
    assert.ok(r.source.includes("235.3(b)"), `${r.id}: a regulated row must cite Regulation II`);
  }
});

test("dataset: both published networks are represented, and Discover deliberately is not", () => {
  const networks = new Set(INTERCHANGE_RATES.map((r) => r.network));
  assert.deepEqual([...networks].sort(), ["Mastercard", "Visa"]);
  // Discover gates its US schedule behind an acquirer verification code and
  // marks it confidential, so there is no primary source to publish from. If a
  // future edition of this dataset grows Discover rows, that decision has to be
  // made deliberately and this assertion updated with the source.
  assert.ok(!INTERCHANGE_RATES.some((r) => r.network === "Discover"));
});

test("dataset: defaults are usable and select a real, non-empty view", () => {
  assert.ok(INTERCHANGE_DEFAULTS.amount > 0);
  assert.equal(INTERCHANGE_DEFAULTS.network, "all");
  assert.equal(INTERCHANGE_DEFAULTS.category, "all");
  const shown = filterRates(INTERCHANGE_RATES, {
    query: INTERCHANGE_DEFAULTS.query,
    network: INTERCHANGE_DEFAULTS.network,
    category: INTERCHANGE_DEFAULTS.category,
    channel: INTERCHANGE_DEFAULTS.channel,
  });
  assert.ok(shown.length >= INTERCHANGE_DEFAULTS.maxRows, "the default view must fill the first page of results");
  // And the default amount must produce a non-zero fee on every visible row,
  // so the server-rendered HTML never ships a table of dollar zeroes.
  for (const r of shown.slice(0, INTERCHANGE_DEFAULTS.maxRows)) {
    assert.ok(interchangeCost(INTERCHANGE_DEFAULTS.amount, r).cents > 0, `${r.id}: zero fee on the default amount`);
  }
});

test("dataset: every category in the filter list is actually used", () => {
  for (const c of INTERCHANGE_CATEGORIES) {
    assert.ok(
      INTERCHANGE_RATES.some((r) => r.category === c),
      `category "${c}" is offered in the filter but matches no rows`,
    );
  }
});

// ---------------------------------------------------------------------------
// Claims the page copy makes, asserted against the data
// ---------------------------------------------------------------------------

test("copy check: exempt debit really is cheaper than regulated debit on a small ticket", () => {
  // The page says the Durbin cap is not a discount at every ticket size. On a
  // $5 coffee, regulated debit is 21 + 0.25 = 21.25 -> 21 cents, while Visa's
  // CPS/Small Ticket Debit at 1.55% + $0.04 is 7.75 + 4 = 11.75 -> 12 cents.
  const regulated = interchangeCost(5, { ratePct: 0.05, fixed: 0.21 }).cents;
  const smallTicket = interchangeCost(5, { ratePct: 1.55, fixed: 0.04 }).cents;
  assert.equal(regulated, 21);
  assert.equal(smallTicket, 12);
  assert.ok(smallTicket < regulated);
});

test("copy check: the supermarket debit program beats retail debit above $18.75", () => {
  // Visa CPS/Supermarket Debit is a flat $0.30; CPS/Retail Debit is
  // 0.80% + $0.15. Setting 0.008a + 0.15 = 0.30 gives a = $18.75 exactly.
  const supermarket = { ratePct: 0, fixed: 0.3 };
  const retail = { ratePct: 0.8, fixed: 0.15 };
  assert.equal(interchangeCost(18.75, supermarket).cents, 30);
  assert.equal(interchangeCost(18.75, retail).cents, 30);
  // A dollar either side of the crossover, clear of the rounding boundary.
  assert.ok(interchangeCost(17.75, retail).cents < interchangeCost(17.75, supermarket).cents);
  assert.ok(interchangeCost(19.75, retail).cents > interchangeCost(19.75, supermarket).cents);
  // And the gap widens: on a $200 basket it is 30 cents against $1.75.
  assert.equal(interchangeCost(200, supermarket).cents, 30);
  assert.equal(interchangeCost(200, retail).cents, 175);
});

test("copy check: Visa's commercial large ticket rate beats Commercial Product 3 at $7,755.56", () => {
  // Commercial Product 3 is 1.75% + $0.10; Commercial Product Large Ticket is
  // 1.30% + $35.00. Setting 0.0175a + 0.10 = 0.013a + 35.00 gives
  // 0.0045a = 34.90, so a = $7,755.56.
  const product3 = { ratePct: 1.75, fixed: 0.1 };
  const largeTicket = { ratePct: 1.3, fixed: 35 };
  const crossover = 34.9 / 0.0045; // 7,755.5555...
  assert.ok(interchangeCost(crossover - 100, product3).cents < interchangeCost(crossover - 100, largeTicket).cents);
  assert.ok(interchangeCost(crossover + 100, product3).cents > interchangeCost(crossover + 100, largeTicket).cents);
});
