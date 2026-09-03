"use client";

import * as React from "react";
import { GROSS_UP_DEFAULTS, GROSS_UP_PRESETS } from "@/lib/tools-data/gross-up";
import { grossUp } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ResultRow,
  SelectField,
  money,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

const CUSTOM = "custom";

/**
 * "What do I charge so that $X lands in my account?"
 *
 * Two things earn this page its place. First, the naive answer is wrong and
 * almost everyone reaches for it: adding 2.9% to $100 gives $102.90, which nets
 * $99.62. The comparison is rendered rather than described, because being shown
 * the 38 cent shortfall is the whole lesson.
 *
 * Second, the effective rate. On a $1 net at 2.9% plus 30 cents you have to
 * charge $1.34, which is a 25% effective rate. Nothing else makes the fixed-fee
 * problem that visible.
 */
export function GrossUpCalculator() {
  const [presetId, setPresetId] = React.useState(GROSS_UP_PRESETS[0]?.id ?? CUSTOM);
  const [net, setNet] = React.useState(String(GROSS_UP_DEFAULTS.net));
  const [rate, setRate] = React.useState(String(GROSS_UP_DEFAULTS.rate));
  const [fixed, setFixed] = React.useState(String(GROSS_UP_DEFAULTS.fixed));

  const preset = GROSS_UP_PRESETS.find((p) => p.id === presetId);
  const activeRate = preset ? preset.rate : num(rate);
  const activeFixed = preset ? preset.fixed : num(fixed);

  const r = grossUp(num(net), activeRate, activeFixed);

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <SelectField
            id="gu-preset"
            label="Processor and channel"
            value={presetId}
            onChange={setPresetId}
            options={[
              ...GROSS_UP_PRESETS.map((p) => ({ value: p.id, label: p.label })),
              { value: CUSTOM, label: "Enter my own rate" },
            ]}
            hint="Published US rates. Pick your channel, or enter your own."
          />

          <Field
            id="gu-net"
            label="Amount you want to receive"
            prefix="$"
            value={net}
            onChange={setNet}
            hint="What should actually land in your bank account."
          />

          {!preset && (
            <FieldGrid>
              <Field id="gu-rate" label="Rate" suffix="%" value={rate} onChange={setRate} />
              <Field id="gu-fixed" label="Per transaction" prefix="$" value={fixed} onChange={setFixed} />
            </FieldGrid>
          )}

          {preset && (
            <p className="text-micro text-muted-foreground">
              Using {pct(preset.rate)} + {money(preset.fixed)} per transaction.
            </p>
          )}
        </div>
      }
      results={
        <div>
          <Headline
            label="Charge this"
            value={money(r.gross)}
            sub={`${money(r.fee)} in fees, leaving exactly ${money(r.net)}.`}
          />

          <div className="mt-5">
            <ResultRow label="Gross amount to charge" value={money(r.gross)} emphasis />
            <ResultRow label="Processing fee" value={money(r.fee)} />
            <ResultRow label="You receive" value={money(r.net)} />
            <ResultRow
              label="Effective rate on the charge"
              value={pct(r.effectiveRate)}
              note="Fee divided by the gross amount."
            />
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">If you just add the percentage</p>
            <div className="mt-2">
              <ResultRow label="Naive charge" value={money(r.naive.gross)} note="Net plus the rate, the obvious guess" />
              <ResultRow label="You would actually receive" value={money(r.naive.net)} />
              <ResultRow label="Shortfall" value={money(r.naive.shortfall)} emphasis note="Every single transaction" />
            </div>
          </div>

          {r.exceedsSurchargeCap && (
            <Callout tone="warn">
              The markup here is more than 3% of the original amount. That is fine if you are building it into your
              price. If you intend to add it to a customer&rsquo;s bill as a credit card surcharge, it exceeds the 3%
              cap Visa applies in the US, and surcharging carries its own state rules and notification requirements.
            </Callout>
          )}

          <Caveat>
            Computed in whole cents, then verified: the fee is recalculated on the rounded charge and the charge is
            nudged up if the net would land short. Rounding half up on its own can leave you a cent light, because
            the processor rounds its own fee independently.
          </Caveat>
        </div>
      }
    />
  );
}

export default GrossUpCalculator;
