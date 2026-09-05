/**
 * Pure arithmetic behind the `/tools/*` calculators.
 *
 * Separated from the widgets for one reason: these are the parts that can be
 * WRONG in a way nobody notices. A layout bug is visible. A rate solver that
 * converges on the wrong branch returns a confident number in the thousands of
 * percent, and a churn figure annualised by multiplying instead of compounding
 * is off by two points and looks entirely plausible. Both are covered by
 * `tests/index.test.ts` against fixed reference values.
 *
 * Client-safe: no `@/models`, no `server-only`, no I/O.
 */

import type { FedHoliday, PayoutProfile } from "@/lib/tools-data/payouts";
import { BANKING_DAYS_PER_MONTH, BANKING_DAYS_PER_YEAR } from "@/lib/tools-data/mca";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Round half UP, which is what a processor does. `Math.round` rounds half away from zero, so they agree on positives; this is explicit about intent. */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

// ---------------------------------------------------------------------------
// Gross-up (reverse fee)
// ---------------------------------------------------------------------------

export interface GrossUpResult {
  gross: number;
  fee: number;
  net: number;
  effectiveRate: number;
  /** What you get by naively adding the percentage, which lands short. */
  naive: { gross: number; fee: number; net: number; shortfall: number };
  /** True when the markup exceeds the 3% cap Visa applies to US credit card surcharges. */
  exceedsSurchargeCap: boolean;
}

/**
 * "What do I charge so that $X lands in my account?"
 *
 * gross = (net + fixed) / (1 - rate).
 *
 * Computed in integer cents, not floats. Binary floating point produces one cent
 * errors at exactly the moment a user is checking the output against a
 * statement, which is the only moment this page is being used.
 *
 * The verify-then-bump step matters: rounding the gross half up can still land a
 * cent short, because the processor rounds ITS fee independently of our
 * rounding. So the fee is recomputed on the rounded gross and the gross is
 * nudged up a cent at a time until the net clears the target. Never round the
 * gross down: a merchant who charges a rounded-down figure lands short.
 */
export function grossUp(net: number, ratePct: number, fixed: number): GrossUpResult {
  const rate = ratePct / 100;
  const netC = toCents(Math.max(0, net));
  const fixedC = toCents(Math.max(0, fixed));

  const feeOn = (grossC: number) => roundHalfUp(grossC * rate) + fixedC;

  const empty: GrossUpResult = {
    gross: 0,
    fee: 0,
    net: 0,
    effectiveRate: 0,
    naive: { gross: 0, fee: 0, net: 0, shortfall: 0 },
    exceedsSurchargeCap: false,
  };
  // A rate at or above 100% has no solution: no charge is large enough.
  if (rate >= 1 || netC <= 0) return empty;

  let grossC = roundHalfUp((netC + fixedC) / (1 - rate));
  for (let i = 0; i < 5; i += 1) {
    if (grossC - feeOn(grossC) >= netC) break;
    grossC += 1;
  }
  const feeC = feeOn(grossC);
  const confirmedC = grossC - feeC;

  const naiveGrossC = roundHalfUp(netC * (1 + rate));
  const naiveFeeC = feeOn(naiveGrossC);
  const naiveNetC = naiveGrossC - naiveFeeC;

  return {
    gross: grossC / 100,
    fee: feeC / 100,
    net: confirmedC / 100,
    effectiveRate: grossC > 0 ? (feeC / grossC) * 100 : 0,
    naive: {
      gross: naiveGrossC / 100,
      fee: naiveFeeC / 100,
      net: naiveNetC / 100,
      shortfall: (netC - naiveNetC) / 100,
    },
    exceedsSurchargeCap: (grossC - netC) / netC > 0.03,
  };
}

// ---------------------------------------------------------------------------
// Merchant cash advance
// ---------------------------------------------------------------------------

export interface McaInput {
  advance: number;
  factorRate: number;
  originationPct: number;
  /** Holdback mode uses the percentage of daily card settlement; fixed mode uses a flat debit. */
  mode: "holdback" | "fixed";
  holdbackPct: number;
  monthlyVolume: number;
  fixedAmount: number;
  fixedFrequency: "daily" | "weekly";
}

export interface McaResult {
  totalRepayment: number;
  factorCost: number;
  originationFee: number;
  totalCost: number;
  netReceived: number;
  dailyPayment: number;
  weeklyPayment: number;
  /** In fixed-debit mode, what share of daily card settlement the debit really is. */
  impliedHoldbackPct: number;
  bankingDays: number;
  calendarDays: number;
  months: number;
  /** Annualised by multiplying the daily rate by banking days, which is what the state disclosure rules mean. */
  apr: number;
}

/**
 * Solve the periodic rate on the advance's real cash flow: cash received today
 * against a stream of daily payments.
 *
 * NPV(r) = -N + sum of P / (1+r)^t is DECREASING in r, because a higher discount
 * rate shrinks the present value of the payments while N is fixed. So when
 * NPV(mid) is positive the root lies ABOVE mid.
 *
 * Getting that branch backwards does not fail loudly. It converges on r = 1.0
 * and reports an APR of about 25,200 percent, which on a page whose entire
 * purpose is an honest APR would be worse than shipping nothing. The reference
 * cases in `tests/index.test.ts` exist to catch exactly that inversion.
 */
function solveDailyRate(net: number, payment: number, fullPayments: number, residual: number): number {
  if (net <= 0 || payment <= 0 || fullPayments <= 0) return 0;

  const npv = (r: number): number => {
    // Annuity closed form, plus the stub payment one period later.
    const annuity = (payment * (1 - Math.pow(1 + r, -fullPayments))) / r;
    const stub = residual > 0.005 ? residual / Math.pow(1 + r, fullPayments + 1) : 0;
    return annuity + stub - net;
  };

  let lo = 1e-12;
  let hi = 1;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function mcaSchedule(input: McaInput): McaResult {
  const advance = Math.max(0, input.advance);
  const factor = Math.max(1, input.factorRate);
  const totalRepayment = advance * factor;
  const factorCost = totalRepayment - advance;
  const originationFee = advance * (Math.max(0, input.originationPct) / 100);
  const netReceived = advance - originationFee;

  const dailyVolume = Math.max(0, input.monthlyVolume) / BANKING_DAYS_PER_MONTH;
  const dailyPayment =
    input.mode === "holdback"
      ? (Math.max(0, input.holdbackPct) / 100) * dailyVolume
      : input.fixedFrequency === "weekly"
        ? Math.max(0, input.fixedAmount) / 5
        : Math.max(0, input.fixedAmount);

  const empty: McaResult = {
    totalRepayment,
    factorCost,
    originationFee,
    totalCost: factorCost + originationFee,
    netReceived,
    dailyPayment: 0,
    weeklyPayment: 0,
    impliedHoldbackPct: 0,
    bankingDays: 0,
    calendarDays: 0,
    months: 0,
    apr: 0,
  };
  if (dailyPayment <= 0 || totalRepayment <= 0) return empty;

  const fullPayments = Math.floor(totalRepayment / dailyPayment);
  const residual = totalRepayment - fullPayments * dailyPayment;
  const bankingDays = fullPayments + (residual > 0.005 ? 1 : 0);
  const rate = solveDailyRate(netReceived, dailyPayment, fullPayments, residual);

  return {
    totalRepayment,
    factorCost,
    originationFee,
    totalCost: factorCost + originationFee,
    netReceived,
    dailyPayment,
    weeklyPayment: dailyPayment * 5,
    impliedHoldbackPct: dailyVolume > 0 ? (dailyPayment / dailyVolume) * 100 : 0,
    bankingDays,
    calendarDays: Math.round((bankingDays * 7) / 5),
    months: bankingDays / BANKING_DAYS_PER_MONTH,
    apr: rate * BANKING_DAYS_PER_YEAR * 100,
  };
}

// ---------------------------------------------------------------------------
// Equipment lease
// ---------------------------------------------------------------------------

/**
 * The monthly rate implied by a lease: solve P = L * (1 - (1+i)^-n) / i.
 *
 * Bisection rather than Newton. f(i) is strictly decreasing on (0, infinity), so
 * bisection always converges; Newton can diverge at the rates these leases
 * actually carry, which routinely exceed 100% APR.
 *
 * Returns null when no positive rate exists, i.e. when the payments never add up
 * to the purchase price, which means the "lease" is cheaper than buying and is
 * not really a finance transaction at all.
 */
export function impliedMonthlyLeaseRate(
  purchasePrice: number,
  monthlyPayment: number,
  termMonths: number,
): number | null {
  const P = purchasePrice;
  const L = monthlyPayment;
  const n = Math.round(termMonths);
  if (P <= 0 || L <= 0 || n <= 0) return null;
  if (L * n <= P) return null;

  const f = (i: number) => (L * (1 - Math.pow(1 + i, -n))) / i - P;

  let lo = 1e-12;
  let hi = 5;
  if (f(hi) > 0) return null;
  for (let k = 0; k < 400; k += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Rolling reserve
// ---------------------------------------------------------------------------

export interface ReserveRow {
  month: number;
  label: string;
  held: number;
  released: number;
  net: number;
  locked: number;
  firstRelease: boolean;
}

/**
 * The reserve timeline.
 *
 * The point the arithmetic makes: under constant volume a rolling reserve is not
 * a cost that is paid and gone, it is a permanent working-capital hole of
 * (monthly volume x reserve pct x hold months) that only unwinds when you leave.
 */
export function reserveTimeline(opts: {
  monthlyVolume: number;
  reservePct: number;
  holdMonths: number;
  startMonth: Date;
  months: number;
  /** Optional: the month processing stops, for the wind-down view. */
  stopAfterMonth?: number;
}): { rows: ReserveRow[]; withheldPerMonth: number; steadyStateLocked: number } {
  const W = Math.max(0, opts.monthlyVolume) * (Math.max(0, opts.reservePct) / 100);
  const h = Math.max(0, Math.round(opts.holdMonths));
  const steadyStateLocked = W * h;
  const stop = opts.stopAfterMonth;

  const rows: ReserveRow[] = [];
  for (let m = 1; m <= opts.months; m += 1) {
    const processing = stop === undefined || m <= stop;
    const held = processing ? W : 0;
    const released = stop === undefined ? (m > h ? W : 0) : m > h && m - h <= stop ? W : 0;
    const locked =
      stop === undefined
        ? W * Math.min(m, h)
        : m <= stop
          ? W * Math.min(m, h)
          : W * Math.max(0, h - (m - stop));

    const d = new Date(opts.startMonth.getTime());
    d.setMonth(d.getMonth() + m - 1);

    rows.push({
      month: m,
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      held,
      released,
      net: held - released,
      locked,
      firstRelease: h > 0 && m === h + 1,
    });
  }

  return { rows, withheldPerMonth: W, steadyStateLocked };
}

// ---------------------------------------------------------------------------
// Payout dates
// ---------------------------------------------------------------------------

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The set of dates the Federal Reserve is actually closed on a weekday.
 *
 * Weekend-dated holidays are DROPPED, not shifted. That is the Fed's own rule:
 * when a holiday falls on a Saturday the Reserve Banks are open the preceding
 * Friday, so nothing is skipped. Sunday holidays are already pre-resolved to
 * their observed Monday in the data, so shifting here would move them twice.
 */
export function buildClosureSet(holidays: FedHoliday[]): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    const day = new Date(`${h.date}T00:00:00Z`).getUTCDay();
    if (day === 0 || day === 6) continue;
    set.add(h.date);
  }
  return set;
}

export const isBusinessDay = (d: Date, closures: Set<string>): boolean => {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6 && !closures.has(iso(d));
};

const nextBusinessDay = (d: Date, closures: Set<string>): Date => {
  const next = new Date(d.getTime());
  do {
    next.setUTCDate(next.getUTCDate() + 1);
  } while (!isBusinessDay(next, closures));
  return next;
};

/** n = 0 returns the anchor (the first business day at or after `d`), not `d` itself. */
export function addBusinessDays(d: Date, n: number, closures: Set<string>): Date {
  let cur = isBusinessDay(d, closures) ? new Date(d.getTime()) : nextBusinessDay(d, closures);
  for (let i = 0; i < n; i += 1) cur = nextBusinessDay(cur, closures);
  return cur;
}

export interface PayoutResult {
  settlement: Date;
  weekday: string;
  calendarDays: number;
  /** Why days were skipped, in plain language. Empty when nothing was skipped. */
  skipped: string[];
  missedCutoff: boolean;
}

/**
 * Resolve a sale to the date the money is expected to land.
 *
 * Cutoffs are compared as WALL CLOCK minutes since midnight, never through UTC.
 * Converting would drift the comparison by an hour twice a year at the daylight
 * saving boundaries, which is the kind of bug that only shows up in March.
 */
export function payoutDate(opts: {
  profile: PayoutProfile;
  saleDate: string;
  saleTime: string;
  speed: "standard" | "nextDay" | "instant";
  holidays: FedHoliday[];
}): PayoutResult | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.saleDate)) return null;
  const closures = buildClosureSet(opts.holidays);
  const sale = new Date(`${opts.saleDate}T00:00:00Z`);
  if (Number.isNaN(sale.getTime())) return null;

  let batch = new Date(sale.getTime());
  let missedCutoff = false;
  const cutoff = opts.profile.cutoff;
  if (cutoff && cutoff !== "none") {
    const [hhmm] = cutoff.split(" ");
    const parts = (hhmm ?? "").split(":");
    const cutMinutes = Number(parts[0]) * 60 + Number(parts[1] ?? 0);
    const saleParts = opts.saleTime.split(":");
    const saleMinutes = Number(saleParts[0]) * 60 + Number(saleParts[1] ?? 0);
    if (Number.isFinite(cutMinutes) && Number.isFinite(saleMinutes) && saleMinutes > cutMinutes) {
      batch.setUTCDate(batch.getUTCDate() + 1);
      missedCutoff = true;
    }
  }

  const days = opts.speed === "instant" ? 0 : opts.speed === "nextDay" ? 1 : opts.profile.standardDays;
  const settlement = opts.speed === "instant" ? batch : addBusinessDays(batch, days, closures);

  const skipped: string[] = [];
  const cursor = new Date(batch.getTime());
  while (cursor < settlement) {
    if (!isBusinessDay(cursor, closures)) {
      const day = cursor.getUTCDay();
      const name = closures.has(iso(cursor))
        ? opts.holidays.find((h) => h.date === iso(cursor))?.name
        : undefined;
      if (name) skipped.push(name);
      else if (day === 0 || day === 6) skipped.push("a weekend");
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    settlement,
    weekday: settlement.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    calendarDays: Math.round((settlement.getTime() - sale.getTime()) / 86400000),
    skipped: Array.from(new Set(skipped)),
    missedCutoff,
  };
}

// ---------------------------------------------------------------------------
// Involuntary churn
// ---------------------------------------------------------------------------

export interface ChurnResult {
  mrr: number;
  monthlyAtRisk: number;
  monthlyRecovered: number;
  monthlyLost: number;
  annualLost: number;
  monthlyUpside: number;
  annualUpside: number;
  churnMonthly: number;
  churnAnnual: number;
  churnAtTargetMonthly: number;
  churnAtTargetAnnual: number;
  subscribersLostMonthly: number;
  subscribersLostAtTarget: number;
  targetBelowCurrent: boolean;
}

/**
 * Involuntary churn from failed payments.
 *
 * Annualised by COMPOUNDING, never by multiplying the monthly rate by twelve.
 * At a 4% decline rate and 53% recovery the monthly rate is 1.88%: compounded
 * that is 20.37% a year, multiplied it is 22.56%. Getting this wrong is the most
 * common defect in the competing calculators and is a large part of why this
 * page is worth building.
 */
export function involuntaryChurn(opts: {
  subscribers: number;
  arpu: number;
  declineRatePct: number;
  recoveryRatePct: number;
  targetRecoveryPct: number;
}): ChurnResult {
  const S = Math.max(0, opts.subscribers);
  const A = Math.max(0, opts.arpu);
  const d = Math.min(1, Math.max(0, opts.declineRatePct / 100));
  const r = Math.min(1, Math.max(0, opts.recoveryRatePct / 100));
  const t = Math.min(1, Math.max(0, opts.targetRecoveryPct / 100));

  const mrr = S * A;
  const monthlyAtRisk = mrr * d;
  const churnMonthly = d * (1 - r);
  const churnAtTargetMonthly = d * (1 - t);
  const annualise = (m: number) => 1 - Math.pow(1 - m, 12);

  return {
    mrr,
    monthlyAtRisk,
    monthlyRecovered: monthlyAtRisk * r,
    monthlyLost: monthlyAtRisk * (1 - r),
    annualLost: monthlyAtRisk * (1 - r) * 12,
    monthlyUpside: monthlyAtRisk * Math.max(0, t - r),
    annualUpside: monthlyAtRisk * Math.max(0, t - r) * 12,
    churnMonthly,
    churnAnnual: annualise(churnMonthly),
    churnAtTargetMonthly,
    churnAtTargetAnnual: annualise(churnAtTargetMonthly),
    subscribersLostMonthly: S * churnMonthly,
    subscribersLostAtTarget: S * churnAtTargetMonthly,
    targetBelowCurrent: t < r,
  };
}

// ---------------------------------------------------------------------------
// Compound and simple interest
// ---------------------------------------------------------------------------

export interface CompoundInput {
  principal: number;
  /** Nominal annual rate, as a percentage. Not the APY. */
  annualRatePct: number;
  years: number;
  /** Compounding periods per year. 0 means continuous. */
  compoundsPerYear: number;
  contribution: number;
  /** Contribution periods per year. 0 means no contributions at all. */
  contributionsPerYear: number;
  /** True for an annuity due: money in at the START of each period. */
  contributeAtStart: boolean;
}

export interface CompoundYear {
  year: number;
  startBalance: number;
  contributions: number;
  interest: number;
  endBalance: number;
}

export interface CompoundResult {
  finalValue: number;
  principal: number;
  totalContributions: number;
  /** finalValue less every dollar you put in. */
  totalReturns: number;
  /** Effective annual yield as a percentage: what Regulation DD calls the APY. */
  apy: number;
  /** The same deposits at the same nominal rate, with interest that never compounds. */
  simpleFinalValue: number;
  /** What compounding is worth over that, in dollars. */
  compoundingPremium: number;
  /** Years for the OPENING PRINCIPAL alone to double. Contributions are excluded on purpose. */
  doublingYears: number;
  /** The 72 shortcut, so the page can show how far off it is rather than assert it. */
  ruleOf72Years: number;
  schedule: CompoundYear[];
}

/**
 * Effective annual rate from a nominal rate compounded n times a year.
 *
 * (1 + r/n)^n - 1, and e^r - 1 when n is 0 (continuous). This is the single
 * quantity that makes two differently-compounded rates comparable, which is why
 * Regulation DD makes US institutions disclose it, and why every output on the
 * compound page is derived from it rather than from the nominal rate.
 *
 * `Math.expm1` rather than `Math.exp(r) - 1`: at the rates a savings account
 * actually pays, subtracting 1 from a number very close to 1 throws away
 * significant digits.
 */
export function effectiveAnnualRate(annualRatePct: number, compoundsPerYear: number): number {
  const r = Math.max(-0.99, annualRatePct / 100);
  if (compoundsPerYear <= 0) return Math.expm1(r);
  const n = Math.max(1, Math.round(compoundsPerYear));
  return Math.pow(1 + r / n, n) - 1;
}

/**
 * Growth of a lump sum plus a stream of deposits.
 *
 * WHY IT STEPS INSTEAD OF USING THE ANNUITY FORMULA. The compounding frequency
 * and the contribution frequency are independent inputs: daily compounding with
 * monthly deposits is the normal case, not an edge case. Rather than force them
 * to match, the effective ANNUAL rate is computed once and then converted to a
 * rate per contribution step, (1 + EAR)^(1/c) - 1. That is exact for any pair of
 * frequencies, and it keeps the year-by-year table arithmetically identical to
 * the headline instead of merely close to it.
 *
 * The simple-interest comparison runs in the SAME loop rather than as a separate
 * closed form, so it is guaranteed to describe the same deposits over the same
 * timeline. Simple interest accrues on money deposited, never on interest
 * already earned, which is the whole distinction the two pages exist to draw.
 */
export function compoundInterest(input: CompoundInput): CompoundResult {
  const principal = Math.max(0, input.principal);
  const years = Math.min(100, Math.max(0, Math.round(input.years)));
  const ratePct = input.annualRatePct;

  // With no contributions the loop still needs a step count, so it steps once a
  // year and deposits nothing.
  const hasContributions = input.contributionsPerYear > 0 && input.contribution > 0;
  const c = hasContributions ? Math.max(1, Math.round(input.contributionsPerYear)) : 1;
  const pmt = hasContributions ? Math.max(0, input.contribution) : 0;

  const ear = effectiveAnnualRate(ratePct, input.compoundsPerYear);
  const stepRate = Math.pow(1 + ear, 1 / c) - 1;
  // The simple-interest twin uses the NOMINAL rate split evenly across the year,
  // because simple interest has no compounding frequency to convert.
  const simpleStepRate = Math.max(-0.99, ratePct / 100) / c;

  let balance = principal;
  let depositedBase = principal;
  let simpleInterest = 0;
  let totalContributions = 0;
  const schedule: CompoundYear[] = [];

  for (let y = 1; y <= years; y += 1) {
    const startBalance = balance;
    let yearContributions = 0;

    for (let step = 0; step < c; step += 1) {
      if (pmt > 0 && input.contributeAtStart) {
        balance += pmt;
        depositedBase += pmt;
        yearContributions += pmt;
        totalContributions += pmt;
      }
      balance *= 1 + stepRate;
      simpleInterest += depositedBase * simpleStepRate;
      if (pmt > 0 && !input.contributeAtStart) {
        balance += pmt;
        depositedBase += pmt;
        yearContributions += pmt;
        totalContributions += pmt;
      }
    }

    schedule.push({
      year: y,
      startBalance,
      contributions: yearContributions,
      interest: balance - startBalance - yearContributions,
      endBalance: balance,
    });
  }

  const simpleFinalValue = principal + totalContributions + simpleInterest;

  return {
    finalValue: balance,
    principal,
    totalContributions,
    totalReturns: balance - principal - totalContributions,
    apy: ear * 100,
    simpleFinalValue,
    compoundingPremium: balance - simpleFinalValue,
    doublingYears: ear > 0 ? Math.log(2) / Math.log(1 + ear) : Number.POSITIVE_INFINITY,
    ruleOf72Years: ratePct > 0 ? 72 / ratePct : Number.POSITIVE_INFINITY,
    schedule,
  };
}

export type DayBasis = 360 | 365;

export interface SimpleInput {
  principal: number;
  annualRatePct: number;
  termValue: number;
  termUnit: "years" | "months" | "days";
  /**
   * Days assumed in a year. Only bites when the term is counted in days: a term
   * stated in months or years is the same fraction of a year either way.
   */
  dayBasis: DayBasis;
}

export interface SimpleResult {
  interest: number;
  total: number;
  /** The fraction of a year the formula multiplied by. */
  yearFraction: number;
  /** Actual calendar days in the term, on a 365-day year. */
  days: number;
  perDay: number;
  perMonth: number;
  /** The rate a 360-day basis actually charges. Equals the entered rate on a 365-day basis. */
  effectiveRatePct: number;
  /** Regulation DD APY on these exact dollars. */
  apy: number;
  /** The same principal and term with monthly compounding, for contrast. */
  compoundedMonthly: number;
  compoundingGap: number;
}

/**
 * Simple interest: I = P x r x t, and nothing else.
 *
 * Two things this gets right that most simple-interest pages do not.
 *
 * DAY COUNT. A term entered in days is divided by `dayBasis`, so the 360-day
 * commercial convention makes a 365-day loan cost 365/360 of a year of interest.
 * That is not a rounding artefact, it is the convention working as designed, and
 * it is why a note quoted at 9.00% on an Actual/360 basis accrues at 9.125%. A
 * term entered in months or years is unaffected, because no days were counted.
 *
 * APY. The result is fed straight through the Regulation DD formula,
 * 100[(1 + I/P)^(365/days) - 1], so a short-dated simple-interest deal can be
 * compared against a compounding one on the one measure US law defines. Reg DD
 * is defined on ACTUAL days in the term, so that exponent never uses 360 even
 * when the accrual did.
 */
export function simpleInterest(input: SimpleInput): SimpleResult {
  const principal = Math.max(0, input.principal);
  const ratePct = input.annualRatePct;
  const r = ratePct / 100;
  const termValue = Math.max(0, input.termValue);
  const basis = input.dayBasis === 360 ? 360 : 365;

  const yearFraction =
    input.termUnit === "years"
      ? termValue
      : input.termUnit === "months"
        ? termValue / 12
        : termValue / basis;

  const days =
    input.termUnit === "years"
      ? termValue * 365
      : input.termUnit === "months"
        ? termValue * (365 / 12)
        : termValue;

  const interest = principal * r * yearFraction;
  const total = principal + interest;
  const actualYears = days / 365;
  const compoundedMonthly = principal * Math.pow(1 + r / 12, 12 * actualYears);

  return {
    interest,
    total,
    yearFraction,
    days,
    perDay: days > 0 ? interest / days : 0,
    perMonth: days > 0 ? interest / (days / (365 / 12)) : 0,
    effectiveRatePct: input.termUnit === "days" ? ratePct * (365 / basis) : ratePct,
    apy: principal > 0 && days > 0 ? (Math.pow(1 + interest / principal, 365 / days) - 1) * 100 : 0,
    compoundedMonthly,
    compoundingGap: compoundedMonthly - total,
  };
}
