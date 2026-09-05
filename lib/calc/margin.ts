/**
 * Margin, markup, contribution and the break-even solve, with the card
 * processing fee treated as a per unit variable cost.
 *
 * Client safe: no `@/models`, no I/O, no clock. Every output is a pure function
 * of its inputs, so the widget renders identical figures on the server and after
 * hydration.
 *
 * ─── Why this module exists at all ───────────────────────────────────────────
 *
 * Margin and markup arithmetic is three lines long, so a module is only worth
 * writing if it fixes something the three lines get wrong. Two things:
 *
 *   1. MARGIN AND MARKUP ARE DIFFERENT DENOMINATORS AND THE SAME UNITS.
 *      margin = (price - cost) / PRICE. markup = (price - cost) / COST. A 50
 *      percent markup is a 33.333 percent margin. Both are percentages, both are
 *      plausible, neither throws, and a page that swaps them prices every product
 *      it touches too low. Keeping the two conversions in one tested place is the
 *      only defence, because the failure is silent by construction.
 *
 *   2. THE PROCESSING FEE IS A FUNCTION OF PRICE, SO IT IS NOT A CONSTANT.
 *      Every general break-even calculator asks for a "variable cost per unit"
 *      and then divides. A card fee quoted as a percentage plus a fixed amount
 *      cannot be entered that way without first knowing the price, and if the
 *      price is what you are solving for, the fee has to be carried through the
 *      algebra rather than guessed. `priceForTargetMargin` below does exactly
 *      that, in closed form, and then repairs the rounding.
 *
 * ─── The margin denominator, stated once ─────────────────────────────────────
 *
 * Every margin in this module is measured against the PRICE THE CUSTOMER PAYS,
 * not against the amount that lands in the bank after the processor takes its
 * cut. Both conventions exist in the wild and they differ by roughly the fee
 * itself, so the choice has to be explicit or two people using the same page
 * will get different answers.
 *
 * Price is the right denominator because it is the number on the invoice, the
 * number in the accounting system's revenue line, and the number a benchmark
 * like a published sector gross margin is computed against. The fee then appears
 * where it belongs, as a cost, rather than being netted out of revenue where it
 * would quietly flatter the margin.
 *
 * ─── Why the money is integer cents, and where the rounding goes ─────────────
 *
 * A merchant checks this against a statement, so the per transaction fee is
 * computed the way a processor computes it: the percentage leg is rounded to the
 * nearest cent FIRST, then the fixed leg is added. On a $24.00 sale at 2.9
 * percent plus 30 cents that is round(69.6) = 70 cents plus 30 cents, exactly
 * $1.00. Compute it as 24 * 0.029 + 0.30 in floating point and you get
 * 0.9960000000000001, which renders as $1.00 and then fails to reconcile by a
 * cent once it is multiplied by a month of orders.
 *
 * A consequence worth knowing: because the percentage leg is rounded, the
 * contribution per unit is a step function of price, not a smooth one. Two
 * prices a cent apart can produce the same fee. That is why the target price
 * solver verifies its closed form answer instead of trusting it.
 *
 * ─── The silent failure modes this module is shaped around ───────────────────
 *
 *   - A NEGATIVE CONTRIBUTION STILL DIVIDES. If the fee and the unit cost exceed
 *     the price, fixedCosts / contribution returns a NEGATIVE unit count, which
 *     renders as a number and reads as an answer. Every solver here returns null
 *     in that case, and the widget says why.
 *   - THE FEE COMPUTED OFF THE WRONG PRICE. Solving for a target margin by
 *     computing the fee on the pre-fee price understates it, so the price comes
 *     out low and the margin lands under target. The closed form below never
 *     forms an intermediate price.
 *   - ROUNDING THE UNIT COUNT BEFORE THE MONEY. Break-even units are reported
 *     both exactly and rounded UP, because a fraction of a unit does not cover a
 *     fraction of the rent. Revenue is derived from the exact figure, so the
 *     revenue line is the true break-even rather than the revenue at the rounded
 *     unit count. Both are returned so the widget can print each in its place.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Round half UP. `Math.round` agrees on positives; this states the intent. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(safe(dollars) * 100);

const fromCents = (cents: number): number => cents / 100;

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** Percentages arrive as percentages, never as decimals, everywhere in this file. */
const asRate = (pct: number): number => safe(pct) / 100;

// ---------------------------------------------------------------------------
// Margin and markup, the conversion nobody should have to look up twice
// ---------------------------------------------------------------------------

/**
 * Markup to margin. markup / (100 + markup), as a percentage.
 *
 * Derivation, because the one line is worth being able to reproduce: markup m
 * means price = cost x (1 + m). Gross profit is cost x m. Margin is that profit
 * over price, so it is (cost x m) / (cost x (1 + m)), and the cost cancels. The
 * result depends only on the markup, which is why a single conversion table
 * covers every product at every price.
 *
 * Markup is unbounded above; margin is not. A markup of 900 percent is a margin
 * of 90 percent, and no markup, however large, reaches 100 percent margin.
 */
export function markupToMargin(markupPct: number): number {
  const m = safe(markupPct);
  const denominator = 100 + m;
  // A markup of -100 percent means the price is zero, and a margin on a zero
  // price is not defined. Return 0 rather than Infinity so the page renders.
  if (denominator === 0) return 0;
  return (m / denominator) * 100;
}

/**
 * Margin to markup. margin / (100 - margin), as a percentage.
 *
 * The exact inverse of `markupToMargin`. The asymptote at 100 percent margin is
 * real, not a numerical artefact: a 100 percent margin means the cost is zero,
 * and there is no finite multiple of zero that reaches a positive price. Margins
 * at or above 100 are clamped just below so the page prints a very large markup
 * rather than Infinity, which would render as "N/A" and look like a bug in the
 * page rather than a bug in the input.
 */
export function marginToMarkup(marginPct: number): number {
  const m = Math.min(99.999999, safe(marginPct));
  const denominator = 100 - m;
  if (denominator === 0) return 0;
  return (m / denominator) * 100;
}

/** Price from a cost and a markup. price = cost x (1 + markup). */
export function priceFromMarkup(cost: number, markupPct: number): number {
  return fromCents(roundHalfUp(toCents(cost) * (1 + asRate(markupPct))));
}

/**
 * Price from a cost and a target margin. price = cost / (1 - margin).
 *
 * This is the division people replace with a multiplication. Multiplying a $60
 * cost by 1.40 to reach a "40 percent margin" gives $84, which is a 28.6 percent
 * margin. The correct price is $100.
 */
export function priceFromMargin(cost: number, marginPct: number): number {
  const m = Math.min(99.999999, safe(marginPct));
  const denominator = 1 - m / 100;
  if (denominator <= 0) return 0;
  return fromCents(roundHalfUp(toCents(cost) / denominator));
}

export interface MarginMarkupRow {
  markupPct: number;
  marginPct: number;
  /** What the cost is multiplied by to reach the price. */
  multiplier: number;
  /**
   * The share of gross profit a card fee takes at `referencePrice`, as a
   * percentage. This is the column every other conversion table omits, and it is
   * the reason a thin margin and a card terminal are a bad combination.
   */
  feeShareOfGrossProfitPct: number;
}

/**
 * The conversion table, plus what a card fee costs at each margin.
 *
 * The fee column is computed at a single reference price on purpose. At a fixed
 * price the fee is a fixed number of dollars, so the only thing moving down the
 * column is the gross profit it is being taken out of. That isolates the point:
 * the same fee is a rounding error on a 75 percent margin and more than a third
 * of the gross profit on a 9 percent one.
 */
export function marginMarkupTable(
  markupPcts: number[],
  referencePrice: number,
  feeRatePct: number,
  feeFixed: number,
): MarginMarkupRow[] {
  const priceCents = toCents(referencePrice);
  const feeCents = perTransactionFeeCents(priceCents, feeRatePct, feeFixed);

  return markupPcts.map((markupPct) => {
    const marginPct = markupToMargin(markupPct);
    const grossProfitCents = priceCents * (marginPct / 100);
    return {
      markupPct,
      marginPct,
      multiplier: 1 + asRate(markupPct),
      feeShareOfGrossProfitPct: grossProfitCents > 0 ? (feeCents / grossProfitCents) * 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// The processing fee
// ---------------------------------------------------------------------------

/**
 * One card fee, in cents, on a price already expressed in cents.
 *
 * Percentage leg rounded to the cent first, then the fixed leg added. That order
 * is what a processor does and it is what a statement shows. Reversing it, or
 * keeping the percentage leg as a float and rounding only the total, disagrees
 * by a cent on roughly half of all prices.
 */
export function perTransactionFeeCents(priceCents: number, feeRatePct: number, feeFixed: number): number {
  const percentLeg = roundHalfUp(Math.max(0, priceCents) * asRate(feeRatePct));
  return percentLeg + Math.max(0, toCents(feeFixed));
}

/** The same fee in dollars, for callers outside this module. */
export function perTransactionFee(price: number, feeRatePct: number, feeFixed: number): number {
  return fromCents(perTransactionFeeCents(toCents(price), feeRatePct, feeFixed));
}

/**
 * The fee averaged across a month in which only some sales are on a card, in
 * cents.
 *
 * The fee is rounded PER TRANSACTION and only then blended by the card share,
 * because a cash sale pays no fee at all rather than a smaller one. Blending the
 * rate first and rounding once is a different, smaller number.
 */
function blendedFeeCents(
  priceCents: number,
  feeRatePct: number,
  feeFixed: number,
  cardSharePct: number,
): number {
  const share = Math.min(100, Math.max(0, safe(cardSharePct))) / 100;
  return roundHalfUp(perTransactionFeeCents(priceCents, feeRatePct, feeFixed) * share);
}

// ---------------------------------------------------------------------------
// Unit economics and break-even
// ---------------------------------------------------------------------------

export interface UnitEconomicsInput {
  /** What the customer pays for one unit, in dollars. */
  pricePerUnit: number;
  /** Cost of goods for one unit. This is the cost the margin is measured against. */
  unitCost: number;
  /**
   * Any other per unit variable cost that is not cost of goods and not the card
   * fee: pick and pack, outbound shipping you pay for, a per unit royalty. Kept
   * separate from `unitCost` so the gross margin figure still matches the one an
   * accounting system would report.
   */
  otherVariableCost: number;
  /** Percentage leg of the processing fee. */
  feeRatePct: number;
  /** Fixed leg of the processing fee, in dollars per transaction. */
  feeFixed: number;
  /** Share of units paid for by card, 0 to 100. Cash and check sales pay no fee. */
  cardSharePct: number;
  /** Rent, salaries, software, insurance: everything that does not move with volume. */
  fixedCostsPerMonth: number;
  /** Profit wanted on top of covering the fixed costs. Zero gives a pure break-even. */
  targetProfitPerMonth: number;
}

export interface UnitEconomicsResult {
  pricePerUnit: number;
  unitCost: number;
  /** Card fee attributable to one unit, after the card share blend. */
  processingFeePerUnit: number;
  /** The fee on a single card sale, before the blend. Equal to the above at 100 percent card. */
  processingFeePerCardSale: number;
  /** unitCost + otherVariableCost + processingFeePerUnit. */
  variableCostPerUnit: number;
  /** price - variableCostPerUnit. The dollars each unit puts toward fixed costs. */
  contributionPerUnit: number;
  /** contributionPerUnit / price, as a percentage. */
  contributionMarginPct: number;
  /** (price - unitCost) / price. Gross margin, before fees and other variable costs. */
  grossMarginPct: number;
  /** (price - unitCost) / unitCost. The same gross profit expressed as a markup. */
  grossMarkupPct: number;
  /** Gross profit in dollars, price less cost of goods only. */
  grossProfitPerUnit: number;
  /** The processing fee as a percentage of price. On a small ticket this is well above the headline rate. */
  feeAsPctOfPrice: number;
  /** The processing fee as a percentage of gross profit. The number that decides whether it matters. */
  feeShareOfGrossProfitPct: number;
  /** Margin points the fee and the other variable costs take off the gross margin. */
  marginPointsLostToVariableCosts: number;
  /** Margin points the fee alone takes off. */
  marginPointsLostToFees: number;
  /** Exact break-even, fractional units. Null when a unit never contributes. */
  breakEvenUnits: number | null;
  /** The same figure rounded UP, because a fraction of a unit pays no rent. */
  breakEvenUnitsWhole: number | null;
  /** Revenue at the EXACT break-even: fixedCosts / contribution margin ratio. */
  breakEvenRevenue: number | null;
  /** Revenue at the rounded-up unit count, which is slightly above break-even. */
  breakEvenRevenueWhole: number | null;
  /** Profit at the rounded-up unit count. Small and positive, never negative. */
  profitAtWholeBreakEven: number | null;
  /** Exact break-even if the card fee did not exist. The comparison this page is for. */
  breakEvenUnitsNoFee: number | null;
  breakEvenRevenueNoFee: number | null;
  /** Extra units a month the card fee costs, exact. */
  extraUnitsFromFees: number | null;
  /** Those extra units priced out, per month and per year. */
  extraRevenueFromFeesMonthly: number | null;
  extraRevenueFromFeesAnnual: number | null;
  /** Units needed to clear fixed costs AND the target profit. */
  unitsForTargetProfit: number | null;
  unitsForTargetProfitWhole: number | null;
  revenueForTargetProfit: number | null;
  /** Card fees paid in a month at the whole-unit break-even volume. */
  feesAtBreakEvenMonthly: number | null;
  /** False when a unit contributes nothing, which makes every break-even undefined. */
  viable: boolean;
}

/**
 * Everything the break-even screen prints, from one call.
 *
 * The order matters. The fee is computed from the price BEFORE the contribution
 * is formed, and the contribution is formed before anything is divided, so there
 * is never a point in the calculation where a fee is estimated from a price that
 * has not been fixed. That is the whole reason a percentage-plus-fixed fee needs
 * more care than a flat variable cost.
 */
export function unitEconomics(input: UnitEconomicsInput): UnitEconomicsResult {
  const priceCents = Math.max(0, toCents(input.pricePerUnit));
  const costCents = Math.max(0, toCents(input.unitCost));
  const otherCents = Math.max(0, toCents(input.otherVariableCost));
  const fixedCostCents = Math.max(0, toCents(input.fixedCostsPerMonth));
  const targetProfitCents = Math.max(0, toCents(input.targetProfitPerMonth));

  const feePerCardSaleCents = perTransactionFeeCents(priceCents, input.feeRatePct, input.feeFixed);
  const feeCents = blendedFeeCents(priceCents, input.feeRatePct, input.feeFixed, input.cardSharePct);

  const variableCents = costCents + otherCents + feeCents;
  const contributionCents = priceCents - variableCents;
  const grossProfitCents = priceCents - costCents;

  const grossMarginPct = priceCents > 0 ? (grossProfitCents / priceCents) * 100 : 0;
  const grossMarkupPct = costCents > 0 ? (grossProfitCents / costCents) * 100 : 0;
  const contributionMarginPct = priceCents > 0 ? (contributionCents / priceCents) * 100 : 0;

  const viable = contributionCents > 0;

  // Break-even with the fee counted. Everything below this line is null when a
  // unit does not contribute, because a negative unit count is not an answer.
  const breakEvenUnits = viable ? fixedCostCents / contributionCents : null;
  const breakEvenUnitsWhole = breakEvenUnits === null ? null : Math.ceil(breakEvenUnits);

  // Revenue at the exact break-even. Equivalent to fixed costs divided by the
  // contribution margin ratio, which is how a textbook states it; computed from
  // the unit figure so the two lines on the page cannot disagree.
  const breakEvenRevenue = breakEvenUnits === null ? null : fromCents(breakEvenUnits * priceCents);
  const breakEvenRevenueWhole =
    breakEvenUnitsWhole === null ? null : fromCents(breakEvenUnitsWhole * priceCents);
  const profitAtWholeBreakEven =
    breakEvenUnitsWhole === null ? null : fromCents(breakEvenUnitsWhole * contributionCents - fixedCostCents);

  // The counterfactual: the same business with no card fee at all. Not "the same
  // business on a cheaper processor", which would still carry a fee.
  const noFeeContributionCents = priceCents - costCents - otherCents;
  const noFeeViable = noFeeContributionCents > 0;
  const breakEvenUnitsNoFee = noFeeViable ? fixedCostCents / noFeeContributionCents : null;
  const breakEvenRevenueNoFee =
    breakEvenUnitsNoFee === null ? null : fromCents(breakEvenUnitsNoFee * priceCents);

  const extraUnitsFromFees =
    breakEvenUnits === null || breakEvenUnitsNoFee === null ? null : breakEvenUnits - breakEvenUnitsNoFee;
  const extraRevenueFromFeesMonthly =
    extraUnitsFromFees === null ? null : fromCents(extraUnitsFromFees * priceCents);
  const extraRevenueFromFeesAnnual =
    extraRevenueFromFeesMonthly === null ? null : extraRevenueFromFeesMonthly * 12;

  const unitsForTargetProfit = viable ? (fixedCostCents + targetProfitCents) / contributionCents : null;
  const unitsForTargetProfitWhole =
    unitsForTargetProfit === null ? null : Math.ceil(unitsForTargetProfit);
  const revenueForTargetProfit =
    unitsForTargetProfit === null ? null : fromCents(unitsForTargetProfit * priceCents);

  const feesAtBreakEvenMonthly =
    breakEvenUnitsWhole === null ? null : fromCents(roundHalfUp(breakEvenUnitsWhole * feeCents));

  return {
    pricePerUnit: fromCents(priceCents),
    unitCost: fromCents(costCents),
    processingFeePerUnit: fromCents(feeCents),
    processingFeePerCardSale: fromCents(feePerCardSaleCents),
    variableCostPerUnit: fromCents(variableCents),
    contributionPerUnit: fromCents(contributionCents),
    contributionMarginPct,
    grossMarginPct,
    grossMarkupPct,
    grossProfitPerUnit: fromCents(grossProfitCents),
    feeAsPctOfPrice: priceCents > 0 ? (feeCents / priceCents) * 100 : 0,
    feeShareOfGrossProfitPct: grossProfitCents > 0 ? (feeCents / grossProfitCents) * 100 : 0,
    marginPointsLostToVariableCosts: grossMarginPct - contributionMarginPct,
    marginPointsLostToFees: priceCents > 0 ? (feeCents / priceCents) * 100 : 0,
    breakEvenUnits,
    breakEvenUnitsWhole,
    breakEvenRevenue,
    breakEvenRevenueWhole,
    profitAtWholeBreakEven,
    breakEvenUnitsNoFee,
    breakEvenRevenueNoFee,
    extraUnitsFromFees,
    extraRevenueFromFeesMonthly,
    extraRevenueFromFeesAnnual,
    unitsForTargetProfit,
    unitsForTargetProfitWhole,
    revenueForTargetProfit,
    feesAtBreakEvenMonthly,
    viable,
  };
}

export interface BreakEvenLadderRow {
  pricePerUnit: number;
  contributionPerUnit: number;
  contributionMarginPct: number;
  breakEvenUnitsWhole: number | null;
  breakEvenRevenue: number | null;
}

/**
 * The same business at a range of prices.
 *
 * This is the table that answers the question behind the question. Nobody wants
 * a break-even number; they want to know whether to move the price. Because the
 * fee has a fixed leg, the contribution does not move linearly with price, so
 * the rows have to be computed rather than interpolated from the middle one.
 */
export function breakEvenLadder(input: UnitEconomicsInput, prices: number[]): BreakEvenLadderRow[] {
  return prices.map((pricePerUnit) => {
    const r = unitEconomics({ ...input, pricePerUnit });
    return {
      pricePerUnit: r.pricePerUnit,
      contributionPerUnit: r.contributionPerUnit,
      contributionMarginPct: r.contributionMarginPct,
      breakEvenUnitsWhole: r.breakEvenUnitsWhole,
      breakEvenRevenue: r.breakEvenRevenue,
    };
  });
}

// ---------------------------------------------------------------------------
// Pricing to a target margin, with the fee inside the algebra
// ---------------------------------------------------------------------------

export interface TargetPriceInput {
  unitCost: number;
  /** Other per unit variable cost, same meaning as in `UnitEconomicsInput`. */
  otherVariableCost: number;
  /** The margin wanted AFTER the card fee, measured against the price. */
  targetMarginPct: number;
  feeRatePct: number;
  feeFixed: number;
}

export interface TargetPriceResult {
  /** The price to charge. Null when the target is unreachable at any price. */
  price: number | null;
  /** What the naive answer would be: cost / (1 - margin), with no fee in it. */
  priceIgnoringFees: number;
  /** price less priceIgnoringFees. The dollars the fee adds to the sticker. */
  priceUplift: number | null;
  processingFee: number | null;
  profitPerUnit: number | null;
  /** The margin actually achieved at the returned price. At or just above the target. */
  achievedMarginPct: number | null;
  /**
   * The same pricing decision expressed as a markup on cost: (price - cost) /
   * cost, so that price = cost x (1 + markup) holds exactly and the number can
   * be handed to whoever sets prices.
   *
   * Deliberately NOT the after-fee profit over cost. That figure is smaller,
   * looks like a markup, and rebuilds the wrong price when someone multiplies by
   * it. `profitOnCostAfterFeePct` carries it instead, labelled for what it is.
   */
  achievedMarkupPct: number | null;
  /** After-fee profit as a percentage of cost. A yield, not a pricing multiplier. */
  profitOnCostAfterFeePct: number | null;
  /** The margin the naive price would really have delivered once the fee landed. */
  marginAtNaivePricePct: number;
  /**
   * False when the target margin plus the fee rate reaches or exceeds 100
   * percent of price, which no price can satisfy: raising the price raises the
   * percentage fee in lockstep.
   */
  reachable: boolean;
}

/**
 * The price that leaves a given margin AFTER the processor is paid.
 *
 * The algebra, because it is short and it is the part competitors skip. Let p be
 * the price, c the unit cost including any other variable cost, f the percentage
 * fee as a decimal, F the fixed fee, and m the target margin as a decimal. Profit
 * per unit is p - c - (f x p + F). Setting profit / p equal to m:
 *
 *   p - c - f x p - F = m x p
 *   p x (1 - f - m)   = c + F
 *   p                 = (c + F) / (1 - f - m)
 *
 * Two things fall out of that denominator, and both are real.
 *
 * FIRST, the fee rate and the target margin add. A 60 percent target on a 2.9
 * percent card rate divides by 0.371, not by 0.40, so the price is 7.8 percent
 * higher than the naive answer before the 30 cent fixed fee is even counted.
 *
 * SECOND, the target becomes unreachable once f + m reaches 1. There is no price
 * that leaves a 98 percent margin on a card at 2.9 percent, because every dollar
 * added to the price hands 2.9 cents of itself straight back. That case returns
 * `reachable: false` rather than a negative price, which would render as a number
 * and read as an answer.
 *
 * ─── Why the closed form is then repaired ────────────────────────────────────
 *
 * The percentage leg of the fee is rounded to the cent per transaction, so the
 * achieved margin is a step function of the price and the closed form can land a
 * hundredth of a point under target. The solver therefore starts one cent below
 * the closed form and walks UP until the achieved margin clears the target. The
 * walk is bounded, and in practice it takes zero or one step. This is the same
 * discipline the gross-up rounding in `lib/tools-math.ts` uses, for the same
 * reason: rounding your own arithmetic does not make the processor round the
 * same way.
 */
export function priceForTargetMargin(input: TargetPriceInput): TargetPriceResult {
  const costCents = Math.max(0, toCents(input.unitCost)) + Math.max(0, toCents(input.otherVariableCost));
  const fixedFeeCents = Math.max(0, toCents(input.feeFixed));
  const f = Math.max(0, asRate(input.feeRatePct));
  const m = asRate(input.targetMarginPct);

  const naiveDenominator = 1 - m;
  const priceIgnoringFeesCents =
    naiveDenominator > 0 ? roundHalfUp(costCents / naiveDenominator) : 0;
  const marginAtNaivePricePct = marginAfterFeePct(
    priceIgnoringFeesCents,
    costCents,
    input.feeRatePct,
    input.feeFixed,
  );

  const denominator = 1 - f - m;
  if (denominator <= 0) {
    return {
      price: null,
      priceIgnoringFees: fromCents(priceIgnoringFeesCents),
      priceUplift: null,
      processingFee: null,
      profitPerUnit: null,
      achievedMarginPct: null,
      achievedMarkupPct: null,
      profitOnCostAfterFeePct: null,
      marginAtNaivePricePct,
      reachable: false,
    };
  }

  const exactCents = (costCents + fixedFeeCents) / denominator;

  // Start BELOW the floor of the closed form, not at it, and walk up to the
  // first cent price that actually clears the target. That price is the answer,
  // because walking up returns the lowest clearing price at or above the start.
  //
  // How far below has to be derived rather than guessed. The closed form is
  // exact against an UNROUNDED fee; the real fee is rounded to the cent, so it
  // can fall up to half a cent in the merchant's favour. Dropping the price by
  // one cent costs one cent of profit but only reduces the profit the target
  // demands by (1 - f - m) of a cent, so each cent below the closed form opens
  // a deficit of exactly `denominator` cents. Half a cent of rounding luck
  // therefore covers 0.5 / denominator cents of price, and nothing beyond that.
  //
  // This matters most where it is least obvious. At a 60 percent target on a
  // 2.9 percent card rate the denominator is 0.371, so the window is two cents.
  // At an 85 percent target on a 2.6 percent rate it is 0.124, and the window is
  // four. Looking back a single cent, which is what the arithmetic looks like it
  // needs, returns a price a cent high on exactly those thin-denominator cases.
  // Capped at 50 cents so a pathological denominator cannot turn this into a
  // long scan; below that cap the loop bound is never the binding constraint.
  const lookBack = Math.min(50, Math.ceil(0.5 / denominator) + 1);
  let priceCents = Math.max(1, Math.floor(exactCents) - lookBack);
  for (let step = 0; step < lookBack + 200; step += 1) {
    if (marginAfterFeePct(priceCents, costCents, input.feeRatePct, input.feeFixed) >= safe(input.targetMarginPct)) {
      break;
    }
    priceCents += 1;
  }

  const feeCents = perTransactionFeeCents(priceCents, input.feeRatePct, input.feeFixed);
  const profitCents = priceCents - costCents - feeCents;

  return {
    price: fromCents(priceCents),
    priceIgnoringFees: fromCents(priceIgnoringFeesCents),
    priceUplift: fromCents(priceCents - priceIgnoringFeesCents),
    processingFee: fromCents(feeCents),
    profitPerUnit: fromCents(profitCents),
    achievedMarginPct: (profitCents / priceCents) * 100,
    achievedMarkupPct: costCents > 0 ? ((priceCents - costCents) / costCents) * 100 : 0,
    profitOnCostAfterFeePct: costCents > 0 ? (profitCents / costCents) * 100 : 0,
    marginAtNaivePricePct,
    reachable: true,
  };
}

/** Margin after the card fee, in percent, from cent quantities. Internal to the solver. */
function marginAfterFeePct(
  priceCents: number,
  costCents: number,
  feeRatePct: number,
  feeFixed: number,
): number {
  if (priceCents <= 0) return 0;
  const feeCents = perTransactionFeeCents(priceCents, feeRatePct, feeFixed);
  return ((priceCents - costCents - feeCents) / priceCents) * 100;
}

/**
 * The price that breaks even at a volume you already know you can sell.
 *
 * The other direction of the same solve, and the one a merchant with a fixed
 * production run actually has. Required contribution per unit is (fixed costs +
 * target profit) / units, and the price that delivers it inverts the fee the same
 * way the margin solver does:
 *
 *   p x (1 - f) - F - c = contribution
 *   p                   = (contribution + c + F) / (1 - f)
 *
 * Returns null when the fee rate is at or above 100 percent, where no price
 * contributes anything.
 */
export function priceForVolume(
  input: Omit<UnitEconomicsInput, "pricePerUnit">,
  units: number,
): number | null {
  const n = Math.max(0, safe(units));
  if (n <= 0) return null;
  const f = Math.max(0, asRate(input.feeRatePct));
  if (f >= 1) return null;

  const costCents = Math.max(0, toCents(input.unitCost)) + Math.max(0, toCents(input.otherVariableCost));
  const fixedFeeCents = Math.max(0, toCents(input.feeFixed));
  const needCents = (Math.max(0, toCents(input.fixedCostsPerMonth)) + Math.max(0, toCents(input.targetProfitPerMonth))) / n;
  return fromCents(Math.ceil((needCents + costCents + fixedFeeCents) / (1 - f)));
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export interface MarginDefaults {
  pricePerUnit: number;
  unitCost: number;
  otherVariableCost: number;
  feeRatePct: number;
  feeFixed: number;
  cardSharePct: number;
  fixedCostsPerMonth: number;
  targetProfitPerMonth: number;
  targetMarginPct: number;
  /** The markup rungs the conversion table prints. */
  conversionMarkups: number[];
  /** The price the conversion table's fee column is computed at. */
  conversionReferencePrice: number;
}

/**
 * The state the widget renders on the server, so the raw HTML already carries
 * computed dollar figures.
 *
 * The scenario is chosen because its arithmetic is checkable in your head and it
 * makes the point the page exists for. A $24.00 item costing $9.60 is a 60
 * percent margin and a 150 percent markup, two round numbers that are the same
 * fact. Stripe's published US standard rate of 2.9 percent plus 30 cents on that
 * $24.00 sale is exactly $1.00, which is 4.17 percent of the price rather than
 * the 2.9 percent on the poster. And $7,200 of monthly fixed costs breaks even at
 * exactly 500 units with no fee and 538 with it, so the cost of accepting cards
 * is legible as 38 units a month rather than as a percentage nobody feels.
 */
export const MARGIN_DEFAULTS: MarginDefaults = {
  pricePerUnit: 24,
  unitCost: 9.6,
  otherVariableCost: 0,
  feeRatePct: 2.9,
  feeFixed: 0.3,
  cardSharePct: 100,
  fixedCostsPerMonth: 7200,
  targetProfitPerMonth: 0,
  targetMarginPct: 60,
  conversionMarkups: [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300],
  conversionReferencePrice: 50,
};
