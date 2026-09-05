/**
 * Which SAQ, and which merchant level.
 *
 * Client safe: no `@/models`, no I/O, no clock. The questions and the level
 * bands arrive as plain arguments rather than as an import of the data module,
 * so this file has no runtime dependency on a document that the PCI SSC and the
 * card networks revise on their own schedule.
 *
 * ─── There is no arithmetic here worth checking, and that is the danger ──────
 *
 * Nothing in this module multiplies anything. Every failure mode is a wrong
 * BRANCH, which returns a confident answer that looks exactly like a right one:
 *
 *   1. ORDER. The decision tree must ask about the entity type and about
 *      electronic storage of account data BEFORE it asks how payments arrive.
 *      A merchant who stores card numbers is on SAQ D whatever the checkout
 *      looks like, and a tree that asks about checkout first hands that merchant
 *      SAQ A and a validation that is short by a hundred requirements. The
 *      resolver therefore walks the tree the data declares, never a shortcut,
 *      and `resolveSaq` refuses to answer while any question on the path is
 *      unanswered rather than guessing at the rest.
 *
 *   2. THE LEVEL 3 BOUNDARY IS AN E-COMMERCE COUNT, NOT A TOTAL. Level 1 and
 *      Level 2 are decided on all transactions across all channels. Level 3 is
 *      decided only on e-commerce transactions. A shop with 900,000 card-present
 *      sales and 400 online sales is Level 4, not Level 3, and reading the
 *      Level 3 line against the total makes it Level 3. The two counts are
 *      separate inputs for that reason and are never added together.
 *
 *   3. THE TWO NETWORKS DISAGREE AT EXACTLY 20,000. Mastercard's rule is
 *      "greater than 20,000" e-commerce transactions for Level 3. Visa's page
 *      says Level 3 is "20,000 to 1 million" and Level 4 is "less than 20,000",
 *      which claims the boundary value for both. This module uses the strict
 *      Mastercard reading, so exactly 20,000 is Level 4, and flags the tie so
 *      the page can say so rather than pretending the boundary is crisp.
 *
 *   4. E-COMMERCE CANNOT EXCEED THE TOTAL. A user who types the online figure
 *      into both boxes would otherwise get a coherent but meaningless answer.
 *      The input is clamped and the clamp is reported.
 */

// ---------------------------------------------------------------------------
// Shared shapes, structurally matching `lib/tools-data/pci.ts`
// ---------------------------------------------------------------------------

export interface SaqOptionLike {
  id: string;
  label: string;
  rulesIn: string[];
  rulesOut: string[];
  next: string | null;
  resolvesTo?: string;
}

export interface SaqQuestionLike {
  id: string;
  question: string;
  options: SaqOptionLike[];
}

export interface MerchantLevelLike {
  level: 1 | 2 | 3 | 4;
  label: string;
  validation: string;
  minTotal: number | null;
  minEcommerce: number | null;
}

// ---------------------------------------------------------------------------
// The SAQ decision tree
// ---------------------------------------------------------------------------

export interface SaqPathStep {
  questionId: string;
  question: string;
  optionId: string;
  answer: string;
}

export interface SaqResolution {
  /** The SAQ id the answers point at, or null while the path is incomplete. */
  saqId: string | null;
  /** True once a terminal option has been reached. */
  complete: boolean;
  /** The questions actually asked, in the order the tree asked them. */
  path: SaqPathStep[];
  /** The next question to put to the user, or null when the path is settled. */
  nextQuestionId: string | null;
  /** SAQ ids still possible given the answers so far. */
  remaining: string[];
  /** SAQ ids eliminated, in elimination order, for the "why not" list. */
  eliminated: string[];
}

/**
 * Walk the tree from its first question, following only declared edges.
 *
 * Returns the whole walk rather than just the answer, because the walk is the
 * product: a merchant who is told "SAQ A-EP" and not told which answer ruled out
 * SAQ A has learned nothing they can take to their acquirer.
 *
 * The walk is bounded by the number of questions, so a data file with a cycle in
 * it returns an incomplete result instead of hanging the browser.
 */
export function resolveSaq(
  questions: SaqQuestionLike[],
  answers: Record<string, string>,
  allSaqIds: string[],
): SaqResolution {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const path: SaqPathStep[] = [];
  const eliminated: string[] = [];
  let remaining = [...allSaqIds];

  let currentId: string | null = questions[0]?.id ?? null;

  for (let guard = 0; guard < questions.length + 1; guard += 1) {
    if (!currentId) break;
    const question = byId.get(currentId);
    if (!question) break;

    const chosenId = answers[question.id];
    const option = question.options.find((o) => o.id === chosenId);
    if (!option) {
      // Unanswered. Stop here rather than assuming a default: a defaulted
      // answer to "do you store card numbers" is the one that produces a
      // dangerously wrong SAQ.
      return {
        saqId: null,
        complete: false,
        path,
        nextQuestionId: question.id,
        remaining,
        eliminated,
      };
    }

    path.push({
      questionId: question.id,
      question: question.question,
      optionId: option.id,
      answer: option.label,
    });

    for (const id of option.rulesOut) {
      if (remaining.includes(id) && !eliminated.includes(id)) eliminated.push(id);
    }
    remaining = remaining.filter((id) => !option.rulesOut.includes(id));

    if (option.resolvesTo) {
      // A terminal answer settles it. Everything else is eliminated whether the
      // option said so or not, so the two lists cannot contradict each other.
      const settled = option.resolvesTo;
      for (const id of remaining) {
        if (id !== settled && !eliminated.includes(id)) eliminated.push(id);
      }
      return {
        saqId: settled,
        complete: true,
        path,
        nextQuestionId: null,
        remaining: [settled],
        eliminated,
      };
    }

    currentId = option.next;
  }

  return { saqId: null, complete: false, path, nextQuestionId: currentId, remaining, eliminated };
}

/**
 * The questions the tree will actually ask, given the answers so far.
 *
 * The widget renders one question at a time from this, so a merchant answering
 * "service provider" never sees the e-commerce question. Reachability is
 * recomputed from the answers rather than tracked as state, because a tracked
 * list goes stale the moment somebody changes an earlier answer, and a stale
 * list leaves a dead question on screen contributing to a resolution nobody can
 * see.
 */
export function reachableQuestions<Q extends SaqQuestionLike>(
  questions: Q[],
  answers: Record<string, string>,
): Q[] {
  // Generic on the question type so the caller keeps its own richer shape: the
  // widget renders per-question help text and per-option hints that this module
  // has no opinion about, and a non-generic signature would erase them.
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: Q[] = [];
  let currentId: string | null = questions[0]?.id ?? null;

  for (let guard = 0; guard < questions.length + 1; guard += 1) {
    if (!currentId) break;
    const question = byId.get(currentId);
    if (!question) break;
    out.push(question);

    const option = question.options.find((o) => o.id === answers[question.id]);
    if (!option || option.resolvesTo) break;
    currentId = option.next;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Merchant level
// ---------------------------------------------------------------------------

export interface MerchantLevelInput {
  /** All Visa and Mastercard transactions across every channel, per year. */
  totalAnnualTransactions: number;
  /** The e-commerce subset of the same year. Never added to the total. */
  ecommerceAnnualTransactions: number;
  /** A confirmed account data compromise, which the networks may escalate on. */
  hadCompromise: boolean;
}

export interface MerchantLevelResult {
  level: 1 | 2 | 3 | 4;
  label: string;
  validation: string;
  /** Which count decided it, in plain words. */
  reason: string;
  /** True when a compromise, not a count, is what put the merchant at Level 1. */
  escalatedByCompromise: boolean;
  /** True when the e-commerce figure had to be clamped to the total. */
  clamped: boolean;
  /** True at exactly 20,000 e-commerce transactions, where the networks differ. */
  onNetworkBoundary: boolean;
  /**
   * How many ADDITIONAL transactions would take this merchant into the level
   * above. Two figures, because two different counts move a merchant up: total
   * volume decides Levels 1 and 2, the e-commerce subset decides Level 3. Null
   * where the figure is meaningless, which is Level 1 and the e-commerce figure
   * anywhere except Level 4.
   */
  toNextLevelTotal: number | null;
  toNextLevelEcommerce: number | null;
  /**
   * How far the e-commerce count would have to FALL to drop out of Level 3.
   * Only meaningful at Level 3, and it is the figure a merchant sitting just
   * over the line actually wants: a Level 3 obligation does not lift the moment
   * volume dips, but it does tell you how much of the year's growth is holding
   * the paperwork in place.
   */
  toLowerLevelEcommerce: number | null;
}

const LEVEL_1_MIN_TOTAL = 6_000_001;
const LEVEL_2_MIN_TOTAL = 1_000_001;
const LEVEL_3_MIN_ECOM = 20_001;

const whole = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/**
 * Resolve the merchant level from two transaction counts.
 *
 * The bands are hard-coded here rather than read out of the passed rows on
 * purpose: `minTotal` and `minEcommerce` describe two different denominators,
 * and a generic "first row whose minimum is met" loop over them silently reads
 * the Level 3 e-commerce line against a total volume. The rows are still passed
 * in so the labels and validation text come from the sourced data rather than
 * being duplicated as strings in the logic.
 */
export function merchantLevel(
  input: MerchantLevelInput,
  levels: MerchantLevelLike[],
): MerchantLevelResult {
  const total = whole(input.totalAnnualTransactions);
  const rawEcom = whole(input.ecommerceAnnualTransactions);
  const clamped = rawEcom > total;
  const ecom = clamped ? total : rawEcom;

  const rowFor = (level: 1 | 2 | 3 | 4): MerchantLevelLike =>
    levels.find((l) => l.level === level) ?? {
      level,
      label: `Level ${level}`,
      validation: "",
      minTotal: null,
      minEcommerce: null,
    };

  const finish = (
    level: 1 | 2 | 3 | 4,
    reason: string,
    escalatedByCompromise: boolean,
  ): MerchantLevelResult => {
    const row = rowFor(level);
    return {
      level,
      label: row.label,
      validation: row.validation,
      reason,
      escalatedByCompromise,
      clamped,
      onNetworkBoundary: ecom === 20_000,
      // Level 2 climbs to Level 1 at the 6,000,001st transaction; Levels 3 and 4
      // climb to Level 2 at the 1,000,001st. Level 1 has nowhere to go.
      toNextLevelTotal: level === 1 ? null : (level === 2 ? LEVEL_1_MIN_TOTAL : LEVEL_2_MIN_TOTAL) - total,
      // Only a Level 4 merchant climbs on the e-commerce count alone.
      toNextLevelEcommerce: level === 4 ? LEVEL_3_MIN_ECOM - ecom : null,
      // And only a Level 3 merchant can fall out of a level on that count.
      toLowerLevelEcommerce: level === 3 ? ecom - (LEVEL_3_MIN_ECOM - 1) : null,
    };
  };

  if (input.hadCompromise) {
    return finish(
      1,
      "Mastercard may deem any merchant with a confirmed account data compromise event to be Level 1, and Visa may escalate a breached merchant to a higher validation tier. Count-based levels do not apply until the networks say so.",
      true,
    );
  }

  if (total >= LEVEL_1_MIN_TOTAL) {
    return finish(
      1,
      `${total.toLocaleString("en-US")} transactions a year across all channels is above the 6 million line.`,
      false,
    );
  }

  if (total >= LEVEL_2_MIN_TOTAL) {
    return finish(
      2,
      `${total.toLocaleString("en-US")} transactions a year across all channels sits between 1 million and 6 million.`,
      false,
    );
  }

  if (ecom >= LEVEL_3_MIN_ECOM) {
    return finish(
      3,
      `${ecom.toLocaleString("en-US")} e-commerce transactions a year is above the 20,000 line, even though the ${total.toLocaleString("en-US")} total is under 1 million.`,
      false,
    );
  }

  return finish(
    4,
    `${total.toLocaleString("en-US")} transactions a year in total and ${ecom.toLocaleString("en-US")} of them online, so every higher line is clear.`,
    false,
  );
}
