"use client";

import * as React from "react";
import {
  COMPOUNDING_OPTIONS,
  COMPOUND_DEFAULTS,
  CONTRIBUTION_OPTIONS,
} from "@/lib/tools-data/interest";
import { compoundInterest } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  CheckboxRow,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ResultRow,
  SelectField,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Compound interest, with the comparison the category leaves out.
 *
 * The four headline outputs deliberately match what a bank's own calculator
 * shows, because those are the right four: what you started with, what you paid
 * in, what the interest earned, and what you end with. Everything below them is
 * what the competing tools do not do.
 *
 * THE ONE OUTPUT THAT MATTERS MOST is "worth more than simple interest". A total
 * interest figure on its own tells you nothing about compounding, because most
 * of it would have been earned anyway. On the defaults the account earns
 * $15,290.66 of interest and compounding accounts for $2,853.16 of that. A page
 * that presents the first number as the compounding effect overstates it fivefold.
 *
 * The doubling row prints the exact figure AND the Rule of 72 estimate side by
 * side rather than quoting the shortcut as fact. The rule is nearly exact at 8%,
 * overstates below it and understates above it, and showing both is the only
 * honest way to use it.
 */

const YEARS_LIMIT = 100;

const years = (n: number): string => {
  if (!Number.isFinite(n)) return "Never";
  if (n >= 1000) return "Over 1,000 years";
  return `${n.toFixed(1)} years`;
};

export function CompoundInterestCalculator() {
  const [principal, setPrincipal] = React.useState(String(COMPOUND_DEFAULTS.principal));
  const [ratePct, setRatePct] = React.useState(String(COMPOUND_DEFAULTS.annualRatePct));
  const [term, setTerm] = React.useState(String(COMPOUND_DEFAULTS.years));
  const [compounds, setCompounds] = React.useState(String(COMPOUND_DEFAULTS.compoundsPerYear));
  const [contribution, setContribution] = React.useState(String(COMPOUND_DEFAULTS.contribution));
  const [contributesPerYear, setContributesPerYear] = React.useState(
    String(COMPOUND_DEFAULTS.contributionsPerYear),
  );
  const [atStart, setAtStart] = React.useState(COMPOUND_DEFAULTS.contributeAtStart);

  const contributionsPerYear = num(contributesPerYear);
  const termYears = Math.min(YEARS_LIMIT, Math.max(0, Math.round(num(term))));

  const r = compoundInterest({
    principal: num(principal),
    annualRatePct: num(ratePct),
    years: termYears,
    compoundsPerYear: num(compounds),
    contribution: num(contribution),
    contributionsPerYear,
    contributeAtStart: atStart,
  });

  const frequencyLabel =
    COMPOUNDING_OPTIONS.find((o) => o.value === compounds)?.label.toLowerCase() ?? "annually";
  const contributing = contributionsPerYear > 0 && num(contribution) > 0;
  const zeroRate = num(ratePct) <= 0;
  const overLimit = Math.round(num(term)) > YEARS_LIMIT;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Your deposit</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field
                  id="ci-principal"
                  label="Initial investment"
                  prefix="$"
                  value={principal}
                  onChange={setPrincipal}
                  hint="What is in the account on day one."
                />
                <Field
                  id="ci-rate"
                  label="Annual return rate"
                  suffix="%"
                  value={ratePct}
                  onChange={setRatePct}
                  hint="The nominal rate, not the APY. We work out the APY below."
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Time and compounding</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field
                  id="ci-years"
                  label="Timeframe"
                  suffix="yrs"
                  inputMode="numeric"
                  value={term}
                  onChange={setTerm}
                  hint="Whole years."
                />
                <SelectField
                  id="ci-compounds"
                  label="Interest is added"
                  value={compounds}
                  onChange={setCompounds}
                  options={COMPOUNDING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  hint="Changes the APY, not the rate you typed."
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Contributions</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field
                  id="ci-contribution"
                  label="Contribution"
                  prefix="$"
                  value={contribution}
                  onChange={setContribution}
                />
                <SelectField
                  id="ci-contribution-period"
                  label="Period"
                  value={contributesPerYear}
                  onChange={setContributesPerYear}
                  options={CONTRIBUTION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </FieldGrid>
              {contributing && (
                <CheckboxRow
                  checked={atStart}
                  onChange={() => setAtStart((v) => !v)}
                  label="Pay in at the start of each period"
                  hint="A deposit at the start earns for that whole period. At the end, the default, it earns nothing until the next one."
                />
              )}
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Final value"
            value={money(r.finalValue)}
            sub={`After ${termYears} ${termYears === 1 ? "year" : "years"} at ${pct(num(ratePct))}, compounded ${frequencyLabel}.`}
          />

          <div className="mt-5">
            <ResultRow label="Initial investment" value={money(r.principal)} />
            <ResultRow
              label="Total additional contributions"
              value={money(r.totalContributions)}
              note={contributing ? `${money(num(contribution))} x ${contributionsPerYear * termYears} deposits` : undefined}
            />
            <ResultRow label="Total returns" value={money(r.totalReturns)} note="Interest only" />
            <ResultRow label="Final value" value={money(r.finalValue)} emphasis />
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Rate and time</p>
            <div className="mt-2">
              <ResultRow
                label="Effective annual yield (APY)"
                value={pct(r.apy, 4)}
                note={`What ${pct(num(ratePct))} compounded ${frequencyLabel} is actually worth in a year`}
              />
              <ResultRow
                label="Years to double the opening balance"
                value={years(r.doublingYears)}
                note="Contributions excluded, so this is growth rather than a savings plan"
              />
              <ResultRow
                label="Rule of 72 estimate"
                value={years(r.ruleOf72Years)}
                note={
                  Number.isFinite(r.doublingYears) && Number.isFinite(r.ruleOf72Years)
                    ? `${r.ruleOf72Years > r.doublingYears ? "Overstates" : "Understates"} the real figure by ${Math.abs(r.ruleOf72Years - r.doublingYears).toFixed(2)} years`
                    : undefined
                }
              />
            </div>
          </div>

          {zeroRate ? (
            <Callout>
              At a zero rate nothing compounds, so the final value is simply what you paid in. Enter the rate the
              account actually pays.
            </Callout>
          ) : (
            <Callout tone={r.compoundingPremium > 0 ? "good" : "neutral"}>
              Compounding is worth{" "}
              <strong className="text-foreground">{money(r.compoundingPremium)}</strong> here. The same deposits
              at the same rate with interest that never compounds reach {money(r.simpleFinalValue)}, so
              compounding accounts for {pct((r.compoundingPremium / (r.totalReturns || 1)) * 100, 1)} of the{" "}
              {money(r.totalReturns)} of interest. The rest would have been earned either way.
            </Callout>
          )}

          {overLimit && (
            <Callout tone="warn">
              Capped at {YEARS_LIMIT} years. Past that the arithmetic still works and the projection stops
              meaning anything.
            </Callout>
          )}

          {r.schedule.length > 0 && (
            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Year by year</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Year", "Start", "Paid in", "Interest", "End"]}
                  maxHeight="18rem"
                  rows={r.schedule.map((y) => [
                    String(y.year),
                    money0(y.startBalance),
                    money0(y.contributions),
                    money(y.interest),
                    money0(y.endBalance),
                  ])}
                />
              </div>
            </div>
          )}

          <Caveat>
            A gross nominal projection at a fixed rate. No tax, inflation, fees or missed deposits. Interest
            credited to a US deposit account is generally taxable in the year it is credited, so the amount you
            keep is lower than the figure above.
          </Caveat>
        </div>
      }
    />
  );
}

export default CompoundInterestCalculator;
