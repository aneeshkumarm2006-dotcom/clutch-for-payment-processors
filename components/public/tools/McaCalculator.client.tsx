"use client";

import * as React from "react";
import { MCA_APR_BANDS, MCA_DEFAULTS, MCA_FACTOR_RANGE, MCA_HOLDBACK_RANGE } from "@/lib/tools-data/mca";
import { mcaSchedule } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ModeTabs,
  ResultRow,
  SelectField,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Merchant cash advance: factor rate to APR.
 *
 * The output that matters is the APR, because a factor rate is a price with the
 * clock taken out of it. The same 1.30 factor is roughly 111% APR at a 10%
 * holdback and roughly 221% at 20%, on identical dollars, and no term sheet says
 * which one you are signing.
 *
 * All arithmetic lives in `lib/tools-math.ts` and is covered by reference cases
 * in the test suite, including the inverted-bisection failure that returns a
 * confident 25,200 percent.
 */
export function McaCalculator() {
  const [advance, setAdvance] = React.useState(String(MCA_DEFAULTS.advance));
  const [factorRate, setFactorRate] = React.useState(String(MCA_DEFAULTS.factorRate));
  const [originationPct, setOriginationPct] = React.useState(String(MCA_DEFAULTS.originationPct));
  const [mode, setMode] = React.useState<"holdback" | "fixed">("holdback");
  const [holdbackPct, setHoldbackPct] = React.useState(String(MCA_DEFAULTS.holdbackPct));
  const [monthlyVolume, setMonthlyVolume] = React.useState(String(MCA_DEFAULTS.monthlyVolume));
  const [fixedAmount, setFixedAmount] = React.useState("500");
  const [fixedFrequency, setFixedFrequency] = React.useState<"daily" | "weekly">("daily");

  const factor = num(factorRate);
  const r = mcaSchedule({
    advance: num(advance),
    factorRate: factor,
    originationPct: num(originationPct),
    mode,
    holdbackPct: num(holdbackPct),
    monthlyVolume: num(monthlyVolume),
    fixedAmount: num(fixedAmount),
    fixedFrequency,
  });

  const band = MCA_APR_BANDS.find((b) => r.apr < b.max) ?? MCA_APR_BANDS[MCA_APR_BANDS.length - 1];
  const factorOutOfRange = factor > 0 && (factor < MCA_FACTOR_RANGE[0] || factor > MCA_FACTOR_RANGE[1]);
  // A factor entered as "30" instead of "1.30" is the one input error that
  // produces a plausible-looking page rather than an obvious one.
  const factorLooksWrong = factor >= 2;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">The offer</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field id="mca-advance" label="Advance amount" prefix="$" value={advance} onChange={setAdvance} />
                <Field
                  id="mca-factor"
                  label="Factor rate"
                  value={factorRate}
                  onChange={setFactorRate}
                  hint={`Typically ${MCA_FACTOR_RANGE[0]} to ${MCA_FACTOR_RANGE[1]}. Not a percentage.`}
                />
              </FieldGrid>
              <Field
                id="mca-origination"
                label="Origination or underwriting fee"
                suffix="%"
                value={originationPct}
                onChange={setOriginationPct}
                hint="Usually taken off the top, so it never reaches your account."
              />
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">How it gets repaid</p>
            <div className="mt-2.5 space-y-4">
              <ModeTabs
                value={mode}
                onChange={(v) => setMode(v as "holdback" | "fixed")}
                options={[
                  { value: "holdback", label: "Holdback of card sales" },
                  { value: "fixed", label: "Fixed debit" },
                ]}
              />
              {mode === "holdback" ? (
                <FieldGrid>
                  <Field
                    id="mca-holdback"
                    label="Holdback"
                    suffix="%"
                    value={holdbackPct}
                    onChange={setHoldbackPct}
                    hint={`Typically ${MCA_HOLDBACK_RANGE[0]}% to ${MCA_HOLDBACK_RANGE[1]}% of each day's card settlement.`}
                  />
                  <Field
                    id="mca-volume"
                    label="Monthly card volume"
                    prefix="$"
                    value={monthlyVolume}
                    onChange={setMonthlyVolume}
                  />
                </FieldGrid>
              ) : (
                <>
                  <FieldGrid>
                    <Field id="mca-fixed" label="Debit amount" prefix="$" value={fixedAmount} onChange={setFixedAmount} />
                    <SelectField
                      id="mca-freq"
                      label="Frequency"
                      value={fixedFrequency}
                      onChange={(v) => setFixedFrequency(v as "daily" | "weekly")}
                      options={[
                        { value: "daily", label: "Every banking day" },
                        { value: "weekly", label: "Every week" },
                      ]}
                    />
                  </FieldGrid>
                  <Field
                    id="mca-volume-fixed"
                    label="Monthly card volume"
                    prefix="$"
                    value={monthlyVolume}
                    onChange={setMonthlyVolume}
                    hint="Used to show what share of your sales the debit really is."
                  />
                </>
              )}
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Estimated APR"
            value={pct(r.apr)}
            sub={`${money(r.totalCost)} of total cost on ${money(r.netReceived)} actually received.`}
          />

          {r.apr > 0 && band && (
            <Callout tone={r.apr > 100 ? "warn" : "neutral"}>
              <strong className="text-foreground">{band.label}.</strong> {band.note}
            </Callout>
          )}

          <div className="mt-5">
            <ResultRow label="Total repayment" value={money(r.totalRepayment)} note={`${money(r.factorCost)} of factor cost`} />
            <ResultRow label="Origination fee" value={money(r.originationFee)} note="Deducted before funding" />
            <ResultRow label="Cash actually received" value={money(r.netReceived)} emphasis />
            <ResultRow
              label={mode === "holdback" ? "Payment per banking day" : "Effective daily payment"}
              value={money(r.dailyPayment)}
              note={
                mode === "fixed" && r.impliedHoldbackPct > 0
                  ? `That is ${pct(r.impliedHoldbackPct, 1)} of your daily card settlement.`
                  : `${money(r.weeklyPayment)} a week`
              }
            />
            <ResultRow
              label="Estimated payoff"
              value={r.bankingDays > 0 ? `${Math.round(r.bankingDays)} banking days` : "N/A"}
              note={r.bankingDays > 0 ? `About ${r.months.toFixed(1)} months, ${r.calendarDays} calendar days` : undefined}
            />
          </div>

          {factorLooksWrong && (
            <Callout tone="warn">
              A factor rate is a multiplier, not a percentage. A 1.30 factor on {money0(num(advance))} means you
              repay {money0(num(advance) * 1.3)}. If you meant thirty percent, enter 1.30.
            </Callout>
          )}
          {!factorLooksWrong && factorOutOfRange && (
            <Callout tone="warn">
              That factor sits outside the {MCA_FACTOR_RANGE[0]} to {MCA_FACTOR_RANGE[1]} range funders publish.
              Worth double checking the term sheet.
            </Callout>
          )}

          <Caveat>
            The APR is solved on the real cash flow by the actuarial method and annualised over 252 banking days,
            which is the method New York&rsquo;s commercial financing disclosure rule specifies. It is an estimate:
            your actual payoff moves with your sales.
          </Caveat>
        </div>
      }
    />
  );
}

export default McaCalculator;
