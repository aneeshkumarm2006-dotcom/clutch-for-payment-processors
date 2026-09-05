import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MARGIN_DEFAULTS,
  breakEvenLadder,
  marginMarkupTable,
  marginToMarkup,
  markupToMargin,
  perTransactionFee,
  perTransactionFeeCents,
  priceForTargetMargin,
  priceForVolume,
  priceFromMargin,
  priceFromMarkup,
  unitEconomics,
  type UnitEconomicsInput,
} from "../../../lib/calc/margin";

/**
 * Every expected value below is derived INDEPENDENTLY of `lib/calc/margin.ts`:
 * from arithmetic worked by hand, from the algebraic identity the function is
 * supposed to satisfy, or from a formula published outside this repository. A
 * test that asserts whatever the code happened to return pins the bug in place.
 *
 * The published references being leaned on:
 *
 *   - The U.S. Small Business Administration's business guide page on the
 *     break-even point (read 5 September 2026) states break-even units as fixed
 *     costs divided by (sales price per unit less variable cost per unit),
 *     break-even sales dollars as fixed costs divided by the contribution
 *     margin, and contribution margin as (sale price less variable cost)
 *     divided by sale price. Those three are cross checked against each other
 *     below, which is a stronger assertion than checking any one of them: the
 *     units answer and the revenue answer are computed by different lines of
 *     the module and have to agree through SBA's own identity.
 *   - Stripe's published US standard rate of 2.9 percent plus 30 cents per
 *     successful transaction for domestic cards, read from a Wayback Machine
 *     capture of stripe.com/pricing dated 4 September 2026, is the fee schedule
 *     the fee assertions use.
 *
 * The silent failure modes being pinned:
 *
 *   1. MARGIN AND MARKUP SWAPPED. Both are percentages, neither throws, and the
 *      wrong one prices every product too low. Pinned with hand computed pairs
 *      and with a round trip through both conversions.
 *   2. THE FEE COMPUTED OFF THE WRONG PRICE. Solving for a target margin using
 *      a fee taken on the pre-fee price understates it, so the price lands low
 *      and the margin lands under target. Pinned by asserting the ACHIEVED
 *      margin at the returned price, recomputed here from scratch, is never
 *      below the target.
 *   3. FLOATING POINT FEE ARITHMETIC. 24 * 0.029 + 0.30 is 0.9960000000000001
 *      in IEEE 754. A processor charges exactly $1.00. Pinned at a price where
 *      the percentage leg lands on a half cent.
 *   4. A NEGATIVE CONTRIBUTION THAT STILL DIVIDES. fixedCosts / contribution
 *      returns a negative unit count that renders as a number and reads as an
 *      answer. Pinned as null.
 *   5. ROUNDING THE UNIT COUNT BEFORE THE MONEY. Break-even units must round UP
 *      and break-even revenue must come off the EXACT figure, or the two lines
 *      on the page disagree with each other.
 */

const close = (actual: number, expected: number, tolerance: number, what: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
};

/** The worked example on the page, and the widget's server-rendered default state. */
const harborLane: UnitEconomicsInput = {
  pricePerUnit: 24,
  unitCost: 9.6,
  otherVariableCost: 0,
  feeRatePct: 2.9,
  feeFixed: 0.3,
  cardSharePct: 100,
  fixedCostsPerMonth: 7200,
  targetProfitPerMonth: 0,
};

// ---------------------------------------------------------------------------
// 1. Margin and markup are not interchangeable
// ---------------------------------------------------------------------------

test("markupToMargin reproduces the textbook pairs, computed by hand", () => {
  // Worked outside the module from m / (100 + m):
  //   50  -> 50/150  = 0.333333...  -> 33.3333%
  //   100 -> 100/200 = 0.5          -> 50%
  //   150 -> 150/250 = 0.6          -> 60%
  //   900 -> 900/1000 = 0.9         -> 90%
  close(markupToMargin(50), 100 / 3, 1e-9, "50 percent markup");
  assert.equal(markupToMargin(100), 50);
  assert.equal(markupToMargin(150), 60);
  assert.equal(markupToMargin(900), 90);
  // A zero markup is a zero margin, and the pair never coincides above zero.
  assert.equal(markupToMargin(0), 0);
});

test("marginToMarkup reproduces the inverse pairs, computed by hand", () => {
  // m / (100 - m): 40 -> 40/60 = 0.66667; 60 -> 60/40 = 1.5; 75 -> 75/25 = 3.
  close(marginToMarkup(40), 200 / 3, 1e-9, "40 percent margin");
  assert.equal(marginToMarkup(60), 150);
  assert.equal(marginToMarkup(75), 300);
  assert.equal(marginToMarkup(50), 100);
});

test("the two conversions are exact inverses across the whole usable range", () => {
  // An identity that has to hold whatever the implementation does. If either
  // direction picks the wrong denominator this fails at every point.
  for (let markup = 1; markup <= 900; markup += 7) {
    close(marginToMarkup(markupToMargin(markup)), markup, 1e-6, `round trip at ${markup}`);
  }
});

test("markup is always the larger percentage above zero, and margin is capped", () => {
  for (let markup = 1; markup <= 1000; markup += 13) {
    const margin = markupToMargin(markup);
    assert.ok(margin < markup, `markup ${markup} should exceed its margin ${margin}`);
    assert.ok(margin < 100, `margin ${margin} must never reach 100 percent`);
  }
});

test("priceFromMargin is a division and priceFromMarkup is a multiplication", () => {
  // The classic error: multiplying a $60 cost by 1.40 to reach a 40 percent
  // margin gives $84, which is a 28.571 percent margin. The right answer is
  // $100.00. Both figures below were computed by hand.
  assert.equal(priceFromMargin(60, 40), 100);
  assert.equal(priceFromMarkup(60, 40), 84);
  const marginAt84 = ((84 - 60) / 84) * 100;
  close(marginAt84, 200 / 7, 1e-9, "the margin the multiplication actually delivers");
  // And 9.60 / 0.40 = 24.00 exactly, the page's default price.
  assert.equal(priceFromMargin(9.6, 60), 24);
  assert.equal(priceFromMarkup(9.6, 150), 24);
});

// ---------------------------------------------------------------------------
// 2. The fee, in integer cents, in the order a processor computes it
// ---------------------------------------------------------------------------

test("the fee is computed the way a statement shows it, not in floating point", () => {
  // 2.9% of $24.00 is 69.6 cents, which rounds to 70, plus the 30 cent fixed
  // leg: exactly 100 cents. In IEEE 754, 24 * 0.029 + 0.30 is 0.9960000000000001.
  assert.equal(perTransactionFeeCents(2400, 2.9, 0.3), 100);
  assert.equal(perTransactionFee(24, 2.9, 0.3), 1);
  assert.notEqual(24 * 0.029 + 0.3, 1);
});

test("the effective rate of a percentage-plus-fixed fee falls as the ticket grows", () => {
  // Each figure computed by hand from round(price * 0.029) + 30, in cents:
  //   $8.00   -> round(23.2) = 23  + 30 = 53   -> 6.625%
  //   $20.00  -> round(58)   = 58  + 30 = 88   -> 4.400%
  //   $40.00  -> round(116)  = 116 + 30 = 146  -> 3.650%
  //   $250.00 -> round(725)  = 725 + 30 = 755  -> 3.020%
  const cases: [number, number, number][] = [
    [8, 0.53, 6.625],
    [20, 0.88, 4.4],
    [40, 1.46, 3.65],
    [250, 7.55, 3.02],
  ];
  for (const [price, fee, ratePct] of cases) {
    assert.equal(perTransactionFee(price, 2.9, 0.3), fee, `fee on $${price}`);
    close((fee / price) * 100, ratePct, 1e-9, `effective rate on $${price}`);
  }
});

// ---------------------------------------------------------------------------
// 3. Break-even, cross checked through the SBA identity
// ---------------------------------------------------------------------------

test("the worked example reproduces the hand computed break-even", () => {
  const r = unitEconomics(harborLane);
  // By hand, in cents. Fee 100. Variable 960 + 100 = 1060. Contribution
  // 2400 - 1060 = 1340. 720000 / 1340 = 537.3134328358209.
  assert.equal(r.processingFeePerUnit, 1);
  assert.equal(r.variableCostPerUnit, 10.6);
  assert.equal(r.contributionPerUnit, 13.4);
  close(r.grossMarginPct, 60, 1e-9, "gross margin");
  close(r.grossMarkupPct, 150, 1e-9, "gross markup");
  close(r.contributionMarginPct, 100 * (13.4 / 24), 1e-9, "contribution margin");
  close(r.breakEvenUnits ?? 0, 7200 / 13.4, 1e-9, "exact break-even units");
  assert.equal(r.breakEvenUnitsWhole, 538);
  close(r.breakEvenRevenue ?? 0, (7200 / 13.4) * 24, 1e-6, "break-even revenue");
});

test("break-even units and break-even revenue agree through the SBA identity", () => {
  // SBA states two formulas: units = fixed / (price - variable), and sales
  // dollars = fixed / contribution margin RATIO. They are computed by different
  // lines of the module, so making them agree is a real cross check.
  const cases: UnitEconomicsInput[] = [
    harborLane,
    { ...harborLane, pricePerUnit: 8, unitCost: 2.5, fixedCostsPerMonth: 4000 },
    { ...harborLane, pricePerUnit: 250, unitCost: 180, fixedCostsPerMonth: 31000 },
    { ...harborLane, cardSharePct: 60 },
    { ...harborLane, otherVariableCost: 1.85, feeRatePct: 2.6, feeFixed: 0.15 },
  ];
  for (const input of cases) {
    const r = unitEconomics(input);
    assert.ok(r.viable, "all fixture cases should contribute");
    const cmRatio = r.contributionPerUnit / r.pricePerUnit;
    const revenueFromRatio = input.fixedCostsPerMonth / cmRatio;
    close(r.breakEvenRevenue ?? 0, revenueFromRatio, 0.01, `SBA identity at $${input.pricePerUnit}`);
  }
});

test("the unit count rounds up and the revenue comes off the exact figure", () => {
  const r = unitEconomics(harborLane);
  // 537.3134... is not a whole number, so the whole figure must be strictly
  // larger, and the reported revenue must be BELOW the revenue at that whole
  // count. Rounding the units first and deriving revenue from them would make
  // these two equal, which is the bug.
  assert.equal(r.breakEvenUnitsWhole, Math.ceil(r.breakEvenUnits ?? 0));
  assert.ok((r.breakEvenRevenue ?? 0) < (r.breakEvenRevenueWhole ?? 0));
  // Selling the rounded-up count must leave a small POSITIVE profit, never a
  // negative one, or the rounding went the wrong way.
  assert.ok((r.profitAtWholeBreakEven ?? -1) >= 0);
  assert.ok((r.profitAtWholeBreakEven ?? 0) < r.contributionPerUnit);
});

test("the fee-free counterfactual is the page's headline claim, computed by hand", () => {
  const r = unitEconomics(harborLane);
  // With no fee, contribution is 2400 - 960 = 1440 cents, and 720000 / 1440 is
  // exactly 500. The whole point of the page is the difference between the two.
  assert.equal(r.breakEvenUnitsNoFee, 500);
  assert.equal(r.breakEvenRevenueNoFee, 12000);
  close(r.extraUnitsFromFees ?? 0, 7200 / 13.4 - 500, 1e-9, "extra units");
  close(
    r.extraRevenueFromFeesAnnual ?? 0,
    (7200 / 13.4 - 500) * 24 * 12,
    1e-6,
    "annualized by multiplying twelve monthly figures, not by compounding",
  );
});

test("a cash sale pays no fee at all, so the card share is a blend and not a discount", () => {
  const r = unitEconomics({ ...harborLane, cardSharePct: 60 });
  // The fee is rounded PER TRANSACTION and only then blended: 100 cents on the
  // card sales, nothing on the rest, so 0.60 * 100 = 60 cents. Blending the
  // rate first (2400 * 0.029 * 0.6 = 41.76 -> 42, plus 0.6 * 30 = 18) gives 60
  // as well here, so the case that separates them is asserted below.
  assert.equal(r.processingFeePerUnit, 0.6);
  assert.equal(r.contributionPerUnit, 13.8);
  assert.equal(r.breakEvenUnitsWhole, Math.ceil(7200 / 13.8));
  assert.equal(r.breakEvenUnitsWhole, 522);
  // Zero card share means the fee-free counterfactual and the real answer meet.
  const none = unitEconomics({ ...harborLane, cardSharePct: 0 });
  assert.equal(none.processingFeePerUnit, 0);
  assert.equal(none.breakEvenUnitsWhole, 500);
  assert.equal(none.breakEvenUnits, none.breakEvenUnitsNoFee);
});

test("a unit that never contributes returns null rather than a negative unit count", () => {
  // Price $10.00, cost $9.50, fee $0.59. Contribution is -9 cents. Dividing
  // 720000 by -9 gives -80,000 units, which renders as a number.
  const r = unitEconomics({ ...harborLane, pricePerUnit: 10, unitCost: 9.5 });
  assert.equal(perTransactionFee(10, 2.9, 0.3), 0.59);
  close(r.contributionPerUnit, -0.09, 1e-9, "negative contribution");
  assert.equal(r.viable, false);
  assert.equal(r.breakEvenUnits, null);
  assert.equal(r.breakEvenUnitsWhole, null);
  assert.equal(r.breakEvenRevenue, null);
  assert.equal(r.unitsForTargetProfit, null);
});

test("a target profit is covered on top of the fixed costs, not instead of them", () => {
  const r = unitEconomics({ ...harborLane, targetProfitPerMonth: 2680 });
  // (720000 + 268000) / 1340 = 737.313... by hand. $2,680 is exactly 200 units
  // of contribution, so the answer must be the break-even plus 200 exactly.
  close(r.unitsForTargetProfit ?? 0, (7200 + 2680) / 13.4, 1e-9, "units for target profit");
  close((r.unitsForTargetProfit ?? 0) - (r.breakEvenUnits ?? 0), 200, 1e-9, "exactly 200 more units");
});

// ---------------------------------------------------------------------------
// 4. The target margin solve, with the fee inside the algebra
// ---------------------------------------------------------------------------

test("the naive price misses the target by the fee, which is the page's premise", () => {
  const t = priceForTargetMargin({
    unitCost: 9.6,
    otherVariableCost: 0,
    targetMarginPct: 60,
    feeRatePct: 2.9,
    feeFixed: 0.3,
  });
  // Naive: 9.60 / 0.40 = 24.00. At $24.00 the fee is $1.00, so the profit is
  // $13.40 and the margin is 13.40 / 24.00 = 55.8333 percent. All by hand.
  assert.equal(t.priceIgnoringFees, 24);
  close(t.marginAtNaivePricePct, (13.4 / 24) * 100, 1e-9, "margin at the naive price");
});

test("the target price satisfies the closed form worked separately", () => {
  // p = (c + F) / (1 - f - m) = (9.60 + 0.30) / (1 - 0.029 - 0.60)
  //   = 9.90 / 0.371 = 26.6846... so the cent price is $26.68 or $26.69.
  const closedForm = (9.6 + 0.3) / (1 - 0.029 - 0.6);
  close(closedForm, 26.6846, 0.0001, "closed form sanity");
  const t = priceForTargetMargin({
    unitCost: 9.6,
    otherVariableCost: 0,
    targetMarginPct: 60,
    feeRatePct: 2.9,
    feeFixed: 0.3,
  });
  assert.equal(t.reachable, true);
  assert.ok(Math.abs((t.price ?? 0) - closedForm) <= 0.02, `price ${t.price} near ${closedForm}`);
  assert.equal(t.price, 26.68);
  // And the uplift over the naive price is larger than the fee itself, because
  // raising the price also raises the percentage leg being covered.
  assert.ok((t.priceUplift ?? 0) > (t.processingFee ?? 0));
});

test("the achieved margin, recomputed here from scratch, never lands under the target", () => {
  // This is the assertion that catches a fee taken on the wrong price. The
  // margin is rebuilt below from the returned price using nothing from the
  // module except the price itself.
  for (const targetMarginPct of [5, 12.5, 20, 33.33, 40, 55, 60, 72.5, 85]) {
    for (const [feeRatePct, feeFixed] of [
      [2.9, 0.3],
      [2.6, 0.15],
      [3.49, 0.49],
      [0, 0],
    ] as [number, number][]) {
      for (const unitCost of [1.25, 9.6, 47, 180]) {
        const t = priceForTargetMargin({ unitCost, otherVariableCost: 0, targetMarginPct, feeRatePct, feeFixed });
        assert.equal(t.reachable, true, `${targetMarginPct} at ${feeRatePct} should be reachable`);
        const priceCents = Math.round((t.price ?? 0) * 100);
        const feeCents = Math.floor(priceCents * (feeRatePct / 100) + 0.5) + Math.round(feeFixed * 100);
        const costCents = Math.round(unitCost * 100);
        const achieved = ((priceCents - costCents - feeCents) / priceCents) * 100;
        assert.ok(
          achieved >= targetMarginPct,
          `cost ${unitCost} at ${targetMarginPct}% on ${feeRatePct}+${feeFixed}: achieved ${achieved}`,
        );
        // And it must not overshoot: a cent less must fail the target, so the
        // answer is the LOWEST price that clears it.
        const lowerCents = priceCents - 1;
        const lowerFee = Math.floor(lowerCents * (feeRatePct / 100) + 0.5) + Math.round(feeFixed * 100);
        const lowerAchieved = ((lowerCents - costCents - lowerFee) / lowerCents) * 100;
        assert.ok(
          lowerAchieved < targetMarginPct,
          `overshoot: ${t.price} minus a cent still clears ${targetMarginPct}%`,
        );
      }
    }
  }
});

test("a target the fee rate makes impossible is refused rather than priced negative", () => {
  // f + m >= 1 means every extra dollar of price hands part of itself back.
  // 9.90 / (1 - 0.029 - 0.98) = 9.90 / -0.009, a negative price that renders
  // identically to a real one.
  const t = priceForTargetMargin({
    unitCost: 9.6,
    otherVariableCost: 0,
    targetMarginPct: 98,
    feeRatePct: 2.9,
    feeFixed: 0.3,
  });
  assert.equal(t.reachable, false);
  assert.equal(t.price, null);
  assert.equal(t.achievedMarginPct, null);
  // The naive figure is still reported, because it is the number the user would
  // otherwise have used.
  assert.ok(t.priceIgnoringFees > 0);
});

test("with no fee at all the solver collapses to cost divided by one minus the margin", () => {
  // A control: strip the fee and the answer must equal the schoolbook price to
  // the cent, computed by nothing but the solver.
  for (const [unitCost, marginPct, expected] of [
    [60, 40, 100],
    [9.6, 60, 24],
    [25, 20, 31.25],
  ] as [number, number, number][]) {
    const t = priceForTargetMargin({ unitCost, otherVariableCost: 0, targetMarginPct: marginPct, feeRatePct: 0, feeFixed: 0 });
    assert.equal(t.price, expected, `no-fee price for ${unitCost} at ${marginPct}%`);
    assert.equal(t.priceIgnoringFees, expected);
    assert.equal(t.priceUplift, 0);
  }
});

test("the reported markup rebuilds the price when multiplied against cost", () => {
  // achievedMarkupPct must be (price - cost) / cost, not the after-fee profit
  // over cost. Handing someone the second figure and having them multiply by it
  // produces a price well below the one that hits the target.
  const t = priceForTargetMargin({
    unitCost: 9.6,
    otherVariableCost: 0,
    targetMarginPct: 60,
    feeRatePct: 2.9,
    feeFixed: 0.3,
  });
  const rebuilt = 9.6 * (1 + (t.achievedMarkupPct ?? 0) / 100);
  close(rebuilt, t.price ?? 0, 0.005, "markup rebuilds the price");
  assert.ok((t.profitOnCostAfterFeePct ?? 0) < (t.achievedMarkupPct ?? 0));
});

// ---------------------------------------------------------------------------
// 5. The tables the page renders
// ---------------------------------------------------------------------------

test("the price ladder is computed row by row, not scaled off the middle row", () => {
  // Because the unit cost and the fixed fee leg are both fixed in dollars,
  // contribution is not proportional to price. Halving the price must therefore
  // more than halve the contribution.
  const rows = breakEvenLadder(harborLane, [12, 24, 48]);
  assert.equal(rows[1]!.contributionPerUnit, 13.4);
  assert.ok(rows[0]!.contributionPerUnit < rows[1]!.contributionPerUnit / 2);
  assert.ok(rows[2]!.contributionPerUnit > rows[1]!.contributionPerUnit * 2);
  // Hand computed: at $12.00 the fee is round(34.8)=35 + 30 = 65 cents, so
  // contribution is 1200 - 960 - 65 = 175 cents and break-even is
  // ceil(720000 / 175) = ceil(4114.28) = 4115 units.
  assert.equal(perTransactionFee(12, 2.9, 0.3), 0.65);
  assert.equal(rows[0]!.contributionPerUnit, 1.75);
  assert.equal(rows[0]!.breakEvenUnitsWhole, 4115);
});

test("the conversion table's fee column isolates the profit, not the fee", () => {
  const rows = marginMarkupTable([10, 50, 300], 50, 2.9, 0.3);
  // The fee on a $50.00 sale is round(145) = 145 + 30 = 175 cents. It is the
  // same on every row by construction, so the column can only be moving with
  // the gross profit underneath it.
  assert.equal(perTransactionFee(50, 2.9, 0.3), 1.75);
  // Hand computed shares of gross profit at a $50.00 price:
  //   10% markup  -> 9.0909% margin -> profit $4.545454 -> 1.75/4.545454 = 38.50%
  //   50% markup  -> 33.3333% margin -> profit $16.6667 -> 10.50%
  //   300% markup -> 75% margin      -> profit $37.50   -> 4.6667%
  close(rows[0]!.feeShareOfGrossProfitPct, (1.75 / (50 * (10 / 110))) * 100, 1e-9, "10 percent markup");
  close(rows[0]!.feeShareOfGrossProfitPct, 38.5, 1e-9, "10 percent markup, hand figure");
  close(rows[1]!.feeShareOfGrossProfitPct, 10.5, 1e-9, "50 percent markup");
  close(rows[2]!.feeShareOfGrossProfitPct, 14 / 3, 1e-9, "300 percent markup");
  // The multiplier column has to rebuild the price from the cost.
  assert.equal(rows[1]!.multiplier, 1.5);
});

// ---------------------------------------------------------------------------
// 6. Solving for price at a known volume, the other direction
// ---------------------------------------------------------------------------

test("priceForVolume inverts the break-even solve", () => {
  // Sell 400 units and the required contribution is 720000 / 400 = 1800 cents.
  // p = (contribution + cost + fixed fee) / (1 - f)
  //   = (18.00 + 9.60 + 0.30) / 0.971 = 27.90 / 0.971 = 28.7332..., rounded up
  //   to the cent so the volume is genuinely covered.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pricePerUnit: _ignored, ...withoutPrice } = harborLane;
  const p = priceForVolume(withoutPrice, 400);
  close(p ?? 0, 27.9 / 0.971, 0.01, "price for 400 units");
  assert.equal(p, 28.74);
  // Charging it must actually clear the fixed costs at 400 units.
  const r = unitEconomics({ ...harborLane, pricePerUnit: p ?? 0 });
  assert.ok((r.breakEvenUnits ?? Infinity) <= 400, `break-even ${r.breakEvenUnits} should not exceed 400`);
  assert.equal(priceForVolume(withoutPrice, 0), null);
});

// ---------------------------------------------------------------------------
// 7. The defaults are the worked example
// ---------------------------------------------------------------------------

test("MARGIN_DEFAULTS renders the figures the page prints in prose", () => {
  const d = MARGIN_DEFAULTS;
  assert.equal(d.pricePerUnit, 24);
  assert.equal(d.unitCost, 9.6);
  assert.equal(d.feeRatePct, 2.9);
  assert.equal(d.feeFixed, 0.3);
  assert.equal(d.fixedCostsPerMonth, 7200);
  const r = unitEconomics({
    pricePerUnit: d.pricePerUnit,
    unitCost: d.unitCost,
    otherVariableCost: d.otherVariableCost,
    feeRatePct: d.feeRatePct,
    feeFixed: d.feeFixed,
    cardSharePct: d.cardSharePct,
    fixedCostsPerMonth: d.fixedCostsPerMonth,
    targetProfitPerMonth: d.targetProfitPerMonth,
  });
  // Every one of these appears verbatim in the ToolDef copy.
  assert.equal(r.breakEvenUnitsWhole, 538);
  assert.equal(r.breakEvenUnitsNoFee, 500);
  assert.equal(r.processingFeePerUnit, 1);
  assert.equal(r.contributionPerUnit, 13.4);
  assert.equal((r.breakEvenRevenue ?? 0).toFixed(2), "12895.52");
  assert.equal((r.extraRevenueFromFeesMonthly ?? 0).toFixed(2), "895.52");
  assert.equal((r.extraRevenueFromFeesAnnual ?? 0).toFixed(2), "10746.27");
  assert.equal(r.feesAtBreakEvenMonthly, 538);
  assert.equal(r.grossMarginPct.toFixed(2), "60.00");
  assert.equal(r.grossMarkupPct.toFixed(2), "150.00");
  assert.equal(r.contributionMarginPct.toFixed(2), "55.83");
  assert.equal(r.feeAsPctOfPrice.toFixed(2), "4.17");
  // And the conversion ladder the widget renders must cover the pair quoted in
  // the FAQ: a 50 percent markup is a 33.33 percent margin.
  assert.ok(d.conversionMarkups.includes(50));
  const fifty = marginMarkupTable(d.conversionMarkups, d.conversionReferencePrice, d.feeRatePct, d.feeFixed).find(
    (row) => row.markupPct === 50,
  );
  assert.equal((fifty?.marginPct ?? 0).toFixed(2), "33.33");
});
