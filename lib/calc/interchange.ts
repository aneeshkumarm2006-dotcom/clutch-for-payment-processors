/**
 * Interchange arithmetic and the table filter.
 *
 * Separated from the widget for the same reason as `lib/tools-math.ts`: the
 * parts that can be WRONG without looking wrong live here and are covered by
 * fixed reference values in `tests/tools/batch-four/interchange-fee-lookup.ts`.
 *
 * Client-safe: no `@/models`, no `server-only`, no I/O, no clock.
 *
 * ─── The three silent failures this module exists to prevent ─────────────────
 *
 * 1. A MINIMUM IS NOT A FIXED FEE. Visa prints its restaurant program as
 *    "2.10% (min. $0.04)" and its retail program as "1.65% + $0.10". Those are
 *    different operators. Adding a minimum the way you add a fixed fee
 *    overstates every single small ticket by the minimum, and the error is
 *    invisible on a large one, so it survives casual checking. `ratePct`,
 *    `fixed`, `min` and `cap` are four separate inputs here and are applied in
 *    the order a network applies them: percentage, plus fixed, then floored at
 *    the minimum, then ceilinged at the cap.
 *
 * 2. A CAP IS A CEILING ON THE WHOLE FEE, NOT ON THE PERCENTAGE. Visa's
 *    CPS/Automated Fuel Dispenser Debit program is "0.80% + $0.15 ($0.95 Cap)".
 *    On a $200 fill the uncapped fee would be $1.75; the answer is $0.95, not
 *    $0.95 + $0.15. Capping only the percentage component would report $1.10 and
 *    would look entirely plausible on a statement line.
 *
 * 3. FLOATING POINT MONEY. Every figure here is checked by somebody against a
 *    processor statement, which is the one moment a one cent drift matters. The
 *    arithmetic runs in integer cents and rounds once, at the end.
 */

/** Round half up, which is the direction a network rounds. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

/** The subset of an interchange row the cost function needs. Structural, so both the data module's rows and a hand built test fixture satisfy it. */
export interface InterchangeProgramRate {
  ratePct: number;
  fixed: number;
  cap?: number;
  min?: number;
}

export interface InterchangeCostResult {
  /** Interchange on this transaction, in whole cents. */
  cents: number;
  /** The same figure in dollars. */
  fee: number;
  /** Interchange as a percentage of the transaction. */
  effectivePct: number;
  /** True when the published cap bound the answer down. */
  capped: boolean;
  /** True when the published minimum bound the answer up. */
  floored: boolean;
}

const EMPTY: InterchangeCostResult = {
  cents: 0,
  fee: 0,
  effectivePct: 0,
  capped: false,
  floored: false,
};

/**
 * Apply one published interchange program to one transaction amount.
 *
 * fee = clamp(amount * rate + fixed, min, cap), evaluated in cents and rounded
 * once at the end rather than component by component. Rounding each component
 * separately and adding produces a different answer on roughly one amount in
 * four, because two halves round up where the sum would have rounded once.
 *
 * The order matters and is not arbitrary. The minimum is applied before the cap
 * so that a program carrying both (none do today, but the schedules change every
 * six months) resolves to the cap rather than to the minimum.
 */
export function interchangeCost(amount: number, program: InterchangeProgramRate): InterchangeCostResult {
  if (!Number.isFinite(amount) || amount <= 0) return EMPTY;

  const amountCents = roundHalfUp(amount * 100);
  const fixedCents = program.fixed * 100;

  let raw = (amountCents * program.ratePct) / 100 + fixedCents;

  let floored = false;
  if (program.min !== undefined) {
    const minCents = program.min * 100;
    if (raw < minCents) {
      raw = minCents;
      floored = true;
    }
  }

  let capped = false;
  if (program.cap !== undefined) {
    const capCents = program.cap * 100;
    if (raw > capCents) {
      raw = capCents;
      capped = true;
    }
  }

  const cents = roundHalfUp(raw);

  return {
    cents,
    fee: cents / 100,
    effectivePct: amountCents === 0 ? 0 : (cents / amountCents) * 100,
    capped,
    floored,
  };
}

/**
 * The published rate, rendered the way the network prints it.
 *
 * Kept beside the arithmetic rather than in the widget so the string and the
 * number it describes cannot drift apart: "1.65% + $0.10" and "2.10% (min
 * $0.04)" are formatted from the same fields the cost function reads.
 */
export function formatProgramRate(program: InterchangeProgramRate): string {
  const parts: string[] = [];
  const pct = `${program.ratePct.toFixed(2)}%`;

  if (program.ratePct === 0) {
    parts.push(`$${program.fixed.toFixed(2)}`);
  } else if (program.fixed === 0) {
    parts.push(pct);
  } else {
    parts.push(`${pct} + $${program.fixed.toFixed(2)}`);
  }

  if (program.min !== undefined) parts.push(`(min $${program.min.toFixed(2)})`);
  if (program.cap !== undefined) parts.push(`(cap $${program.cap.toFixed(2)})`);

  return parts.join(" ");
}

/** The shape the filter reads. Structural for the same reason as above. */
export interface FilterableRate {
  id: string;
  network: string;
  programName: string;
  cardType: string;
  channel: string;
  category: string;
  notes: string;
}

export interface InterchangeFilter {
  query: string;
  /** "all", or one of `INTERCHANGE_NETWORKS`. */
  network: string;
  /** "all", or one of `INTERCHANGE_CATEGORIES`. */
  category: string;
  /** "all", or a channel label. */
  channel: string;
}

/**
 * Filter the table.
 *
 * The free text query matches the program name, the card type, the category and
 * the notes, because a merchant searching "6513" or "rent" or "grocery" is
 * looking for a row whose program name contains none of those words. Matching
 * the notes is what makes an MCC number findable at all: the MCC restrictions
 * live there and nowhere else.
 *
 * The channel filter deliberately keeps rows marked "Any" in both the card
 * present and the card not present views, because "Any" means the rate sheet
 * does not restrict the program to one channel, not that the program is
 * channel-less. Dropping them would hide the correct answer from half the
 * searches on this page.
 */
export function filterRates<T extends FilterableRate>(rows: T[], filter: InterchangeFilter): T[] {
  const q = filter.query.trim().toLowerCase();

  return rows.filter((r) => {
    if (filter.network !== "all" && r.network !== filter.network) return false;
    if (filter.category !== "all" && r.category !== filter.category) return false;
    if (filter.channel !== "all" && r.channel !== filter.channel && r.channel !== "Any") return false;
    if (!q) return true;
    return (
      r.programName.toLowerCase().includes(q) ||
      r.cardType.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q)
    );
  });
}
