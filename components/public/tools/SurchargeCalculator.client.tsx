"use client";

import * as React from "react";
import { SURCHARGE_DEFAULTS, type SurchargeState } from "@/lib/tools-data/surcharge";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  Pill,
  ResultRow,
  SelectField,
  money,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Credit card surcharging: the dollar math, and a state law reference beside it.
 *
 * SCOPE THIS CAREFULLY IF YOU EDIT IT. The calculator computes arithmetic on
 * numbers the merchant supplies. It does NOT output a "maximum legal surcharge",
 * because whether you may surcharge and at what ceiling turns on your state, the
 * card network rules, your cost of acceptance and your acquirer agreement. That
 * is legal advice, and a computed answer would read as one.
 *
 * The state table below is reference material with a cited source per row and an
 * explicit "Unclear" status, so an unverified state is shown as unverified
 * rather than guessed at.
 *
 * The output most merchants have never seen: because you pay processing on the
 * surcharge too, a surcharge set equal to your rate does not make you whole. The
 * residual is rendered.
 *
 * The 52 row state table arrives as PROPS from the server component. Importing
 * it here would ship it to every calculator on the site, because /tools/[tool] is
 * one route with one client manifest.
 */
export function SurchargeCalculator({ states }: { states: SurchargeState[] }) {
  const [ticket, setTicket] = React.useState(String(SURCHARGE_DEFAULTS.ticket));
  const [surchargePct, setSurchargePct] = React.useState(String(SURCHARGE_DEFAULTS.surchargePct));
  const [rate, setRate] = React.useState(String(SURCHARGE_DEFAULTS.processingRate));
  const [fixed, setFixed] = React.useState(String(SURCHARGE_DEFAULTS.processingFixed));
  const [state, setState] = React.useState("California");

  const t = Math.max(0, num(ticket));
  const s = Math.max(0, num(surchargePct)) / 100;
  const r = Math.max(0, num(rate)) / 100;
  const f = Math.max(0, num(fixed));

  const surchargeAmount = t * s;
  const customerTotal = t + surchargeAmount;
  const processingCost = customerTotal * r + f;
  const netReceived = customerTotal - processingCost;
  const residual = t - netReceived;
  const costWithout = t * r + f;
  const recovered = costWithout - residual;
  const recoveryPct = costWithout > 0 ? (recovered / costWithout) * 100 : 0;
  const breakEvenPct = t > 0 && r < 1 ? ((t * r + f) / (t * (1 - r))) * 100 : 0;

  const row = states.find((x) => x.state === state);
  const tone =
    row?.status === "Prohibited" ? "bad" : row?.status === "Permitted" ? "good" : row?.status === "Unclear" ? "neutral" : "warn";
  const overNetworkCap = num(surchargePct) > 3;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">The sale</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field id="sc-ticket" label="Ticket amount" prefix="$" value={ticket} onChange={setTicket} />
                <Field
                  id="sc-pct"
                  label="Surcharge you want to add"
                  suffix="%"
                  value={surchargePct}
                  onChange={setSurchargePct}
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Your processing cost</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="sc-rate" label="Rate" suffix="%" value={rate} onChange={setRate} />
                <Field id="sc-fixed" label="Per transaction" prefix="$" value={fixed} onChange={setFixed} />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Where you trade</p>
            <div className="mt-2.5">
              <SelectField
                id="sc-state"
                label="State"
                value={state}
                onChange={setState}
                options={states.map((x) => ({ value: x.state, label: x.state }))}
                hint="Reference only. This does not compute whether you may surcharge."
              />
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Customer pays"
            value={money(customerTotal)}
            sub={`${money(surchargeAmount)} of surcharge on a ${money(t)} sale.`}
          />

          <div className="mt-5">
            <ResultRow label="Surcharge added" value={money(surchargeAmount)} />
            <ResultRow
              label="Processing cost"
              value={money(processingCost)}
              note="Charged on the larger amount, because you pay on the surcharge too"
            />
            <ResultRow label="You keep" value={money(netReceived)} emphasis />
            <ResultRow
              label="Still absorbed"
              value={money(Math.max(0, residual))}
              note={
                costWithout > 0
                  ? `You recovered ${pct(Math.max(0, Math.min(100, recoveryPct)), 0)} of your ${money(costWithout)} processing cost.`
                  : undefined
              }
            />
          </div>

          {breakEvenPct > 0 && (
            <Callout>
              To break even exactly on this ticket you would need a{" "}
              <strong className="text-foreground">{pct(breakEvenPct)}</strong> surcharge, because the surcharge is
              itself processed. Whether you may charge that is a separate question, and not one this tool answers.
            </Callout>
          )}

          {overNetworkCap && (
            <Callout tone="warn">
              Visa and Mastercard cap US credit card surcharges, and the applicable ceiling is also limited by your
              own cost of acceptance. A surcharge above 3% is outside what the networks permit in the US.
            </Callout>
          )}

          {row && (
            <div className="mt-6 rounded border bg-muted px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-h4 text-foreground">{row.state}</p>
                <Pill tone={tone}>{row.status}</Pill>
              </div>
              <p className="mt-2 text-small text-muted-foreground">{row.detail}</p>
              <p className="mt-2 text-micro text-muted-foreground">
                Source: {row.source}. Checked {row.checked}.
              </p>
            </div>
          )}

          <Caveat>
            Reference material, not legal advice, and not a computed answer to whether you may surcharge. Debit and
            prepaid cards can never be surcharged anywhere in the US, the card networks require advance notice to
            your acquirer, and state rules change. Confirm with your acquirer and your own counsel before you switch
            surcharging on.
          </Caveat>
        </div>
      }
    />
  );
}

export default SurchargeCalculator;
