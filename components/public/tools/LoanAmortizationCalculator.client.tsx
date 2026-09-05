"use client";

import * as React from "react";
import {
  LOAN_AMORTIZATION_DEFAULTS as D,
  buildSchedule,
  equivalentFactorRate,
  extraPaymentEffect,
  sbaGuarantyFee,
  sbaMaxVariableRate,
  type LoanInput,
} from "@/lib/calc/amortization";
import {
  CalcShell,
  Callout,
  Caveat,
  CheckboxRow,
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
 * Business Loan Amortization Calculator.
 *
 * Three modes, because a borrower holding a term sheet is asking three questions
 * and only the first of them is "what is the payment".
 *
 * The gap this exploits. Every calculator ranking for this query is a mortgage
 * calculator with the word business in the title: principal, rate, term, a
 * schedule, and nothing else. None of them models the two things that make a
 * business loan different from a mortgage. First, the fees come OUT of the
 * disbursement rather than being added to the balance, so the borrower repays
 * the face amount while receiving less than it, and the real APR is above the
 * note rate. Second, the alternative on the table is usually not another bank,
 * it is a merchant cash advance, so the page prices one against the other and
 * hands the reader off to the tool that does advances properly.
 *
 * The arithmetic is in `lib/calc/amortization.ts` and is tested there, for the
 * reason stated in that file's header: a schedule that fails to land on zero, an
 * APR solver on the wrong branch and a negatively amortizing loop are all silent
 * failures that return a confident number.
 *
 * IMPORTS: this module deliberately imports only the narrow calc module. A
 * `"use client"` module under this directory must never import `@/lib/tools`,
 * `@/lib/tools-defs`, `@/lib/rate-cards` or the `@/lib/tools-data` barrel, since
 * `/tools/[tool]` is one route and one client manifest, so anything imported
 * here lands in the chunk that every calculator on the site downloads.
 */
export function LoanAmortizationCalculator() {
  const [mode, setMode] = React.useState<"schedule" | "extra" | "sba">("schedule");

  const [principal, setPrincipal] = React.useState(String(D.principal));
  const [ratePct, setRatePct] = React.useState(String(D.annualRatePct));
  const [termMonths, setTermMonths] = React.useState(String(D.termMonths));
  const [originationPct, setOriginationPct] = React.useState(String(D.originationPct));
  const [flatFees, setFlatFees] = React.useState(String(D.flatFees));
  const [extraPayment, setExtraPayment] = React.useState(String(D.extraPayment));
  const [balloonOn, setBalloonOn] = React.useState(false);
  const [balloonMonths, setBalloonMonths] = React.useState(String(D.balloonTermMonths));
  const [everyPayment, setEveryPayment] = React.useState(false);

  const [spreadPct, setSpreadPct] = React.useState(String(D.sbaSpreadPct));
  const [primePct, setPrimePct] = React.useState(String(D.primeRatePct));

  const face = Math.max(0, num(principal));
  const amortMonths = Math.max(0, Math.round(num(termMonths)));
  const maturity = balloonOn ? Math.max(1, Math.round(num(balloonMonths))) : amortMonths;

  const sbaFee = sbaGuarantyFee(face, amortMonths);
  const sbaRate = Math.max(0, num(primePct)) + Math.max(0, num(spreadPct));
  const sbaCeiling = sbaMaxVariableRate(face, Math.max(0, num(primePct)));

  const input: LoanInput = React.useMemo(() => {
    const shared = {
      principal: face,
      amortizationMonths: amortMonths,
      termMonths: mode === "schedule" ? maturity : amortMonths,
      extraPayment: mode === "extra" ? Math.max(0, num(extraPayment)) : 0,
    };
    if (mode === "sba") {
      return {
        ...shared,
        annualRatePct: sbaRate,
        fees: { originationPct: 0, flatFees: Math.max(0, num(flatFees)), guarantyFee: sbaFee.fee },
      };
    }
    return {
      ...shared,
      annualRatePct: Math.max(0, num(ratePct)),
      fees: {
        originationPct: Math.max(0, num(originationPct)),
        flatFees: Math.max(0, num(flatFees)),
        guarantyFee: 0,
      },
    };
  }, [face, amortMonths, maturity, mode, extraPayment, ratePct, originationPct, flatFees, sbaRate, sbaFee.fee]);

  const schedule = React.useMemo(() => buildSchedule(input), [input]);
  const effect = React.useMemo(
    () => extraPaymentEffect({ ...input, extraPayment: Math.max(0, num(extraPayment)) }),
    [input, extraPayment],
  );

  const factor = equivalentFactorRate(schedule.amountFinanced, schedule.totalPaid);
  const aprUplift = schedule.aprPct - schedule.noteRatePct;
  const years = amortMonths / 12;

  const termOptions = [
    { value: "12", label: "1 year (12 payments)" },
    { value: "24", label: "2 years (24 payments)" },
    { value: "36", label: "3 years (36 payments)" },
    { value: "60", label: "5 years (60 payments)" },
    { value: "84", label: "7 years (84 payments)" },
    { value: "120", label: "10 years (120 payments)" },
    { value: "180", label: "15 years (180 payments)" },
    { value: "300", label: "25 years (300 payments)" },
  ];

  const scheduleTable = everyPayment ? (
    <MiniTable
      columns={["#", "Payment", "Interest", "Principal", "Balance"]}
      align={["left", "right", "right", "right", "right"]}
      maxHeight="360px"
      rows={schedule.rows.map((r) => [
        String(r.period),
        money(r.payment),
        money(r.interest),
        money(r.principal + r.extra),
        money(r.balance),
      ])}
      empty="Enter a loan amount, a rate and a term."
    />
  ) : (
    <MiniTable
      columns={["Year", "Paid", "Interest", "Principal", "Balance"]}
      align={["left", "right", "right", "right", "right"]}
      maxHeight="360px"
      rows={schedule.yearly.map((y) => [
        String(y.year),
        money0(y.totalPaid),
        money0(y.interest),
        money0(y.principal),
        money0(y.endingBalance),
      ])}
      empty="Enter a loan amount, a rate and a term."
    />
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "schedule" | "extra" | "sba")}
            options={[
              { value: "schedule", label: "Payment and schedule" },
              { value: "extra", label: "Extra payments" },
              { value: "sba", label: "SBA 7(a)" },
            ]}
          />

          <FieldGrid>
            <Field id="la-principal" label="Loan amount" prefix="$" value={principal} onChange={setPrincipal} />
            <SelectField id="la-term" label="Amortization term" value={termMonths} onChange={setTermMonths} options={termOptions} />
          </FieldGrid>

          {mode === "sba" ? (
            <FieldGrid>
              <Field
                id="la-prime"
                label="Prime rate"
                suffix="%"
                value={primePct}
                onChange={setPrimePct}
                hint="Fed H.15 bank prime loan rate, 4 September 2026."
              />
              <Field
                id="la-spread"
                label="Lender spread over prime"
                suffix="%"
                value={spreadPct}
                onChange={setSpreadPct}
                hint={`SBA ceiling at this loan size is prime plus ${pct(sbaCeiling.spreadPct, 2)}.`}
              />
            </FieldGrid>
          ) : (
            <FieldGrid>
              <Field id="la-rate" label="Interest rate" suffix="%" value={ratePct} onChange={setRatePct} hint="The note rate, before fees." />
              <Field
                id="la-orig"
                label="Origination fee"
                suffix="%"
                value={originationPct}
                onChange={setOriginationPct}
                hint="Deducted at funding, not added to the balance."
              />
            </FieldGrid>
          )}

          <FieldGrid>
            <Field
              id="la-flat"
              label={mode === "sba" ? "Packaging and closing fees" : "Other closing fees"}
              prefix="$"
              value={flatFees}
              onChange={setFlatFees}
              hint="Packaging, documentation, filing, appraisal."
            />
            {mode === "extra" ? (
              <Field
                id="la-extra"
                label="Extra principal each month"
                prefix="$"
                value={extraPayment}
                onChange={setExtraPayment}
                hint="Paid alongside every scheduled payment."
              />
            ) : mode === "sba" ? (
              <div className="min-w-0 rounded border bg-muted px-4 py-3">
                <p className="text-label uppercase text-muted-foreground">SBA guaranty fee</p>
                <p className="mt-1 text-h4 tabular-nums text-foreground">{money(sbaFee.fee)}</p>
                <p className="mt-1 text-micro text-muted-foreground">
                  {pct(sbaFee.feePct, 2)} of the {pct(sbaFee.guarantyPct, 0)} guaranteed portion, {money0(sbaFee.guaranteedPortion)}.
                </p>
              </div>
            ) : (
              <Field
                id="la-balloon"
                label="Balloon: months to maturity"
                value={balloonMonths}
                onChange={setBalloonMonths}
                hint="Only used when the balloon box below is ticked."
              />
            )}
          </FieldGrid>

          {mode === "schedule" && (
            <CheckboxRow
              checked={balloonOn}
              onChange={() => setBalloonOn((v) => !v)}
              label="This note balloons before it fully amortizes"
              hint="The payment is sized on the amortization term. The balance falls due at maturity."
            />
          )}

          {mode !== "extra" && (
            <CheckboxRow
              checked={everyPayment}
              onChange={() => setEveryPayment((v) => !v)}
              label="Show every payment instead of a yearly summary"
              hint={`${schedule.payments} rows. The summary is easier to read at ${amortMonths} periods.`}
            />
          )}
        </div>
      }
      results={
        schedule.neverAmortizes ? (
          <div>
            <Headline
              label="This loan never pays off"
              value="No schedule"
              sub="The payment does not cover one period of interest, so the balance grows instead of shrinking."
            />
            <Callout tone="warn">
              At {pct(Math.max(0, num(ratePct)))} on {money0(face)}, one month of interest is more than the level payment
              this term produces. Shorten the term, lower the rate, or check that the rate you entered is annual rather
              than monthly.
            </Callout>
          </div>
        ) : mode === "extra" ? (
          <div>
            <Headline
              label="Interest saved by the extra payment"
              value={money(effect.interestSaved)}
              sub={`${effect.monthsSaved} months removed. Paid off after ${effect.acceleratedPayments} payments instead of ${effect.baselinePayments}.`}
            />
            <div className="mt-5">
              <ResultRow label="Scheduled payment" value={money(schedule.scheduledPayment)} />
              <ResultRow
                label="Payment including the extra"
                value={money(schedule.scheduledPayment + Math.max(0, num(extraPayment)))}
                emphasis
              />
              <ResultRow label="Interest without the extra" value={money(effect.baselineInterest)} note={`${effect.baselinePayments} payments`} />
              <ResultRow label="Interest with the extra" value={money(effect.acceleratedInterest)} note={`${effect.acceleratedPayments} payments`} />
              <ResultRow label="Extra principal actually paid" value={money(effect.extraPaid)} />
              <ResultRow label="Interest saved" value={money(effect.interestSaved)} emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Year by year, with the extra applied</p>
              <div className="mt-2">{scheduleTable}</div>
            </div>

            <Callout tone={effect.interestSaved > 0 ? "good" : "neutral"}>
              You put in {money0(effect.extraPaid)} of extra principal and took {money0(effect.interestSaved)} of interest
              off the loan. Check the note for a prepayment charge before you start: on a business term loan it is usually
              a declining percentage in the first two or three years, and on an SBA 7(a) loan with a maturity of fifteen
              years or more there is a statutory prepayment charge in the first three years.
            </Callout>

            <Caveat>
              The saving is the difference between two full schedules the calculator can print, not a shortcut formula.
              Extra principal is assumed to be applied on the payment date and to reduce principal, which is what your
              note should say. Some servicers hold unscheduled money as a prepaid regular payment instead, which saves
              you nothing.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Monthly payment"
              value={money(schedule.scheduledPayment)}
              sub={
                mode === "sba"
                  ? `${money0(face)} at ${pct(sbaRate)} over ${years.toFixed(0)} years, prime plus ${pct(Math.max(0, num(spreadPct)), 2)}.`
                  : `${money0(face)} at ${pct(schedule.noteRatePct)} over ${years.toFixed(0)} years.`
              }
            />

            <div className="mt-5">
              <ResultRow label="Note rate" value={pct(schedule.noteRatePct)} />
              <ResultRow
                label="APR, fees included"
                value={pct(schedule.aprPct)}
                note={aprUplift > 0.005 ? `${pct(aprUplift)} above the note rate` : "No fees deducted, so it matches"}
                emphasis
              />
              <ResultRow label="Face amount of the note" value={money(face)} />
              {mode === "sba" ? (
                <ResultRow label="SBA guaranty fee" value={`-${money(schedule.fees.guaranty)}`} note={sbaFee.tier} />
              ) : (
                <ResultRow
                  label="Origination fee"
                  value={`-${money(schedule.fees.origination)}`}
                  note={`${pct(Math.max(0, num(originationPct)))} of the face amount`}
                />
              )}
              <ResultRow label="Other closing fees" value={`-${money(schedule.fees.flat)}`} />
              <ResultRow label="Cash you actually receive" value={money(schedule.amountFinanced)} emphasis />
              <ResultRow label="Total interest" value={money(schedule.totalInterest)} />
              <ResultRow label="Total repaid" value={money(schedule.totalPaid)} note={`${schedule.payments} payments`} />
              <ResultRow label="Total cost of the money" value={money(schedule.totalCostOfCapital)} note="Interest plus every fee" emphasis />
              {balloonOn && mode === "schedule" ? (
                <ResultRow label="Balloon due at maturity" value={money(schedule.balloonDue)} note={`Payment ${schedule.payments}, plus that month's interest`} emphasis />
              ) : (
                <ResultRow label="Final payment" value={money(schedule.finalPayment)} note="Adjusted so the balance lands on zero" />
              )}
            </div>

            {mode === "sba" && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Pill tone={sbaRate <= sbaCeiling.maxRatePct ? "good" : "bad"}>
                  {sbaRate <= sbaCeiling.maxRatePct ? "Inside the SBA rate ceiling" : "Above the SBA rate ceiling"}
                </Pill>
                <span className="text-micro text-muted-foreground">
                  Ceiling at {money0(face)} is prime plus {pct(sbaCeiling.spreadPct, 2)}, which is {pct(sbaCeiling.maxRatePct)} today.
                </span>
                {sbaFee.overProgramMax && <Pill tone="warn">Above the $5,000,000 7(a) maximum</Pill>}
              </div>
            )}

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">
                {everyPayment ? "Every payment" : "Year by year"}
              </p>
              <div className="mt-2">{scheduleTable}</div>
            </div>

            {balloonOn && mode === "schedule" ? (
              <Callout tone="warn">
                {money0(schedule.balloonDue)} of the {money0(face)} you borrowed is still outstanding when this note
                matures at payment {schedule.payments}. That is not a payment so much as a promise to stay creditworthy
                {Math.round(maturity / 12)} years from now, at whatever rate the market sets by then. Price the
                refinance today, not the week the balloon comes due.
              </Callout>
            ) : (
              <Callout>
                A merchant cash advance that put the same {money0(schedule.amountFinanced)} in your account and took back
                the same {money0(schedule.totalPaid)} would be quoted as a {factor.toFixed(2)} factor rate. That is the
                same dollars, not the same price: an advance repays out of daily card settlement in months rather than{" "}
                {years.toFixed(0)} years, so the annualized cost is several times higher. Run the advance properly on the
                merchant cash advance calculator before you compare the two.
              </Callout>
            )}

            <Caveat>
              {mode === "sba"
                ? "Guaranty fee from SBA Information Notice 5000-872051, the FY 2026 7(a) fee schedule effective 28 August 2025, checked 5 September 2026. It is charged on the guaranteed portion, not on the loan. The lender's 0.55 percent annual service fee is excluded because lenders may not pass it on to the borrower. A prime-based SBA rate is variable, and this schedule holds it flat."
                : "Monthly accrual on the outstanding balance, each period rounded to the cent, final payment adjusted so the balance lands exactly on zero. The APR is the actuarial method of Appendix J to 12 CFR Part 1026: the monthly rate multiplied by twelve, never compounded."}
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default LoanAmortizationCalculator;
