"use client";

import * as React from "react";
import { RESTAURANT_BENCHMARKS, RESTAURANT_DEFAULTS } from "@/lib/tools-data/restaurant";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ResultRow,
  Verdict,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Restaurant card fees, with tips modelled.
 *
 * Tips are the differentiator and the reason this page is not a duplicate of the
 * generic fee calculator. A restaurant pays processing on the whole authorised
 * amount, tip included, so a 19% tip adds 19% to the processing bill on every
 * card check. Neither restaurant-specific competitor mentions tips anywhere.
 *
 * Third party delivery volume is deliberately excluded from the input rather
 * than modelled: on marketplace orders the platform is usually the merchant of
 * record, so that volume is not the restaurant's processing cost at all, and
 * including it would overstate the answer.
 */
export function RestaurantFeeCalculator() {
  const [monthlySales, setMonthlySales] = React.useState(String(RESTAURANT_DEFAULTS.monthlySales));
  const [averageCheck, setAverageCheck] = React.useState(String(RESTAURANT_DEFAULTS.averageCheck));
  const [tipPct, setTipPct] = React.useState(String(RESTAURANT_DEFAULTS.tipPct));
  const [cardSharePct, setCardSharePct] = React.useState(String(RESTAURANT_DEFAULTS.cardSharePct));
  const [rate, setRate] = React.useState(String(RESTAURANT_DEFAULTS.rate));
  const [fixed, setFixed] = React.useState(String(RESTAURANT_DEFAULTS.fixed));
  const [monthlyFees, setMonthlyFees] = React.useState(String(RESTAURANT_DEFAULTS.monthlyFees));

  const sales = Math.max(0, num(monthlySales));
  const check = Math.max(0, num(averageCheck));
  const tip = Math.max(0, num(tipPct)) / 100;
  const cardShare = Math.max(0, Math.min(100, num(cardSharePct))) / 100;
  const r = Math.max(0, num(rate)) / 100;
  const f = Math.max(0, num(fixed));
  const fees = Math.max(0, num(monthlyFees));

  const cardSales = sales * cardShare;
  const tipVolume = cardSales * tip;
  // The processor authorises check plus tip, so the whole amount is priced.
  const authorised = cardSales + tipVolume;
  const covers = check > 0 ? cardSales / check : 0;

  const percentCost = authorised * r;
  const perItemCost = covers * f;
  const total = percentCost + perItemCost + fees;
  const tipCost = tipVolume * r;
  const effective = cardSales > 0 ? (total / cardSales) * 100 : 0;
  const perCover = covers > 0 ? total / covers : 0;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Your restaurant</p>
            <div className="mt-2.5 space-y-4">
              <Field
                id="rc-sales"
                label="Monthly food and beverage sales"
                prefix="$"
                value={monthlySales}
                onChange={setMonthlySales}
                hint="Excluding sales tax, and excluding third party delivery volume."
              />
              <FieldGrid>
                <Field
                  id="rc-check"
                  label="Average check"
                  prefix="$"
                  value={averageCheck}
                  onChange={setAverageCheck}
                  hint="Before tip."
                />
                <Field
                  id="rc-card"
                  label="Paid by card"
                  suffix="%"
                  value={cardSharePct}
                  onChange={setCardSharePct}
                />
              </FieldGrid>
              <Field
                id="rc-tip"
                label="Average tip"
                suffix="%"
                value={tipPct}
                onChange={setTipPct}
                hint="Of the pre-tip check. You pay processing on this too."
              />
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Your rates</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field id="rc-rate" label="Processing rate" suffix="%" value={rate} onChange={setRate} />
                <Field id="rc-fixed" label="Per transaction" prefix="$" value={fixed} onChange={setFixed} />
              </FieldGrid>
              <Field
                id="rc-fees"
                label="Fixed monthly fees"
                prefix="$"
                value={monthlyFees}
                onChange={setMonthlyFees}
                hint="POS software, gateway, PCI, statement."
              />
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Monthly processing cost"
            value={money(total)}
            sub={`${money0(total * 12)} a year on ${money0(cardSales)} of card sales.`}
          />

          <div className="mt-5">
            <ResultRow label={`Percentage (${pct(r * 100)})`} value={money(percentCost)} note={`On ${money0(authorised)} authorised, tips included`} />
            <ResultRow label={`Per transaction (${money(f)} x ${Math.round(covers)})`} value={money(perItemCost)} />
            {fees > 0 && <ResultRow label="Fixed monthly fees" value={money(fees)} />}
            <ResultRow label="Effective rate on card sales" value={pct(effective)} emphasis />
            <ResultRow label="Cost per cover" value={money(perCover)} />
          </div>

          <Verdict effectiveRate={effective} />

          {tipCost > 0 && (
            <Callout>
              <strong className="text-foreground">{money(tipCost)} a month of that is processing on tips</strong>, or{" "}
              {money0(tipCost * 12)} a year. You pay the full rate on the whole authorised amount, so a{" "}
              {pct(tip * 100, 0)} tip adds {pct(tip * 100, 0)} to your processing bill on every card check. That is
              money handed to staff that you are charged for moving.
            </Callout>
          )}

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Where restaurants typically land</p>
            <div className="mt-2">
              <MiniTable
                columns={["Segment", "Effective rate"]}
                rows={RESTAURANT_BENCHMARKS.map((b) => [b.segment, b.effectiveRate])}
              />
            </div>
          </div>

          <Caveat>
            Third party delivery orders are excluded on purpose: on marketplace orders the platform is usually the
            merchant of record, so that volume is not yours to process and including it would overstate this number.
            Whether processing fees may be deducted from tipped employees is a federal and state wage question, not a
            processing one, and this tool does not answer it.
          </Caveat>
        </div>
      }
    />
  );
}

export default RestaurantFeeCalculator;
