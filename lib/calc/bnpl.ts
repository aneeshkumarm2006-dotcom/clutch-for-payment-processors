/**
 * What buy now, pay later costs a merchant, and what it has to earn back.
 *
 * Client safe: no `@/models`, no I/O, no clock, no dependency on the rate data.
 * The provider's percentage and fixed fee arrive as plain numbers so the
 * arithmetic outlives any rate sheet.
 *
 * ─── The question this module exists to answer ──────────────────────────────
 *
 * BNPL is sold on conversion and basket size and priced at roughly twice a card.
 * A merchant on 2.9% plus 30 cents who turns on a 5.99% plus 30 cent method has
 * not bought a payment method, they have bought an option on incremental sales.
 * So the only number that decides anything is the break-even: how much NEW
 * revenue the method has to create before it stops being a discount on sales the
 * merchant already had.
 *
 * ─── The failure mode this module exists to prevent ─────────────────────────
 *
 * CANNIBALISATION. Every vendor case study, and every calculator currently
 * ranking for this query, computes the return on TOTAL BNPL volume. That is the
 * wrong denominator and it is wrong in a direction that always flatters the
 * vendor. A customer who would have paid by card and instead pays by Klarna has
 * not generated a sale; the merchant has simply paid 5.99 percent for a sale it
 * was going to make at 2.9 percent. Run the arithmetic on total BNPL volume and
 * a method that destroys margin looks like it prints money, because the gross
 * margin on sales you already had is enormous next to a three point fee.
 *
 * Every function below therefore splits BNPL orders into two populations:
 *
 *   SWITCHED     orders that would have happened anyway, now paying a higher fee.
 *                These are pure cost unless the basket also grew.
 *   INCREMENTAL  orders that only exist because the method was offered. These
 *                carry their full contribution margin, less the BNPL fee.
 *
 * The merchant supplies the split. Nothing in this module infers it, and nothing
 * in this module uses a vendor's published uplift number as an input default,
 * because a vendor uplift figure compares BNPL orders against all orders, which
 * measures who chooses BNPL rather than what BNPL causes.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * Per-order fees are computed in integer cents and rounded half up, the
 * direction a processor rounds, because a merchant checking this page is usually
 * holding a statement. Each order is priced and rounded separately and then
 * multiplied by the order count, never the reverse: a processor charges per
 * transaction, so rounding the monthly total once understates or overstates by
 * up to half a cent per order.
 *
 * ─── Where the arithmetic is deliberately continuous, and why it matters ────
 *
 * `requiredAovUpliftPct` is solved in closed form on unrounded dollars, not in
 * cents. It has to be: the answer is a ratio, and forcing it onto the cent grid
 * would make it jump in visible steps as the basket size moves. The consequence
 * is that feeding the returned uplift back into `bnplMonthly` can land a cent or
 * two either side of exactly break-even. That is a rounding artefact of the fee,
 * not a solver error, and it is stated in the page's assumptions rather than
 * hidden.
 *
 * ─── Order counts are not rounded to whole orders ───────────────────────────
 *
 * 12 percent of 1,200 orders is 144, but 12 percent of 1,199 is 143.88. Rounding
 * the population counts before multiplying by a per-order figure moves the
 * monthly answer by dollars and makes the outputs stop adding up against each
 * other. The counts stay fractional all the way through; only the break-even
 * ORDER COUNT is presented as a whole number, and it is rounded UP, because half
 * an extra sale does not pay a bill.
 */

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Round half UP, the direction a processor rounds. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const atLeastZero = (n: number): number => Math.max(0, safe(n));

/**
 * The fee one order attracts, in whole cents.
 *
 * Percentage applied to the order in cents, rounded half up, then the fixed fee
 * added as an exact cent amount. Adding first and rounding once would be a
 * different number on roughly half of all baskets.
 */
export function feeCents(amount: number, ratePct: number, fixedFee: number): number {
  const amountC = toCents(atLeastZero(amount));
  const rate = safe(ratePct) / 100;
  return roundHalfUp(amountC * rate) + toCents(atLeastZero(fixedFee));
}

// ---------------------------------------------------------------------------
// One order, priced two ways
// ---------------------------------------------------------------------------

export interface SingleOrderInput {
  orderValue: number;
  cardRatePct: number;
  cardFixedFee: number;
  bnplRatePct: number;
  bnplFixedFee: number;
}

export interface SingleOrderResult {
  cardFee: number;
  bnplFee: number;
  /** BNPL fee minus card fee. What the same sale costs extra when the customer switches. */
  extraFee: number;
  cardEffectiveRatePct: number;
  bnplEffectiveRatePct: number;
  /** How many times the card fee the BNPL fee is. 2.4 means BNPL costs 2.4x the card. */
  multipleOfCard: number;
  netAfterCard: number;
  netAfterBnpl: number;
}

/**
 * Prices one order on a card and on a BNPL method side by side.
 *
 * `multipleOfCard` is the number the category is actually about, and it is the
 * one no vendor page prints. A rate of 5.99 percent against 2.9 percent sounds
 * like a two point difference; on a $40 basket it is 2.4 times the fee.
 */
export function singleOrder(input: SingleOrderInput): SingleOrderResult {
  const value = atLeastZero(input.orderValue);
  const valueC = toCents(value);
  const cardC = feeCents(value, input.cardRatePct, input.cardFixedFee);
  const bnplC = feeCents(value, input.bnplRatePct, input.bnplFixedFee);

  return {
    cardFee: cardC / 100,
    bnplFee: bnplC / 100,
    extraFee: (bnplC - cardC) / 100,
    cardEffectiveRatePct: valueC > 0 ? (cardC / valueC) * 100 : 0,
    bnplEffectiveRatePct: valueC > 0 ? (bnplC / valueC) * 100 : 0,
    multipleOfCard: cardC > 0 ? bnplC / cardC : 0,
    netAfterCard: (valueC - cardC) / 100,
    netAfterBnpl: (valueC - bnplC) / 100,
  };
}

// ---------------------------------------------------------------------------
// A month of orders, with the break-even
// ---------------------------------------------------------------------------

export interface BnplMonthlyInput {
  /** Total orders a month WITH the BNPL method live. What the merchant observes. */
  monthlyOrders: number;
  /** Average order value on card. The BNPL basket is derived from this and the uplift. */
  averageOrderValue: number;
  cardRatePct: number;
  cardFixedFee: number;
  bnplRatePct: number;
  bnplFixedFee: number;
  /** Share of total orders paid by the BNPL method. */
  bnplSharePct: number;
  /** Share of those BNPL orders that would NOT have happened without it. The honest input. */
  incrementalSharePct: number;
  /** How much larger a BNPL basket is than a card basket, as a percentage. Vendor claims live here. */
  aovUpliftPct: number;
  /** Contribution margin before payment fees, as a percentage of the sale. */
  grossMarginPct: number;
}

export interface BnplMonthlyResult {
  // Populations
  bnplOrders: number;
  switchedOrders: number;
  incrementalOrders: number;
  cardOrders: number;
  /** Orders the merchant would have had with no BNPL at all: card orders plus switched orders. */
  baselineOrders: number;

  // Baskets and per-order economics
  bnplOrderValue: number;
  cardFeePerOrder: number;
  bnplFeePerOrder: number;
  /** Contribution per switched order minus contribution that order used to make. Negative without a basket uplift. */
  switchingMarginPerOrder: number;
  /** Contribution one genuinely new BNPL order adds: margin on the basket, less the BNPL fee. */
  incrementalMarginPerOrder: number;

  // Monthly money
  revenue: number;
  baselineRevenue: number;
  feeBill: number;
  baselineFeeBill: number;
  /** Extra fee paid on sales the merchant already had. The cannibalization bill. */
  cannibalizationCost: number;
  /** Extra contribution from bigger baskets on those same switched sales. */
  switchedUpliftMargin: number;
  /** Contribution from orders that only exist because BNPL was offered. */
  incrementalProfit: number;
  /** The whole answer: monthly profit with BNPL minus monthly profit without it. */
  netMonthlyEffect: number;
  netAnnualEffect: number;

  // Blended rates, for the verdict band
  blendedEffectiveRatePct: number;
  baselineEffectiveRatePct: number;

  // Break-even
  /** Extra genuinely new orders a month needed to pay for the cannibalized ones. */
  breakEvenIncrementalOrders: number;
  /** Those orders as a percentage lift on the baseline order count. */
  breakEvenOrderLiftPct: number;
  /** Share of BNPL orders that must be genuinely new, holding the BNPL mix fixed. */
  breakEvenIncrementalSharePct: number;
  /** True when the entered mix already clears the break-even. */
  alreadyPaysForItself: boolean;
  /** True when no volume of incremental orders can help, because margin is below the BNPL rate. */
  marginBelowBnplRate: boolean;
}

export function bnplMonthly(input: BnplMonthlyInput): BnplMonthlyResult {
  const totalOrders = atLeastZero(input.monthlyOrders);
  const cardValue = atLeastZero(input.averageOrderValue);
  const uplift = safe(input.aovUpliftPct) / 100;
  const bnplValue = cardValue * (1 + Math.max(-0.99, uplift));
  const margin = safe(input.grossMarginPct) / 100;

  const share = Math.min(1, Math.max(0, safe(input.bnplSharePct) / 100));
  const incShare = Math.min(1, Math.max(0, safe(input.incrementalSharePct) / 100));

  const bnplOrders = totalOrders * share;
  const incrementalOrders = bnplOrders * incShare;
  const switchedOrders = bnplOrders - incrementalOrders;
  const cardOrders = totalOrders - bnplOrders;
  const baselineOrders = cardOrders + switchedOrders;

  const cardFeeC = feeCents(cardValue, input.cardRatePct, input.cardFixedFee);
  const bnplFeeC = feeCents(bnplValue, input.bnplRatePct, input.bnplFixedFee);
  const cardFee = cardFeeC / 100;
  const bnplFee = bnplFeeC / 100;

  // Contribution one order makes, after the payment fee.
  const cardContribution = cardValue * margin - cardFee;
  const bnplContribution = bnplValue * margin - bnplFee;

  // A switched order swaps one for the other. Without a basket uplift this is
  // exactly the negative of the extra fee, which is the whole cannibalization
  // argument in one line.
  const switchingMarginPerOrder = bnplContribution - cardContribution;

  const revenue = cardOrders * cardValue + (switchedOrders + incrementalOrders) * bnplValue;
  const baselineRevenue = baselineOrders * cardValue;
  const feeBill = cardOrders * cardFee + (switchedOrders + incrementalOrders) * bnplFee;
  const baselineFeeBill = baselineOrders * cardFee;

  const cannibalizationCost = switchedOrders * (bnplFee - cardFee);
  const switchedUpliftMargin = switchedOrders * (bnplValue - cardValue) * margin;
  const incrementalProfit = incrementalOrders * bnplContribution;
  const netMonthlyEffect = switchedOrders * switchingMarginPerOrder + incrementalProfit;

  // Break-even 1: how many NEW orders pay for the switched ones, holding the
  // switched population where it is. Undefined when switching is already
  // profitable (nothing to pay for) or when a new order loses money too.
  const deficit = -(switchedOrders * switchingMarginPerOrder);
  const breakEvenIncrementalOrders =
    deficit > 0 && bnplContribution > 0 ? deficit / bnplContribution : 0;

  // Break-even 2: the incremental SHARE at which the whole BNPL block washes its
  // face, holding the number of BNPL orders fixed. Closed form:
  //   net(s) = B[(1 - s)T1 + s T2] = 0  ->  s* = -T1 / (T2 - T1)
  // With T1 < 0 and T2 > 0 this always lands in (0, 1).
  const t1 = switchingMarginPerOrder;
  const t2 = bnplContribution;
  const breakEvenIncrementalShare = t2 - t1 !== 0 ? -t1 / (t2 - t1) : 0;

  return {
    bnplOrders,
    switchedOrders,
    incrementalOrders,
    cardOrders,
    baselineOrders,
    bnplOrderValue: bnplValue,
    cardFeePerOrder: cardFee,
    bnplFeePerOrder: bnplFee,
    switchingMarginPerOrder,
    incrementalMarginPerOrder: bnplContribution,
    revenue,
    baselineRevenue,
    feeBill,
    baselineFeeBill,
    cannibalizationCost,
    switchedUpliftMargin,
    incrementalProfit,
    netMonthlyEffect,
    netAnnualEffect: netMonthlyEffect * 12,
    blendedEffectiveRatePct: revenue > 0 ? (feeBill / revenue) * 100 : 0,
    baselineEffectiveRatePct: baselineRevenue > 0 ? (baselineFeeBill / baselineRevenue) * 100 : 0,
    breakEvenIncrementalOrders,
    breakEvenOrderLiftPct:
      baselineOrders > 0 ? (breakEvenIncrementalOrders / baselineOrders) * 100 : 0,
    breakEvenIncrementalSharePct: Math.max(0, Math.min(100, breakEvenIncrementalShare * 100)),
    alreadyPaysForItself: netMonthlyEffect >= 0,
    marginBelowBnplRate: margin <= safe(input.bnplRatePct) / 100,
  };
}

// ---------------------------------------------------------------------------
// The other break-even: basket size instead of order count
// ---------------------------------------------------------------------------

export interface RequiredUpliftInput {
  averageOrderValue: number;
  cardRatePct: number;
  cardFixedFee: number;
  bnplRatePct: number;
  bnplFixedFee: number;
  grossMarginPct: number;
}

export interface RequiredUpliftResult {
  /** The basket a switched order has to reach for the swap to be margin neutral. */
  requiredOrderValue: number;
  /** That basket as a percentage lift on the card basket. */
  requiredAovUpliftPct: number;
  /** Extra dollars of basket needed on each switched order. */
  requiredExtraDollars: number;
  /** False when gross margin is at or below the BNPL rate, in which case there is no solution. */
  solvable: boolean;
}

/**
 * "If BNPL brings me no extra orders at all, how much bigger does the basket
 * have to get before the swap stops costing me money?"
 *
 * Set the contribution of a BNPL order at basket x equal to the contribution of
 * a card order at basket A:
 *
 *   x g - (x b + bf)  =  A g - (A c + cf)
 *   x (g - b)         =  A (g - c) - cf + bf
 *   x                 =  [A (g - c) - cf + bf] / (g - b)
 *
 * where g is gross margin, c and cf the card rate and fixed fee, b and bf the
 * BNPL rate and fixed fee.
 *
 * THE SIGN CHECK THAT MATTERS. The denominator is gross margin minus the BNPL
 * rate. When margin is at or below the BNPL rate every extra dollar of basket
 * loses money, so growing the basket cannot fix anything and the equation has no
 * useful root: it returns a negative or an absurd number rather than throwing.
 * A 5 percent net margin retailer offered a 6 percent method is exactly this
 * case, and it is a real one. `solvable` is returned so the page can say "no
 * basket uplift saves this" instead of printing a confident minus sign.
 */
export function requiredAovUplift(input: RequiredUpliftInput): RequiredUpliftResult {
  const value = atLeastZero(input.averageOrderValue);
  const g = safe(input.grossMarginPct) / 100;
  const c = safe(input.cardRatePct) / 100;
  const b = safe(input.bnplRatePct) / 100;
  const cf = atLeastZero(input.cardFixedFee);
  const bf = atLeastZero(input.bnplFixedFee);

  const denominator = g - b;
  if (denominator <= 0 || value <= 0) {
    return {
      requiredOrderValue: 0,
      requiredAovUpliftPct: 0,
      requiredExtraDollars: 0,
      solvable: false,
    };
  }

  const requiredOrderValue = (value * (g - c) - cf + bf) / denominator;
  return {
    requiredOrderValue,
    requiredAovUpliftPct: (requiredOrderValue / value - 1) * 100,
    requiredExtraDollars: requiredOrderValue - value,
    solvable: true,
  };
}

// ---------------------------------------------------------------------------
// Provider comparison
// ---------------------------------------------------------------------------

export interface ProviderQuote {
  id: string;
  name: string;
  ratePct: number;
  fixedFee: number;
}

export interface ProviderComparisonRow extends ProviderQuote {
  fee: number;
  net: number;
  effectiveRatePct: number;
  multipleOfCard: number;
  extraFee: number;
  /** Extra fee across a month at the entered BNPL order count. */
  monthlyExtraFee: number;
}

/**
 * Prices one order across every provider, plus the monthly cost of the same mix.
 *
 * Sorted by fee ascending so the cheapest published option is first. The order
 * is computed, not editorial: nothing here ranks providers on anything but the
 * dollar cost of the basket the merchant typed in.
 */
export function compareProviders(
  orderValue: number,
  cardRatePct: number,
  cardFixedFee: number,
  bnplOrdersPerMonth: number,
  quotes: ProviderQuote[],
): ProviderComparisonRow[] {
  const cardC = feeCents(orderValue, cardRatePct, cardFixedFee);
  const valueC = toCents(atLeastZero(orderValue));
  const orders = atLeastZero(bnplOrdersPerMonth);

  return quotes
    .map((q) => {
      const feeC = feeCents(orderValue, q.ratePct, q.fixedFee);
      return {
        ...q,
        fee: feeC / 100,
        net: (valueC - feeC) / 100,
        effectiveRatePct: valueC > 0 ? (feeC / valueC) * 100 : 0,
        multipleOfCard: cardC > 0 ? feeC / cardC : 0,
        extraFee: (feeC - cardC) / 100,
        monthlyExtraFee: ((feeC - cardC) / 100) * orders,
      };
    })
    .sort((a, b) => a.fee - b.fee);
}
