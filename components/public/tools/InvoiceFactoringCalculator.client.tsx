"use client";

import * as React from "react";
import {
  DEFAULT_FACTORING_STRUCTURE,
  FACTORING_ANCILLARY_FEES,
  FACTORING_DAY_LADDER,
  FACTORING_DEFAULTS,
  FACTORING_FEE_STRUCTURES,
} from "@/lib/tools-data/factoring";
import {
  factoringFacility,
  factoringInvoice,
  factoringLadder,
  type FactoringFeeTerms,
  type FactoringStructureId,
} from "@/lib/calc/factoring";
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
 * Invoice Factoring Rate to APR Calculator.
 *
 * The gap this exploits: every ranking invoice factoring calculator returns the
 * same two numbers, the advance and the fee, and stops. None of them annualizes,
 * and the ones that do annualize divide by the invoice FACE VALUE, which is not
 * money the merchant ever held. The fee is charged on face; the cash received is
 * the advance. Dividing by face understates the cost by exactly the advance
 * rate, about 15 percent on an 85 percent advance, in the merchant's favor.
 *
 * Both figures are therefore rendered and both are labeled, because a reader
 * cannot tell them apart from the number alone. The arithmetic lives in
 * `lib/calc/factoring.ts` with the Appendix J citation for the annualization.
 *
 * Imports the NARROW data module, never `@/lib/tools-data`, and never
 * `@/lib/tools`: `/tools/[tool]` is one route with one client manifest, so a
 * barrel import here would ship this page's constants to all twenty five
 * calculators. See NOTES.md.
 */
export function InvoiceFactoringCalculator() {
  const d = FACTORING_DEFAULTS;

  const [mode, setMode] = React.useState<"invoice" | "facility">(d.mode);
  const [structure, setStructure] = React.useState<FactoringStructureId>(d.structure);

  const [faceValue, setFaceValue] = React.useState(String(d.faceValue));
  const [advanceRate, setAdvanceRate] = React.useState(String(d.advanceRatePct));
  const [days, setDays] = React.useState(String(d.daysToPayment));

  const [flatPct, setFlatPct] = React.useState(String(d.flatPct));
  const [initialPct, setInitialPct] = React.useState(String(d.initialPct));
  const [initialDays, setInitialDays] = React.useState(String(d.initialDays));
  const [stepPct, setStepPct] = React.useState(String(d.stepPct));
  const [stepDays, setStepDays] = React.useState(String(d.stepDays));
  const [benchmarkPct, setBenchmarkPct] = React.useState(String(d.benchmarkPct));
  const [marginPct, setMarginPct] = React.useState(String(d.marginPct));
  const [basis, setBasis] = React.useState(String(d.dayCountBasis));

  const [transferFee, setTransferFee] = React.useState(String(d.transferFee));
  const [applicationFee, setApplicationFee] = React.useState(String(d.applicationFee));
  const [dueDiligenceFee, setDueDiligenceFee] = React.useState(String(d.dueDiligenceFee));
  const [minimumFee, setMinimumFee] = React.useState(String(d.monthlyMinimumFee));
  const [minimumIsFloor, setMinimumIsFloor] = React.useState(d.minimumIsFloor);
  const [lockboxFee, setLockboxFee] = React.useState(String(d.lockboxMonthlyFee));
  const [terminationFee, setTerminationFee] = React.useState(String(d.terminationFee));
  const [includeTermination, setIncludeTermination] = React.useState(d.includeTermination);

  const [monthlyVolume, setMonthlyVolume] = React.useState(String(d.monthlyFactoredVolume));
  const [averageInvoice, setAverageInvoice] = React.useState(String(d.averageInvoice));

  const terms: FactoringFeeTerms = {
    structure,
    flatPct: num(flatPct),
    initialPct: num(initialPct),
    initialDays: num(initialDays),
    stepPct: num(stepPct),
    stepDays: num(stepDays),
    benchmarkPct: num(benchmarkPct),
    marginPct: num(marginPct),
    dayCountBasis: num(basis) === 365 ? 365 : 360,
  };

  const invoiceInput = {
    faceValue: num(faceValue),
    advanceRatePct: num(advanceRate),
    daysToPayment: num(days),
    terms,
    transferFee: num(transferFee),
    upfrontFees: 0,
    settlementFees: 0,
  };

  const inv = factoringInvoice(invoiceInput);
  const ladder = factoringLadder(invoiceInput, FACTORING_DAY_LADDER);

  const fac = factoringFacility({
    monthlyFactoredVolume: num(monthlyVolume),
    averageInvoice: num(averageInvoice),
    advanceRatePct: num(advanceRate),
    daysToPayment: num(days),
    terms,
    transferFee: num(transferFee),
    applicationFee: num(applicationFee),
    dueDiligenceFee: num(dueDiligenceFee),
    monthlyMinimumFee: num(minimumFee),
    minimumIsFloor,
    lockboxMonthlyFee: num(lockboxFee),
    terminationFee: num(terminationFee),
    includeTermination,
  });

  const activeStructure =
    FACTORING_FEE_STRUCTURES.find((s) => s.id === structure) ?? DEFAULT_FACTORING_STRUCTURE;

  const understatement = inv.aprOnAdvance - inv.aprOnFace;

  const feeFields = (
    <div className="space-y-4">
      <SelectField
        id="if-structure"
        label="How the discount fee is quoted"
        value={structure}
        onChange={(v) => setStructure(v as FactoringStructureId)}
        options={FACTORING_FEE_STRUCTURES.map((s) => ({ value: s.id, label: s.label }))}
        hint={
          activeStructure.chargedOn === "face"
            ? "Charged on the invoice face value, not on the cash you receive."
            : "Accrued daily on funds employed, which is the advance."
        }
      />

      {structure === "flat" && (
        <Field
          id="if-flat"
          label="Flat discount rate"
          suffix="%"
          value={flatPct}
          onChange={setFlatPct}
          hint="Of face value, for the whole recourse period however long it runs."
        />
      )}

      {structure === "tiered" && (
        <>
          <FieldGrid>
            <Field id="if-init-pct" label="Opening rate" suffix="%" value={initialPct} onChange={setInitialPct} />
            <Field id="if-init-days" label="Days it covers" suffix="days" value={initialDays} onChange={setInitialDays} />
          </FieldGrid>
          <FieldGrid>
            <Field id="if-step-pct" label="Added per further period" suffix="%" value={stepPct} onChange={setStepPct} />
            <Field id="if-step-days" label="Length of each period" suffix="days" value={stepDays} onChange={setStepDays} />
          </FieldGrid>
        </>
      )}

      {structure === "prime-plus" && (
        <>
          <FieldGrid>
            <Field
              id="if-bench"
              label="Benchmark rate"
              suffix="%"
              value={benchmarkPct}
              onChange={setBenchmarkPct}
              hint="Bank prime loan rate, Federal Reserve H.15."
            />
            <Field id="if-margin" label="Margin over benchmark" suffix="%" value={marginPct} onChange={setMarginPct} />
          </FieldGrid>
          <SelectField
            id="if-basis"
            label="Day count basis"
            value={basis}
            onChange={setBasis}
            options={[
              { value: "360", label: "360 day year (usual US commercial)" },
              { value: "365", label: "365 day year" },
            ]}
            hint="A 360 day year raises the real rate by 365/360, or about 1.4 percent of itself."
          />
        </>
      )}
    </div>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "invoice" | "facility")}
            options={[
              { value: "invoice", label: "One invoice" },
              { value: "facility", label: "A year on the facility" },
            ]}
          />

          {mode === "invoice" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="if-face" label="Invoice face value" prefix="$" value={faceValue} onChange={setFaceValue} />
                <Field
                  id="if-advance"
                  label="Advance rate"
                  suffix="%"
                  value={advanceRate}
                  onChange={setAdvanceRate}
                  hint="What the factor pays you up front."
                />
              </FieldGrid>
              <Field
                id="if-days"
                label="Days until your customer actually pays"
                suffix="days"
                value={days}
                onChange={setDays}
                hint="Not the stated terms. Net 30 customers pay in 45 more often than in 30."
              />
              {feeFields}
              <Field
                id="if-transfer"
                label="Wire or ACH fee per advance"
                prefix="$"
                value={transferFee}
                onChange={setTransferFee}
                hint="Taken out of the advance, so it also shrinks the amount financed."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="if-monthly-vol"
                  label="Invoice value factored per month"
                  prefix="$"
                  value={monthlyVolume}
                  onChange={setMonthlyVolume}
                  hint="Face value assigned, not cash received."
                />
                <Field
                  id="if-avg-invoice"
                  label="Average invoice"
                  prefix="$"
                  value={averageInvoice}
                  onChange={setAverageInvoice}
                  hint="Sets how many per advance fees you pay."
                />
              </FieldGrid>
              <FieldGrid>
                <Field id="if-advance-2" label="Advance rate" suffix="%" value={advanceRate} onChange={setAdvanceRate} />
                <Field id="if-days-2" label="Average days to payment" suffix="days" value={days} onChange={setDays} />
              </FieldGrid>
              {feeFields}
              <FieldGrid>
                <Field id="if-transfer-2" label="Wire or ACH per advance" prefix="$" value={transferFee} onChange={setTransferFee} />
                <Field id="if-lockbox" label="Lockbox or servicing, monthly" prefix="$" value={lockboxFee} onChange={setLockboxFee} />
              </FieldGrid>
              <Field
                id="if-minimum"
                label="Monthly minimum fee"
                prefix="$"
                value={minimumFee}
                onChange={setMinimumFee}
                hint="Zero by default. Take the real number off your term sheet."
              />
              <CheckboxRow
                checked={minimumIsFloor}
                onChange={() => setMinimumIsFloor((v) => !v)}
                label="The minimum is a floor on my discount fees"
                hint="Untick if your contract adds it on top instead. Read the clause: the two differ by the whole minimum every month you are above it."
              />
              <FieldGrid>
                <Field id="if-app-fee" label="Application or filing fee" prefix="$" value={applicationFee} onChange={setApplicationFee} />
                <Field id="if-dd-fee" label="Due diligence fee" prefix="$" value={dueDiligenceFee} onChange={setDueDiligenceFee} />
              </FieldGrid>
              <Field id="if-term-fee" label="Early termination fee" prefix="$" value={terminationFee} onChange={setTerminationFee} />
              <CheckboxRow
                checked={includeTermination}
                onChange={() => setIncludeTermination((v) => !v)}
                label="Include the termination fee in this year"
                hint="Tick it if you expect to leave inside the term. It is priced on the facility limit or on a volume shortfall, not on what you drew."
              />
            </div>
          )}
        </div>
      }
      results={
        mode === "invoice" ? (
          <div>
            <Headline
              label="Annualized cost of the cash advanced"
              value={pct(inv.aprOnAdvance)}
              sub={`${money(inv.totalCost)} on a ${money0(inv.faceValue)} invoice paid in ${Math.round(inv.daysToPayment)} days. Quoted as ${pct(inv.discountPctApplied, 2)} of face.`}
            />

            <div className="mt-5">
              <ResultRow label="Advance paid to you" value={money(inv.advance)} note={`${pct(num(advanceRate), 1)} of face`} />
              <ResultRow label="Less fees taken at funding" value={money(inv.ancillaryTotal)} />
              <ResultRow label="Cash in the bank on day one" value={money(inv.cashAtFunding)} emphasis />
              <ResultRow label="Reserve held back" value={money(inv.reserveHeld)} />
              <ResultRow label="Discount fee, charged on face" value={money(inv.discountFee)} />
              <ResultRow label="Reserve released when they pay" value={money(inv.cashAtSettlement)} />
              <ResultRow label="Total you keep" value={money(inv.netProceeds)} emphasis />
              <ResultRow label="Total cost" value={money(inv.totalCost)} note={`${pct(inv.costPctOfFace, 2)} of face, ${pct(inv.costPctOfAdvance, 2)} of the advance`} />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">The same fee, annualized two ways</p>
              <div className="mt-2">
                <ResultRow label="On the cash advanced" value={pct(inv.aprOnAdvance)} note="The honest figure" emphasis />
                <ResultRow label="On the invoice face value" value={pct(inv.aprOnFace)} note="What most calculators print" />
                <ResultRow label="Compounded, if you rolled it all year" value={pct(inv.effectiveAnnualRate)} note="Not a disclosure figure" />
              </div>
            </div>

            <Callout tone={inv.aprOnAdvance >= 30 ? "warn" : "neutral"}>
              Annualizing on the invoice face value understates this deal by{" "}
              <strong className="text-foreground">{pct(understatement)}</strong>. The fee is charged on the{" "}
              {money0(inv.faceValue)} face, but only {money(inv.cashAtFunding)} ever reached your account, so the face
              value is not the denominator. That gap is the advance rate, and it never goes away.
            </Callout>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">If they pay sooner, or later</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Paid in", "Fee", "Cost", "On the advance"]}
                  align={["left", "right", "right", "right"]}
                  rows={ladder.map((r) => [
                    <span key={`d-${r.days}`} className="flex items-center gap-2">
                      <span>{r.days} days</span>
                      {r.days === Math.round(inv.daysToPayment) && <Pill tone="neutral">your input</Pill>}
                    </span>,
                    pct(r.discountPct, 2),
                    money0(r.cost),
                    pct(r.aprOnAdvance, 1),
                  ])}
                />
              </div>
            </div>

            <Caveat>
              Fee structure: {activeStructure.label}. {activeStructure.howItIsQuoted}
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Annualized rate on funds employed"
              value={pct(fac.annualizedRateOnFunds)}
              sub={`${money0(fac.annualTotalCost)} a year to keep an average of ${money0(fac.averageFundsEmployed)} advanced.`}
            />

            <div className="mt-5">
              <ResultRow label="Face value factored in a year" value={money0(fac.annualFactoredVolume)} />
              <ResultRow label="Advances funded" value={`${Math.round(fac.advancesPerYear).toLocaleString("en-US")}`} />
              <ResultRow label="Discount fees" value={money0(fac.annualDiscountFees)} note={fac.minimumTopUp > 0 ? `${money0(fac.minimumTopUp)} of that is the monthly minimum, not usage` : undefined} />
              <ResultRow label="Wire or ACH fees" value={money0(fac.annualTransferFees)} />
              <ResultRow label="Lockbox and servicing" value={money0(fac.annualLockboxFees)} />
              <ResultRow label="One time fees" value={money0(fac.oneTimeFees)} note="First year only" />
              <ResultRow label="Total cost of the facility" value={money0(fac.annualTotalCost)} emphasis />
              <ResultRow label="Cost as a share of what you factored" value={pct(fac.costPctOfVolume, 2)} />
              <ResultRow label="You keep" value={money0(fac.annualNetProceeds)} />
            </div>

            <Callout tone={fac.annualizedRateOnFunds >= 30 ? "warn" : "neutral"}>
              Average funds employed is {money0(fac.averageFundsEmployed)}, not the {money0(fac.annualFactoredVolume)} you
              factored: each advanced dollar is out for {Math.round(num(days))} days, so the balance you are really
              renting is the annual advance volume times {Math.round(num(days))}/365. That balance, not the volume, is
              what a bank line would be compared against.
            </Callout>

            <Caveat>
              One time fees are charged once and are not spread here, so year two is cheaper by{" "}
              {money0(fac.oneTimeFees)} on the same usage. If your factor charges a renewal fee, add it back.
            </Caveat>
          </div>
        )
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-small text-muted-foreground">
          The fee is charged on the invoice. The cash is the advance. This calculator annualizes on the advance,
          because that is the money you actually had.
        </p>
        <p className="text-micro text-muted-foreground">
          {FACTORING_ANCILLARY_FEES.length} ancillary fees modeled
        </p>
      </div>
    </CalcShell>
  );
}

export default InvoiceFactoringCalculator;
