import { test } from "node:test";
import assert from "node:assert/strict";
import { merchantLevel, reachableQuestions, resolveSaq } from "../../../lib/calc/pci";
import {
  PCI_MERCHANT_LEVELS,
  PCI_SAQ_DEFAULTS,
  PCI_SAQ_QUESTIONS,
  PCI_SAQ_TYPES,
  PCI_SOURCES,
} from "../../../lib/tools-data/pci";

/**
 * Every expected value below was derived from the published sources or worked
 * on paper, before the implementation was consulted.
 *
 * This tool does no arithmetic worth checking, and that is exactly why it needs
 * a test: every failure mode is a wrong BRANCH, which returns a confident answer
 * that is indistinguishable from a right one. The four being pinned:
 *
 *   1. QUESTION ORDER. Electronic storage of account data must be asked before
 *      the acceptance channel. A merchant who stores card numbers is on SAQ D
 *      however the cards arrive, and a tree that asks about checkout first will
 *      hand that merchant SAQ A and a validation short by a hundred
 *      requirements.
 *   2. THE LEVEL 3 DENOMINATOR. Levels 1 and 2 are decided on all transactions.
 *      Level 3 is decided only on the e-commerce subset. Reading the Level 3
 *      line against a total makes a 900,000-transaction card-present shop with
 *      400 online sales into a Level 3 merchant.
 *   3. THE 20,000 TIE. Mastercard says Level 3 begins above 20,000 e-commerce
 *      transactions. Visa's page gives 20,000 to both Level 3 and Level 4.
 *      Exactly 20,000 must resolve to Level 4 and must be flagged.
 *   4. THE SCAN FLAG. Whether a questionnaire carries the quarterly ASV scan is
 *      derivable from the published document: it is true when and only when
 *      Requirement 11 appears in Section 2. The two fields are recorded
 *      independently in the data module and are cross-checked here, so one
 *      cannot be edited without the other.
 */

const ALL_IDS = PCI_SAQ_TYPES.map((t) => t.id);
const resolve = (answers: Record<string, string>) => resolveSaq(PCI_SAQ_QUESTIONS, answers, ALL_IDS);

// ---------------------------------------------------------------------------
// The decision tree walks the right path
// ---------------------------------------------------------------------------

test("tree order: storage of account data is asked before the acceptance channel", () => {
  const ids = PCI_SAQ_QUESTIONS.map((q) => q.id);
  assert.equal(ids[0], "entity");
  assert.ok(ids.indexOf("storage") < ids.indexOf("channel"), "storage must precede channel");
});

test("storing account data lands on SAQ D for merchants, whatever the checkout looks like", () => {
  // Stale answers from a previous walk are deliberately left in the object: the
  // resolver must stop at the terminal option and never read past it.
  const r = resolve({
    entity: "merchant",
    storage: "yes",
    channel: "ecommerce",
    ecom: "redirect",
  });
  assert.equal(r.saqId, "d-merchant");
  assert.equal(r.complete, true);
  assert.equal(r.path.length, 2, "the walk must stop at the storage question");
});

test("a service provider gets SAQ D for Service Providers and is asked nothing else", () => {
  const r = resolve({ entity: "service-provider" });
  assert.equal(r.saqId, "d-service-provider");
  assert.equal(r.path.length, 1);
  assert.equal(reachableQuestions(PCI_SAQ_QUESTIONS, { entity: "service-provider" }).length, 1);
});

test("the A versus A-EP split turns on where the payment page comes from", () => {
  const base = { entity: "merchant", storage: "no", channel: "ecommerce" };

  // PCI SSC, SAQ Instructions and Guidelines v4.0 page 9: a URL redirect and an
  // iframe to a compliant TPSP are both SAQ A examples.
  assert.equal(resolve({ ...base, ecom: "redirect" }).saqId, "a");
  assert.equal(resolve({ ...base, ecom: "iframe" }).saqId, "a");
  assert.equal(resolve({ ...base, ecom: "no-website" }).saqId, "a");

  // Same page: a merchant-created payment form (Direct Post) and a merchant page
  // that loads a script supporting the payment page are both SAQ A-EP.
  assert.equal(resolve({ ...base, ecom: "merchant-page-scripts" }).saqId, "a-ep");

  // And account data reaching merchant systems is SAQ D, page 22.
  assert.equal(resolve({ ...base, ecom: "own-systems" }).saqId, "d-merchant");
});

test("the card-present hardware questions land on the SAQ the Council's flow chart gives", () => {
  const base = { entity: "merchant", storage: "no", channel: "card-present" };
  assert.equal(resolve({ ...base, cp: "imprint-dial" }).saqId, "b");
  assert.equal(resolve({ ...base, cp: "ip-terminal" }).saqId, "b-ip");
  assert.equal(resolve({ ...base, cp: "payment-app" }).saqId, "c");
  assert.equal(resolve({ ...base, cp: "virtual-terminal" }).saqId, "c-vt");
  assert.equal(resolve({ ...base, cp: "p2pe" }).saqId, "p2pe");
  assert.equal(resolve({ ...base, cp: "spoc" }).saqId, "spoc");
  assert.equal(resolve({ ...base, cp: "other" }).saqId, "d-merchant");
});

test("MOTO fully outsourced is SAQ A, and SAQ A-EP is never reachable off a MOTO channel", () => {
  const base = { entity: "merchant", storage: "no", channel: "moto" };
  assert.equal(resolve({ ...base, moto: "fully-outsourced" }).saqId, "a");
  // SAQ A-EP is applicable only to e-commerce channels (Guidelines, page 15).
  for (const option of PCI_SAQ_QUESTIONS.find((q) => q.id === "moto")!.options) {
    assert.notEqual(option.resolvesTo, "a-ep");
  }
  for (const option of PCI_SAQ_QUESTIONS.find((q) => q.id === "cp")!.options) {
    assert.notEqual(option.resolvesTo, "a-ep");
    assert.notEqual(option.resolvesTo, "a");
  }
});

test("an unfinished walk answers nothing and names the question it is waiting on", () => {
  const r = resolve({ entity: "merchant", storage: "no", channel: "ecommerce" });
  assert.equal(r.saqId, null);
  assert.equal(r.complete, false);
  assert.equal(r.nextQuestionId, "ecom");
  assert.equal(r.path.length, 3);
  // The e-commerce answer has already eliminated every card-present SAQ.
  for (const id of ["b", "b-ip", "c", "c-vt", "p2pe", "spoc"]) {
    assert.ok(r.eliminated.includes(id), `${id} should be eliminated on an e-commerce channel`);
  }
});

test("a cycle or a dangling edge cannot hang the walk", () => {
  const looped = [
    {
      id: "one",
      question: "One?",
      options: [{ id: "go", label: "Go", rulesIn: [], rulesOut: [], next: "two" }],
    },
    {
      id: "two",
      question: "Two?",
      options: [{ id: "back", label: "Back", rulesIn: [], rulesOut: [], next: "one" }],
    },
  ];
  const r = resolveSaq(looped, { one: "go", two: "back" }, ["x"]);
  assert.equal(r.complete, false);
  assert.ok(r.path.length <= looped.length + 1);
});

// ---------------------------------------------------------------------------
// Merchant level
// ---------------------------------------------------------------------------

const level = (total: number, ecom: number, compromise = false) =>
  merchantLevel(
    {
      totalAnnualTransactions: total,
      ecommerceAnnualTransactions: ecom,
      hadCompromise: compromise,
    },
    PCI_MERCHANT_LEVELS,
  );

test("the Level 1 and Level 2 lines are read against total transactions", () => {
  // Visa: over 6 million across all channels is Level 1; 1 million to 6 million
  // is Level 2. Mastercard: greater than six million, and greater than one
  // million up to six million.
  assert.equal(level(6_000_001, 0).level, 1);
  assert.equal(level(6_000_000, 0).level, 2);
  assert.equal(level(1_000_001, 0).level, 2);
  assert.equal(level(1_000_000, 19_000).level, 4);
});

test("the Level 3 line is read against e-commerce transactions only", () => {
  // The bug this pins: 900,000 card-present sales plus 400 online sales is a
  // 900,400 total, which is nowhere near any total-volume line, and 400 online,
  // which is nowhere near the e-commerce line. Level 4 on both readings.
  assert.equal(level(900_400, 400).level, 4);
  // And the mirror case: a small shop that is almost entirely online crosses on
  // the e-commerce count while its total stays trivial.
  assert.equal(level(24_000, 23_500).level, 3);
});

test("exactly 20,000 e-commerce transactions is Level 4 and is flagged as a boundary", () => {
  const at = level(30_000, 20_000);
  assert.equal(at.level, 4);
  assert.equal(at.onNetworkBoundary, true);

  const over = level(30_000, 20_001);
  assert.equal(over.level, 3);
  assert.equal(over.onNetworkBoundary, false);
});

test("a confirmed compromise overrides the counts", () => {
  const r = level(1_200, 40, true);
  assert.equal(r.level, 1);
  assert.equal(r.escalatedByCompromise, true);
});

test("an e-commerce count above the total is capped at the total and says so", () => {
  const r = level(10_000, 50_000);
  assert.equal(r.clamped, true);
  assert.equal(r.level, 4);
  // Capped to 10,000, which is 10,001 short of the Level 3 line.
  assert.equal(r.toNextLevelEcommerce, 10_001);
});

test("the worked example on the page reproduces exactly", () => {
  // Fern and Filament: 41,000 Visa and Mastercard transactions, 26,400 online.
  const r = level(41_000, 26_400);
  assert.equal(r.level, 3);
  // 26,400 is above 20,000, so Level 3. By hand: 1,000,001 - 41,000 = 959,001
  // more transactions in total would reach Level 2.
  assert.equal(r.toNextLevelTotal, 959_001);
  // And 26,400 - 20,000 = 6,400 fewer online transactions would put it back at
  // Level 4 under the strict reading of the Mastercard rule.
  assert.equal(r.toLowerLevelEcommerce, 6_400);
  assert.equal(r.toNextLevelEcommerce, null);
  assert.equal(r.label, "Level 3");
});

test("negative and non-finite inputs degrade to zero rather than to a level", () => {
  assert.equal(level(-500, -20).level, 4);
  assert.equal(level(Number.NaN, Number.NaN).level, 4);
  assert.equal(level(Number.POSITIVE_INFINITY, 0).level, 4);
});

// ---------------------------------------------------------------------------
// The data module holds together
// ---------------------------------------------------------------------------

test("the widget defaults resolve to SAQ A-EP, so the server-rendered HTML is never blank", () => {
  const r = resolve(PCI_SAQ_DEFAULTS.answers);
  assert.equal(r.complete, true);
  assert.equal(r.saqId, "a-ep");
  assert.ok(PCI_SAQ_TYPES.some((t) => t.id === "a-ep"));
});

test("every edge in the tree points at a real question or a real SAQ", () => {
  const questionIds = new Set(PCI_SAQ_QUESTIONS.map((q) => q.id));
  const saqIds = new Set(ALL_IDS);

  for (const q of PCI_SAQ_QUESTIONS) {
    assert.ok(q.question.length > 0, `${q.id} has no question text`);
    assert.ok(q.options.length >= 2, `${q.id} needs at least two options`);
    const optionIds = new Set<string>();
    for (const o of q.options) {
      assert.ok(!optionIds.has(o.id), `${q.id} has a duplicate option id ${o.id}`);
      optionIds.add(o.id);
      assert.ok(
        o.next !== null || typeof o.resolvesTo === "string",
        `${q.id}/${o.id} is a dead end: no next question and no resolution`,
      );
      if (o.next) assert.ok(questionIds.has(o.next), `${q.id}/${o.id} points at missing question ${o.next}`);
      if (o.resolvesTo) assert.ok(saqIds.has(o.resolvesTo), `${q.id}/${o.id} resolves to missing SAQ ${o.resolvesTo}`);
      for (const id of [...o.rulesIn, ...o.rulesOut]) {
        assert.ok(saqIds.has(id), `${q.id}/${o.id} names missing SAQ ${id}`);
      }
      for (const id of o.rulesIn) {
        assert.ok(!o.rulesOut.includes(id), `${q.id}/${o.id} both rules in and rules out ${id}`);
      }
    }
  }
});

test("every SAQ a terminal option can produce is reachable, and every SAQ is reachable", () => {
  const produced = new Set<string>();
  for (const q of PCI_SAQ_QUESTIONS) {
    for (const o of q.options) {
      if (o.resolvesTo) produced.add(o.resolvesTo);
    }
  }
  for (const id of ALL_IDS) {
    assert.ok(produced.has(id), `${id} is in the table but no answer can reach it`);
  }
});

test("every SAQ row carries a dated source and a real eligibility list", () => {
  for (const t of PCI_SAQ_TYPES) {
    assert.ok(t.source.includes("Checked"), `${t.id} has no checked date`);
    assert.ok(t.eligibility.length >= 3, `${t.id} has a thin eligibility list`);
    assert.ok(t.channels.length >= 1, `${t.id} names no channel`);
    assert.ok(t.requirementCountNote.length > 40, `${t.id} does not explain its count`);
  }
  assert.ok(PCI_SOURCES.length >= 5);
  for (const s of PCI_SOURCES) assert.ok(s.includes("Checked 5 September 2026"), s);
});

test("the ASV scan flag agrees with whether Requirement 11 is in the questionnaire", () => {
  // Read off the published documents: Requirement 11 appears in Section 2 of
  // SAQ A, A-EP, B-IP, C and D, and does not appear at all in SAQ B, C-VT or
  // P2PE. The two fields are stored separately in the data module on purpose.
  for (const t of PCI_SAQ_TYPES) {
    if (t.requirementFamilies === null) {
      // The one document that could not be read. It must say so rather than
      // guessing, and it must be the only one that does.
      assert.equal(t.scan, "unverified", `${t.id} has no family count but claims a scan answer`);
      continue;
    }
    assert.notEqual(t.scan, "unverified", `${t.id} was read, so it must not claim to be unverified`);
    const hasEleven = t.requirementFamilies.includes(11);
    assert.equal(
      hasEleven,
      t.scan !== "no",
      `${t.id}: requirement families say ${hasEleven ? "" : "no "}Requirement 11 but the scan flag says ${t.scan}`,
    );
  }
});

test("requirement families are a clean subset of the twelve, and the known counts are right", () => {
  const expected: Record<string, number> = {
    a: 7,
    "a-ep": 12,
    b: 4,
    "b-ip": 9,
    "c-vt": 10,
    c: 12,
    p2pe: 3,
    "d-merchant": 12,
    "d-service-provider": 12,
  };
  for (const t of PCI_SAQ_TYPES) {
    if (t.requirementFamilies === null) {
      assert.equal(t.id, "spoc", "only SAQ SPoC lacks a family count");
      continue;
    }
    const fams = t.requirementFamilies;
    assert.deepEqual([...fams].sort((a, b) => a - b), fams, `${t.id} families are not sorted`);
    assert.equal(new Set(fams).size, fams.length, `${t.id} has a duplicate family`);
    for (const f of fams) assert.ok(f >= 1 && f <= 12, `${t.id} has family ${f} outside 1 to 12`);
    assert.equal(fams.length, expected[t.id], `${t.id} family count`);
  }
  // SAQ A is the smallest e-commerce questionnaire and SAQ A-EP touches every
  // family: that gap is the whole subject of the page.
  const a = PCI_SAQ_TYPES.find((t) => t.id === "a")!;
  const aep = PCI_SAQ_TYPES.find((t) => t.id === "a-ep")!;
  assert.ok(a.requirementFamilies!.length < aep.requirementFamilies!.length);
  assert.equal(a.requirementCount, 29);
  assert.equal(aep.requirementCount, 139);
});

test("only SAQ A-EP is e-commerce only, and only SAQ A covers both card-not-present channels", () => {
  const aep = PCI_SAQ_TYPES.find((t) => t.id === "a-ep")!;
  assert.deepEqual(aep.channels, ["E-commerce"]);
  const a = PCI_SAQ_TYPES.find((t) => t.id === "a")!;
  assert.deepEqual(a.channels, ["E-commerce", "Mail order and telephone order"]);
  // No card-present SAQ may claim an e-commerce channel.
  for (const id of ["b", "b-ip", "c", "c-vt", "p2pe", "spoc"]) {
    const t = PCI_SAQ_TYPES.find((x) => x.id === id)!;
    assert.ok(!t.channels.includes("E-commerce"), `${id} must not claim an e-commerce channel`);
  }
});

test("the four merchant levels are ordered and their thresholds do not overlap", () => {
  assert.deepEqual(
    PCI_MERCHANT_LEVELS.map((l) => l.level),
    [1, 2, 3, 4],
  );
  const one = PCI_MERCHANT_LEVELS[0]!;
  const two = PCI_MERCHANT_LEVELS[1]!;
  const three = PCI_MERCHANT_LEVELS[2]!;
  assert.equal(one.minTotal, 6_000_001);
  assert.equal(two.minTotal, 1_000_001);
  assert.equal(three.minEcommerce, 20_001);
  assert.equal(three.minTotal, null, "Level 3 has no total-volume line, only an e-commerce one");
  for (const l of PCI_MERCHANT_LEVELS) {
    assert.ok(l.source.includes("Visa"), `${l.label} does not cite Visa`);
    assert.ok(l.source.includes("Mastercard"), `${l.label} does not cite Mastercard`);
  }
});

test("no en dash, em dash, horizontal bar or curly quote reaches the rendered strings", () => {
  const banned = /[–—―‘’“”]/;
  const strings: string[] = [];
  for (const t of PCI_SAQ_TYPES) {
    strings.push(t.label, t.title, t.whoItIsFor, t.requirementCountNote, t.scanNote, t.source);
    strings.push(...t.channels, ...t.eligibility, ...t.notApplicable);
  }
  for (const q of PCI_SAQ_QUESTIONS) {
    strings.push(q.question, q.help);
    for (const o of q.options) strings.push(o.label, o.hint ?? "");
  }
  for (const l of PCI_MERCHANT_LEVELS) {
    strings.push(l.label, l.visaCriteria, l.mastercardCriteria, l.validation, l.source);
  }
  for (const s of strings) {
    assert.ok(!banned.test(s), `banned punctuation in: ${s}`);
  }
});
