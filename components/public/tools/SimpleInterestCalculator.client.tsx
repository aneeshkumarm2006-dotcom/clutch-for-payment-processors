"use client";

import * as React from "react";
import {
  DAY_BASIS_OPTIONS,
  SIMPLE_DEFAULTS,
  TERM_UNIT_OPTIONS,
} from "@/lib/tools-data/interest";
import { simpleInterest } from "@/lib/tools-math";
import type { DayBasis, SimpleInput } from "@/lib/tools-math";
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

/**
 * Simple interest, with the day count made explicit.
 *
 * The arithmetic is one multiplication, so the reason this is a page rather than
 * a sentence is the denominator. A term in days has to be divided by an assumed
 * year length, and US commercial lending routinely assumes 360, which turns a
 * 9.00% note into a 9.125% one without touching the rate on the paper.
 *
 * The basis selector only appears when the term is counted in DAYS. That is not
 * a UI shortcut: a term stated in months or years is the same fraction of a year
 * under either convention, so offering the choice there would imply a difference
 * that does not exist.
 *
 * The APY row uses the Regulation DD formula and always divides by actual days,
 * never 360, even when the accrual used 360. The accrual convention decides how
 * many dollars were earned; the APY formula annualises those dollars over real
 * elapsed time. Putting 360 in the exponent counts the convention twice.
 */
export function SimpleInterestCalculator() {
  const [principal, setPrincipal] = React.useState(String(SIMPLE_DEFAULTS.principal));
  const [ratePct, setRatePct] = React.useState(String(SIMPLE_DEFAULTS.annualRatePct));
  const [termValue, setTermValue] = React.useState(String(SIMPLE_DEFAULTS.termValue));
  const [termUnit, setTermUnit] = React.useState<SimpleInput["termUnit"]>(SIMPLE_DEFAULTS.termUnit);
  const [dayBasis, setDayBasis] = React.useState(String(SIMPLE_DEFAULTS.dayBasis));

  const basis: DayBasis = dayBasis === "360" ? 360 : 365;
  const countingDays = termUnit === "days";

  const r = simpleInterest({
    principal: num(principal),
    annualRatePct: num(ratePct),
    termValue: num(termValue),
    termUnit,
    dayBasis: basis,
  });

  const usingCommercialBasis = countingDays && basis === 360;
  const unitLabel = TERM_UNIT_OPTIONS.find((o) => o.value === termUnit)?.label.toLowerCase() ?? "days";
  const overOneYear = r.days > 365;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">The deal</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field
                  id="si-principal"
                  label="Principal"
                  prefix="$"
                  value={principal}
                  onChange={setPrincipal}
                  hint="The amount borrowed, lent or deposited."
                />
                <Field
                  id="si-rate"
                  label="Annual interest rate"
                  suffix="%"
                  value={ratePct}
                  onChange={setRatePct}
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">The term</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field
                  id="si-term"
                  label="Term"
                  inputMode="numeric"
                  value={termValue}
                  onChange={setTermValue}
                />
                <SelectField
                  id="si-term-unit"
                  label="Counted in"
                  value={termUnit}
                  onChange={(v) => setTermUnit(v as SimpleInput["termUnit"])}
                  options={TERM_UNIT_OPTIONS}
                />
              </FieldGrid>
              {/* Only meaningful when days are being counted: a term in months or
                  years is the same fraction of a year under either convention. */}
              {countingDays && (
                <SelectField
                  id="si-basis"
                  label="Day count basis"
                  value={dayBasis}
                  onChange={setDayBasis}
                  options={DAY_BASIS_OPTIONS}
                  hint="Actual/360 is standard in US commercial lending and charges 365 days of a rate set for a 360 day year."
                />
              )}
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Interest"
            value={money(r.interest)}
            sub={`On ${money(num(principal))} at ${pct(num(ratePct))} for ${num(termValue).toLocaleString("en-US")} ${unitLabel}.`}
          />

          <div className="mt-5">
            <ResultRow label="Principal" value={money(num(principal))} />
            <ResultRow label="Interest" value={money(r.interest)} />
            <ResultRow label="Total at maturity" value={money(r.total)} emphasis />
            <ResultRow
              label="Accrual per day"
              value={money(r.perDay)}
              note="Constant for the whole term, which is what makes it simple interest"
            />
            <ResultRow label="Accrual per month" value={money(r.perMonth)} />
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Compare it to anything else</p>
            <div className="mt-2">
              <ResultRow
                label="Effective annual rate"
                value={pct(r.effectiveRatePct, 4)}
                note={
                  usingCommercialBasis
                    ? `Actual/360 charges 365/360 of the ${pct(num(ratePct))} you were quoted`
                    : "Equal to the quoted rate on an Actual/365 basis"
                }
              />
              <ResultRow
                label="Annual percentage yield"
                value={pct(r.apy, 4)}
                note="Regulation DD formula, annualised over the actual days in the term"
              />
              <ResultRow
                label="If it compounded monthly instead"
                value={money(r.compoundedMonthly)}
                note={`${r.compoundingGap >= 0 ? "Compounding would add" : "Simple interest is ahead by"} ${money(Math.abs(r.compoundingGap))}`}
              />
            </div>
          </div>

          {usingCommercialBasis ? (
            <Callout tone="warn">
              On an Actual/360 basis this accrues at{" "}
              <strong className="text-foreground">{pct(r.effectiveRatePct, 3)}</strong>, not the{" "}
              {pct(num(ratePct))} on the paper. Switch the basis to Actual/365 to see the difference in dollars,
              and convert both quotes to the same basis before comparing them.
            </Callout>
          ) : (
            countingDays && (
              <Callout>
                This is an Actual/365 basis, so the effective rate equals the quoted rate. If your note says
                interest accrues on a 360 day year, switch the basis: the same rate then costs 1.39% more.
              </Callout>
            )
          )}

          {overOneYear && (
            <Callout tone="neutral">
              Past a year the gap against compounding stops being a rounding error. Over this term it is{" "}
              {money(Math.abs(r.compoundingGap))}, and the APY falls below the stated rate because a deal that
              never compounds loses ground against the annualised standard every year it runs.
            </Callout>
          )}

          <Caveat>
            Interest never joins the principal, so nothing compounds and the daily accrual is flat. If your
            agreement capitalises unpaid interest at any point, use the compound interest calculator instead. No
            tax, fees, origination charges or prepayment terms are modelled.
          </Caveat>
        </div>
      }
    />
  );
}

export default SimpleInterestCalculator;
