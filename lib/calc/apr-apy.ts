/**
 * APR to APY, APY to APR, and the same rate restated across compounding
 * frequencies.
 *
 * Client safe: no `@/models`, no I/O, no clock. Every output is a pure function
 * of its inputs, so the widget renders the same figures on the server as it does
 * after hydration.
 *
 * ─── Why this module exists next to `effectiveAnnualRate` ────────────────────
 *
 * `lib/tools-math.ts` already exports `effectiveAnnualRate(annualRatePct,
 * compoundsPerYear)`, which the compound and simple interest pages use. This
 * module deliberately does NOT edit that function, because the two pages must
 * agree forever and the safest way to guarantee that is to keep the older
 * function untouched and pin the agreement in a test. The conventions are
 * therefore copied exactly:
 *
 *   - `compoundsPerYear` of 0 (or anything below 1) means CONTINUOUS.
 *   - the rate arrives as a percentage, never as a decimal.
 *   - a rate below -99 percent is clamped, because (1 + r/n) must stay positive.
 *
 * What this module adds is the INVERSE, which `effectiveAnnualRate` has no
 * notion of, and a restatement across two different frequencies.
 *
 * ─── Why expm1 and log1p everywhere ─────────────────────────────────────────
 *
 * The naive forms, `Math.pow(1 + r / n, n) - 1` and `Math.pow(1 + apy, 1 / n) - 1`,
 * both end by subtracting 1 from a number very close to 1. At the rates a US
 * deposit account actually pays (the FDIC national average savings rate is 0.38
 * percent) and at daily compounding, that subtraction throws away roughly four
 * significant digits, and the round trip APR to APY to APR then fails to return
 * the number the user typed. `Math.expm1` and `Math.log1p` compute the same
 * quantities without ever forming the intermediate near-1 value.
 *
 * The identity used in both directions is the same one:
 *
 *   APY  = expm1(n * log1p(r / n))        and  expm1(r) when compounding is continuous
 *   APR  = n * expm1(log1p(apy) / n)      and  log1p(apy) when compounding is continuous
 *
 * These are exact inverses of each other in real arithmetic, so any drift you
 * see between them is floating point and is asserted to be under 1e-10 in the
 * tests.
 *
 * ─── Why the dollar figures are integer cents ───────────────────────────────
 *
 * The percentage gap between an APR and an APY looks trivial and the dollars do
 * not, which is the entire reason this page shows both. Someone reading the
 * dollar figure is usually holding a statement, so the money is computed in
 * integer cents and rounded half up, the direction a bank rounds, rather than
 * left as a binary float that renders one cent light.
 *
 * ─── The silent failure mode ────────────────────────────────────────────────
 *
 * Inverting the two directions does not throw. Feed 24.99 percent through the
 * wrong one at daily compounding and you get 22.28 percent instead of 28.38
 * percent: still plausible, still the right order of magnitude, and wrong by
 * $610 a year on a $10,000 balance. `aprToApy` must always return a number at or
 * above its input and `apyToApr` must always return one at or below, for any
 * positive rate. Both properties are asserted over a sweep in the tests.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Round half UP. `Math.round` agrees on positives; this states the intent. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const fromCents = (cents: number): number => cents / 100;

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

// ---------------------------------------------------------------------------
// Frequencies
// ---------------------------------------------------------------------------

export interface CompoundingOption {
  /** The select value. Stringified `periodsPerYear`, so the widget parses it back. */
  value: string;
  label: string;
  /** 0 is the sentinel for continuous compounding, which has no period count. */
  periodsPerYear: number;
  /** What the period is called in a sentence, singular. */
  periodName: string;
}

/**
 * Every schedule a US account or note is actually quoted on, plus the ceiling.
 *
 * Semimonthly (24) and biweekly (26) are NOT the same thing and are both here
 * because payroll advances and some business lines of credit use one or the
 * other, and a page that offers only "monthly" quietly rounds 26 periods to 24.
 * Continuous is included because it is the upper bound: no schedule at the same
 * nominal rate can beat it, so it answers "how much is left on the table" in one
 * row. Nothing in the US pays continuously.
 */
export const COMPOUNDING_FREQUENCIES: CompoundingOption[] = [
  { value: "1", label: "Annually", periodsPerYear: 1, periodName: "year" },
  { value: "2", label: "Semiannually", periodsPerYear: 2, periodName: "half year" },
  { value: "4", label: "Quarterly", periodsPerYear: 4, periodName: "quarter" },
  { value: "12", label: "Monthly", periodsPerYear: 12, periodName: "month" },
  { value: "24", label: "Semimonthly", periodsPerYear: 24, periodName: "half month" },
  { value: "26", label: "Biweekly", periodsPerYear: 26, periodName: "two weeks" },
  { value: "52", label: "Weekly", periodsPerYear: 52, periodName: "week" },
  { value: "365", label: "Daily", periodsPerYear: 365, periodName: "day" },
  { value: "0", label: "Continuously", periodsPerYear: 0, periodName: "instant" },
];

export const frequencyLabel = (periodsPerYear: number): string =>
  COMPOUNDING_FREQUENCIES.find((f) => f.periodsPerYear === normalizePeriods(periodsPerYear))?.label ??
  `${Math.round(periodsPerYear)} times a year`;

/**
 * Anything below 1 collapses to the continuous sentinel, 0. Everything else is
 * passed through, capped so a typo cannot hang the page.
 *
 * ONE DELIBERATE DIFFERENCE FROM `effectiveAnnualRate`. That function rounds the
 * period count to a whole number; this one does not. Every frequency the widget
 * can produce is an integer taken from `COMPOUNDING_FREQUENCIES`, so the two
 * agree exactly on everything this site can render. The fractional case is kept
 * open for one reason: Regulation DD's own worked example in Appendix A to 12
 * CFR Part 1030 runs over a 182 day term, so its period count is 365/182, and
 * rounding that to 2 would put the published 6.18 percent out of reach. The test
 * file reproduces that example, which is the strongest reference available
 * because it sits outside this module entirely.
 */
export function normalizePeriods(compoundsPerYear: number): number {
  const n = safe(compoundsPerYear);
  if (n < 1) return 0;
  return Math.min(100000, n);
}

// ---------------------------------------------------------------------------
// The two conversions
// ---------------------------------------------------------------------------

/**
 * Nominal annual rate to effective annual yield, as percentages.
 *
 * This is the Regulation DD quantity: the total interest a balance earns across
 * a 365 day period once the interest already credited starts earning too. It is
 * the only form in which two rates on different compounding schedules can be
 * compared.
 *
 * Matches `effectiveAnnualRate(annualRatePct, compoundsPerYear) * 100` from
 * `lib/tools-math.ts` to within floating point noise, which is pinned by a test
 * so the two pages can never print different answers for the same inputs.
 */
export function aprToApy(aprPct: number, compoundsPerYear: number): number {
  const r = Math.max(-0.99, safe(aprPct) / 100);
  const n = normalizePeriods(compoundsPerYear);
  if (n === 0) return Math.expm1(r) * 100;
  // Annual compounding is the identity, and it has to be EXACTLY the identity.
  // expm1(log1p(0.2499)) comes back as 0.24989999999999995, which is invisible
  // in the yield column and very visible in the difference column, where it
  // renders as "-0.000 pts" beside a sentence saying the two are the same
  // number. Short-circuit it rather than round it away downstream.
  if (n === 1) return r * 100;
  return Math.expm1(n * Math.log1p(r / n)) * 100;
}

/**
 * Effective annual yield back to the nominal annual rate, as percentages.
 *
 * The inverse of `aprToApy` at the same frequency. This is the direction a
 * saver needs and almost no calculator offers: a bank advertises the APY,
 * because Regulation DD makes it advertise the APY, and the nominal rate is
 * what you need to model month by month interest or to compare against a note
 * quoted nominally.
 *
 * An APY at or below -100 percent has no real solution, so it is clamped rather
 * than returned as NaN. A NaN would render as "N/A" and look like a bug in the
 * page rather than a bug in the input.
 */
export function apyToApr(apyPct: number, compoundsPerYear: number): number {
  const y = Math.max(-0.99, safe(apyPct) / 100);
  const n = normalizePeriods(compoundsPerYear);
  if (n === 0) return Math.log1p(y) * 100;
  // The identity again, for the same reason as in `aprToApy`.
  if (n === 1) return y * 100;
  return n * Math.expm1(Math.log1p(y) / n) * 100;
}

/**
 * Restate a nominal rate quoted on one schedule as the nominal rate on another
 * schedule that yields exactly the same money.
 *
 * Round tripping through the APY is not a shortcut, it is the definition: two
 * nominal rates are equivalent when and only when their effective annual yields
 * match. 24.99 percent compounded daily and 25.24 percent compounded monthly are
 * the same deal.
 */
export function restateNominal(
  aprPct: number,
  fromCompoundsPerYear: number,
  toCompoundsPerYear: number,
): number {
  return apyToApr(aprToApy(aprPct, fromCompoundsPerYear), toCompoundsPerYear);
}

/**
 * The rate applied at each compounding step, as a percentage.
 *
 * Returns null for continuous compounding, which has no period and therefore no
 * periodic rate. Returning 0 there would be a lie that renders identically to a
 * fact.
 */
export function periodicRate(aprPct: number, compoundsPerYear: number): number | null {
  const n = normalizePeriods(compoundsPerYear);
  if (n === 0) return null;
  return safe(aprPct) / n;
}

// ---------------------------------------------------------------------------
// Dollars
// ---------------------------------------------------------------------------

export type ConversionDirection = "aprToApy" | "apyToApr" | "restate";

export interface AprApyInput {
  direction: ConversionDirection;
  /** The rate as quoted, a percentage. Read as an APR unless direction is apyToApr. */
  ratePct: number;
  compoundsPerYear: number;
  /** Only used by the restate direction: the schedule to express the rate on instead. */
  targetCompoundsPerYear: number;
  /** The balance the dollar figures are computed on. */
  balance: number;
  years: number;
}

export interface AprApyResult {
  /** Nominal annual rate on the entered schedule. */
  aprPct: number;
  /** Effective annual yield. Equals aprPct only when compounding is annual. */
  apyPct: number;
  /** apyPct less aprPct, in percentage POINTS, not percent. */
  spreadPct: number;
  periodsPerYear: number;
  /** Null when compounding is continuous. */
  periodicRatePct: number | null;
  /** The same rate restated on the target schedule. Equals aprPct outside the restate direction. */
  restatedAprPct: number;
  restatedPeriodsPerYear: number;
  /** One year of interest on the balance WITH compounding, in dollars. */
  compoundedYearOne: number;
  /** One year of interest on the balance if nothing compounded, in dollars. */
  nominalYearOne: number;
  /** What compounding adds in the first year. This is the number the percentage hides. */
  yearOneGap: number;
  years: number;
  /** Balance after `years` at the APY. */
  compoundedValue: number;
  /** Balance after `years` at the nominal rate with interest that never compounds. */
  nominalValue: number;
  /** compoundedValue less nominalValue. */
  termGap: number;
  /** The APY the same nominal rate would reach compounded continuously: the ceiling. */
  continuousApyPct: number;
  /** How much of that ceiling this schedule captures, 0 to 100. */
  ceilingCapturedPct: number;
  /** True when the entered schedule is annual, where APR and APY are the same number. */
  isAnnual: boolean;
}

/**
 * Everything the widget prints, from one call.
 *
 * The nominal comparison is SIMPLE interest, balance x (1 + r x t), not the APY
 * applied once. That is the right contrast: the question the page answers is
 * what compounding within the year adds to a rate that ignores it, so the
 * baseline has to be a rate that never compounds at all.
 *
 * All four dollar figures are computed from the SAME balance in integer cents,
 * so `yearOneGap` is exactly the difference between two numbers printed on the
 * page rather than a separately rounded third quantity that can disagree with
 * them by a cent.
 */
export function convertRate(input: AprApyInput): AprApyResult {
  const n = normalizePeriods(input.compoundsPerYear);
  const target = normalizePeriods(input.targetCompoundsPerYear);
  const balance = Math.max(0, safe(input.balance));
  const years = Math.min(100, Math.max(0, safe(input.years)));

  const aprPct =
    input.direction === "apyToApr" ? apyToApr(input.ratePct, n) : Math.max(-99, safe(input.ratePct));
  const apyPct = input.direction === "apyToApr" ? Math.max(-99, safe(input.ratePct)) : aprToApy(aprPct, n);

  const r = aprPct / 100;
  const y = apyPct / 100;

  const balanceCents = toCents(balance);
  const compoundedYearOneCents = roundHalfUp(balanceCents * y);
  const nominalYearOneCents = roundHalfUp(balanceCents * r);
  const compoundedValueCents = roundHalfUp(balanceCents * Math.pow(1 + y, years));
  const nominalValueCents = roundHalfUp(balanceCents * (1 + r * years));

  const continuousApyPct = Math.expm1(Math.max(-0.99, r)) * 100;

  return {
    aprPct,
    apyPct,
    spreadPct: apyPct - aprPct,
    periodsPerYear: n,
    periodicRatePct: periodicRate(aprPct, n),
    restatedAprPct: input.direction === "restate" ? apyToApr(apyPct, target) : aprPct,
    restatedPeriodsPerYear: input.direction === "restate" ? target : n,
    compoundedYearOne: fromCents(compoundedYearOneCents),
    nominalYearOne: fromCents(nominalYearOneCents),
    yearOneGap: fromCents(compoundedYearOneCents - nominalYearOneCents),
    years,
    compoundedValue: fromCents(compoundedValueCents),
    nominalValue: fromCents(nominalValueCents),
    termGap: fromCents(compoundedValueCents - nominalValueCents),
    continuousApyPct,
    ceilingCapturedPct: continuousApyPct > 0 ? (apyPct / continuousApyPct) * 100 : 0,
    isAnnual: n === 1,
  };
}

export interface LadderRow {
  label: string;
  periodsPerYear: number;
  /** Null for continuous. */
  periodicRatePct: number | null;
  apyPct: number;
  /** One year of interest on the balance at that schedule, in dollars. */
  interestOneYear: number;
  /** Dollars more than the same nominal rate compounded once a year. */
  gapVsAnnual: number;
}

/**
 * The same nominal rate on every schedule, side by side, in percent and in
 * dollars.
 *
 * This is the table that settles the argument. The percentage column moves by a
 * few tenths of a point from annual to daily and looks like nothing; the dollar
 * column on a real balance is what people react to. Both are printed for exactly
 * that reason.
 *
 * `gapVsAnnual` is measured against ANNUAL compounding rather than against the
 * nominal rate, because annual compounding is the schedule on which the nominal
 * rate and the yield are the same number, so the column reads as the pure value
 * of compounding more often.
 */
export function frequencyLadder(aprPct: number, balance: number): LadderRow[] {
  const balanceCents = toCents(Math.max(0, safe(balance)));
  const annualCents = roundHalfUp(balanceCents * (aprToApy(aprPct, 1) / 100));

  return COMPOUNDING_FREQUENCIES.map((f) => {
    const apy = aprToApy(aprPct, f.periodsPerYear);
    const interestCents = roundHalfUp(balanceCents * (apy / 100));
    return {
      label: f.label,
      periodsPerYear: f.periodsPerYear,
      periodicRatePct: periodicRate(aprPct, f.periodsPerYear),
      apyPct: apy,
      interestOneYear: fromCents(interestCents),
      gapVsAnnual: fromCents(interestCents - annualCents),
    };
  });
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export interface AprApyDefaults {
  direction: ConversionDirection;
  /** The APR the aprToApy direction opens on. */
  aprPct: number;
  /** The APY the apyToApr direction opens on. */
  apyPct: number;
  compoundsPerYear: number;
  targetCompoundsPerYear: number;
  balance: number;
  years: number;
}

/**
 * The state the widget renders on the server, so the raw HTML already carries
 * computed dollar figures.
 *
 * 24.99 percent compounded daily on a $10,000 balance is chosen because it is
 * the case that makes the distinction unavoidable: it is a normal US card rate
 * against the Federal Reserve G.19 average of 20.94 percent for the second
 * quarter of 2026, and the compounding gap on it is a three figure sum rather
 * than a rounding difference. The APY side opens at 4.50 percent compounded
 * monthly, which is the shape of a business savings or money market quote.
 */
export const APR_APY_DEFAULTS: AprApyDefaults = {
  direction: "aprToApy",
  aprPct: 24.99,
  apyPct: 4.5,
  compoundsPerYear: 365,
  targetCompoundsPerYear: 12,
  balance: 10000,
  years: 1,
};
