"use client";

import * as React from "react";
import {
  CalcShell,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ResultRow,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Interchange-plus vs flat-rate, behind
 * `/tools/interchange-plus-vs-flat-rate-calculator`.
 *
 * The differentiator is the BREAK-EVEN, and it is the reason this tool exists.
 * Every page ranking for this query is published by someone who sells
 * interchange-plus processing, so every one of them concludes "switch". None
 * returns the volume at which that stops being true, and the published rules of
 * thumb openly contradict each other ("over $5,000 a month" against "over $8,000
 * to $10,000"). A calculator that can also say "stay where you are" is the only
 * credible version of this page.
 *
 * Break-even volume, holding the average ticket constant so transaction count
 * moves with volume:
 *
 *   flat(V)  = V*fr/100 + (V/t)*ff
 *   icp(V)   = V*(ic+mk)/100 + (V/t)*mkf + M
 *
 * Both are linear in V apart from the fixed monthly M, so
 *
 *   V* = M / (flatPerDollar - icpPerDollar)
 *
 * and a non-positive denominator means interchange-plus never wins at this
 * ticket size, which is a real answer rather than an error.
 */
export function PricingModelCalculator() {
  const [volume, setVolume] = React.useState("18000");
  const [count, setCount] = React.useState("300");

  const [flatRate, setFlatRate] = React.useState("2.9");
  const [flatFixed, setFlatFixed] = React.useState("0.30");

  const [interchange, setInterchange] = React.useState("1.85");
  const [markup, setMarkup] = React.useState("0.30");
  const [markupFixed, setMarkupFixed] = React.useState("0.10");
  const [monthlyFees, setMonthlyFees] = React.useState("30");

  const V = Math.max(0, num(volume));
  const N = Math.max(0, num(count));
  const ticket = N > 0 ? V / N : 0;

  const fr = num(flatRate);
  const ff = num(flatFixed);
  const ic = num(interchange);
  const mk = num(markup);
  const mkf = num(markupFixed);
  const M = Math.max(0, num(monthlyFees));

  const flatCost = (V * fr) / 100 + N * ff;
  const icpProcessing = (V * (ic + mk)) / 100 + N * mkf;
  const icpCost = icpProcessing + M;

  const saving = flatCost - icpCost;
  const flatEffective = V > 0 ? (flatCost / V) * 100 : 0;
  const icpEffective = V > 0 ? (icpCost / V) * 100 : 0;

  // Per dollar of volume, at the current average ticket.
  const flatPerDollar = ticket > 0 ? fr / 100 + ff / ticket : fr / 100;
  const icpPerDollar = ticket > 0 ? (ic + mk) / 100 + mkf / ticket : (ic + mk) / 100;
  const spread = flatPerDollar - icpPerDollar;
  const breakEvenVolume = spread > 0 ? M / spread : null;

  // Break-even average ticket at the CURRENT volume: the ticket size at which the
  // two models cost the same. Only meaningful when the per-item fees differ.
  const A = (V * (fr - ic - mk)) / 100;
  const B = V * (ff - mkf);
  const breakEvenTicketRaw = Math.abs(B) > 0.0001 ? B / (M - A) : null;
  const breakEvenTicket =
    breakEvenTicketRaw !== null && breakEvenTicketRaw > 0 && breakEvenTicketRaw < 100000
      ? breakEvenTicketRaw
      : null;

  const winner = saving > 0 ? "icp" : saving < 0 ? "flat" : "tie";

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Your business</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="pmc-volume" label="Monthly card volume" prefix="$" value={volume} onChange={setVolume} />
                <Field
                  id="pmc-count"
                  label="Transactions per month"
                  value={count}
                  onChange={setCount}
                  hint={ticket > 0 ? `Average ticket ${money(ticket)}` : undefined}
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Flat-rate offer</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="pmc-flat-rate" label="Rate" suffix="%" value={flatRate} onChange={setFlatRate} />
                <Field id="pmc-flat-fixed" label="Per transaction" prefix="$" value={flatFixed} onChange={setFlatFixed} />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Interchange-plus offer</p>
            <div className="mt-2.5 space-y-4">
              <Field
                id="pmc-interchange"
                label="Blended interchange and assessments"
                suffix="%"
                value={interchange}
                onChange={setInterchange}
                hint="A typical US small-business mix is 1.7% to 2.1%. Use your statement's figure if you have it."
              />
              <FieldGrid>
                <Field id="pmc-markup" label="Markup" suffix="%" value={markup} onChange={setMarkup} />
                <Field id="pmc-markup-fixed" label="Markup per transaction" prefix="$" value={markupFixed} onChange={setMarkupFixed} />
              </FieldGrid>
              <Field
                id="pmc-monthly"
                label="Monthly fees on the interchange-plus account"
                prefix="$"
                value={monthlyFees}
                onChange={setMonthlyFees}
                hint="Set this to zero if the provider charges none. It moves the break-even more than anything else."
              />
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label={winner === "icp" ? "Interchange-plus saves" : winner === "flat" ? "Flat-rate is cheaper by" : "The two cost the same"}
            value={money(Math.abs(saving))}
            sub={
              winner === "tie"
                ? "You are sitting exactly on the break-even."
                : `${money(Math.abs(saving) * 12)} a year at this volume.`
            }
          />

          <div className="mt-5">
            <ResultRow
              label="Flat-rate cost"
              value={money(flatCost)}
              note={`${pct(flatEffective)} effective`}
              emphasis={winner === "flat"}
            />
            <ResultRow
              label="Interchange-plus cost"
              value={money(icpCost)}
              note={`${pct(icpEffective)} effective, including ${money(M)} of monthly fees`}
              emphasis={winner === "icp"}
            />
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Break-even</p>
            <div className="mt-2">
              {breakEvenVolume === null ? (
                <p className="rounded border border-warning/40 bg-warning/10 px-4 py-3 text-small text-muted-foreground">
                  At this average ticket, the interchange-plus offer never beats the flat rate,
                  at any volume. The markup plus interchange is already at or above the flat rate
                  before the monthly fees are counted. Either the flat-rate offer is unusually good
                  or the interchange-plus quote is not.
                </p>
              ) : (
                <>
                  <ResultRow
                    label="Break-even monthly volume"
                    value={money0(breakEvenVolume)}
                    note={
                      V >= breakEvenVolume
                        ? `You are ${money0(V - breakEvenVolume)} a month above it.`
                        : `You are ${money0(breakEvenVolume - V)} a month below it.`
                    }
                    emphasis
                  />
                  {breakEvenTicket !== null && (
                    <ResultRow
                      label="Break-even average ticket"
                      value={money(breakEvenTicket)}
                      note={`At ${money(V)} a month. Your ticket is ${money(ticket)}.`}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <p className="mt-5 rounded border border-border-strong bg-muted px-4 py-3 text-small text-muted-foreground">
            {breakEvenVolume === null
              ? "Stay on flat-rate pricing, or go back and ask for a better markup."
              : V >= breakEvenVolume
                ? "You are above the break-even, so interchange-plus is worth quoting. Ask for the markup in basis points and the full list of monthly fees before you compare."
                : "You are below the break-even. Staying on flat-rate pricing is the right answer today, and it is worth re-running this once your volume grows."}
          </p>

          <Caveat>
            Interchange is a range, not a number: the networks publish rate tables by card type,
            merchant category and channel. Replace the estimate with your statement&rsquo;s figure for a
            real answer.
          </Caveat>
        </div>
      }
    />
  );
}

export default PricingModelCalculator;
