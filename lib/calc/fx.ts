/**
 * Cross border and currency conversion arithmetic.
 *
 * Separated from the widget for the reason every module in this family is
 * separated: these are the parts that can be WRONG in a way nobody notices. A
 * layout bug is visible. An exchange rate read in the wrong direction returns a
 * confident number that is out by a factor of the rate squared, and a markup
 * measured against the wrong base is out by three percent of itself, which is a
 * difference no reader can see and every merchant argues about.
 *
 * Client-safe: no `@/models`, no `server-only`, no I/O, no `Date.now()`.
 *
 * ─── Failure mode 1: the direction of a quote ────────────────────────────────
 * The Federal Reserve prints the euro as US dollars per euro and the yen as yen
 * per US dollar. A merchant reads both off the same table. If the code assumes
 * one convention, the other one inverts, and inverting an exchange rate does not
 * throw: 159.97 becomes 0.00625 and the resulting markup is a plausible looking
 * number in the thousands of percent, or in the hundredths. Every rate entering
 * this module therefore carries its direction, `toUsdPerUnit` is the ONLY place
 * an inversion happens, and the test asserts that the same economic situation
 * expressed both ways returns the identical markup.
 *
 * ─── Failure mode 2: which base the markup is measured against ───────────────
 * "A 3% markup" is two different numbers and both are used in the wild.
 *
 *   Value measure:  (mid - received) / mid.        What the spread cost you as a
 *                                                  share of what the sale was
 *                                                  actually worth.
 *   Rate measure:   (mid - received) / received.   What was added to the rate you
 *                                                  were quoted.
 *
 * A processor that adds 3% to a foreign-per-dollar quote takes 1 - 1/1.03, which
 * is 2.9126% of the value, not 3%. Neither number is wrong; publishing one and
 * calling it the other is. Both are returned, `markupPct` is the value measure,
 * and the page says which is which.
 *
 * ─── Failure mode 3: double counting the network assessment ──────────────────
 * On flat rate pricing the processor's international add-on is what you pay
 * INSTEAD of the network cross border assessment, because the processor already
 * absorbed the assessment when it set the add-on. On interchange plus the
 * assessment lands on your statement and the processor adds nothing. Adding both
 * inflates a foreign card by about 145 basis points and looks entirely plausible
 * on a page about foreign cards. `passThroughNetwork` is the switch, and the
 * profiles in `lib/tools-data/fx.ts` set it per processor.
 *
 * ─── Money is accumulated in integer hundredths of a cent ────────────────────
 * Same reason as `lib/calc/adyen.ts`. Network per item fees are genuinely sub
 * cent ($0.0195, $0.0295, $0.0395), so cents are too coarse a unit to accumulate
 * in, and binary floating point produces one cent errors at exactly the moment a
 * merchant is checking the output against a statement, which is the only moment
 * this page is being used. Everything accumulates in integer units of $0.0001
 * and rounds ONCE, at the end, half up, which is what a processor does.
 */

import type { NetworkCrossBorderAssessment } from "@/lib/tools-data/fx";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** $0.0001. Fine enough for a $0.0195 network fee, coarse enough to stay in safe integer range at any volume a merchant enters. */
const UNITS_PER_DOLLAR = 10_000;

/** Round half UP, which is what a processor does. Explicit about intent rather than relying on `Math.round`'s away-from-zero rule. */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toUnits = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * UNITS_PER_DOLLAR);

const toDollars = (units: number): number => units / UNITS_PER_DOLLAR;

/** Round a units figure to the nearest cent and return dollars. Used only for billed totals. */
const unitsToBilledDollars = (units: number): number => roundHalfUp(units / 100) / 100;

const pctOfUnits = (amountUnits: number, pct: number): number =>
  roundHalfUp((amountUnits * Math.max(0, pct)) / 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export type QuoteDirection = "usd-per-unit" | "unit-per-usd";

/**
 * Normalize any quote to US dollars per one unit of the foreign currency.
 *
 * The ONE place an inversion happens in this module. A non positive rate returns
 * zero rather than Infinity, because a merchant mid-typing a rate should see a
 * blank result and not a number in the billions.
 */
export function toUsdPerUnit(rate: number, direction: QuoteDirection): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return direction === "usd-per-unit" ? rate : 1 / rate;
}

/** The inverse of `toUsdPerUnit`, so a derived rate can be shown back in the direction the merchant typed. */
export function fromUsdPerUnit(usdPerUnit: number, direction: QuoteDirection): number {
  if (!Number.isFinite(usdPerUnit) || usdPerUnit <= 0) return 0;
  return direction === "usd-per-unit" ? usdPerUnit : 1 / usdPerUnit;
}

// ---------------------------------------------------------------------------
// The cost of one cross border payment
// ---------------------------------------------------------------------------

export interface CrossBorderRates {
  /** The processor's published card rate, before any add-on. */
  basePct: number;
  baseFixed: number;
  /** The processor's own international card add-on. Zero on interchange plus pricing. */
  internationalPct: number;
  /** The conversion markup, as a percentage of the converted amount. */
  fxMarkupPct: number;
  /** The network cross border assessment, used only when `passThroughNetwork` is true. */
  networkPct: number;
  networkFixed: number;
}

export interface CrossBorderPaymentInput {
  amount: number;
  /** The card was issued outside the US. This is a geography test, not a currency test. */
  foreignCard: boolean;
  /** The sale had to be converted into the settlement currency. This is a currency test, not a geography test. */
  currencyConverted: boolean;
  /** True on interchange plus and interchange++, where the network assessment reaches your statement. */
  passThroughNetwork: boolean;
  rates: CrossBorderRates;
}

export interface CrossBorderPaymentResult {
  amount: number;
  /** Components are UNROUNDED dollars: the network lines are genuinely sub cent. */
  baseFee: number;
  internationalFee: number;
  networkAssessment: number;
  conversionCost: number;
  /** The one figure rounded to the cent, half up. */
  total: number;
  net: number;
  /** Computed on the unrounded total. Rounding first moves the rate by up to half a cent divided by the amount. */
  effectiveRatePct: number;
  /** What the identical sale would have cost on a domestic card with no conversion. */
  domesticTotal: number;
  domesticEffectiveRatePct: number;
  /** The whole cost of the payment being international, in dollars and as a share of the sale. */
  crossBorderPremium: number;
  crossBorderPremiumPct: number;
  /** The cross border premium as a share of the domestic fee. The number that makes people sit up. */
  premiumAsShareOfDomesticFeePct: number;
}

/**
 * Price one payment, splitting the three charges the whole category blurs.
 *
 * The geography test and the currency test are DELIBERATELY independent inputs.
 * A US issued card charged in euros converts but is not cross border. A UK
 * issued card charged in dollars is cross border but does not convert. Braintree
 * prices those two cases with two different 1% add-ons for exactly this reason,
 * and a model that folds them together gets both cases wrong.
 */
export function crossBorderPayment(input: CrossBorderPaymentInput): CrossBorderPaymentResult {
  const { rates } = input;
  const amount = Math.max(0, safe(input.amount));
  const amountU = toUnits(amount);

  const baseU = pctOfUnits(amountU, rates.basePct) + toUnits(rates.baseFixed);
  const intlU = input.foreignCard && !input.passThroughNetwork ? pctOfUnits(amountU, rates.internationalPct) : 0;
  const networkU =
    input.foreignCard && input.passThroughNetwork
      ? pctOfUnits(amountU, rates.networkPct) + toUnits(rates.networkFixed)
      : 0;
  const fxU = input.currencyConverted ? pctOfUnits(amountU, rates.fxMarkupPct) : 0;

  const totalU = baseU + intlU + networkU + fxU;
  const total = unitsToBilledDollars(totalU);
  const domesticTotal = unitsToBilledDollars(baseU);
  const premiumU = intlU + networkU + fxU;

  return {
    amount,
    baseFee: toDollars(baseU),
    internationalFee: toDollars(intlU),
    networkAssessment: toDollars(networkU),
    conversionCost: toDollars(fxU),
    total,
    net: unitsToBilledDollars(amountU) - total,
    effectiveRatePct: amount > 0 ? (toDollars(totalU) / amount) * 100 : 0,
    domesticTotal,
    domesticEffectiveRatePct: amount > 0 ? (toDollars(baseU) / amount) * 100 : 0,
    crossBorderPremium: unitsToBilledDollars(premiumU),
    crossBorderPremiumPct: amount > 0 ? (toDollars(premiumU) / amount) * 100 : 0,
    premiumAsShareOfDomesticFeePct: baseU > 0 ? (premiumU / baseU) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// A month of mixed volume
// ---------------------------------------------------------------------------

export interface BlendedMonthInput {
  monthlyVolume: number;
  averageTicket: number;
  /** Share of monthly volume on cards issued outside the US. */
  foreignSharePct: number;
  /** Share of monthly volume that has to be converted. Independent of the share above, on purpose. */
  convertedSharePct: number;
  passThroughNetwork: boolean;
  rates: CrossBorderRates;
}

export interface BlendedMonthResult {
  /** Volume divided by average ticket, NOT rounded to a whole payment. See the note on the function. */
  transactions: number;
  foreignVolume: number;
  convertedVolume: number;
  domesticVolume: number;
  percentageCost: number;
  fixedCost: number;
  internationalCost: number;
  networkCost: number;
  conversionCost: number;
  totalMonthlyCost: number;
  /** The blended monthly effective rate. This is the figure the site's rate bands are built to score. */
  blendedRatePct: number;
  /** What the same month would have cost with no foreign or converted volume at all. */
  baselineCost: number;
  baselineRatePct: number;
  crossBorderCostMonthly: number;
  crossBorderCostAnnual: number;
  /** Blended rate minus baseline rate, in percentage points. Multiply by 100 for basis points. */
  ratePremiumPct: number;
}

/**
 * The blended monthly rate, which is the question a merchant with an
 * international mix actually has.
 *
 * ON THE TRANSACTION COUNT. It is volume divided by average ticket and is NOT
 * rounded to a whole number. Rounding it would move the total by up to one fixed
 * fee, and the count is itself an estimate derived from two estimates, so
 * rounding buys precision that does not exist while introducing a discontinuity
 * a merchant would notice when they nudge the average ticket by a dollar.
 *
 * ON THE BASELINE. `baselineCost` is the same volume with the international and
 * conversion lines removed, NOT the same volume at some other processor. The
 * comparison this page is entitled to make is "what is the international mix
 * costing me", not "what would a different deal cost", which is a different tool.
 */
export function blendedMonth(input: BlendedMonthInput): BlendedMonthResult {
  const { rates } = input;
  const volume = Math.max(0, safe(input.monthlyVolume));
  const ticket = Math.max(0, safe(input.averageTicket));
  const foreignShare = Math.min(100, Math.max(0, safe(input.foreignSharePct)));
  const convertedShare = Math.min(100, Math.max(0, safe(input.convertedSharePct)));

  const transactions = ticket > 0 ? volume / ticket : 0;
  const foreignVolume = (volume * foreignShare) / 100;
  const convertedVolume = (volume * convertedShare) / 100;
  const foreignTransactions = (transactions * foreignShare) / 100;

  const volumeU = toUnits(volume);
  const foreignVolumeU = toUnits(foreignVolume);
  const convertedVolumeU = toUnits(convertedVolume);

  const percentageU = pctOfUnits(volumeU, rates.basePct);
  const fixedU = toUnits(transactions * Math.max(0, rates.baseFixed));
  const intlU = input.passThroughNetwork ? 0 : pctOfUnits(foreignVolumeU, rates.internationalPct);
  const networkU = input.passThroughNetwork
    ? pctOfUnits(foreignVolumeU, rates.networkPct) + toUnits(foreignTransactions * Math.max(0, rates.networkFixed))
    : 0;
  const fxU = pctOfUnits(convertedVolumeU, rates.fxMarkupPct);

  const baselineU = percentageU + fixedU;
  const crossBorderU = intlU + networkU + fxU;
  const totalU = baselineU + crossBorderU;

  const blendedRatePct = volume > 0 ? (toDollars(totalU) / volume) * 100 : 0;
  const baselineRatePct = volume > 0 ? (toDollars(baselineU) / volume) * 100 : 0;

  return {
    transactions,
    foreignVolume,
    convertedVolume,
    domesticVolume: volume - foreignVolume,
    percentageCost: toDollars(percentageU),
    fixedCost: toDollars(fixedU),
    internationalCost: toDollars(intlU),
    networkCost: toDollars(networkU),
    conversionCost: toDollars(fxU),
    totalMonthlyCost: unitsToBilledDollars(totalU),
    blendedRatePct,
    baselineCost: unitsToBilledDollars(baselineU),
    baselineRatePct,
    crossBorderCostMonthly: unitsToBilledDollars(crossBorderU),
    crossBorderCostAnnual: unitsToBilledDollars(crossBorderU * 12),
    ratePremiumPct: blendedRatePct - baselineRatePct,
  };
}

// ---------------------------------------------------------------------------
// The implied FX markup
// ---------------------------------------------------------------------------

export interface FxMarkupInput {
  /** The sale amount in the FOREIGN currency, as the customer paid it. */
  foreignAmount: number;
  /** The mid market reference rate, as quoted. */
  midRate: number;
  /** The rate you were actually given, quoted the same way round. */
  receivedRate: number;
  direction: QuoteDirection;
}

export interface FxMarkupResult {
  midUsdPerUnit: number;
  receivedUsdPerUnit: number;
  /** What the sale was worth at the reference rate. */
  midValue: number;
  /** What reached you. */
  receivedValue: number;
  spreadCost: number;
  /** The value measure: the share of the mid market value that did not reach you. The headline. */
  markupPct: number;
  /** The rate measure: what was added to the rate you were given. Equals a "3% added to the rate" quote. */
  rateSpreadPct: number;
  /** True when the received rate is better than the reference rate, which usually means a stale reference. */
  favorable: boolean;
}

/**
 * Derive the markup hidden inside a rate.
 *
 * This is the whole reason the page exists. A processor quoting "3 to 4 percent
 * conversion" and a processor quoting a rate cannot be compared until both are
 * expressed as a percentage against the same reference, and only one of the two
 * ever gives you a percentage.
 *
 * Both measures are returned because they are both used in public and they are
 * NOT equal. A rate that is 3% worse than mid on the rate measure is 2.9126% on
 * the value measure. The gap is small and it is exactly the size of the argument
 * a merchant ends up having with a support agent.
 */
export function fxMarkup(input: FxMarkupInput): FxMarkupResult {
  const foreignAmount = Math.max(0, safe(input.foreignAmount));
  const midUsdPerUnit = toUsdPerUnit(input.midRate, input.direction);
  const receivedUsdPerUnit = toUsdPerUnit(input.receivedRate, input.direction);

  const empty: FxMarkupResult = {
    midUsdPerUnit,
    receivedUsdPerUnit,
    midValue: 0,
    receivedValue: 0,
    spreadCost: 0,
    markupPct: 0,
    rateSpreadPct: 0,
    favorable: false,
  };
  if (midUsdPerUnit <= 0 || receivedUsdPerUnit <= 0) return empty;

  const midValueU = toUnits(foreignAmount * midUsdPerUnit);
  const receivedValueU = toUnits(foreignAmount * receivedUsdPerUnit);

  return {
    midUsdPerUnit,
    receivedUsdPerUnit,
    midValue: unitsToBilledDollars(midValueU),
    receivedValue: unitsToBilledDollars(receivedValueU),
    spreadCost: unitsToBilledDollars(midValueU - receivedValueU),
    markupPct: ((midUsdPerUnit - receivedUsdPerUnit) / midUsdPerUnit) * 100,
    rateSpreadPct: ((midUsdPerUnit - receivedUsdPerUnit) / receivedUsdPerUnit) * 100,
    favorable: receivedUsdPerUnit > midUsdPerUnit,
  };
}

// ---------------------------------------------------------------------------
// Running it forward
// ---------------------------------------------------------------------------

export interface FxForwardInput {
  midRate: number;
  direction: QuoteDirection;
  /** A stated markup, on the VALUE measure: the share of mid market value the provider keeps. */
  markupPct: number;
  foreignAmount: number;
  transactionsPerYear: number;
}

export interface FxForwardResult {
  midUsdPerUnit: number;
  receivedUsdPerUnit: number;
  /** The received rate expressed the way the merchant typed the quote, so it can be compared to one. */
  receivedQuoted: number;
  midValuePerTransaction: number;
  costPerTransaction: number;
  costPerYear: number;
  annualConvertedVolume: number;
}

/**
 * Given a stated markup, show the rate you would actually receive and what the
 * spread costs.
 *
 * The exact inverse of `fxMarkup` on the value measure, which the test asserts
 * by round tripping: feed a markup in, take the rate out, feed it back and the
 * same markup must come back. A one sided implementation of a two sided identity
 * is where sign errors live.
 */
export function fxForward(input: FxForwardInput): FxForwardResult {
  const midUsdPerUnit = toUsdPerUnit(input.midRate, input.direction);
  const markup = Math.max(0, safe(input.markupPct));
  const foreignAmount = Math.max(0, safe(input.foreignAmount));
  const txns = Math.max(0, safe(input.transactionsPerYear));

  if (midUsdPerUnit <= 0 || markup >= 100) {
    return {
      midUsdPerUnit,
      receivedUsdPerUnit: 0,
      receivedQuoted: 0,
      midValuePerTransaction: 0,
      costPerTransaction: 0,
      costPerYear: 0,
      annualConvertedVolume: 0,
    };
  }

  const receivedUsdPerUnit = midUsdPerUnit * (1 - markup / 100);
  const midValueU = toUnits(foreignAmount * midUsdPerUnit);
  const costPerTxnU = pctOfUnits(midValueU, markup);

  return {
    midUsdPerUnit,
    receivedUsdPerUnit,
    receivedQuoted: fromUsdPerUnit(receivedUsdPerUnit, input.direction),
    midValuePerTransaction: unitsToBilledDollars(midValueU),
    costPerTransaction: unitsToBilledDollars(costPerTxnU),
    costPerYear: unitsToBilledDollars(costPerTxnU * txns),
    annualConvertedVolume: unitsToBilledDollars(midValueU * txns),
  };
}

// ---------------------------------------------------------------------------
// The network layer
// ---------------------------------------------------------------------------

/**
 * Sum a network's published cross border percentage lines.
 *
 * The total is computed here rather than stored in `lib/tools-data/fx.ts` on
 * purpose: a total that is stored beside its own components can drift from them
 * silently, and this one is asserted against a hand computed figure in the test.
 */
export function assessmentTotalPct(assessment: NetworkCrossBorderAssessment): number {
  return assessment.components.reduce((sum, c) => sum + (Number.isFinite(c.pct) ? c.pct : 0), 0);
}

/** The dollar cost of a network cross border assessment on one sale, rounded to the cent. */
export function assessmentCost(assessment: NetworkCrossBorderAssessment, amount: number): number {
  const amountU = toUnits(Math.max(0, safe(amount)));
  const u = pctOfUnits(amountU, assessmentTotalPct(assessment)) + toUnits(assessment.incrementalFixed);
  return unitsToBilledDollars(u);
}
