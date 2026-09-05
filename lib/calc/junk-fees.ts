/**
 * What the fixed-fee long tail on a merchant statement costs in a year, and
 * what it is worth in basis points on the volume it is charged against.
 *
 * Client safe: no `@/models`, no I/O, no clock. The fee rows arrive as plain
 * objects, so the arithmetic has no runtime dependency on the reference data in
 * `lib/tools-data/junk-fees.ts` and can be tested against hand figures.
 *
 * ─── Failure mode one: the monthly minimum is a floor, not a line ────────────
 *
 * This is the error that makes every competing "hidden fees" page wrong, and it
 * is silent. A monthly minimum does not add to your bill. It guarantees a floor
 * under the processing charge you were already paying, so it costs you the
 * SHORTFALL and nothing else:
 *
 *   cost = max(0, minimum - monthly processing charge)
 *
 * A merchant doing $15,000 a month at 2.90 percent pays $435.00 in discount fees
 * against a $20.00 minimum, so the minimum costs zero. Model it as a flat $20 a
 * month and the annual total is $240 too high, the number still looks entirely
 * reasonable, and nothing throws. `model: "floor"` exists for this one case, and
 * a floor line that costs nothing is returned with `dormant: true` so the page
 * can show the merchant it was counted and came to zero, rather than silently
 * dropping it.
 *
 * ─── Failure mode two: annualising by summing rounded months ─────────────────
 *
 * A fee billed annually has no whole-cent monthly value. $99.00 a year is
 * $8.25 a month, but $219.00 a year is $18.25 exactly while $9.95 a month is
 * $119.40 a year exactly, and mixing the two directions of rounding across a
 * dozen lines drifts the total by cents. Cents are the whole point of a page
 * somebody is reading with a statement in their hand.
 *
 * So the ANNUAL figure is the authority. Every line is reduced to annual cents
 * first, in the direction the biller charges, and every monthly figure on the
 * page is derived by dividing the annual by twelve for display. The consequence,
 * stated rather than hidden: twelve times the displayed monthly total can differ
 * from the displayed annual total by a few cents, and the annual one is right.
 *
 * ─── Why twelve, and not a compounding factor ────────────────────────────────
 *
 * These are flows, not growth. Each month's fee is charged once and paid once,
 * so twelve identical months cost twelve times one month. Annualising a churn
 * rate by multiplying is a real bug (see `involuntaryChurn` in
 * `lib/tools-math.ts`) because survivors compound. Fees do not. The model holds
 * volume and fee schedule flat for a year and says so on the page.
 *
 * ─── Banking days ────────────────────────────────────────────────────────────
 *
 * A batch fee is charged per settlement, and settlement happens on banking days.
 * 21 a month and 252 a year matches the convention the merchant cash advance
 * model already uses on this site, and 21 x 12 = 252 exactly, so a per-day
 * line's monthly figure times twelve equals its annual figure with no drift.
 *
 * ─── The early termination fee is not a monthly cost ─────────────────────────
 *
 * You pay it once, on the way out, and only if you leave. Putting $495 into a
 * monthly total would be nonsense. Spread across the months left on the term it
 * answers the question a merchant actually has when a cheaper quote lands on the
 * desk: what does staying cost me per year? With no months left it costs
 * nothing, because a term that has run has no exit fee to spread.
 */

import type { JunkFeeFrequency, JunkFeeModel } from "@/lib/tools-data/junk-fees";

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Round half UP, which is the direction a biller rounds. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const atLeastZero = (n: number): number => Math.max(0, safe(n));

/** Settlement happens on banking days. Same convention as the MCA model. */
export const BANKING_DAYS_PER_MONTH = 21;
export const BANKING_DAYS_PER_YEAR = 252;

// ---------------------------------------------------------------------------
// Inputs and results
// ---------------------------------------------------------------------------

export interface JunkFeeLineInput {
  id: string;
  label: string;
  /** The amount as it is billed, in US dollars. */
  amount: number;
  frequency: JunkFeeFrequency;
  model: JunkFeeModel;
}

export interface JunkFeeCalcInput {
  /** Card volume a month, in US dollars. The denominator for the basis point figure. */
  monthlyVolume: number;
  /** The merchant's current all-in processing rate, before any of these lines. */
  effectiveRatePct: number;
  /** Months left on the contract. Only an early termination fee reads it. */
  remainingTermMonths: number;
  lines: JunkFeeLineInput[];
}

export interface JunkFeeLineResult {
  id: string;
  label: string;
  /** The authoritative figure. Every other number on the line derives from it. */
  annualCost: number;
  /** Annual divided by twelve, for display only. */
  monthlyCost: number;
  /** What this line alone adds to the merchant's rate, in basis points. */
  addedBps: number;
  /** This line's share of the annual total, as a percentage. */
  shareOfTotalPct: number;
  /**
   * True when the line was ticked and cost nothing. Only a floor can do this,
   * and showing it is the point: a merchant needs to see the minimum was
   * counted and came to zero rather than wonder whether it was dropped.
   */
  dormant: boolean;
}

export interface JunkFeeResult {
  /** The headline. Sum of the line annuals, in dollars. */
  annualTotal: number;
  /** Annual divided by twelve. */
  monthlyTotal: number;
  annualVolume: number;
  /** Volume times the stated effective rate. The floor for a monthly minimum. */
  monthlyProcessingCharge: number;
  /** The annual total expressed against annual volume, in basis points. */
  addedBps: number;
  /** The same figure as a percentage. */
  addedRatePct: number;
  /** Stated effective rate plus the drag. What the merchant actually pays per dollar. */
  allInRatePct: number;
  /** In the order the lines were passed in. */
  lines: JunkFeeLineResult[];
  /** Most expensive first, ties broken by label so the order is stable. */
  ranked: JunkFeeLineResult[];
}

// ---------------------------------------------------------------------------
// One line
// ---------------------------------------------------------------------------

/**
 * The annual cost of one line, in integer cents.
 *
 * `model` decides the shape and `frequency` decides the multiplier, in that
 * order. A floor and a termination fee ignore their frequency entirely, which
 * is why the switch cannot be driven by frequency alone.
 */
function annualCentsFor(
  line: JunkFeeLineInput,
  processingChargeCents: number,
  remainingTermMonths: number,
): number {
  const amountCents = toCents(atLeastZero(line.amount));

  if (line.model === "floor") {
    // Costs the shortfall and nothing more. Above the floor it is invisible.
    const shortfall = Math.max(0, amountCents - processingChargeCents);
    return shortfall * 12;
  }

  if (line.model === "termination") {
    const months = Math.floor(atLeastZero(remainingTermMonths));
    // A term with no months left carries no exit fee to spread.
    if (months <= 0) return 0;
    return roundHalfUp((amountCents * 12) / months);
  }

  switch (line.frequency) {
    case "annual":
      return amountCents;
    case "per-business-day":
      return amountCents * BANKING_DAYS_PER_YEAR;
    case "amortized":
      // A one-off that reached here without the termination model. Spread it the
      // same way rather than charging it twelve times.
      return annualCentsFor({ ...line, model: "termination" }, processingChargeCents, remainingTermMonths);
    case "monthly":
    default:
      return amountCents * 12;
  }
}

// ---------------------------------------------------------------------------
// The whole statement
// ---------------------------------------------------------------------------

export function junkFeeTotals(input: JunkFeeCalcInput): JunkFeeResult {
  const monthlyVolume = atLeastZero(input.monthlyVolume);
  const ratePct = atLeastZero(input.effectiveRatePct);
  const annualVolume = monthlyVolume * 12;

  const monthlyVolumeCents = toCents(monthlyVolume);
  const processingChargeCents = roundHalfUp((monthlyVolumeCents * ratePct) / 100);

  // Each line is priced ONCE, in cents, and the total is the sum of those. Never
  // re-derive a line from a share of the total: that is how a rounding error
  // becomes a total that does not match its own breakdown.
  //
  // Priced as pairs rather than as two parallel arrays read back by index.
  // `noUncheckedIndexedAccess` is on, so a parallel-array lookup is typed
  // `number | undefined` and has to be defended against on every use; carrying
  // the line and its cents together means the value is never absent in the
  // first place.
  const priced = input.lines.map((line) => ({
    line,
    annualCents: annualCentsFor(line, processingChargeCents, input.remainingTermMonths),
  }));
  const annualTotalCents = priced.reduce((sum, p) => sum + p.annualCents, 0);

  const lines: JunkFeeLineResult[] = priced.map(({ line, annualCents }) => {
    return {
      id: line.id,
      label: line.label,
      annualCost: annualCents / 100,
      monthlyCost: annualCents / 1200,
      addedBps: annualVolume > 0 ? (annualCents / 100 / annualVolume) * 10000 : 0,
      shareOfTotalPct: annualTotalCents > 0 ? (annualCents / annualTotalCents) * 100 : 0,
      dormant: line.model === "floor" && annualCents === 0,
    };
  });

  const annualTotal = annualTotalCents / 100;
  const addedBps = annualVolume > 0 ? (annualTotal / annualVolume) * 10000 : 0;

  const ranked = [...lines].sort(
    (a, b) => b.annualCost - a.annualCost || a.label.localeCompare(b.label),
  );

  return {
    annualTotal,
    monthlyTotal: annualTotalCents / 1200,
    annualVolume,
    monthlyProcessingCharge: processingChargeCents / 100,
    addedBps,
    addedRatePct: addedBps / 100,
    allInRatePct: ratePct + addedBps / 100,
    lines,
    ranked,
  };
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

export interface JunkFeeVolumeRow {
  monthlyVolume: number;
  addedBps: number;
  annualTotal: number;
}

/**
 * The same annual bill against a ladder of monthly volumes.
 *
 * This is the output that makes the page land: a fixed dollar bill is a rate,
 * and the rate is inversely proportional to volume. It is computed by re-running
 * the whole model at each volume rather than by dividing the headline, because a
 * monthly minimum is volume dependent and a shortcut would quietly ignore that.
 */
export function junkFeeByVolume(
  input: JunkFeeCalcInput,
  volumes: number[],
): JunkFeeVolumeRow[] {
  return volumes.map((monthlyVolume) => {
    const r = junkFeeTotals({ ...input, monthlyVolume });
    return { monthlyVolume, addedBps: r.addedBps, annualTotal: r.annualTotal };
  });
}
