"use client";

import * as React from "react";
import {
  MARGIN_DEFAULTS,
  breakEvenLadder,
  marginMarkupTable,
  marginToMarkup,
  markupToMargin,
  perTransactionFee,
  priceForTargetMargin,
  unitEconomics,
} from "@/lib/calc/margin";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ModeTabs,
  Pill,
  ResultRow,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Break-even, margin against markup, and the price that hits a target margin.
 *
 * The gap this exploits: every general margin and break-even calculator on the
 * first page treats variable cost per unit as a number you already know. For a
 * business that takes cards, part of that cost is a percentage of the price plus
 * a fixed amount per transaction, which means it is not knowable until the price
 * is fixed and it cannot be entered as a constant at all when the price is what
 * you are solving for. This widget carries the fee through every solve, and
 * prints the fee-free answer beside it so the difference is visible rather than
 * asserted.
 *
 * NO VERDICT BAND HERE, deliberately. `Verdict` scores a merchant's blended
 * monthly effective processing rate against the pricing-model bands. What this
 * page computes is the fee on one ticket, which is dominated by the fixed leg
 * and would be scored as if it were a bad deal on a $9 sale and a good one on a
 * $900 sale. That mislabelling already shipped once on the brand calculators and
 * was removed; do not add it back here.
 *
 * Narrow imports only: `@/lib/calc/margin`, never `@/lib/tools`, never the
 * `@/lib/tools-data` barrel. One route serves every calculator, so anything
 * imported here ships to all of them.
 */
export function BreakEvenMarginCalculator() {
  const [mode, setMode] = React.useState<"breakeven" | "convert" | "price">("breakeven");

  const d = MARGIN_DEFAULTS;

  // Shared across the break-even and target-price screens.
  const [price, setPrice] = React.useState(String(d.pricePerUnit));
  const [cost, setCost] = React.useState(String(d.unitCost));
  const [otherVariable, setOtherVariable] = React.useState(String(d.otherVariableCost));
  const [feeRate, setFeeRate] = React.useState(String(d.feeRatePct));
  const [feeFixed, setFeeFixed] = React.useState(String(d.feeFixed));
  const [cardShare, setCardShare] = React.useState(String(d.cardSharePct));
  const [fixedCosts, setFixedCosts] = React.useState(String(d.fixedCostsPerMonth));
  const [targetProfit, setTargetProfit] = React.useState(String(d.targetProfitPerMonth));
  const [targetMargin, setTargetMargin] = React.useState(String(d.targetMarginPct));

  // Two one-way converters. Deliberately not bound to each other: a pair of
  // fields that each rewrite the other fights the user mid-keystroke and rounds
  // the value they typed.
  const [markupIn, setMarkupIn] = React.useState("50");
  const [marginIn, setMarginIn] = React.useState("40");

  const inputs = {
    pricePerUnit: num(price),
    unitCost: num(cost),
    otherVariableCost: num(otherVariable),
    feeRatePct: num(feeRate),
    feeFixed: num(feeFixed),
    cardSharePct: num(cardShare),
    fixedCostsPerMonth: num(fixedCosts),
    targetProfitPerMonth: num(targetProfit),
  };

  const unit = unitEconomics(inputs);

  const ladderPrices = [0.8, 0.9, 1, 1.1, 1.2].map(
    (multiple) => Math.round(inputs.pricePerUnit * multiple * 100) / 100,
  );
  const ladder = breakEvenLadder(inputs, ladderPrices);

  const target = priceForTargetMargin({
    unitCost: inputs.unitCost,
    otherVariableCost: inputs.otherVariableCost,
    targetMarginPct: num(targetMargin),
    feeRatePct: inputs.feeRatePct,
    feeFixed: inputs.feeFixed,
  });

  const conversion = marginMarkupTable(
    d.conversionMarkups,
    d.conversionReferencePrice,
    inputs.feeRatePct,
    inputs.feeFixed,
  );

  const referenceFee = perTransactionFee(d.conversionReferencePrice, inputs.feeRatePct, inputs.feeFixed);
  const wantsProfit = inputs.targetProfitPerMonth > 0;

  const feeFields = (
    <FieldGrid>
      <Field
        id="bem-feerate"
        label="Processing rate"
        suffix="%"
        value={feeRate}
        onChange={setFeeRate}
        hint="The percentage leg. Stripe's published US standard rate is 2.9%."
      />
      <Field
        id="bem-feefixed"
        label="Fixed fee per transaction"
        prefix="$"
        value={feeFixed}
        onChange={setFeeFixed}
        hint="The per-sale leg, 30 cents on that same schedule."
      />
    </FieldGrid>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "breakeven" | "convert" | "price")}
            options={[
              { value: "breakeven", label: "Break even" },
              { value: "convert", label: "Margin vs markup" },
              { value: "price", label: "Price for a margin" },
            ]}
          />

          {mode === "breakeven" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="bem-price"
                  label="Selling price per unit"
                  prefix="$"
                  value={price}
                  onChange={setPrice}
                  hint="What the customer pays, before any fee comes out."
                />
                <Field
                  id="bem-cost"
                  label="Unit cost"
                  prefix="$"
                  value={cost}
                  onChange={setCost}
                  hint="Cost of goods for one unit. This is what the margin is measured against."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="bem-othervar"
                  label="Other variable cost per unit"
                  prefix="$"
                  value={otherVariable}
                  onChange={setOtherVariable}
                  hint="Pick, pack, outbound shipping you pay for. Leave at zero if it already sits inside your unit cost."
                />
                <Field
                  id="bem-cardshare"
                  label="Sales paid by card"
                  suffix="%"
                  value={cardShare}
                  onChange={setCardShare}
                  hint="A cash sale pays no processing fee at all, so this is a blend, not a discount."
                />
              </FieldGrid>
              {feeFields}
              <FieldGrid>
                <Field
                  id="bem-fixedcosts"
                  label="Fixed costs a month"
                  prefix="$"
                  value={fixedCosts}
                  onChange={setFixedCosts}
                  hint="Rent, salaries, software, insurance: whatever does not move with volume."
                />
                <Field
                  id="bem-targetprofit"
                  label="Profit wanted a month"
                  prefix="$"
                  value={targetProfit}
                  onChange={setTargetProfit}
                  hint="Leave at zero for a pure break-even."
                />
              </FieldGrid>
            </div>
          )}

          {mode === "convert" && (
            <div className="space-y-5">
              <FieldGrid>
                <Field id="bem-cvcost" label="Unit cost" prefix="$" value={cost} onChange={setCost} />
                <Field id="bem-cvprice" label="Selling price" prefix="$" value={price} onChange={setPrice} />
              </FieldGrid>
              {feeFields}
              <div className="rounded border border-border-strong bg-muted px-4 py-4">
                <p className="text-label uppercase text-muted-foreground">
                  Convert one number without a price
                </p>
                <div className="mt-3 space-y-4">
                  <Field
                    id="bem-markupin"
                    label="A markup of"
                    suffix="%"
                    value={markupIn}
                    onChange={setMarkupIn}
                    hint={`is a margin of ${pct(markupToMargin(num(markupIn)))}, so the price is ${(1 + num(markupIn) / 100).toFixed(3)} times the cost.`}
                  />
                  <Field
                    id="bem-marginin"
                    label="A margin of"
                    suffix="%"
                    value={marginIn}
                    onChange={setMarginIn}
                    hint={`needs a markup of ${pct(marginToMarkup(num(marginIn)))}, so the price is ${(1 + marginToMarkup(num(marginIn)) / 100).toFixed(3)} times the cost.`}
                  />
                </div>
              </div>
            </div>
          )}

          {mode === "price" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="bem-tpcost"
                  label="Unit cost"
                  prefix="$"
                  value={cost}
                  onChange={setCost}
                  hint="Cost of goods for one unit."
                />
                <Field
                  id="bem-tpother"
                  label="Other variable cost per unit"
                  prefix="$"
                  value={otherVariable}
                  onChange={setOtherVariable}
                  hint="Anything else that moves with each sale, except the card fee."
                />
              </FieldGrid>
              <Field
                id="bem-targetmargin"
                label="Margin you want to keep after the fee"
                suffix="%"
                value={targetMargin}
                onChange={setTargetMargin}
                hint="Measured against the price the customer pays, not against what lands in your bank."
              />
              {feeFields}
            </div>
          )}
        </div>
      }
      results={
        mode === "breakeven" ? (
          <div>
            <Headline
              label="Break-even volume"
              value={
                unit.breakEvenUnitsWhole === null
                  ? "Never"
                  : `${unit.breakEvenUnitsWhole.toLocaleString("en-US")} units`
              }
              sub={
                unit.breakEvenUnits === null
                  ? "At this price a unit costs more to sell than it brings in, so no volume covers the fixed costs."
                  : `${money(unit.breakEvenRevenue ?? 0)} of sales a month at ${money(unit.pricePerUnit)}. Without the card fee it would be ${(unit.breakEvenUnitsNoFee ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 })} units.`
              }
            />

            <div className="mt-5">
              <ResultRow label="Gross margin" value={pct(unit.grossMarginPct)} note="Price less unit cost, over price" />
              <ResultRow label="The same figure as a markup" value={pct(unit.grossMarkupPct)} note="Price less unit cost, over cost" />
              <ResultRow
                label="Processing fee per unit"
                value={money(unit.processingFeePerUnit)}
                note={`${pct(unit.feeAsPctOfPrice)} of the price, and ${pct(unit.feeShareOfGrossProfitPct)} of the gross profit`}
              />
              <ResultRow label="Variable cost per unit" value={money(unit.variableCostPerUnit)} note="Unit cost, other variable cost and the fee" />
              <ResultRow label="Contribution per unit" value={money(unit.contributionPerUnit)} emphasis />
              <ResultRow label="Contribution margin" value={pct(unit.contributionMarginPct)} note={`${pct(unit.marginPointsLostToVariableCosts)} below the gross margin`} />
              {unit.breakEvenUnits !== null && (
                <ResultRow
                  label="Break-even, exact"
                  value={unit.breakEvenUnits.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  note="Rounded up above, because a fraction of a unit pays no rent"
                />
              )}
              {unit.breakEvenRevenueNoFee !== null && (
                <ResultRow label="Break-even sales with no card fee" value={money(unit.breakEvenRevenueNoFee)} />
              )}
              {unit.feesAtBreakEvenMonthly !== null && (
                <ResultRow label="Card fees paid at break-even" value={money(unit.feesAtBreakEvenMonthly)} note="A month" />
              )}
              {wantsProfit && unit.unitsForTargetProfitWhole !== null && (
                <ResultRow
                  label={`Units for ${money0(inputs.targetProfitPerMonth)} of profit`}
                  value={unit.unitsForTargetProfitWhole.toLocaleString("en-US")}
                  note={`${money(unit.revenueForTargetProfit ?? 0)} of sales`}
                  emphasis
                />
              )}
            </div>

            {unit.extraUnitsFromFees !== null && unit.extraUnitsFromFees > 0 && (
              <Callout tone="warn">
                Accepting cards moves the break-even by{" "}
                <strong className="text-foreground">
                  {unit.extraUnitsFromFees.toLocaleString("en-US", { maximumFractionDigits: 1 })} units a month
                </strong>
                , which is {money(unit.extraRevenueFromFeesMonthly ?? 0)} of extra sales you have to find before the
                month is level, or {money(unit.extraRevenueFromFeesAnnual ?? 0)} a year. That is the line every general
                break-even calculator leaves out.
              </Callout>
            )}

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">What a price change does to it</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Price", "Contribution", "CM", "Break-even units"]}
                  align={["left", "right", "right", "right"]}
                  rows={ladder.map((row) => [
                    <span key={row.pricePerUnit} className="text-foreground">
                      {money(row.pricePerUnit)}
                    </span>,
                    money(row.contributionPerUnit),
                    pct(row.contributionMarginPct, 1),
                    row.breakEvenUnitsWhole === null
                      ? "Never"
                      : row.breakEvenUnitsWhole.toLocaleString("en-US"),
                  ])}
                />
              </div>
            </div>

            <Caveat>
              Fixed costs are the ones that do not move with volume. If a cost rises with each unit sold, it belongs in
              the variable box, or the break-even comes out low.
            </Caveat>
          </div>
        ) : mode === "convert" ? (
          <div>
            <Headline
              label="Gross margin"
              value={pct(unit.grossMarginPct)}
              sub={`The same pricing as a markup is ${pct(unit.grossMarkupPct)}. They are one fact with two denominators, and they are never the same number above zero.`}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="neutral">Margin divides by the price</Pill>
              <Pill tone="neutral">Markup divides by the cost</Pill>
            </div>

            <div className="mt-5">
              <ResultRow label="Gross profit per unit" value={money(unit.grossProfitPerUnit)} />
              <ResultRow
                label="Price as a multiple of cost"
                value={`${(1 + unit.grossMarkupPct / 100).toFixed(3)}x`}
                note="Cost multiplied by this reaches the price"
              />
              <ResultRow label="Processing fee on this sale" value={money(unit.processingFeePerCardSale)} note={`${pct(unit.feeAsPctOfPrice)} of the price`} />
              <ResultRow label="Margin after the card fee" value={pct(unit.contributionMarginPct)} emphasis />
              <ResultRow
                label="Margin points the fee takes"
                value={pct(unit.marginPointsLostToFees)}
                note={`${pct(unit.feeShareOfGrossProfitPct)} of the gross profit on this unit`}
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Markup to margin, and what the fee costs</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Markup", "Margin", "Multiplier", "Fee as share of profit"]}
                  align={["left", "right", "right", "right"]}
                  maxHeight="20rem"
                  rows={conversion.map((row) => [
                    <span key={row.markupPct} className="text-foreground">
                      {pct(row.markupPct, 0)}
                    </span>,
                    pct(row.marginPct),
                    `${row.multiplier.toFixed(2)}x`,
                    pct(row.feeShareOfGrossProfitPct),
                  ])}
                />
              </div>
            </div>

            <Caveat>
              The last column is the fee of {money(referenceFee)} on a {money0(d.conversionReferencePrice)} sale, taken
              out of the gross profit at each margin. The fee is the same dollar amount on every row. Only the profit it
              comes out of changes.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label={`Price for a ${pct(num(targetMargin), 1)} margin after fees`}
              value={target.price === null ? "No price works" : money(target.price)}
              sub={
                target.price === null
                  ? "The target margin plus the processing rate reaches 100 percent of the price. Every dollar you add hands part of itself straight back, so no price gets there."
                  : `Charging ${money(target.priceIgnoringFees)}, which is the answer with no fee in it, actually leaves ${pct(target.marginAtNaivePricePct)}.`
              }
            />

            {target.price !== null && (
              <div className="mt-5">
                <ResultRow label="Price with the fee ignored" value={money(target.priceIgnoringFees)} note="Cost divided by one minus the margin" />
                <ResultRow label="What the fee adds to the price" value={money(target.priceUplift ?? 0)} emphasis />
                <ResultRow label="Processing fee at that price" value={money(target.processingFee ?? 0)} />
                <ResultRow label="Profit per unit after the fee" value={money(target.profitPerUnit ?? 0)} />
                <ResultRow label="Margin achieved" value={pct(target.achievedMarginPct ?? 0)} note="At or a hair above the target, never under" />
                <ResultRow
                  label="Markup to apply to cost"
                  value={pct(target.achievedMarkupPct ?? 0)}
                  note={`Price is ${(1 + (target.achievedMarkupPct ?? 0) / 100).toFixed(3)} times the cost`}
                />
                <ResultRow
                  label="After-fee profit on cost"
                  value={pct(target.profitOnCostAfterFeePct ?? 0)}
                  note="A yield, not a pricing multiplier. Do not multiply by this one."
                />
              </div>
            )}

            <Callout>
              This is a margin gross-up, not a fee gross-up. If what you want is the amount to charge so that an exact
              sum lands in your bank after the processor takes its cut, that is a different solve and the reverse fee
              calculator on this site does it.
            </Callout>

            <Caveat>
              Margin here is measured against the price the customer pays. Some sellers measure it against the money
              that settles, which is the same profit over a smaller number and reads about a point higher. Pick one and
              use it everywhere.
            </Caveat>
          </div>
        )
      }
    />
  );
}
