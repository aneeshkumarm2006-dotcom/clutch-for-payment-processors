import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualizedDiscountCost,
  cardPaymentComparison,
  earlyPaymentDecision,
  sellerDiscountProgram,
} from "../../../lib/calc/early-payment";
import {
  TRADE_TERMS,
  TRADE_TERM_DEFAULTS,
  findTradeTerm,
} from "../../../lib/tools-data/trade-terms";

/**
 * Every expected value below was derived on paper from the stated inputs before
 * the implementation was consulted, or lifted from a published worked example.
 * The arithmetic here is small enough that hand derivation is possible, which is
 * exactly why it is worth doing: a test asserting whatever the function happened
 * to return would pin the bug in place rather than catch it.
 *
 * The failure modes being pinned:
 *
 *   1. THE WRONG DENOMINATOR IN THE PERIOD RATE. The discount is a share of the
 *      face amount, but the credit is extended on the discounted amount. d gives
 *      36.50 percent on 2/10 net 30; d / (1 - d) gives 37.24 percent. Both are
 *      plausible, neither throws, and the gap widens with the discount. Asserted
 *      against the correct figure AND against the wrong one, so a regression to
 *      the naive form cannot pass.
 *   2. ANNUALIZING BY MULTIPLYING WHERE THE TERMS RECUR. Nominal multiplies,
 *      effective compounds, and on 3/10 net 30 they are 17.9 points apart. Both
 *      are asserted from separately computed closed forms.
 *   3. THE DAY COUNT BASIS SILENTLY SWITCHING. AccountingTools publishes this
 *      formula on 360 days and works 2/15 net 40 to 29.4 percent. That published
 *      example is asserted verbatim as an external check on the whole formula,
 *      alongside the 365 day answer for the same terms.
 *   4. THE BREAK-EVEN DRIFTING FROM THE NOMINAL RATE. They are the same number
 *      by algebra, not by coincidence, and the page says so in three places. The
 *      identity is asserted directly, and separately confirmed by showing the
 *      net gain crosses zero exactly at that rate.
 *   5. THE SELLER SIDE USING THE NET DATE AS THE DENOMINATOR. The seller gains
 *      days against when customers ACTUALLY pay. Using the quoted net date turns
 *      21.28 percent into 37.24 percent, and nothing about either figure looks
 *      wrong on the page.
 *   6. TAKE-UP APPEARING TO MATTER. It scales both sides of the seller trade, so
 *      it must divide out of the break-even and out of the sign of the answer.
 *      Asserted by running the same scenario at two different take-up rates.
 *   7. THE CARD FEE BEING CHARGED ON THE FACE AMOUNT. The card is charged the
 *      discounted invoice, so the fee is 2.9 percent of $9,800, not of $10,000.
 *      A $2.90 error that nobody would ever notice.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

const T_2_10_30 = { discountPct: 2, discountDays: 10, netDays: 30 };

/**
 * The nominal figures as exact rationals, which is how they were derived.
 * 0.02 / 0.98 is 1/49 exactly, so 2/10 net 30 on a 365 day year is
 * (1/49) x (365/20) = 365/980 = 73/196, and 2/10 against day-45 payers is
 * (1/49) x (365/35) = 73/343. Writing them this way removes the long division
 * this file got wrong on the first pass, and keeps the expected values entirely
 * independent of the module under test.
 */
const NOMINAL_2_10_NET_30 = (73 / 196) * 100; // 37.244897959183675
const SELLER_2_10_DAY_45 = (73 / 343) * 100; // 21.28279883381924

// ---------------------------------------------------------------------------
// The conversion itself
// ---------------------------------------------------------------------------

/**
 * Derived by hand:
 *   period rate = 0.02 / 0.98            = 0.020408163265...
 *   periods     = 365 / 20               = 18.25
 *   nominal     = 0.0204081632653 x 18.25 = 0.3724489795918 -> 37.244898%
 *
 * The effective rate is derived here as an exact rational raised to a power,
 * (50/49) ^ 18.25 - 1, since 1 + 1/49 is 50/49 exactly. That is a genuinely
 * different computation path from the module's expm1(n x log1p(x)) form, so the
 * two agreeing to nine decimal places checks the implementation rather than
 * restating it. It comes to 44.585293%.
 */
test("annualizedDiscountCost: 2/10 net 30 is 37.244898% nominal and 44.5853% compounded", () => {
  const c = annualizedDiscountCost(T_2_10_30, 365);
  close(c.periodRatePct, 2.0408163265, 1e-8, "period rate");
  assert.equal(c.creditPeriodDays, 20);
  close(c.periodsPerYear, 18.25, 1e-12, "periods per year");
  close(c.nominalAnnualPct, NOMINAL_2_10_NET_30, 1e-9, "nominal");
  close(c.effectiveAnnualPct, (Math.pow(50 / 49, 18.25) - 1) * 100, 1e-9, "effective");
  close(c.effectiveAnnualPct, 44.585293, 1e-5, "effective, to the six figures the page quotes");
  close(c.effectiveAnnualPct - c.nominalAnnualPct, 7.3404, 1e-3, "the 7.34 point gap the page quotes");
  assert.equal(c.free, false);
});

/**
 * The naive form, d x periods, gives 0.02 x 18.25 = 0.365 exactly. If the
 * implementation ever loses the (1 - d) denominator this is the value it will
 * return, so it is asserted as an explicit NOT.
 */
test("annualizedDiscountCost: the denominator is (1 - d), so 2/10 net 30 is not 36.50%", () => {
  const c = annualizedDiscountCost(T_2_10_30, 365);
  assert.ok(
    Math.abs(c.nominalAnnualPct - 36.5) > 0.7,
    `nominal must not be the naive d x periods figure of 36.50%, got ${c.nominalAnnualPct}`,
  );
  // And the exact size of the correction, computed separately:
  // 0.3724489795918 - 0.365 = 0.0074489795918
  close(c.nominalAnnualPct - 36.5, 0.7448979592, 1e-8, "correction from dropping (1 - d)");
});

/**
 * External check on the whole formula, from a published worked example.
 * AccountingTools, "Cost of credit formula", read 5 September 2026, works
 * 2/15 net 40 on a 360 day year:
 *   2% / 98% x (360 / 25) = 0.0204 x 14.4 = 29.4%
 * The same terms on 365 days are 0.0204081632653 x 14.6 = 0.2979591836735.
 */
test("annualizedDiscountCost: matches the published AccountingTools example on 2/15 net 40", () => {
  const on360 = annualizedDiscountCost({ discountPct: 2, discountDays: 15, netDays: 40 }, 360);
  close(on360.nominalAnnualPct, 29.4, 0.05, "2/15 net 40 on a 360 day year");

  const on365 = annualizedDiscountCost({ discountPct: 2, discountDays: 15, netDays: 40 }, 365);
  close(on365.nominalAnnualPct, 29.7959183673, 1e-8, "2/15 net 40 on a 365 day year");
});

/**
 * 3/10 net 30, where nominal and effective separate hardest. Derived by hand:
 *   period rate = 0.03 / 0.97             = 0.0309278350515
 *   nominal     = x 18.25                 = 0.5644330 -> 56.44330%
 *   ln(1.0309278350515)                   = 0.0304587250...
 *   x 18.25                               = 0.5558717...
 *   exp - 1                               = 0.7434762 -> 74.34762%
 *   gap                                   = 17.904 points
 */
test("annualizedDiscountCost: 3/10 net 30 is 56.44% nominal against 74.35% compounded", () => {
  const c = annualizedDiscountCost({ discountPct: 3, discountDays: 10, netDays: 30 }, 365);
  close(c.nominalAnnualPct, 56.4432989691, 1e-8, "3/10 nominal");
  close(c.effectiveAnnualPct, (Math.pow(100 / 97, 18.25) - 1) * 100, 1e-9, "3/10 effective");
  close(c.effectiveAnnualPct, 74.3476, 1e-3, "3/10 effective, to the figures the page quotes");
  close(c.effectiveAnnualPct - c.nominalAnnualPct, 17.9043, 1e-3, "the gap the page quotes");
});

/**
 * Window, not size. The same 2 percent over 50 days rather than 20:
 *   0.0204081632653 x (365 / 50 = 7.3) = 0.1489795918367 -> 14.89796%
 * and it must be less than half the 2/10 net 30 figure, because 7.3 is less
 * than half of 18.25.
 */
test("annualizedDiscountCost: 2/10 net 60 is 14.898%, well under half of 2/10 net 30", () => {
  const c = annualizedDiscountCost({ discountPct: 2, discountDays: 10, netDays: 60 }, 365);
  close(c.nominalAnnualPct, 14.8979591837, 1e-8, "2/10 net 60 nominal");
  const short = annualizedDiscountCost(T_2_10_30, 365);
  assert.ok(c.nominalAnnualPct < short.nominalAnnualPct / 2, "longer window must cost less than half");
});

/**
 * A net term has no discount to forgo. The formula would divide by zero on
 * netDays minus discountDays, so this must be flagged rather than rendered as a
 * confident 0.00 percent beside a verdict.
 */
test("annualizedDiscountCost: net 30 is flagged free rather than annualized to zero", () => {
  const c = annualizedDiscountCost({ discountPct: 0, discountDays: 0, netDays: 30 }, 365);
  assert.equal(c.free, true);
  assert.equal(c.nominalAnnualPct, 0);
  assert.equal(c.effectiveAnnualPct, 0);

  // And the degenerate case where the net date is not after the discount date.
  const bad = annualizedDiscountCost({ discountPct: 2, discountDays: 30, netDays: 30 }, 365);
  assert.equal(bad.free, true);
  assert.ok(Number.isFinite(bad.nominalAnnualPct), "must not return Infinity");
});

/**
 * The convergence property. As the credit period approaches the whole basis
 * year, periodsPerYear approaches 1 and the two annualizations must meet
 * exactly. This is what the expm1/log1p form protects; a naive
 * Math.pow(1 + x, n) - 1 drifts here.
 */
test("annualizedDiscountCost: nominal and effective converge when the credit period is a whole year", () => {
  const c = annualizedDiscountCost({ discountPct: 2, discountDays: 0, netDays: 365 }, 365);
  close(c.periodsPerYear, 1, 1e-12, "periods per year");
  close(c.effectiveAnnualPct, c.nominalAnnualPct, 1e-9, "the two must meet at one period");
});

// ---------------------------------------------------------------------------
// Buyer
// ---------------------------------------------------------------------------

/**
 * Coastal Bindery, the page's worked example. Derived by hand:
 *   invoice          $10,000.00
 *   discount   2% of $10,000     = $200.00
 *   paid early                   = $9,800.00
 *   funding    9800 x 0.0675 x 20 / 365
 *              9800 x 0.0675     = 661.50
 *              661.50 x 20 / 365 = 36.2465753... -> $36.25 half up
 *   net gain   200 - 36.25       = $163.75
 */
test("earlyPaymentDecision: $10,000 on 2/10 net 30 funded at 6.75% nets $163.75", () => {
  const r = earlyPaymentDecision({
    ...T_2_10_30,
    invoiceAmount: 10000,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  });
  assert.equal(r.discount, 200);
  assert.equal(r.amountDueEarly, 9800);
  assert.equal(r.amountDueNet, 10000);
  assert.equal(r.fundingCost, 36.25);
  assert.equal(r.netGain, 163.75);
  assert.equal(r.worthTaking, true);
});

/**
 * The identity that justifies publishing the nominal number at all. Setting
 *   I x d = I(1 - d) x r x n / basis
 * and solving for r gives r = (d / (1 - d)) x (basis / n), which is the nominal
 * formula verbatim. Asserted as an identity, then confirmed behaviourally: at a
 * hair under the break-even the trade is positive, at a hair over it is not.
 */
test("earlyPaymentDecision: the break-even borrowing rate IS the nominal annualized cost", () => {
  for (const terms of [
    T_2_10_30,
    { discountPct: 1, discountDays: 10, netDays: 30 },
    { discountPct: 3, discountDays: 10, netDays: 30 },
    { discountPct: 2, discountDays: 10, netDays: 60 },
  ]) {
    const r = earlyPaymentDecision({
      ...terms,
      invoiceAmount: 10000,
      costOfCapitalPct: 6.75,
      basisDays: 365,
    });
    close(r.breakEvenRatePct, r.cost.nominalAnnualPct, 1e-12, `break-even identity on ${terms.discountPct}/${terms.discountDays} net ${terms.netDays}`);
  }

  // Hand-derived break-even for 2/10 net 30 is 73/196, or 37.2448979592%.
  // Straddle it on a
  // large invoice so a cent of rounding cannot decide the sign.
  const below = earlyPaymentDecision({ ...T_2_10_30, invoiceAmount: 1000000, costOfCapitalPct: 37.0, basisDays: 365 });
  const above = earlyPaymentDecision({ ...T_2_10_30, invoiceAmount: 1000000, costOfCapitalPct: 37.5, basisDays: 365 });
  assert.equal(below.worthTaking, true);
  assert.equal(above.worthTaking, false);
});

// ---------------------------------------------------------------------------
// Seller
// ---------------------------------------------------------------------------

/**
 * The page's seller scenario, derived by hand:
 *   sales             $1,200,000, take-up 40%, 2/10, customers pay day 45
 *   discount given    1,200,000 x 0.40 x 0.02          = $9,600.00
 *   new DSO           0.40 x 10 + 0.60 x 45 = 4 + 27   = 31 days
 *   acceleration      45 - 10                          = 35 days
 *   daily net sales   1,200,000 x 0.98 / 365           = 3,221.917808...
 *   cash released     3,221.917808 x 0.40 x 35         = 45,106.8493 -> $45,106.85
 *   financing saved   45,106.85 x 0.0675               = 3,044.71237 -> $3,044.71
 *   net               3,044.71 - 9,600                 = -$6,555.29
 *   break-even        (0.02 / 0.98) x (365 / 35)       = 0.2128279 -> 21.28279%
 */
test("sellerDiscountProgram: 2/10 against day-45 payers loses $6,555.29 a year on $1.2m", () => {
  const r = sellerDiscountProgram({
    annualCreditSales: 1200000,
    discountPct: 2,
    discountDays: 10,
    currentPaymentDays: 45,
    takeUpPct: 40,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  });
  assert.equal(r.discountGiven, 9600);
  close(r.newDso, 31, 1e-12, "new DSO");
  close(r.dsoReductionDays, 14, 1e-12, "DSO reduction");
  assert.equal(r.cashReleased, 45106.85);
  assert.equal(r.financingSaved, 3044.71);
  assert.equal(r.netAnnual, -6555.29);
  close(r.breakEvenRatePct, SELLER_2_10_DAY_45, 1e-9, "seller break-even");
  assert.equal(r.worthOffering, false);
});

/**
 * The denominator is the day customers ACTUALLY pay. Quote the same 2/10 to
 * customers who already pay on day 30 and the break-even is the buyer's own
 * 37.2448979592 percent; against day-45 payers it is 21.2827868852 percent.
 * A seller-side page that uses the quoted net date reports the first for both.
 */
test("sellerDiscountProgram: the break-even follows observed payment days, not the quoted term", () => {
  const base = {
    annualCreditSales: 1200000,
    discountPct: 2,
    discountDays: 10,
    takeUpPct: 40,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  };
  const punctual = sellerDiscountProgram({ ...base, currentPaymentDays: 30 });
  const late = sellerDiscountProgram({ ...base, currentPaymentDays: 45 });
  close(punctual.breakEvenRatePct, NOMINAL_2_10_NET_30, 1e-9, "day-30 payers");
  close(late.breakEvenRatePct, SELLER_2_10_DAY_45, 1e-9, "day-45 payers");
  assert.ok(late.breakEvenRatePct < punctual.breakEvenRatePct, "later payers make the discount cheaper to offer");
});

/**
 * Take-up scales both the discount handed over and the cash released by the
 * same factor, so it must divide out of the break-even entirely and must never
 * flip the sign. Doubling it must exactly double the loss.
 */
test("sellerDiscountProgram: take-up scales the answer and cannot change its sign", () => {
  const base = {
    annualCreditSales: 1200000,
    discountPct: 2,
    discountDays: 10,
    currentPaymentDays: 45,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  };
  const low = sellerDiscountProgram({ ...base, takeUpPct: 20 });
  const high = sellerDiscountProgram({ ...base, takeUpPct: 40 });
  close(low.breakEvenRatePct, high.breakEvenRatePct, 1e-12, "break-even is independent of take-up");
  close(high.netAnnual, low.netAnnual * 2, 0.02, "double the take-up, double the loss");
  assert.equal(low.worthOffering, high.worthOffering);
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

/**
 * The card route, derived by hand at Melio's published 2.9 percent US card fee
 * (melio.com/pricing, read 5 September 2026):
 *   discount captured  2% of 10,000                = $200.00
 *   charged to card                                = $9,800.00
 *   fee   2.9% of 9,800                            = $284.20
 *   rewards 1.5% of 9,800                          = $147.00
 *   float days  10 + 25 - 30                       = 5
 *   outlay      9,800 + 284.20                     = $10,084.20
 *   float value 10,084.20 x 0.0675 x 5 / 365
 *               10,084.20 x 0.0675 = 680.6835
 *               680.6835 x 5 / 365 = 9.32443...    -> $9.32
 *   net         200 - 284.20 + 147.00 + 9.32       = $72.12
 */
test("cardPaymentComparison: 2.9% fee, 1.5% rewards, 25 day grace nets $72.12 on a $10,000 invoice", () => {
  const r = cardPaymentComparison({
    ...T_2_10_30,
    invoiceAmount: 10000,
    cardFeePct: 2.9,
    rewardsPct: 1.5,
    cardGraceDays: 25,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  });
  assert.equal(r.discountSaved, 200);
  assert.equal(r.amountCharged, 9800);
  assert.equal(r.cardFee, 284.2);
  assert.equal(r.rewardsEarned, 147);
  assert.equal(r.floatDays, 5);
  assert.equal(r.totalOutlay, 10084.2);
  assert.equal(r.floatValue, 9.32);
  assert.equal(r.netAdvantage, 72.12);
  assert.equal(r.worthPayingByCard, true);
});

/**
 * The fee is charged on the DISCOUNTED amount, not the face amount. 2.9 percent
 * of $10,000 is $290.00 and of $9,800 is $284.20: a $5.80 error that looks
 * entirely reasonable on the page.
 *
 * Strip the rewards out and the same trade is $74.88 behind:
 *   200 - 284.20 + 0 + float, where the float on 9,800 + 284.20 is unchanged at
 *   $9.32, giving -74.88.
 */
test("cardPaymentComparison: the fee is charged on the discounted amount, and rewards are what rescue it", () => {
  const r = cardPaymentComparison({
    ...T_2_10_30,
    invoiceAmount: 10000,
    cardFeePct: 2.9,
    rewardsPct: 0,
    cardGraceDays: 25,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  });
  assert.equal(r.cardFee, 284.2);
  assert.notEqual(r.cardFee, 290);
  assert.equal(r.netAdvantage, -74.88);
  assert.equal(r.worthPayingByCard, false);
});

/**
 * Both break-evens, solved independently.
 *
 * Rewards: the shortfall without rewards is 284.20 - 200 - 9.32 = 74.88, spread
 * over the $9,800 charged, so 74.88 / 9800 = 0.00764081... -> 0.764081%.
 *
 * Fee: net(f) = A + f x B is linear, because a dollar of fee both costs a dollar
 * and enlarges the balance earning float.
 *   A = 200 + 147 + 9,800 x 0.0675 x 5 / 365 = 200 + 147 + 9.0616438 = 356.0616438
 *   B = 9,800 x (0.0675 x 5 / 365 - 1) = 9,800 x (0.000924658 - 1) = -9,790.9383562
 *   root = -A / B, which lands between 3.63 and 3.64 percent.
 * Holding the float constant instead would give 356.0616438 / 9,800 = 3.63328%,
 * which is wrong by a third of a basis point and is exactly the kind of small
 * error nobody catches.
 *
 * Rather than trust a long division here (an earlier draft of this file got it
 * wrong in the sixth decimal place), the fee root is confirmed by bisecting the
 * FORWARD calculation, which uses none of the closed-form algebra above. If the
 * solver and the forward function disagree, one of them is wrong and this fails.
 */
test("cardPaymentComparison: both break-evens match separately solved closed forms", () => {
  const scenario = {
    ...T_2_10_30,
    invoiceAmount: 10000,
    cardFeePct: 2.9,
    rewardsPct: 1.5,
    cardGraceDays: 25,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  };
  const r = cardPaymentComparison(scenario);
  close(r.breakEvenRewardsPct, 0.7640816327, 1e-6, "break-even rewards rate");

  // Bisection on netAdvantage, to 1e-9 of a percentage point. Net advantage
  // falls as the fee rises, so the root is bracketed by [0%, 10%].
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    // Use a large invoice so cent rounding cannot blur the crossing point.
    const net = cardPaymentComparison({ ...scenario, invoiceAmount: 100000000, cardFeePct: mid }).netAdvantage;
    if (net > 0) lo = mid;
    else hi = mid;
  }
  const bisected = (lo + hi) / 2;
  close(r.breakEvenCardFeePct, bisected, 1e-6, "break-even card fee against a bisected root");
  // And it is where the page says it is, to the two decimals the page prints.
  close(r.breakEvenCardFeePct, 3.64, 0.005, "the 3.64% the page quotes");

  // The root really is a root: at that fee the trade must be flat.
  const atRoot = cardPaymentComparison({ ...scenario, cardFeePct: r.breakEvenCardFeePct });
  close(atRoot.netAdvantage, 0, 0.02, "net advantage at the break-even fee");
});

/**
 * Negative float is a real case, not a guard to clamp away: a 15 day grace on a
 * day 10 charge takes the cash on day 25, five days BEFORE the day 30 the
 * supplier would have been paid. Signed rounding must not push it further from
 * zero.
 *   float days  10 + 15 - 30 = -5
 *   float value 10,084.20 x 0.0675 x (-5) / 365 = -9.32443... -> -$9.32
 */
test("cardPaymentComparison: a short grace period produces negative float, rounded toward zero", () => {
  const r = cardPaymentComparison({
    ...T_2_10_30,
    invoiceAmount: 10000,
    cardFeePct: 2.9,
    rewardsPct: 1.5,
    cardGraceDays: 15,
    costOfCapitalPct: 6.75,
    basisDays: 365,
  });
  assert.equal(r.floatDays, -5);
  assert.equal(r.floatValue, -9.32);
  assert.equal(r.netAdvantage, 53.48); // 200 - 284.20 + 147.00 - 9.32
});

// ---------------------------------------------------------------------------
// The data module
// ---------------------------------------------------------------------------

test("TRADE_TERMS: every row carries a source and a plausible term structure", () => {
  assert.ok(TRADE_TERMS.length >= 7, "the seven quoted terms the page promises");
  const ids = new Set<string>();
  for (const t of TRADE_TERMS) {
    assert.ok(t.source.length > 40, `${t.id} needs a real source string`);
    assert.ok(!ids.has(t.id), `${t.id} is duplicated`);
    ids.add(t.id);
    assert.ok(t.label.length > 0 && t.arithmetic.length > 20 && t.note.length > 20, `${t.id} copy`);
    assert.ok(t.netDays > 0 && t.netDays <= 120, `${t.id} net days out of range`);
    assert.ok(t.discountPct >= 0 && t.discountPct <= 10, `${t.id} discount out of range`);
    assert.ok(t.discountDays >= 0 && t.discountDays < t.netDays, `${t.id} discount day must precede the net day`);
    assert.equal(t.creditPeriodDays, t.discountPct > 0 ? t.netDays - t.discountDays : 0, `${t.id} credit period`);
    if (t.discountPct === 0) {
      assert.equal(t.nominalAnnualPct, 0);
      assert.equal(t.effectiveAnnualPct, 0);
    } else {
      assert.ok(t.effectiveAnnualPct > t.nominalAnnualPct, `${t.id}: compounding must exceed multiplying`);
      assert.ok(t.nominalAnnualPct > t.nominalAnnual360Pct, `${t.id}: a 365 day year annualizes higher than a 360 day one`);
      assert.ok(t.nominalAnnualPct > 0 && t.nominalAnnualPct < 200, `${t.id} nominal out of range`);
    }
  }
});

/**
 * The precomputed columns in the data module are what the page prose and the
 * rate table quote. They must agree with the calculator sitting three inches
 * away on the same page, to the two decimal places both are printed at.
 */
test("TRADE_TERMS: the precomputed columns agree with lib/calc/early-payment", () => {
  for (const t of TRADE_TERMS) {
    const on365 = annualizedDiscountCost(t, 365);
    const on360 = annualizedDiscountCost(t, 360);
    close(t.nominalAnnualPct, on365.nominalAnnualPct, 5e-4, `${t.id} nominal 365`);
    close(t.effectiveAnnualPct, on365.effectiveAnnualPct, 5e-4, `${t.id} effective 365`);
    close(t.nominalAnnual360Pct, on360.nominalAnnualPct, 5e-4, `${t.id} nominal 360`);
    close(t.periodRatePct, on365.periodRatePct, 5e-4, `${t.id} period rate`);
  }
});

/**
 * Hand-derived spot values for the four rows the page prints in its rate table,
 * asserted against the stored figures rather than against the calculator, so a
 * shared bug in both could not hide here.
 *   2/10 net 30  37.2449 / 44.5853 / 36.7347
 *   1/10 net 30  0.01/0.99 = 0.0101010101 x 18.25 = 0.1843434 -> 18.4343
 *                effective exp(18.25 x ln(1.0101010101)) - 1  -> 20.1312
 *                360: 0.0101010101 x 18 = 0.1818182 -> 18.1818
 *   2/10 net 60  14.8980 / 15.8911 / 14.6939
 *   3/10 net 30  56.4433 / 74.3476 / 55.6701
 */
test("TRADE_TERMS: the four discount rows match values derived by hand", () => {
  const expected: Record<string, [number, number, number]> = {
    "2-10-net-30": [37.2449, 44.5853, 36.7347],
    "1-10-net-30": [18.4343, 20.1312, 18.1818],
    "2-10-net-60": [14.898, 15.8911, 14.6939],
    "3-10-net-30": [56.4433, 74.3476, 55.6701],
  };
  for (const [id, [nominal, effective, nominal360]] of Object.entries(expected)) {
    const t = findTradeTerm(id);
    assert.ok(t, `${id} must exist`);
    close(t.nominalAnnualPct, nominal, 5e-4, `${id} nominal`);
    close(t.effectiveAnnualPct, effective, 5e-4, `${id} effective`);
    close(t.nominalAnnual360Pct, nominal360, 5e-4, `${id} nominal 360`);
  }
});

test("TRADE_TERM_DEFAULTS: the widget opens on real, sourced, in-range values", () => {
  const d = TRADE_TERM_DEFAULTS;
  assert.ok(findTradeTerm(d.termId), "the default term must be a row in TRADE_TERMS");
  assert.equal(d.basisDays, 365);
  // Bank prime loan rate, Federal Reserve H.15 release of 4 September 2026.
  assert.equal(d.costOfCapitalPct, 6.75);
  // Melio's published US fee to pay a business bill by card, read 5 Sept 2026.
  assert.equal(d.cardFeePct, 2.9);
  assert.ok(d.invoiceAmount > 0 && d.annualCreditSales > 0, "no empty default state");
  assert.ok(d.currentPaymentDays > d.discountDays, "customers must pay after the discount window");
  assert.ok(d.takeUpPct > 0 && d.takeUpPct <= 100, "take-up is a percentage");
  assert.ok(d.rewardsPct >= 0 && d.rewardsPct < 5, "rewards rate in a plausible range");
  assert.ok(d.cardGraceDays > 0 && d.cardGraceDays <= 60, "grace period in a plausible range");
});

/**
 * The defaults must render the exact figures the page copy quotes, because the
 * worked example is server-rendered prose sitting above a widget that computes
 * the same scenario. A hand-written number disagreeing with the widget on the
 * same page is the defect this whole file exists to prevent.
 */
test("TRADE_TERM_DEFAULTS: the default state reproduces the page's worked example exactly", () => {
  const d = TRADE_TERM_DEFAULTS;
  const term = findTradeTerm(d.termId);
  assert.ok(term);
  const terms = { discountPct: term.discountPct, discountDays: term.discountDays, netDays: term.netDays };

  const buyer = earlyPaymentDecision({
    ...terms,
    invoiceAmount: d.invoiceAmount,
    costOfCapitalPct: d.costOfCapitalPct,
    basisDays: d.basisDays,
  });
  assert.equal(buyer.discount, 200);
  assert.equal(buyer.fundingCost, 36.25);
  assert.equal(buyer.netGain, 163.75);

  const seller = sellerDiscountProgram({
    annualCreditSales: d.annualCreditSales,
    discountPct: terms.discountPct,
    discountDays: terms.discountDays,
    currentPaymentDays: d.currentPaymentDays,
    takeUpPct: d.takeUpPct,
    costOfCapitalPct: d.costOfCapitalPct,
    basisDays: d.basisDays,
  });
  assert.equal(seller.discountGiven, 9600);
  assert.equal(seller.cashReleased, 45106.85);
  assert.equal(seller.financingSaved, 3044.71);
  assert.equal(seller.netAnnual, -6555.29);

  const card = cardPaymentComparison({
    ...terms,
    invoiceAmount: d.invoiceAmount,
    cardFeePct: d.cardFeePct,
    rewardsPct: d.rewardsPct,
    cardGraceDays: d.cardGraceDays,
    costOfCapitalPct: d.costOfCapitalPct,
    basisDays: d.basisDays,
  });
  assert.equal(card.cardFee, 284.2);
  assert.equal(card.rewardsEarned, 147);
  assert.equal(card.floatValue, 9.32);
  assert.equal(card.netAdvantage, 72.12);
});
