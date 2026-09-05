"use client";

import * as React from "react";
import {
  APR_APY_DEFAULTS,
  COMPOUNDING_FREQUENCIES,
  convertRate,
  frequencyLabel,
  frequencyLadder,
  type ConversionDirection,
} from "@/lib/calc/apr-apy";
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
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * APR vs APY, both directions, plus the restatement across schedules.
 *
 * WHY THREE MODES. The query has three shapes and they are not the same
 * calculation. A borrower has an APR and wants the APY. A saver has an
 * advertised APY, because Regulation DD makes the bank advertise the APY, and
 * wants the nominal rate so they can model a month. And anyone comparing two
 * offers quoted on different schedules needs both rates expressed on ONE
 * schedule, which is neither of the first two.
 *
 * WHY THE DOLLARS ARE ON EVERY SCREEN. The percentage gap is the reason nobody
 * takes this seriously: 24.99 against 28.38 reads as a rounding argument. The
 * same gap on a $10,000 balance is $338.87 in a year, and that is the number
 * that changes behaviour. The ladder prints both columns side by side for
 * exactly that reason.
 *
 * NO VERDICT BAND HERE. `Verdict` scores a merchant's blended monthly effective
 * processing rate against the bands in `lib/tools-rates.ts`. A deposit yield or
 * a card APR is not that quantity, and running it through those bands would
 * label a normal savings account "High".
 */

const FREQUENCY_OPTIONS = COMPOUNDING_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }));

const YEARS_LIMIT = 100;

export function AprApyCalculator() {
  const [mode, setMode] = React.useState<ConversionDirection>(APR_APY_DEFAULTS.direction);
  const [apr, setApr] = React.useState(String(APR_APY_DEFAULTS.aprPct));
  const [apy, setApy] = React.useState(String(APR_APY_DEFAULTS.apyPct));
  const [compounds, setCompounds] = React.useState(String(APR_APY_DEFAULTS.compoundsPerYear));
  const [target, setTarget] = React.useState(String(APR_APY_DEFAULTS.targetCompoundsPerYear));
  const [balance, setBalance] = React.useState(String(APR_APY_DEFAULTS.balance));
  const [term, setTerm] = React.useState(String(APR_APY_DEFAULTS.years));

  const enteredRate = mode === "apyToApr" ? num(apy) : num(apr);
  const years = Math.min(YEARS_LIMIT, Math.max(0, num(term)));

  const r = convertRate({
    direction: mode,
    ratePct: enteredRate,
    compoundsPerYear: num(compounds),
    targetCompoundsPerYear: num(target),
    balance: num(balance),
    years,
  });

  const ladder = frequencyLadder(r.aprPct, num(balance));
  const scheduleLabel = frequencyLabel(r.periodsPerYear).toLowerCase();
  const targetLabel = frequencyLabel(r.restatedPeriodsPerYear).toLowerCase();
  const sameSchedule = r.periodsPerYear === r.restatedPeriodsPerYear;
  const showTerm = years > 1;

  const headline =
    mode === "apyToApr"
      ? { label: "Nominal annual rate (APR)", value: pct(r.aprPct, 3) }
      : mode === "restate"
        ? { label: `Same rate, quoted ${targetLabel}`, value: pct(r.restatedAprPct, 3) }
        : { label: "Effective annual yield (APY)", value: pct(r.apyPct, 3) };

  const headlineSub =
    mode === "apyToApr"
      ? `An advertised ${pct(r.apyPct, 3)} APY compounded ${scheduleLabel} is a nominal ${pct(r.aprPct, 3)} before compounding.`
      : mode === "restate"
        ? sameSchedule
          ? "Pick a different schedule above to restate the rate."
          : `${pct(r.aprPct, 3)} compounded ${scheduleLabel} and ${pct(r.restatedAprPct, 3)} compounded ${targetLabel} pay the same money.`
        : `${pct(r.aprPct, 3)} APR compounded ${scheduleLabel} is ${pct(r.apyPct, 3)} once the interest already credited starts earning too.`;

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as ConversionDirection)}
            options={[
              { value: "aprToApy", label: "APR to APY" },
              { value: "apyToApr", label: "APY to APR" },
              { value: "restate", label: "Restate a rate" },
            ]}
          />

          <FieldGrid>
            {mode === "apyToApr" ? (
              <Field
                id="aa-apy"
                label="Quoted APY"
                suffix="%"
                value={apy}
                onChange={setApy}
                hint="The advertised yield. Regulation DD makes US banks lead with this one."
              />
            ) : (
              <Field
                id="aa-apr"
                label="Quoted APR"
                suffix="%"
                value={apr}
                onChange={setApr}
                hint="The nominal annual rate on the paper, before compounding."
              />
            )}
            <SelectField
              id="aa-compounds"
              label="Interest compounds"
              value={compounds}
              onChange={setCompounds}
              options={FREQUENCY_OPTIONS}
              hint="A US card statement almost always says daily."
            />
          </FieldGrid>

          {mode === "restate" && (
            <SelectField
              id="aa-target"
              label="Restate it on this schedule"
              value={target}
              onChange={setTarget}
              options={FREQUENCY_OPTIONS}
              hint="Two offers only compare once both are quoted the same way."
            />
          )}

          <FieldGrid>
            <Field
              id="aa-balance"
              label="Balance"
              prefix="$"
              value={balance}
              onChange={setBalance}
              hint="What the rate is charged on, or paid on."
            />
            <Field
              id="aa-years"
              label="Held for"
              suffix="yrs"
              value={term}
              onChange={setTerm}
              hint="One year isolates the compounding effect."
            />
          </FieldGrid>
        </div>
      }
      results={
        <div>
          <Headline label={headline.label} value={headline.value} sub={headlineSub} />

          <div className="mt-5">
            <ResultRow
              label="Nominal annual rate (APR)"
              value={pct(r.aprPct, 3)}
              note={`Compounded ${scheduleLabel}`}
              emphasis={mode === "apyToApr"}
            />
            <ResultRow
              label="Effective annual yield (APY)"
              value={pct(r.apyPct, 3)}
              note="The Regulation DD number, and the only one two schedules can be compared on"
              emphasis={mode === "aprToApy"}
            />
            <ResultRow
              label="Difference"
              value={`${r.spreadPct >= 0 ? "+" : ""}${r.spreadPct.toFixed(3)} pts`}
              note={r.isAnnual ? "Annual compounding, so there is nothing to compound within the year" : undefined}
            />
            <ResultRow
              label="Rate applied each period"
              value={r.periodicRatePct === null ? "No period" : pct(r.periodicRatePct, 6)}
              note={
                r.periodicRatePct === null
                  ? "Continuous compounding has no period"
                  : `${pct(r.aprPct, 3)} divided by ${Math.round(r.periodsPerYear)} periods`
              }
            />
            {mode === "restate" && (
              <ResultRow
                label={`Equivalent rate quoted ${targetLabel}`}
                value={pct(r.restatedAprPct, 3)}
                note="Different nominal rate, identical yield and identical dollars"
                emphasis
              />
            )}
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">
              One year on {money0(Math.max(0, num(balance)))}
            </p>
            <div className="mt-2">
              <ResultRow label="With compounding, at the APY" value={money(r.compoundedYearOne)} />
              <ResultRow
                label="Without compounding, at the APR"
                value={money(r.nominalYearOne)}
                note="Simple interest, the same rate applied once"
              />
              <ResultRow label="What compounding adds" value={money(r.yearOneGap)} emphasis />
            </div>
          </div>

          {showTerm && (
            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">
                After {years % 1 === 0 ? years : years.toFixed(1)} years
              </p>
              <div className="mt-2">
                <ResultRow label="Balance at the APY" value={money(r.compoundedValue)} />
                <ResultRow label="Balance at simple interest" value={money(r.nominalValue)} />
                <ResultRow label="Difference" value={money(r.termGap)} emphasis />
              </div>
            </div>
          )}

          {r.isAnnual ? (
            <Callout>
              Compounded once a year, the APR and the APY are the same number. That is the definition, not a
              coincidence, and it is the only schedule on which the two agree.
            </Callout>
          ) : (
            <Callout tone={r.yearOneGap > 0 ? "warn" : "neutral"}>
              The percentage gap is {Math.abs(r.spreadPct).toFixed(3)} points, which sounds like nothing. On{" "}
              {money0(Math.max(0, num(balance)))} it is{" "}
              <strong className="text-foreground">{money(r.yearOneGap)}</strong> in the first year. Compounded{" "}
              {scheduleLabel}, this schedule captures {pct(r.ceilingCapturedPct, 2)} of the {pct(r.continuousApyPct, 3)}{" "}
              ceiling that continuous compounding would reach at the same nominal rate.
            </Callout>
          )}

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">
              {pct(r.aprPct, 3)} on every schedule
            </p>
            <div className="mt-2">
              <MiniTable
                columns={["Compounds", "Each period", "APY", "One year", "vs annual"]}
                align={["left", "right", "right", "right", "right"]}
                maxHeight="20rem"
                rows={ladder.map((row) => [
                  <span key={row.label} className="flex items-center gap-2">
                    <span className="text-foreground">{row.label}</span>
                    {row.periodsPerYear === r.periodsPerYear && <Pill tone="good">yours</Pill>}
                  </span>,
                  row.periodicRatePct === null ? "n/a" : pct(row.periodicRatePct, 6),
                  pct(row.apyPct, 3),
                  money(row.interestOneYear),
                  row.gapVsAnnual === 0 ? "base" : money(row.gapVsAnnual),
                ])}
              />
            </div>
          </div>

          <Caveat>
            A rate with no schedule attached is not yet a number, so the answer above is only as good as the
            compounding frequency you picked. Check the account agreement or the statement rather than guessing.
            One thing this page cannot convert: a merchant cash advance factor rate. A factor is a flat multiplier
            with no time in it, so there is no rate here to enter and nothing to compound. Use the merchant cash
            advance calculator instead.
          </Caveat>
        </div>
      }
    />
  );
}

export default AprApyCalculator;
