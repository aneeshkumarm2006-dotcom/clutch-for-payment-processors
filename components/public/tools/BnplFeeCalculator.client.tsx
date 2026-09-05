"use client";

import * as React from "react";
import type { BnplProvider } from "@/lib/tools-data/bnpl";
import { BNPL_DEFAULTS, getBnplProvider } from "@/lib/tools-data/bnpl";
import { bnplMonthly, compareProviders, requiredAovUplift } from "@/lib/calc/bnpl";
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
  SelectField,
  Verdict,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * BNPL Merchant Cost Calculator.
 *
 * The gap this exploits: every page currently ranking for "BNPL merchant fees"
 * either lists rates with no arithmetic, or reproduces a vendor case study that
 * computes its return on TOTAL BNPL volume. That denominator is the whole error.
 * A customer who would have paid by card and instead pays by Klarna has not
 * created a sale; the merchant has paid roughly twice the fee for a sale it
 * already had. The break-even has to be computed on INCREMENTAL sales, and the
 * merchant is the only person who can supply that share, so the calculator asks
 * for it directly instead of inferring it from a marketing number.
 *
 * THE DEFAULTS ARE PART OF THE ARGUMENT. `aovUpliftPct` opens at zero even
 * though every provider in the table claims between 32 and 58 percent, because a
 * vendor claim as a default would make the tool agree with the marketing before
 * anybody types anything. They are in `lib/tools-data/bnpl.ts` so they are data.
 *
 * The provider rows arrive as PROPS from `ToolWidget`, per the rule in that
 * file: a client module here must not import `@/lib/tools` or the
 * `@/lib/tools-data` barrel. `BNPL_DEFAULTS` is imported from the narrow module,
 * which is allowed and which keeps the opening state out of the component.
 *
 * `Verdict` appears in the blended-rate mode only. It scores a merchant's
 * blended monthly effective rate, which is exactly what that mode computes, and
 * it is meaningless on a single payment.
 */
export function BnplFeeCalculator({ providers }: { providers: BnplProvider[] }) {
  const [mode, setMode] = React.useState<"breakeven" | "order" | "blended">("breakeven");

  const [providerId, setProviderId] = React.useState(BNPL_DEFAULTS.providerId);
  const [monthlyOrders, setMonthlyOrders] = React.useState(String(BNPL_DEFAULTS.monthlyOrders));
  const [aov, setAov] = React.useState(String(BNPL_DEFAULTS.averageOrderValue));
  const [cardRate, setCardRate] = React.useState(String(BNPL_DEFAULTS.cardRatePct));
  const [cardFixed, setCardFixed] = React.useState(String(BNPL_DEFAULTS.cardFixedFee));
  const [bnplShare, setBnplShare] = React.useState(String(BNPL_DEFAULTS.bnplSharePct));
  const [incShare, setIncShare] = React.useState(String(BNPL_DEFAULTS.incrementalSharePct));
  const [uplift, setUplift] = React.useState(String(BNPL_DEFAULTS.aovUpliftPct));
  const [margin, setMargin] = React.useState(String(BNPL_DEFAULTS.grossMarginPct));
  const [singleValue, setSingleValue] = React.useState(String(BNPL_DEFAULTS.singleOrderValue));

  const provider = getBnplProvider(providerId, providers);

  const monthly = bnplMonthly({
    monthlyOrders: num(monthlyOrders),
    averageOrderValue: num(aov),
    cardRatePct: num(cardRate),
    cardFixedFee: num(cardFixed),
    bnplRatePct: provider.ratePct,
    bnplFixedFee: provider.fixedFee,
    bnplSharePct: num(bnplShare),
    incrementalSharePct: num(incShare),
    aovUpliftPct: num(uplift),
    grossMarginPct: num(margin),
  });

  const uplifts = requiredAovUplift({
    averageOrderValue: num(aov),
    cardRatePct: num(cardRate),
    cardFixedFee: num(cardFixed),
    bnplRatePct: provider.ratePct,
    bnplFixedFee: provider.fixedFee,
    grossMarginPct: num(margin),
  });

  const rows = compareProviders(
    num(singleValue),
    num(cardRate),
    num(cardFixed),
    monthly.bnplOrders,
    providers.map((p) => ({ id: p.id, name: p.name, ratePct: p.ratePct, fixedFee: p.fixedFee })),
  );

  const providerOptions = providers.map((p) => ({
    value: p.id,
    label:
      p.ratePctHigh > p.ratePct
        ? `${p.name} (${p.ratePct}% to ${p.ratePctHigh}% + ${money(p.fixedFee)})`
        : `${p.name} (${p.ratePct}% + ${money(p.fixedFee)})`,
  }));

  const extraOrders = Math.ceil(monthly.breakEvenIncrementalOrders);

  const mixControls = (
    <div className="space-y-4">
      <SelectField
        id="bnpl-provider"
        label="BNPL provider"
        value={providerId}
        onChange={setProviderId}
        options={providerOptions}
        hint="Published US merchant rates. Several providers quote on application, so treat these as the list price."
      />
      <FieldGrid>
        <Field id="bnpl-orders" label="Orders a month" value={monthlyOrders} onChange={setMonthlyOrders} />
        <Field id="bnpl-aov" label="Average order value on card" prefix="$" value={aov} onChange={setAov} />
      </FieldGrid>
      <FieldGrid>
        <Field id="bnpl-cardrate" label="Your card rate" suffix="%" value={cardRate} onChange={setCardRate} />
        <Field id="bnpl-cardfixed" label="Card fixed fee" prefix="$" value={cardFixed} onChange={setCardFixed} />
      </FieldGrid>
      <FieldGrid>
        <Field
          id="bnpl-share"
          label="Share of orders paying by BNPL"
          suffix="%"
          value={bnplShare}
          onChange={setBnplShare}
        />
        <Field
          id="bnpl-incshare"
          label="Share of those that are genuinely new"
          suffix="%"
          value={incShare}
          onChange={setIncShare}
          hint="Orders that would not have happened at all without BNPL. This is the input that decides the answer."
        />
      </FieldGrid>
      <FieldGrid>
        <Field
          id="bnpl-uplift"
          label="How much bigger a BNPL basket is"
          suffix="%"
          value={uplift}
          onChange={setUplift}
          hint="Vendor uplift claims compare BNPL orders against all orders, which measures who chooses BNPL, not what BNPL causes. Starts at zero on purpose."
        />
        <Field
          id="bnpl-margin"
          label="Gross margin"
          suffix="%"
          value={margin}
          onChange={setMargin}
          hint="Contribution margin before payment fees."
        />
      </FieldGrid>
    </div>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "breakeven" | "order" | "blended")}
            options={[
              { value: "breakeven", label: "What must it earn back?" },
              { value: "order", label: "Cost per order" },
              { value: "blended", label: "Effect on my rate" },
            ]}
          />

          {mode === "order" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="bnpl-single"
                  label="Order value"
                  prefix="$"
                  value={singleValue}
                  onChange={setSingleValue}
                />
                <Field id="bnpl-cardrate2" label="Your card rate" suffix="%" value={cardRate} onChange={setCardRate} />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="bnpl-cardfixed2"
                  label="Card fixed fee"
                  prefix="$"
                  value={cardFixed}
                  onChange={setCardFixed}
                />
                <Field
                  id="bnpl-share2"
                  label="Share of orders paying by BNPL"
                  suffix="%"
                  value={bnplShare}
                  onChange={setBnplShare}
                  hint={`${Math.round(monthly.bnplOrders).toLocaleString("en-US")} BNPL orders a month at ${Math.round(num(monthlyOrders)).toLocaleString("en-US")} orders total. Drives the last column.`}
                />
              </FieldGrid>
              <p className="text-micro text-muted-foreground">
                Every provider below is priced on the same basket, so the table ranks by dollars rather than by
                headline rate. A lower percentage with a bigger fixed fee loses on small baskets.
              </p>
            </div>
          ) : (
            mixControls
          )}
        </div>
      }
      results={
        mode === "breakeven" ? (
          <div>
            <Headline
              label="Extra orders a month to break even"
              value={monthly.breakEvenIncrementalOrders > 0 ? extraOrders.toLocaleString("en-US") : "None"}
              sub={
                monthly.breakEvenIncrementalOrders > 0
                  ? `A ${pct(monthly.breakEvenOrderLiftPct, 2)} lift on ${Math.round(monthly.baselineOrders).toLocaleString("en-US")} orders pays for ${Math.round(monthly.switchedOrders).toLocaleString("en-US")} switched sales.`
                  : `Switching already adds margin at these inputs, so ${provider.name} does not need to create a single extra order.`
              }
            />

            <div className="mt-5">
              <ResultRow
                label="BNPL orders a month"
                value={Math.round(monthly.bnplOrders).toLocaleString("en-US")}
                note={`${Math.round(monthly.switchedOrders).toLocaleString("en-US")} switched from card, ${Math.round(monthly.incrementalOrders).toLocaleString("en-US")} genuinely new`}
              />
              <ResultRow
                label="Fee on one card order"
                value={money(monthly.cardFeePerOrder)}
                note={`${pct(num(cardRate))} plus ${money(num(cardFixed))}`}
              />
              <ResultRow
                label={`Fee on one ${provider.name} order`}
                value={money(monthly.bnplFeePerOrder)}
                note={`${provider.ratePct}% plus ${money(provider.fixedFee)}`}
              />
              <ResultRow
                label="Extra fee on sales you already had"
                value={money(monthly.cannibalizationCost)}
                note="Per month, on the switched orders only"
                emphasis
              />
              <ResultRow
                label="Margin from genuinely new orders"
                value={money(monthly.incrementalProfit)}
              />
              <ResultRow
                label="Net effect on monthly profit"
                value={money(monthly.netMonthlyEffect)}
                emphasis
              />
              <ResultRow
                label="Net effect a year"
                value={money0(monthly.netAnnualEffect)}
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Two ways to break even</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Route to break even", "Needed"]}
                  align={["left", "right"]}
                  rows={[
                    [
                      <span key="a">
                        Share of BNPL orders that are genuinely new
                        <span className="block text-micro text-muted-foreground">
                          You entered {pct(num(incShare), 1)}
                        </span>
                      </span>,
                      <span key="a2" className="inline-flex items-center gap-2">
                        {pct(monthly.breakEvenIncrementalSharePct)}
                        <Pill tone={num(incShare) >= monthly.breakEvenIncrementalSharePct ? "good" : "bad"}>
                          {num(incShare) >= monthly.breakEvenIncrementalSharePct ? "Clear" : "Short"}
                        </Pill>
                      </span>,
                    ],
                    [
                      <span key="b">
                        Extra orders a month, at today&rsquo;s mix
                        <span className="block text-micro text-muted-foreground">
                          On top of {Math.round(monthly.baselineOrders).toLocaleString("en-US")} baseline orders
                        </span>
                      </span>,
                      monthly.breakEvenIncrementalOrders > 0
                        ? `${extraOrders.toLocaleString("en-US")} (${pct(monthly.breakEvenOrderLiftPct, 2)})`
                        : "None",
                    ],
                    [
                      <span key="c">
                        Bigger basket instead, with no extra orders
                        <span className="block text-micro text-muted-foreground">
                          {uplifts.solvable
                            ? `Take the basket to ${money(uplifts.requiredOrderValue)}`
                            : "No basket size fixes this"}
                        </span>
                      </span>,
                      uplifts.solvable ? pct(uplifts.requiredAovUpliftPct) : "Not possible",
                    ],
                  ]}
                />
              </div>
            </div>

            {monthly.marginBelowBnplRate ? (
              <Callout tone="warn">
                Your gross margin of {pct(num(margin), 1)} is at or below {provider.name}&rsquo;s{" "}
                {provider.ratePct}% rate, so every order loses money on this method whether it is new or not. No volume
                of incremental sales and no basket uplift fixes that. This is the one case where the answer is simply
                no.
              </Callout>
            ) : (
              <Callout tone={monthly.alreadyPaysForItself ? "good" : "warn"}>
                {monthly.alreadyPaysForItself ? (
                  <>
                    At {pct(num(incShare), 1)} incrementality {provider.name} adds{" "}
                    <strong className="text-foreground">{money0(monthly.netMonthlyEffect)} a month</strong>. It stops
                    paying below {pct(monthly.breakEvenIncrementalSharePct)}, so the number to defend is the
                    incrementality, not the fee.
                  </>
                ) : (
                  <>
                    At {pct(num(incShare), 1)} incrementality {provider.name} costs you{" "}
                    <strong className="text-foreground">{money0(Math.abs(monthly.netMonthlyEffect))} a month</strong>.
                    You need {pct(monthly.breakEvenIncrementalSharePct)} of BNPL orders to be genuinely new before it
                    washes its face.
                  </>
                )}
              </Callout>
            )}

            <Caveat>
              If every BNPL order would have happened anyway, this method costs{" "}
              {money0(monthly.bnplOrders * (monthly.bnplFeePerOrder - monthly.cardFeePerOrder))} a month in extra fees
              and returns nothing. That is the scenario the vendor case studies never model, and it is the one to rule
              out with a holdout test before you rule anything in.
            </Caveat>
          </div>
        ) : mode === "order" ? (
          <div>
            <Headline
              label={`Cheapest published BNPL fee on ${money(num(singleValue))}`}
              value={money(rows[0]?.fee ?? 0)}
              sub={`${rows[0]?.name ?? ""} against ${money(rows[0] ? rows[0].fee - rows[0].extraFee : 0)} on your card, which is ${(rows[0]?.multipleOfCard ?? 0).toFixed(2)}x.`}
            />

            <div className="mt-5">
              <MiniTable
                columns={["Provider", "Fee", "Effective", "vs card", "Extra a month"]}
                align={["left", "right", "right", "right", "right"]}
                rows={rows.map((r) => [
                  r.name,
                  money(r.fee),
                  pct(r.effectiveRatePct),
                  `${r.multipleOfCard.toFixed(2)}x`,
                  money0(r.monthlyExtraFee),
                ])}
              />
            </div>

            <div className="mt-5">
              <ResultRow
                label="Your card fee on the same order"
                value={money(rows[0] ? rows[0].fee - rows[0].extraFee : 0)}
                note={`${pct(num(cardRate))} plus ${money(num(cardFixed))}`}
                emphasis
              />
              <ResultRow
                label="Spread between cheapest and dearest BNPL"
                value={money((rows[rows.length - 1]?.fee ?? 0) - (rows[0]?.fee ?? 0))}
                note="On this one order"
              />
              <ResultRow
                label="Dearest option across a month"
                value={money0(rows[rows.length - 1]?.monthlyExtraFee ?? 0)}
                note={`Extra fee over card on ${Math.round(monthly.bnplOrders).toLocaleString("en-US")} BNPL orders`}
              />
            </div>

            <Callout>
              The ranking flips with basket size. A method with a lower percentage and a bigger fixed fee wins on large
              orders and loses on small ones, which is why this table prices the basket you typed rather than comparing
              headline rates.
            </Callout>

            <Caveat>
              Rates are the published US list price for each method, read on the dates in the assumptions below. Klarna,
              Affirm and Zip do not publish a US rate card at all, so their figures come from a payment service
              provider&rsquo;s published rate for that method. A direct contract at volume can be lower, and none of
              these figures is a quote.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Blended effective rate with BNPL"
              value={pct(monthly.blendedEffectiveRatePct)}
              sub={`Up from ${pct(monthly.baselineEffectiveRatePct)} on cards alone, on ${money0(monthly.revenue)} of monthly revenue.`}
            />

            <div className="mt-5">
              <ResultRow
                label="Monthly fee bill, cards only"
                value={money(monthly.baselineFeeBill)}
                note={`${Math.round(monthly.baselineOrders).toLocaleString("en-US")} orders at ${money(monthly.cardFeePerOrder)}`}
              />
              <ResultRow
                label="Monthly fee bill with BNPL"
                value={money(monthly.feeBill)}
                note={`${Math.round(monthly.cardOrders).toLocaleString("en-US")} card orders plus ${Math.round(monthly.bnplOrders).toLocaleString("en-US")} BNPL orders`}
                emphasis
              />
              <ResultRow label="Extra fees a month" value={money(monthly.feeBill - monthly.baselineFeeBill)} />
              <ResultRow label="Extra fees a year" value={money0((monthly.feeBill - monthly.baselineFeeBill) * 12)} />
              <ResultRow
                label="Basis points added to your blended rate"
                value={`${Math.round((monthly.blendedEffectiveRatePct - monthly.baselineEffectiveRatePct) * 100)} bps`}
                emphasis
              />
            </div>

            <Verdict effectiveRate={monthly.blendedEffectiveRatePct} />

            <Callout>
              A {pct(num(bnplShare), 1)} BNPL mix at {provider.ratePct}% moves a{" "}
              {pct(monthly.baselineEffectiveRatePct)} card rate to {pct(monthly.blendedEffectiveRatePct)}. That is the
              number your statement will show, and it is why a merchant who negotiated 20 basis points off their card
              rate can still watch their blended rate rise after turning BNPL on.
            </Callout>

            <Caveat>
              The extra fee bill is a real cost whether or not BNPL is net positive. This mode deliberately ignores the
              incremental sales, because the fee line on your statement does too. Use the break-even mode for the
              decision and this one for the budget.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default BnplFeeCalculator;
