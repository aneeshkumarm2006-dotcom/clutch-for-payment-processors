/**
 * Adyen interchange++ arithmetic.
 *
 * Separated from the widget for the reason every module in this family is
 * separated: these are the parts that can be WRONG in a way nobody notices. A
 * layout bug is visible. A crossover solver that returns the right ticket size
 * with the wrong DIRECTION reads as a confident recommendation to switch
 * processors, and a scheme fee added to a payment method Adyen does not price
 * with interchange++ inflates an American Express payment by a sixth. Neither
 * throws, and both look entirely plausible on a page about fees.
 *
 * Client-safe: no `@/models`, no `server-only`, no I/O, no `Date.now()`.
 *
 * ─── Why the arithmetic is done in integer hundredths of a cent ──────────────
 * Adyen's own price list contains $0.0195 scheme fees and a $0.13 processing fee
 * and bills a monthly aggregate, so sub-cent components are real rather than a
 * rounding artefact: 2,941 authorizations at $0.0195 is $57.35, not zero. Cents
 * are therefore too coarse a unit to accumulate in, and binary floating point
 * produces one cent errors at exactly the moment a merchant is checking the
 * output against an Adyen invoice, which is the only moment this page is being
 * used. Everything below accumulates in integer units of $0.0001 and rounds ONCE,
 * at the end, half up, which is what a processor does.
 *
 * ─── The one thing to get right about interchange++ ─────────────────────────
 * On Visa, Mastercard and Maestro, Adyen's published percentage is Adyen's
 * acquirer fee ALONE. Interchange and scheme fees are added on top and are not
 * Adyen's money. On American Express, Discover, Diners, ACH and the buy now pay
 * later methods, Adyen publishes one all in number and there is nothing to add.
 * `AdyenFeeRates.interchangePlusPlus` is the switch, and it changes the answer
 * by more than two percentage points in either direction.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** $0.0001. Fine enough for a $0.0195 scheme fee, coarse enough to stay in safe integer range at any volume a merchant enters. */
const UNITS_PER_DOLLAR = 10_000;

/** Round half UP, which is what a processor does. Explicit about intent rather than relying on `Math.round`'s away-from-zero rule. */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toUnits = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * UNITS_PER_DOLLAR);

const toDollars = (units: number): number => units / UNITS_PER_DOLLAR;

/** Round a units figure to the nearest cent and return dollars. Used only for the billed total. */
const unitsToBilledDollars = (units: number): number => roundHalfUp(units / 100) / 100;

/** A percentage of an amount, both in units, kept integer. */
const pctOf = (amountUnits: number, pct: number): number =>
  roundHalfUp((amountUnits * Math.max(0, pct)) / 100);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface AdyenFeeRates {
  /**
   * True for Visa, Mastercard and Maestro, where Adyen's published percentage is
   * the acquirer fee only. False for every method Adyen prices with one all in
   * published number, where `methodPct` and `methodFixed` are the whole fee and
   * interchange, scheme fees and markup must all be treated as zero.
   */
  interchangePlusPlus: boolean;
  /** Pass-through. The issuer's interchange, as a percentage of the amount. */
  interchangePct: number;
  interchangeFixed: number;
  /** Pass-through. The Visa or Mastercard scheme fees. */
  schemePct: number;
  schemeFixed: number;
  /** Adyen's acquirer fee, the second plus. Published floor 0.60%. */
  markupPct: number;
  /** Adyen's fixed processing fee per transaction. $0.13 on every method. */
  processingFixed: number;
  /** Adyen's published all in method fee, for the non interchange++ methods. */
  methodPct: number;
  methodFixed: number;
}

export interface AdyenPaymentResult {
  amount: number;
  /** True when the cost could be split into pass-through and Adyen. False on the blended methods. */
  split: boolean;
  interchange: number;
  schemeFee: number;
  markup: number;
  processingFee: number;
  methodFee: number;
  /** Interchange plus scheme fees. Nobody at Adyen sets these and nobody can negotiate them. */
  passThrough: number;
  /** Markup plus processing fee, or the method fee plus processing fee on a blended method. */
  adyenTake: number;
  /** Rounded to the cent, half up. */
  total: number;
  net: number;
  effectiveRatePct: number;
  /** Adyen's share of the total cost, as a percentage. Zero on a blended method, where the split is not published. */
  adyenSharePct: number;
  /** Every percentage component added together. Feeds the crossover solver. */
  combinedPct: number;
  /** Every fixed component added together. Feeds the crossover solver. */
  combinedFixed: number;
}

// ---------------------------------------------------------------------------
// One payment
// ---------------------------------------------------------------------------

/**
 * The cost of a single payment on Adyen.
 *
 * Components are returned UNROUNDED in dollars (they are genuinely sub-cent and
 * a merchant reconciling a monthly invoice needs them that way); `total` is the
 * one figure rounded to the cent.
 *
 * `effectiveRatePct` is computed on the unrounded total, not on the rounded one.
 * Rounding first and dividing after moves the rate by up to half a cent divided
 * by the amount, which on a $1 payment is half a percentage point.
 */
export function adyenPaymentCost(amount: number, r: AdyenFeeRates): AdyenPaymentResult {
  const amountUnits = toUnits(amount);

  const interchangeUnits = r.interchangePlusPlus
    ? pctOf(amountUnits, r.interchangePct) + toUnits(r.interchangeFixed)
    : 0;
  const schemeUnits = r.interchangePlusPlus
    ? pctOf(amountUnits, r.schemePct) + toUnits(r.schemeFixed)
    : 0;
  const markupUnits = r.interchangePlusPlus ? pctOf(amountUnits, r.markupPct) : 0;
  const methodUnits = r.interchangePlusPlus
    ? 0
    : pctOf(amountUnits, r.methodPct) + toUnits(r.methodFixed);
  const processingUnits = toUnits(r.processingFixed);

  const passThroughUnits = interchangeUnits + schemeUnits;
  const adyenUnits = markupUnits + methodUnits + processingUnits;
  const totalUnits = passThroughUnits + adyenUnits;

  const combinedPct = r.interchangePlusPlus
    ? r.interchangePct + r.schemePct + r.markupPct
    : r.methodPct;
  const combinedFixed = r.interchangePlusPlus
    ? r.interchangeFixed + r.schemeFixed + r.processingFixed
    : r.methodFixed + r.processingFixed;

  return {
    amount: toDollars(amountUnits),
    split: r.interchangePlusPlus,
    interchange: toDollars(interchangeUnits),
    schemeFee: toDollars(schemeUnits),
    markup: toDollars(markupUnits),
    processingFee: toDollars(processingUnits),
    methodFee: toDollars(methodUnits),
    passThrough: toDollars(passThroughUnits),
    adyenTake: toDollars(adyenUnits),
    total: unitsToBilledDollars(totalUnits),
    net: unitsToBilledDollars(amountUnits - totalUnits),
    effectiveRatePct: amountUnits > 0 ? (totalUnits / amountUnits) * 100 : 0,
    adyenSharePct: r.interchangePlusPlus && totalUnits > 0 ? (adyenUnits / totalUnits) * 100 : 0,
    combinedPct,
    combinedFixed,
  };
}

// ---------------------------------------------------------------------------
// A month of volume
// ---------------------------------------------------------------------------

export interface AdyenMonthlyInput {
  monthlyVolume: number;
  averageTicket: number;
  /** Adyen's minimum invoice. A FLOOR on the whole bill, not an extra line item. */
  minimumInvoice: number;
  rates: AdyenFeeRates;
}

export interface AdyenMonthlyResult {
  transactions: number;
  interchange: number;
  schemeFee: number;
  markup: number;
  processingFee: number;
  methodFee: number;
  passThrough: number;
  adyenTake: number;
  /** What the transactions actually cost, before the minimum is applied. */
  costBeforeMinimum: number;
  /** The gap the minimum invoice fills. Zero when the minimum does not bind. */
  minimumTopUp: number;
  total: number;
  effectiveRatePct: number;
  effectiveRateBeforeMinimumPct: number;
  minimumBinds: boolean;
  /**
   * The monthly card volume at which the minimum invoice stops costing anything,
   * holding the average ticket and the rates fixed. Null when the rates produce
   * no cost at all, which cannot happen with a real Adyen price.
   */
  volumeToClearMinimum: number | null;
}

/**
 * A month of volume on Adyen.
 *
 * PERCENTAGE FEES ARE CHARGED ON THE VOLUME YOU ENTERED; FIXED FEES ARE CHARGED
 * ON A WHOLE NUMBER OF TRANSACTIONS. Volume divided by average ticket is almost
 * never an integer, and pretending it is moves the answer by a few cents while
 * pretending it is not produces fractional authorizations, which no invoice has
 * ever shown. The transaction count is rounded to the nearest whole payment and
 * the volume is used as entered, so the two halves of the bill each stay
 * defensible on their own terms.
 *
 * THE MINIMUM INVOICE IS A FLOOR, NOT A LINE ITEM. Adyen bills the greater of
 * the month's fees and the minimum, so a merchant under the floor pays the floor
 * and nothing more. Modelling it as an addition, which is the mistake a
 * monthly-fee field invites, overstates a small merchant's bill by the whole of
 * the fees they did generate.
 */
export function adyenMonthlyCost(input: AdyenMonthlyInput): AdyenMonthlyResult {
  const { rates: r } = input;
  const volume = Math.max(0, input.monthlyVolume);
  const ticket = Math.max(0, input.averageTicket);
  const minimum = Math.max(0, input.minimumInvoice);

  const volumeUnits = toUnits(volume);
  const transactions = ticket > 0 ? Math.max(0, roundHalfUp(volume / ticket)) : 0;

  const interchangeUnits = r.interchangePlusPlus
    ? pctOf(volumeUnits, r.interchangePct) + transactions * toUnits(r.interchangeFixed)
    : 0;
  const schemeUnits = r.interchangePlusPlus
    ? pctOf(volumeUnits, r.schemePct) + transactions * toUnits(r.schemeFixed)
    : 0;
  const markupUnits = r.interchangePlusPlus ? pctOf(volumeUnits, r.markupPct) : 0;
  const methodUnits = r.interchangePlusPlus
    ? 0
    : pctOf(volumeUnits, r.methodPct) + transactions * toUnits(r.methodFixed);
  const processingUnits = transactions * toUnits(r.processingFixed);

  const passThroughUnits = interchangeUnits + schemeUnits;
  const adyenUnits = markupUnits + methodUnits + processingUnits;
  const beforeMinimumUnits = passThroughUnits + adyenUnits;
  const minimumUnits = toUnits(minimum);
  const totalUnits = Math.max(beforeMinimumUnits, minimumUnits);

  const combinedPct = r.interchangePlusPlus
    ? r.interchangePct + r.schemePct + r.markupPct
    : r.methodPct;
  const combinedFixed = r.interchangePlusPlus
    ? r.interchangeFixed + r.schemeFixed + r.processingFixed
    : r.methodFixed + r.processingFixed;

  // Cost per dollar of volume, holding the average ticket fixed:
  //   cost = V x pct/100 + (V / ticket) x fixed
  //        = V x (pct/100 + fixed/ticket)
  // so the volume that just reaches the minimum is minimum divided by that
  // bracket. Solved rather than searched, because it is a closed form.
  const perDollar = combinedPct / 100 + (ticket > 0 ? combinedFixed / ticket : 0);
  const volumeToClearMinimum = perDollar > 0 && minimum > 0 ? minimum / perDollar : null;

  return {
    transactions,
    interchange: toDollars(interchangeUnits),
    schemeFee: toDollars(schemeUnits),
    markup: toDollars(markupUnits),
    processingFee: toDollars(processingUnits),
    methodFee: toDollars(methodUnits),
    passThrough: toDollars(passThroughUnits),
    adyenTake: toDollars(adyenUnits),
    costBeforeMinimum: unitsToBilledDollars(beforeMinimumUnits),
    minimumTopUp: unitsToBilledDollars(Math.max(0, minimumUnits - beforeMinimumUnits)),
    total: unitsToBilledDollars(totalUnits),
    effectiveRatePct: volumeUnits > 0 ? (totalUnits / volumeUnits) * 100 : 0,
    effectiveRateBeforeMinimumPct: volumeUnits > 0 ? (beforeMinimumUnits / volumeUnits) * 100 : 0,
    minimumBinds: minimumUnits > beforeMinimumUnits,
    volumeToClearMinimum,
  };
}

// ---------------------------------------------------------------------------
// Crossover against a flat rate
// ---------------------------------------------------------------------------

export type AdyenCrossoverKind =
  | "identical"
  | "adyen-cheaper-everywhere"
  | "flat-cheaper-everywhere"
  | "adyen-cheaper-above"
  | "adyen-cheaper-below";

export interface AdyenCrossoverResult {
  kind: AdyenCrossoverKind;
  /** The ticket size where the two prices meet, or null when they never do. */
  ticket: number | null;
}

/**
 * Where an interchange++ price and a flat rate cross.
 *
 * THIS IS THE FUNCTION THAT FAILS SILENTLY. Both curves are straight lines, so
 * the meeting point is one division:
 *
 *   ticket = |fixed difference| / |percentage difference / 100|
 *
 * and a calculator that stops there prints a plausible dollar figure in all four
 * cases. The figure is useless without the DIRECTION, and the direction flips
 * with the sign of the percentage gap:
 *
 *   Adyen's percentage lower, Adyen's fixed higher  -> Adyen wins ABOVE the ticket
 *   Adyen's percentage higher, Adyen's fixed lower  -> Adyen wins BELOW the ticket
 *
 * The second case is the common one against a 2.9% plus $0.30 flat rate, because
 * Adyen's total fixed cost on a US card is under 30 cents while a premium
 * rewards card pushes the percentage above 2.9%. Report that as "cheaper above"
 * and the page tells a large ticket merchant to switch to the more expensive
 * option.
 *
 * When neither component crosses there is no meeting point at all, and the
 * answer is a sentence rather than a number.
 */
export function adyenFlatRateCrossover(
  adyenPct: number,
  adyenFixed: number,
  flatPct: number,
  flatFixed: number,
): AdyenCrossoverResult {
  // Compared as integers so a difference of exactly zero is exactly zero, and a
  // rate typed as 2.9 does not fail to equal a rate stored as 2.9000000000000004.
  const pctGap = roundHalfUp(flatPct * 10_000) - roundHalfUp(adyenPct * 10_000);
  const fixedGap = toUnits(flatFixed) - toUnits(adyenFixed);

  if (pctGap === 0 && fixedGap === 0) return { kind: "identical", ticket: null };
  if (pctGap >= 0 && fixedGap >= 0) return { kind: "adyen-cheaper-everywhere", ticket: null };
  if (pctGap <= 0 && fixedGap <= 0) return { kind: "flat-cheaper-everywhere", ticket: null };

  const ticket = Math.abs(toDollars(fixedGap)) / (Math.abs(pctGap / 10_000) / 100);

  // pctGap > 0 means the flat rate's percentage is the larger one, so Adyen's
  // percentage advantage grows with the amount and overtakes its fixed fee
  // disadvantage above the crossover.
  return { kind: pctGap > 0 ? "adyen-cheaper-above" : "adyen-cheaper-below", ticket };
}

/** The flat-rate cost of one payment, for the side-by-side comparison. */
export function flatRateCost(amount: number, ratePct: number, fixed: number): number {
  const amountUnits = toUnits(amount);
  return unitsToBilledDollars(pctOf(amountUnits, ratePct) + toUnits(fixed));
}

/** The flat-rate cost of a month of volume, on the same transaction count convention as `adyenMonthlyCost`. */
export function flatRateMonthlyCost(
  monthlyVolume: number,
  transactions: number,
  ratePct: number,
  fixed: number,
): number {
  return unitsToBilledDollars(
    pctOf(toUnits(Math.max(0, monthlyVolume)), ratePct) + Math.max(0, transactions) * toUnits(fixed),
  );
}
