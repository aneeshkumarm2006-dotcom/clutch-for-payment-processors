/**
 * Cash conversion cycle: DSO, DIO, DPO, the countback variant, and the dollars.
 *
 * Client safe: no `@/models`, no I/O, no clock. Every output is a pure function
 * of its inputs, so the widget renders the same figures on the server as it does
 * after hydration.
 *
 * ─── Why both balance conventions are computed, always ───────────────────────
 *
 * DSO, DIO, DPO and the cash conversion cycle are ANALYST ratios, not accounting
 * measures. No US accounting standard defines any of them, so two people can
 * compute different numbers from the same audited statements and both be right.
 * The largest single source of disagreement is which receivables balance goes on
 * top:
 *
 *   ENDING BALANCE   AR at the close of the period, exactly as it appears on the
 *                    balance sheet. Reproducible from published statements by
 *                    anyone, which is why lenders and screeners use it. It is a
 *                    snapshot at one instant, so anything unusual about that
 *                    instant (a large shipment on the last day, a fiscal year
 *                    that ends at the seasonal peak) lands in the ratio at full
 *                    weight.
 *   AVERAGE BALANCE  (opening + closing) / 2. Chosen because the numerator is a
 *                    STOCK measured at an instant while the denominator is a
 *                    FLOW across the whole period, and dividing one by the other
 *                    silently mixes units. Averaging the stock at least
 *                    approximates the window the flow covers. It is still only a
 *                    two point sample, and for a seasonal business those two
 *                    points are frequently the two least representative days of
 *                    the year.
 *
 * Neither is correct in general. Both are therefore returned from every call,
 * along with the gap between them, because the gap is the thing worth seeing:
 * on the defaults in this module it is just over three days of cash conversion
 * cycle, which is real money and is invisible if a page prints one number.
 *
 * ─── Why DPO is returned twice ───────────────────────────────────────────────
 *
 * Payables arise from PURCHASES, not from cost of sales. In a period where
 * inventory grew, you bought more than you sold, so cost of goods sold
 * understates what the payables balance was actually financing. Purchases are
 * recoverable from the same three figures every reader already has:
 *
 *   purchases = cost of goods sold + (closing inventory - opening inventory)
 *
 * Both DPO variants are returned. They diverge exactly as fast as inventory
 * moves, which is the same thing that moves DIO, so a page that reports DIO
 * honestly and DPO on cost of sales is double counting an inventory build.
 *
 * ─── The silent failure mode in the dollar translation ───────────────────────
 *
 * A day of cash conversion cycle is NOT one dollar amount. A day of DSO is worth
 * a day of CREDIT SALES; a day of DIO or DPO is worth a day of COST OF GOODS
 * SOLD, which at any positive gross margin is a smaller number. Valuing all
 * three at revenue overstates an inventory or payables improvement by exactly
 * the gross margin, does not throw, and looks entirely plausible. The three are
 * kept on separate denominators throughout, and `workingCapitalImpact` returns
 * them separately for that reason.
 *
 * The second sign trap in the same function: DSO and DIO improve by going DOWN
 * and DPO improves by going UP. A single signed "change in days" applied
 * uniformly to all three gets payables backwards and reports a cash release when
 * the business has in fact paid its suppliers sooner. Every field on
 * `WorkingCapitalImpactInputs` is therefore expressed as DAYS OF IMPROVEMENT, so
 * a positive number always means cash released, whichever component it is on.
 *
 * ─── Money is integer cents ──────────────────────────────────────────────────
 *
 * Someone reading the released cash figure is usually holding an aged
 * receivables report or a bank line statement, so the dollars are computed in
 * integer cents and rounded half up rather than left as binary floats that
 * render a cent light. Day counts stay as floats: they are ratios, not money,
 * and rounding them before multiplying moves the dollars.
 */

// ---------------------------------------------------------------------------
// Money and guards
// ---------------------------------------------------------------------------

/** Round half UP. `Math.round` agrees on positives; this states the intent. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const fromCents = (cents: number): number => cents / 100;

/** Dollars, snapped to the cent, so every returned money figure is exact. */
const money = (dollars: number): number =>
  Number.isFinite(dollars) ? fromCents(toCents(dollars)) : 0;

const atLeastZero = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Guarded division. A zero denominator means the ratio is undefined, not infinite. */
const ratio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BalanceConvention = "average" | "ending";

/** Which cost flow the payables balance is measured against. See the header. */
export type PayablesDenominator = "cogs" | "purchases";

export interface PeriodBalances {
  /** Balance at the start of the period. Ignored under the ending convention. */
  opening: number;
  /** Balance at the close of the period, as printed on the balance sheet. */
  ending: number;
}

export interface CycleInputs {
  /**
   * Sales made ON CREDIT in the period, not total revenue.
   *
   * This is the other denominator the ranking pages disagree about. A business
   * that takes half its money by card at the till has no receivable for that
   * half, so putting total revenue underneath a receivables balance divides a
   * partial numerator by a whole denominator and reports a DSO roughly half of
   * the real one.
   */
  creditSales: number;
  cogs: number;
  receivables: PeriodBalances;
  inventory: PeriodBalances;
  payables: PeriodBalances;
  /** 365 for a year, 91 or 92 for a quarter, 30 or 31 for a month. */
  daysInPeriod: number;
  convention: BalanceConvention;
  /** Annual cost of the money the cycle ties up, in percent. */
  borrowingRatePct: number;
  /** How many days of improvement the impact table models. */
  improvementDays: number;
}

export interface CycleRatios {
  convention: BalanceConvention;
  receivablesBalance: number;
  inventoryBalance: number;
  payablesBalance: number;
  dso: number;
  dio: number;
  /** DPO measured against cost of goods sold. */
  dpo: number;
  /** DPO measured against purchases. See the header for why both exist. */
  dpoOnPurchases: number;
  ccc: number;
  /** Receivables plus inventory less payables. The cycle, in dollars. */
  workingCapitalInvested: number;
}

export interface WorkingCapitalImpactInputs {
  creditSales: number;
  cogs: number;
  daysInPeriod: number;
  /** Days REMOVED from DSO. Positive releases cash. */
  dsoDaysImproved: number;
  /** Days REMOVED from DIO. Positive releases cash. */
  dioDaysImproved: number;
  /** Days ADDED to DPO. Positive releases cash. See the sign note in the header. */
  dpoDaysImproved: number;
  borrowingRatePct: number;
}

export interface WorkingCapitalImpact {
  /** One day of credit sales. What a day of DSO is worth. */
  salesPerDay: number;
  /** One day of cost of goods sold. What a day of DIO or DPO is worth. */
  cogsPerDay: number;
  dsoCash: number;
  dioCash: number;
  dpoCash: number;
  totalCash: number;
  dsoFinancing: number;
  dioFinancing: number;
  dpoFinancing: number;
  totalFinancing: number;
  /** Days the cash conversion cycle falls by. Always the plain sum of the three. */
  cccDaysImproved: number;
}

export interface CycleResult {
  /** The convention the caller asked for. */
  chosen: CycleRatios;
  average: CycleRatios;
  ending: CycleRatios;
  /** Ending cycle less average cycle, in days. Positive means ending reads worse. */
  conventionGapDays: number;
  /** Cost of goods sold plus the inventory build. */
  purchases: number;
  salesPerDay: number;
  cogsPerDay: number;
  /** A year of simple carry on the working capital the cycle ties up. */
  annualFinancingCost: number;
  /** Daily carry on the same balance, which is what one day of delay costs. */
  dailyFinancingCost: number;
  improvement: WorkingCapitalImpact;
}

export interface CountbackMonth {
  creditSales: number;
  /** Calendar days in that month. 28 to 31, not an average. */
  days: number;
}

export interface CountbackMonthResult extends CountbackMonth {
  /** Receivables retired against this month's sales. */
  consumed: number;
  /** Days of this month the countback actually counted. */
  daysCounted: number;
}

export interface CountbackInputs {
  /** Receivables balance being explained. Usually the closing balance. */
  receivables: number;
  /**
   * Credit sales by month, MOST RECENT FIRST.
   *
   * Order is load bearing and reversing it does not throw. It returns a
   * different, plausible number, because the method walks backwards through
   * time retiring the balance against the newest sales first.
   */
  months: CountbackMonth[];
}

export interface CountbackResult {
  countbackDso: number;
  months: CountbackMonthResult[];
  /**
   * True when the receivables balance outran every month supplied, so the tail
   * had to be extrapolated at the average daily sales rate of the window. A
   * countback that exhausts its window is a warning, not an answer.
   */
  exhausted: boolean;
  /** Receivables left unexplained after the supplied months, before extrapolation. */
  unexplained: number;
  /** The simple formula run over the same months, for comparison. */
  simpleDso: number;
  windowDays: number;
  windowSales: number;
  /** Countback less simple. Positive means the simple formula flatters you. */
  gapDays: number;
  /** The gap, valued at the window's own daily sales rate. */
  gapCash: number;
}

export interface SettlementInputs {
  annualRevenue: number;
  /** Share of revenue taken by card, in percent. The rest is invoiced. */
  cardSharePct: number;
  /** Days from sale to money in the bank on the card share, today. */
  settlementDays: number;
  /** Days from sale to money in the bank on the card share, on a faster processor. */
  improvedSettlementDays: number;
  /** Days from invoice to cash on the invoiced share. */
  invoiceCollectionDays: number;
  /** Rolling reserve withheld, in percent of card volume. */
  reservePct: number;
  /** How long each day's reserve is held before release. */
  reserveHoldDays: number;
  borrowingRatePct: number;
  daysInPeriod: number;
  /**
   * DSO measured off the balance sheet, if the caller has one.
   *
   * Supplying it turns on the collections gap: the days of receivables that
   * neither your terms nor your settlement time explain.
   */
  measuredDsoDays?: number;
}

export interface SettlementResult {
  cardRevenue: number;
  invoiceRevenue: number;
  revenuePerDay: number;
  cardRevenuePerDay: number;
  invoiceRevenuePerDay: number;
  /** Card money in flight at steady state. */
  settlementFloat: number;
  /** Reserve held at steady state, once the release schedule has filled up. */
  reserveBalance: number;
  /** The reserve expressed in days of card revenue. Equals reservePct x holdDays. */
  reserveDragDays: number;
  /** Settlement days plus the reserve drag. The card share's own DSO. */
  cardDsoDays: number;
  cardDsoDaysImproved: number;
  blendedDso: number;
  improvedBlendedDso: number;
  blendedDsoDaysSaved: number;
  /** Cash freed once by the faster payout, on the card share only. */
  cashReleased: number;
  annualFinancingSaving: number;
  /** Measured DSO less the DSO your terms and settlement times imply. */
  collectionsGapDays: number | null;
  collectionsGapCash: number | null;
}

// ---------------------------------------------------------------------------
// The four ratios
// ---------------------------------------------------------------------------

/** Which balance the chosen convention puts on top of the ratio. */
export function balanceFor(b: PeriodBalances, convention: BalanceConvention): number {
  const opening = atLeastZero(b.opening);
  const ending = atLeastZero(b.ending);
  return convention === "ending" ? ending : (opening + ending) / 2;
}

/**
 * DSO = (accounts receivable / credit sales) x days in period.
 *
 * Receivables is a dollar balance, credit sales is the dollar value of sales
 * made on terms in the same period, and the result is the average number of days
 * a dollar of sales spends as somebody else's promise before it is cash.
 */
export function daysSalesOutstanding(
  receivables: number,
  creditSales: number,
  daysInPeriod: number,
): number {
  return ratio(atLeastZero(receivables), atLeastZero(creditSales)) * atLeastZero(daysInPeriod);
}

/**
 * DIO = (inventory / cost of goods sold) x days in period.
 *
 * Cost of goods sold, never revenue: inventory is carried at cost, so putting a
 * cost balance over a revenue flow understates the days by the gross margin.
 */
export function daysInventoryOutstanding(
  inventory: number,
  cogs: number,
  daysInPeriod: number,
): number {
  return ratio(atLeastZero(inventory), atLeastZero(cogs)) * atLeastZero(daysInPeriod);
}

/**
 * DPO = (accounts payable / cost flow) x days in period.
 *
 * The cost flow is cost of goods sold under the common convention and purchases
 * under the stricter one. `purchases` is `cogs + (closing inventory - opening
 * inventory)`, which is what the payables balance was actually financing.
 */
export function daysPayableOutstanding(
  payables: number,
  costFlow: number,
  daysInPeriod: number,
): number {
  return ratio(atLeastZero(payables), atLeastZero(costFlow)) * atLeastZero(daysInPeriod);
}

/**
 * CCC = DSO + DIO - DPO.
 *
 * Days between paying for something and being paid for it. It is allowed to be
 * negative, and a negative answer is not an error: it means suppliers finance
 * the business. The result is deliberately not clamped at zero.
 */
export function cashConversionCycle(dso: number, dio: number, dpo: number): number {
  return finite(dso) + finite(dio) - finite(dpo);
}

/** Cost of goods sold plus the inventory build. Never negative. */
export function purchasesFor(input: Pick<CycleInputs, "cogs" | "inventory">): number {
  const build = atLeastZero(input.inventory.ending) - atLeastZero(input.inventory.opening);
  return Math.max(0, atLeastZero(input.cogs) + build);
}

/** Every ratio under one convention. Called twice by `cashCycle`. */
export function cycleRatios(input: CycleInputs, convention: BalanceConvention): CycleRatios {
  const days = atLeastZero(input.daysInPeriod);
  const ar = balanceFor(input.receivables, convention);
  const inv = balanceFor(input.inventory, convention);
  const ap = balanceFor(input.payables, convention);
  const purchases = purchasesFor(input);

  const dso = daysSalesOutstanding(ar, input.creditSales, days);
  const dio = daysInventoryOutstanding(inv, input.cogs, days);
  const dpo = daysPayableOutstanding(ap, input.cogs, days);
  const dpoOnPurchases = daysPayableOutstanding(ap, purchases, days);

  return {
    convention,
    receivablesBalance: money(ar),
    inventoryBalance: money(inv),
    payablesBalance: money(ap),
    dso,
    dio,
    dpo,
    dpoOnPurchases,
    ccc: cashConversionCycle(dso, dio, dpo),
    workingCapitalInvested: money(ar + inv - ap),
  };
}

// ---------------------------------------------------------------------------
// Days into dollars
// ---------------------------------------------------------------------------

/**
 * What a change in the cycle is worth in cash, and what carrying the cycle costs.
 *
 * Each component is valued on its own denominator, and every input is expressed
 * as days of IMPROVEMENT so a positive number always releases cash. Both of
 * those decisions exist because getting either wrong is silent: see the header.
 *
 * The financing figure is a simple annual carry, not a compounded one, because
 * the money a cycle ties up is normally funded on a revolving line that accrues
 * simple interest on the drawn balance. Compounding it would answer a different
 * question, which the compound interest calculator on this site already answers.
 */
export function workingCapitalImpact(input: WorkingCapitalImpactInputs): WorkingCapitalImpact {
  const days = atLeastZero(input.daysInPeriod);
  const salesPerDay = ratio(atLeastZero(input.creditSales), days);
  const cogsPerDay = ratio(atLeastZero(input.cogs), days);
  const rate = finite(input.borrowingRatePct) / 100;

  const dsoCash = finite(input.dsoDaysImproved) * salesPerDay;
  const dioCash = finite(input.dioDaysImproved) * cogsPerDay;
  const dpoCash = finite(input.dpoDaysImproved) * cogsPerDay;
  const totalCash = dsoCash + dioCash + dpoCash;

  return {
    salesPerDay: money(salesPerDay),
    cogsPerDay: money(cogsPerDay),
    dsoCash: money(dsoCash),
    dioCash: money(dioCash),
    dpoCash: money(dpoCash),
    totalCash: money(totalCash),
    dsoFinancing: money(dsoCash * rate),
    dioFinancing: money(dioCash * rate),
    dpoFinancing: money(dpoCash * rate),
    totalFinancing: money(totalCash * rate),
    cccDaysImproved:
      finite(input.dsoDaysImproved) + finite(input.dioDaysImproved) + finite(input.dpoDaysImproved),
  };
}

/** The whole cycle, both conventions, and the money. */
export function cashCycle(input: CycleInputs): CycleResult {
  const average = cycleRatios(input, "average");
  const ending = cycleRatios(input, "ending");
  const chosen = input.convention === "ending" ? ending : average;

  const days = atLeastZero(input.daysInPeriod);
  const rate = finite(input.borrowingRatePct) / 100;
  const salesPerDay = ratio(atLeastZero(input.creditSales), days);
  const cogsPerDay = ratio(atLeastZero(input.cogs), days);
  const carry = chosen.workingCapitalInvested * rate;

  const improvementDays = atLeastZero(input.improvementDays);

  return {
    chosen,
    average,
    ending,
    conventionGapDays: ending.ccc - average.ccc,
    purchases: money(purchasesFor(input)),
    salesPerDay: money(salesPerDay),
    cogsPerDay: money(cogsPerDay),
    annualFinancingCost: money(carry),
    // A year of carry spread over the year, which is what one more day of delay
    // costs to fund. Divided by the same day count the ratios use, not by 365,
    // so a quarterly model stays internally consistent.
    dailyFinancingCost: money(ratio(carry, days)),
    improvement: workingCapitalImpact({
      creditSales: input.creditSales,
      cogs: input.cogs,
      daysInPeriod: days,
      dsoDaysImproved: improvementDays,
      dioDaysImproved: improvementDays,
      dpoDaysImproved: improvementDays,
      borrowingRatePct: input.borrowingRatePct,
    }),
  };
}

// ---------------------------------------------------------------------------
// Countback DSO
// ---------------------------------------------------------------------------

/**
 * Countback DSO, the method for a business whose sales are not flat.
 *
 * The simple formula divides a receivables balance by the AVERAGE sales rate of
 * the period. That is only meaningful when sales were roughly level. Give it a
 * seasonal business and it is not slightly wrong, it is wrong in a direction:
 *
 *   Sales FALLING into the period end. The balance was built by big months, the
 *   formula divides it by a small average, and DSO reads LONGER than it is.
 *   Sales RISING into the period end. The balance is mostly recent, the formula
 *   divides it by a large average, and DSO reads SHORTER than it is. This is the
 *   dangerous direction, because a growing business is told its collections are
 *   improving at exactly the moment its receivables are growing fastest.
 *
 * The countback method, sometimes called exhaustion, does not average anything.
 * It walks backwards from the most recent month, retiring the receivables
 * balance against actual sales month by month, counting whole months while the
 * balance still exceeds them and a pro rata slice of the month where the balance
 * runs out. The answer is the number of days of ACTUAL recent sales the balance
 * represents.
 *
 * Two failure modes worth naming. First, `months` must be ordered MOST RECENT
 * FIRST; reversed, the method retires the balance against the oldest sales and
 * returns a confident wrong number without throwing. Second, a balance that
 * outruns every month supplied cannot be counted back, only extrapolated, so
 * `exhausted` is returned and the caller is expected to say so rather than
 * print the extrapolation as a measurement.
 */
export function countbackDso(input: CountbackInputs): CountbackResult {
  const months = input.months.map((m) => ({
    creditSales: atLeastZero(m.creditSales),
    days: atLeastZero(m.days),
  }));

  const windowSales = months.reduce((s, m) => s + m.creditSales, 0);
  const windowDays = months.reduce((s, m) => s + m.days, 0);
  const receivables = atLeastZero(input.receivables);

  let remaining = receivables;
  let countback = 0;
  const detail: CountbackMonthResult[] = [];

  for (const m of months) {
    if (remaining <= 0 || m.creditSales <= 0) {
      detail.push({ ...m, consumed: 0, daysCounted: 0 });
      continue;
    }
    if (remaining >= m.creditSales) {
      // The balance covers this whole month, so the whole month is counted.
      remaining -= m.creditSales;
      countback += m.days;
      detail.push({ ...m, consumed: m.creditSales, daysCounted: m.days });
    } else {
      // The balance runs out inside this month. Count the fraction of it the
      // balance reaches, at this month's own sales rate rather than an average.
      const fraction = remaining / m.creditSales;
      countback += fraction * m.days;
      detail.push({ ...m, consumed: remaining, daysCounted: fraction * m.days });
      remaining = 0;
    }
  }

  const exhausted = remaining > 0;
  if (exhausted && windowSales > 0 && windowDays > 0) {
    // Nothing older was supplied, so the tail can only be extrapolated at the
    // window's own average daily sales rate. Flagged, never presented as
    // measured.
    countback += remaining / (windowSales / windowDays);
  }

  const simpleDso = daysSalesOutstanding(receivables, windowSales, windowDays);
  const gapDays = countback - simpleDso;
  const dailySales = ratio(windowSales, windowDays);

  return {
    countbackDso: countback,
    months: detail,
    exhausted,
    unexplained: money(remaining),
    simpleDso,
    windowDays,
    windowSales: money(windowSales),
    gapDays,
    gapCash: money(gapDays * dailySales),
  };
}

// ---------------------------------------------------------------------------
// The payments half: settlement time, reserves and terms
// ---------------------------------------------------------------------------

/**
 * Settlement time is part of DSO, and a rolling reserve is a lot of it.
 *
 * A card sale is not cash on the day it clears. It is a receivable from your
 * processor until the payout lands, so the payout schedule is inside DSO exactly
 * the way invoice terms are. Two mechanics, both arithmetic:
 *
 *   SETTLEMENT FLOAT. At steady state you are always waiting on `settlementDays`
 *   worth of card revenue. Moving from five days to two does not save a fee, it
 *   hands back three days of card revenue, once, permanently.
 *   RESERVE DRAG. A rolling reserve of r percent released after h days holds, at
 *   steady state, r x h days of card revenue. Ten percent held 180 days is
 *   eighteen days of card revenue sitting in someone else's account, which is
 *   why a reserve moves the cycle far more than a payout schedule does.
 *
 * The blended DSO is the revenue weighted average of the card share's own DSO
 * and the invoiced share's collection days. It is the FLOOR your terms and your
 * processor imply, not a measurement. Where the caller supplies a measured DSO
 * from the balance sheet, the difference is returned as the collections gap:
 * receivables that neither your terms nor your settlement schedule explain.
 */
export function settlementImpact(input: SettlementInputs): SettlementResult {
  const days = atLeastZero(input.daysInPeriod);
  const revenue = atLeastZero(input.annualRevenue);
  const cardShare = Math.min(100, atLeastZero(input.cardSharePct)) / 100;
  const invoiceShare = 1 - cardShare;

  const cardRevenue = revenue * cardShare;
  const invoiceRevenue = revenue * invoiceShare;
  const revenuePerDay = ratio(revenue, days);
  const cardRevenuePerDay = ratio(cardRevenue, days);
  const invoiceRevenuePerDay = ratio(invoiceRevenue, days);

  const settle = atLeastZero(input.settlementDays);
  const settleFast = atLeastZero(input.improvedSettlementDays);
  const reserveDragDays = (Math.min(100, atLeastZero(input.reservePct)) / 100) * atLeastZero(input.reserveHoldDays);

  const cardDsoDays = settle + reserveDragDays;
  const cardDsoDaysImproved = settleFast + reserveDragDays;
  const invoiceDays = atLeastZero(input.invoiceCollectionDays);

  const blendedDso = cardShare * cardDsoDays + invoiceShare * invoiceDays;
  const improvedBlendedDso = cardShare * cardDsoDaysImproved + invoiceShare * invoiceDays;

  // Cash freed by the faster payout. Only the card share moves, and only the
  // settlement leg of it: the reserve is unchanged by a payout schedule.
  const cashReleased = Math.max(0, settle - settleFast) * cardRevenuePerDay;
  const rate = finite(input.borrowingRatePct) / 100;

  const measured = input.measuredDsoDays;
  const hasMeasured = typeof measured === "number" && Number.isFinite(measured);
  const gapDays = hasMeasured ? measured - blendedDso : null;

  return {
    cardRevenue: money(cardRevenue),
    invoiceRevenue: money(invoiceRevenue),
    revenuePerDay: money(revenuePerDay),
    cardRevenuePerDay: money(cardRevenuePerDay),
    invoiceRevenuePerDay: money(invoiceRevenuePerDay),
    settlementFloat: money(settle * cardRevenuePerDay),
    reserveBalance: money(reserveDragDays * cardRevenuePerDay),
    reserveDragDays,
    cardDsoDays,
    cardDsoDaysImproved,
    blendedDso,
    improvedBlendedDso,
    blendedDsoDaysSaved: blendedDso - improvedBlendedDso,
    cashReleased: money(cashReleased),
    annualFinancingSaving: money(cashReleased * rate),
    collectionsGapDays: gapDays,
    collectionsGapCash: gapDays === null ? null : money(gapDays * revenuePerDay),
  };
}

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * Default widget state, kept here as data rather than as strings scattered
 * through the component, so the page copy and the tests can be written against
 * the same numbers the visitor first sees.
 *
 * The shape is a US wholesaler that sells on terms and also takes cards: 2.4
 * million dollars of credit sales, a 40 percent gross margin, and a balance
 * sheet that grew across the year. The borrowing rate is the bank prime loan
 * rate from the Federal Reserve H.15 release of 4 September 2026. The 45 day
 * invoice collection default is the average US B2B payment term reported in the
 * Atradius Payment Practices Barometer, US results, 2025 edition.
 */
export const CASH_CYCLE_DEFAULTS = {
  creditSales: 2400000,
  cogs: 1440000,
  arOpening: 260000,
  arEnding: 300000,
  invOpening: 220000,
  invEnding: 240000,
  apOpening: 170000,
  apEnding: 190000,
  daysInPeriod: 365,
  convention: "average" as BalanceConvention,
  borrowingRatePct: 6.75,
  improvementDays: 5,

  // Countback. Most recent month first, and these three months deliberately
  // fall away from the year's average so the seasonal failure is visible on the
  // default state rather than only when a visitor goes looking for it.
  countbackReceivables: 300000,
  month1Sales: 120000,
  month1Days: 31,
  month2Sales: 200000,
  month2Days: 31,
  month3Sales: 260000,
  month3Days: 30,

  // Settlement.
  annualRevenue: 2400000,
  cardSharePct: 60,
  settlementDays: 5,
  improvedSettlementDays: 2,
  invoiceCollectionDays: 45,
  reservePct: 0,
  reserveHoldDays: 180,
} as const;
