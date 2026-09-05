/**
 * Early payment discounts, in both directions.
 *
 * Client safe: no `@/models`, no `server-only`, no I/O, no clock. Every output
 * is a pure function of its inputs, so the widget renders identical figures on
 * the server and after hydration.
 *
 * ─── The two annualizations, and why this module publishes both ─────────────
 *
 * Trade terms are quoted as a discount for paying early: "2/10 net 30" is two
 * percent off if you pay by day 10, otherwise the whole amount by day 30. The
 * question every page about this asks is what it costs to skip the discount, and
 * there are two defensible answers.
 *
 *   NOMINAL, the textbook one:
 *     (d / (1 - d)) x (basis / (netDays - discountDays))
 *
 *   EFFECTIVE, with the periods compounded:
 *     (1 + d / (1 - d)) ^ (basis / (netDays - discountDays)) - 1
 *
 * For 2/10 net 30 on a 365 day year those are 37.24 percent and 44.59 percent.
 * Almost every published calculator prints the first, labels it "APR", and stops.
 * The first is the right number for a ONE-OFF decision funded by simple interest
 * borrowing, and this module proves that below: `breakEvenRatePct` on the buyer
 * result is exactly `nominalAnnualPct`, because setting the discount equal to
 * simple interest on the discounted amount over the credit period solves to that
 * identity. The second is the right number when the same supplier bills you
 * every month and you skip the discount every time, because then the charge
 * genuinely recurs 18.25 times a year.
 *
 * Publishing only one of them is the silent failure. Both are plausible, neither
 * throws, and they are seven points apart on the commonest terms in US B2B.
 *
 * ─── The day count basis is a real fork, not a preference ───────────────────
 *
 * AccountingTools publishes this formula with 360 in the numerator; most finance
 * course material uses 365. On 2/10 net 30 that is 36.73 percent against 37.24
 * percent. Neither is wrong, but a page that does not say which one it used
 * cannot be reconciled against a page that used the other, so `basisDays` is an
 * explicit input and it is printed on the page.
 *
 * ─── The seller side is the same function with a different denominator ──────
 *
 * A seller offering 2/10 does not get paid on day 30 by the customers who
 * decline it. They get paid whenever those customers actually pay, which is the
 * only figure that matters to the decision. So the seller break-even uses the
 * OBSERVED payment day in place of `netDays`, and it is the same
 * `annualizedDiscountCost` call. On terms of 2/10 against customers who really
 * pay at day 45, the break-even cost of capital is 21.28 percent a year, not
 * 37.24, and the difference is entirely the denominator.
 *
 * ─── Two things that cancel, and one that does not ──────────────────────────
 *
 * TAKE-UP CANCELS. The share of customers who accept the discount scales the
 * size of the seller's gain or loss and does NOT change its sign: both the
 * discount given and the cash released are linear in take-up, so it divides out
 * of the break-even entirely. A page that asks "what take-up rate do I need"
 * is asking a question with no answer. `sellerDiscountProgram` returns the
 * break-even RATE instead, which is the quantity that actually decides it.
 *
 * THE RECEIVABLE THAT DISAPPEARS IS THE DISCOUNTED AMOUNT. A customer taking
 * 2/10 on a $10,000 invoice hands over $9,800, not $10,000, so the cash released
 * by the shortened collection cycle must be computed on sales net of the
 * discount. Using gross sales overstates the benefit by roughly the discount
 * rate and does not look wrong on the page.
 *
 * WHAT DOES NOT CANCEL is the card fee in `cardPaymentComparison`. Paying a
 * supplier by card to capture a 2 percent discount at a 2.9 percent card fee is
 * a loss on the fee line alone, and only rewards and float can rescue it. That
 * comparison is arithmetic, not opinion, and it is the reason this module sits
 * on a payments site.
 *
 * ─── Money is integer cents ─────────────────────────────────────────────────
 *
 * Anyone using this page is holding a supplier invoice, so every dollar figure
 * is computed in integer cents and rounded half up. Percentages stay as floats
 * because nobody reconciles a percentage against a statement.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Round half UP. `Math.round` agrees on positives; this states the intent. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const fromCents = (cents: number): number => cents / 100;

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

/**
 * Signed half-up rounding, for the cent figures that can legitimately be
 * negative (a net advantage, a float value when the card settles early).
 * `Math.floor(n + 0.5)` rounds -0.5 to -1 rather than to 0, which would push a
 * result a cent further from zero every time it is negative.
 */
const roundCentsSigned = (n: number): number =>
  n < 0 ? -Math.floor(-n + 0.5) : Math.floor(n + 0.5);

// ---------------------------------------------------------------------------
// The conversion itself
// ---------------------------------------------------------------------------

export interface TradeTermsInput {
  /** The discount, as a percentage. 2 means 2 percent, never 0.02. */
  discountPct: number;
  /** Last day the discount can be taken. */
  discountDays: number;
  /** Day the full amount is due. */
  netDays: number;
}

export interface AnnualizedDiscountCost extends TradeTermsInput {
  /** Days of free credit bought by skipping the discount: netDays minus discountDays. */
  creditPeriodDays: number;
  /** 365 or 360. Printed on the page because published figures differ on it. */
  basisDays: number;
  /** basisDays / creditPeriodDays. Fractional: 2/10 net 30 is 18.25 periods. */
  periodsPerYear: number;
  /** d / (1 - d), as a percentage. The cost of the credit over one period. */
  periodRatePct: number;
  /** periodRate x periodsPerYear. The textbook figure, correct for a one-off. */
  nominalAnnualPct: number;
  /** (1 + periodRate) ^ periodsPerYear - 1. Correct when the terms repeat. */
  effectiveAnnualPct: number;
  /**
   * True when there is nothing to annualize: no discount is offered, or the net
   * day is not after the discount day. Both are real cases (net 30 carries no
   * discount at all) and both make the formula divide by zero or return zero, so
   * they are flagged rather than allowed to render as "0.00%" beside a verdict.
   */
  free: boolean;
}

/**
 * The cost of NOT taking an early payment discount, annualized two ways.
 *
 * The compounded form uses `expm1` and `log1p` rather than `Math.pow(1 + x, n) - 1`.
 * At the small period rates involved (1/10 net 30 is a period rate of 1.0101
 * percent) the naive form ends by subtracting 1 from a number very close to 1
 * and throws away significant digits, which then shows up as the nominal and
 * effective figures failing to agree at the point where they must: as the credit
 * period approaches the whole basis year, the two converge on each other exactly.
 */
export function annualizedDiscountCost(
  terms: TradeTermsInput,
  basisDays = 365,
): AnnualizedDiscountCost {
  const basis = safe(basisDays) > 0 ? safe(basisDays) : 365;
  const discountPct = Math.max(0, Math.min(99.99, safe(terms.discountPct)));
  const discountDays = Math.max(0, safe(terms.discountDays));
  const netDays = Math.max(0, safe(terms.netDays));
  const creditPeriodDays = netDays - discountDays;

  const free = discountPct <= 0 || creditPeriodDays <= 0;
  if (free) {
    return {
      discountPct,
      discountDays,
      netDays,
      creditPeriodDays,
      basisDays: basis,
      periodsPerYear: 0,
      periodRatePct: 0,
      nominalAnnualPct: 0,
      effectiveAnnualPct: 0,
      free: true,
    };
  }

  const d = discountPct / 100;
  // d / (1 - d), not d. The discount is a share of the FACE amount, but the
  // credit is extended on the DISCOUNTED amount: skipping 2 percent off $10,000
  // means paying $200 to keep $9,800 for twenty days, so the denominator is
  // $9,800. Using d flat understates 2/10 net 30 by three quarters of a point.
  const periodRate = d / (1 - d);
  const periodsPerYear = basis / creditPeriodDays;

  return {
    discountPct,
    discountDays,
    netDays,
    creditPeriodDays,
    basisDays: basis,
    periodsPerYear,
    periodRatePct: periodRate * 100,
    nominalAnnualPct: periodRate * periodsPerYear * 100,
    effectiveAnnualPct: Math.expm1(periodsPerYear * Math.log1p(periodRate)) * 100,
    free: false,
  };
}

// ---------------------------------------------------------------------------
// Buyer: should I take it, and should I borrow to take it
// ---------------------------------------------------------------------------

export interface BuyerInput extends TradeTermsInput {
  invoiceAmount: number;
  /** Your own annual borrowing rate, or the return on the cash you would spend. */
  costOfCapitalPct: number;
  basisDays?: number;
}

export interface BuyerResult {
  invoice: number;
  discount: number;
  /** What you hand over on the discount date. */
  amountDueEarly: number;
  /** What you hand over on the net date. */
  amountDueNet: number;
  cost: AnnualizedDiscountCost;
  /** Simple interest on the discounted amount across the credit period. */
  fundingCost: number;
  /** discount minus fundingCost. Positive means take it. */
  netGain: number;
  /**
   * The borrowing rate at which taking the discount exactly breaks even.
   *
   * This is not an approximation of `nominalAnnualPct`, it IS it. Setting
   * I x d = I(1 - d) x r x n / basis and solving for r gives
   * r = (d / (1 - d)) x (basis / n), which is the nominal formula verbatim. The
   * test suite asserts the two agree to floating point, because that identity is
   * the whole justification for publishing the nominal number at all.
   */
  breakEvenRatePct: number;
  worthTaking: boolean;
}

export function earlyPaymentDecision(input: BuyerInput): BuyerResult {
  const cost = annualizedDiscountCost(input, input.basisDays ?? 365);
  const invoiceC = Math.max(0, toCents(safe(input.invoiceAmount)));
  const d = cost.discountPct / 100;

  const discountC = roundHalfUp(invoiceC * d);
  const earlyC = invoiceC - discountC;
  const r = safe(input.costOfCapitalPct) / 100;

  // Simple interest, actual days over the basis year. Not compounded: this is a
  // single draw held for twenty-odd days, and compounding it would overstate the
  // funding cost of the exact decision the page is about.
  const fundingC = roundHalfUp(
    Math.max(0, earlyC * r * (Math.max(0, cost.creditPeriodDays) / cost.basisDays)),
  );
  const netC = discountC - fundingC;

  return {
    invoice: fromCents(invoiceC),
    discount: fromCents(discountC),
    amountDueEarly: fromCents(earlyC),
    amountDueNet: fromCents(invoiceC),
    cost,
    fundingCost: fromCents(fundingC),
    netGain: fromCents(netC),
    breakEvenRatePct: cost.nominalAnnualPct,
    worthTaking: !cost.free && netC > 0,
  };
}

// ---------------------------------------------------------------------------
// Seller: what does offering it actually cost me
// ---------------------------------------------------------------------------

export interface SellerInput {
  /** Annual sales made on credit terms. Cash and card-at-checkout sales are not on terms. */
  annualCreditSales: number;
  discountPct: number;
  discountDays: number;
  /**
   * The day your customers ACTUALLY pay today, not the day your terms say.
   *
   * This is the input the whole seller answer turns on. Quoting net 30 and being
   * paid at day 45 makes the discount buy 35 days of acceleration, not 20, and
   * moves the break-even cost of capital from 37.24 percent to 21.28 percent.
   */
  currentPaymentDays: number;
  /** Share of credit sales expected to take the discount, as a percentage. */
  takeUpPct: number;
  costOfCapitalPct: number;
  basisDays?: number;
}

export interface SellerResult {
  /** Annual dollars of discount handed to customers. */
  discountGiven: number;
  currentDso: number;
  newDso: number;
  dsoReductionDays: number;
  /** One-off cash freed by the shorter cycle, computed on sales NET of the discount. */
  cashReleased: number;
  /** Annual value of that cash at your cost of capital. */
  financingSaved: number;
  /** financingSaved minus discountGiven, per year. Positive means offer it. */
  netAnnual: number;
  /**
   * The cost of capital at which offering the discount exactly breaks even.
   *
   * Take-up divides out of this completely: it multiplies both the discount
   * given and the cash released, so it scales the answer and never flips it.
   */
  breakEvenRatePct: number;
  worthOffering: boolean;
  /** Take-up as a fraction, echoed back so the widget can label the scale. */
  takeUpFraction: number;
}

export function sellerDiscountProgram(input: SellerInput): SellerResult {
  const basis = safe(input.basisDays ?? 365) > 0 ? safe(input.basisDays ?? 365) : 365;
  const salesC = Math.max(0, toCents(safe(input.annualCreditSales)));
  const d = Math.max(0, Math.min(99.99, safe(input.discountPct))) / 100;
  const t = Math.max(0, safe(input.discountDays));
  const d0 = Math.max(0, safe(input.currentPaymentDays));
  const p = Math.max(0, Math.min(100, safe(input.takeUpPct))) / 100;
  const r = safe(input.costOfCapitalPct) / 100;

  const acceleration = Math.max(0, d0 - t);
  const discountGivenC = roundHalfUp(salesC * p * d);
  const newDso = p * t + (1 - p) * d0;
  const dsoReduction = d0 - newDso;

  // Sales net of the discount, because the invoice that clears early clears at
  // the discounted amount. Daily net sales x days of acceleration x take-up.
  const cashReleasedC = roundHalfUp(((salesC * (1 - d)) / basis) * p * acceleration);
  const financingSavedC = roundHalfUp(cashReleasedC * r);
  const netC = financingSavedC - discountGivenC;

  const breakEven = annualizedDiscountCost(
    { discountPct: d * 100, discountDays: t, netDays: d0 },
    basis,
  );

  return {
    discountGiven: fromCents(discountGivenC),
    currentDso: d0,
    newDso,
    dsoReductionDays: dsoReduction,
    cashReleased: fromCents(cashReleasedC),
    financingSaved: fromCents(financingSavedC),
    netAnnual: fromCents(netC),
    breakEvenRatePct: breakEven.nominalAnnualPct,
    worthOffering: !breakEven.free && r * 100 > breakEven.nominalAnnualPct,
    takeUpFraction: p,
  };
}

// ---------------------------------------------------------------------------
// Card: pay the supplier on a card to capture the discount
// ---------------------------------------------------------------------------

export interface CardPayInput extends TradeTermsInput {
  invoiceAmount: number;
  /** The fee charged to put a supplier bill on a card, as a percentage of the payment. */
  cardFeePct: number;
  /** Card rewards or cash back earned on the charge, as a percentage. */
  rewardsPct: number;
  /** Days between the charge landing and the card statement being paid. */
  cardGraceDays: number;
  costOfCapitalPct: number;
  basisDays?: number;
}

export interface CardPayResult {
  /** The discount captured by paying on the discount date. */
  discountSaved: number;
  /** What is actually charged to the card: the discounted invoice. */
  amountCharged: number;
  cardFee: number;
  rewardsEarned: number;
  /** Total leaving the card: charge plus fee. */
  totalOutlay: number;
  /**
   * Days of float gained, which can be negative.
   *
   * Positive when the card statement falls due AFTER the invoice's own net date,
   * which is the case people mean when they say a card buys them time. Negative
   * when the grace period is short enough that the card takes the cash earlier
   * than the supplier would have.
   */
  floatDays: number;
  floatValue: number;
  /** discount minus fee plus rewards plus float. Positive means the card wins. */
  netAdvantage: number;
  /** Rewards rate at which the card route exactly breaks even. */
  breakEvenRewardsPct: number;
  /** Card fee at which the card route exactly breaks even, at the rewards entered. */
  breakEvenCardFeePct: number;
  worthPayingByCard: boolean;
}

/**
 * Paying a supplier bill by card on the discount date, against simply paying
 * cash on the net date.
 *
 * The comparison nobody publishes, and the one this site exists to make: a 2
 * percent discount against a 2.9 percent card fee is a losing trade on the fee
 * line alone, and only the rewards rate and the statement float can rescue it.
 *
 * `breakEvenCardFeePct` is solved rather than approximated. Net advantage is
 * linear in the fee, `net(f) = A + f x B`, because the fee both costs money and
 * enlarges the balance that earns float, so the root is -A / B. Computing the
 * break-even by holding the float constant is wrong by the float on the fee
 * itself, which is small and is exactly the kind of small that nobody catches.
 */
export function cardPaymentComparison(input: CardPayInput): CardPayResult {
  const basis = safe(input.basisDays ?? 365) > 0 ? safe(input.basisDays ?? 365) : 365;
  const invoiceC = Math.max(0, toCents(safe(input.invoiceAmount)));
  const d = Math.max(0, Math.min(99.99, safe(input.discountPct))) / 100;
  const f = Math.max(0, safe(input.cardFeePct)) / 100;
  const w = Math.max(0, safe(input.rewardsPct)) / 100;
  const r = safe(input.costOfCapitalPct) / 100;
  const grace = Math.max(0, safe(input.cardGraceDays));
  const discountDays = Math.max(0, safe(input.discountDays));
  const netDays = Math.max(0, safe(input.netDays));

  const discountC = roundHalfUp(invoiceC * d);
  const chargedC = invoiceC - discountC;
  const feeC = roundHalfUp(chargedC * f);
  const rewardsC = roundHalfUp(chargedC * w);
  const outlayC = chargedC + feeC;

  const floatDays = discountDays + grace - netDays;
  const floatValueC = roundCentsSigned(outlayC * r * (floatDays / basis));

  const netC = discountC - feeC + rewardsC + floatValueC;

  // net(w) is linear in w with slope chargedC, so the break-even rewards rate is
  // the shortfall divided by the amount charged.
  const shortfallC = feeC - discountC - floatValueC;
  const breakEvenRewards = chargedC > 0 ? (shortfallC / chargedC) * 100 : 0;

  // net(f) = A + f x B, with B negative in every realistic case because a dollar
  // of fee costs a dollar and returns only a few days of interest on itself.
  const a = discountC + rewardsC + chargedC * r * (floatDays / basis);
  const b = chargedC * (r * (floatDays / basis) - 1);
  const breakEvenFee = b !== 0 ? (-a / b) * 100 : 0;

  return {
    discountSaved: fromCents(discountC),
    amountCharged: fromCents(chargedC),
    cardFee: fromCents(feeC),
    rewardsEarned: fromCents(rewardsC),
    totalOutlay: fromCents(outlayC),
    floatDays,
    floatValue: fromCents(floatValueC),
    netAdvantage: fromCents(netC),
    breakEvenRewardsPct: breakEvenRewards,
    breakEvenCardFeePct: breakEvenFee,
    worthPayingByCard: netC > 0,
  };
}
