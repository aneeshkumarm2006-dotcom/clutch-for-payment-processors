"use client";

import * as React from "react";
import { computeSavings } from "@/lib/calc/savings";
import {
  ACH_PRICE_OPTIONS,
  DO_NOTHING_FLOOR_ANNUAL,
  PASS_THROUGH_BAND,
  PUBLISHED_MARKUP_BENCHMARKS,
  SAVINGS_DEFAULTS,
  SAVINGS_LEVERS,
  SURCHARGE_NETWORK_CAP_PCT,
} from "@/lib/tools-data/savings";
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
  bps,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The Processing Savings Calculator behind
 * `/tools/credit-card-processing-savings-calculator`.
 *
 * What every ranking page on this query does, and this one does not: compute
 * each saving against the original statement and add them up. That total is
 * unreachable, because the levers overlap in five separate ways. The ordering
 * that fixes it lives in `lib/calc/savings.ts` and the reasoning is written out
 * there. This component is presentation only.
 *
 * The second thing it does not do: gate the answer. Every incumbent on this
 * query is a statement analysis service that wants a PDF upload and a phone
 * number before it shows a number, run by a company that sells payment
 * processing. Nothing here leaves the browser. Do not add a network call.
 *
 * The third: it can say do nothing. `doNothing` is a real branch and it renders.
 * A savings calculator that always finds savings is a lead form with arithmetic
 * printed on it, and readers can tell.
 */
export function ProcessingSavingsCalculator() {
  const d = SAVINGS_DEFAULTS;
  const [mode, setMode] = React.useState<"statement" | "levers">("statement");

  const [volume, setVolume] = React.useState(String(d.monthlyVolume));
  const [transactions, setTransactions] = React.useState(String(d.monthlyTransactions));
  const [fees, setFees] = React.useState(String(d.monthlyFees));
  const [fixedFees, setFixedFees] = React.useState(String(d.monthlyFixedFees));
  const [passThrough, setPassThrough] = React.useState(String(d.passThroughPct));

  const [achVolume, setAchVolume] = React.useState(String(d.achVolume));
  const [achPayments, setAchPayments] = React.useState(String(d.achPayments));
  const [achPriceId, setAchPriceId] = React.useState(ACH_PRICE_OPTIONS[0]?.id ?? "stripe");
  const [commercialShare, setCommercialShare] = React.useState(String(d.commercialSharePct));
  const [downgradeShare, setDowngradeShare] = React.useState(String(d.downgradeSharePct));
  const [removableFees, setRemovableFees] = React.useState(String(d.removableFixedFees));
  const [targetPct, setTargetPct] = React.useState(String(d.targetMarkupPct));
  const [targetPerItem, setTargetPerItem] = React.useState(String(d.targetMarkupPerItem));
  const [surchargeShare, setSurchargeShare] = React.useState(String(d.surchargeSharePct));
  const [surchargeRate, setSurchargeRate] = React.useState(String(d.surchargeRatePct));

  const achPrice = ACH_PRICE_OPTIONS.find((p) => p.id === achPriceId) ?? ACH_PRICE_OPTIONS[0];

  const result = computeSavings({
    monthlyVolume: num(volume),
    monthlyTransactions: num(transactions),
    monthlyFees: num(fees),
    monthlyFixedFees: num(fixedFees),
    passThroughPct: num(passThrough),
    achVolume: num(achVolume),
    achPayments: num(achPayments),
    achRatePct: achPrice?.ratePct ?? 0.8,
    achFixed: achPrice?.fixed ?? 0,
    achCap: achPrice?.cap ?? 5,
    commercialSharePct: num(commercialShare),
    enhancedDataBps: d.enhancedDataBps,
    downgradeSharePct: num(downgradeShare),
    downgradeBps: d.downgradeBps,
    removableFixedFees: num(removableFees),
    targetMarkupPct: num(targetPct),
    targetMarkupPerItem: num(targetPerItem),
    surchargeSharePct: num(surchargeShare),
    surchargeRatePct: num(surchargeRate),
    surchargeCapPct: SURCHARGE_NETWORK_CAP_PCT,
  });

  const leverById = (id: string) => result.levers.find((l) => l.id === id);
  const effortTone = (effort: string) => (effort === "Low" ? "good" : effort === "Medium" ? "warn" : "neutral");

  const benchmark =
    PUBLISHED_MARKUP_BENCHMARKS.find(
      (b) => num(volume) >= b.minVolume && (b.maxVolume === null || num(volume) < b.maxVolume),
    ) ?? PUBLISHED_MARKUP_BENCHMARKS[0];

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "statement" | "levers")}
            options={[
              { value: "statement", label: "Your statement" },
              { value: "levers", label: "Tune the levers" },
            ]}
          />

          {mode === "statement" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="pss-volume"
                  label="Card volume this month"
                  prefix="$"
                  value={volume}
                  onChange={setVolume}
                  hint="Gross processing volume, from page one of your statement."
                />
                <Field
                  id="pss-txns"
                  label="Card transactions this month"
                  value={transactions}
                  onChange={setTransactions}
                  hint="Sales count, not batch count."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="pss-fees"
                  label="Total fees this month"
                  prefix="$"
                  value={fees}
                  onChange={setFees}
                  hint="Everything the processor took, including every monthly charge."
                />
                <Field
                  id="pss-fixed"
                  label="Of that, monthly line items"
                  prefix="$"
                  value={fixedFees}
                  onChange={setFixedFees}
                  hint="Statement, gateway, PCI, batch, minimum, regulatory."
                />
              </FieldGrid>
              <Field
                id="pss-passthrough"
                label="Estimated pass through"
                suffix="%"
                value={passThrough}
                onChange={setPassThrough}
                hint={`Interchange plus assessments, the part nobody can discount. Typical US merchants land between ${pct(PASS_THROUGH_BAND.low, 1)} and ${pct(PASS_THROUGH_BAND.high, 1)}. Replace it with the interchange line off an itemized statement if you have one.`}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-label uppercase text-muted-foreground">Move invoices to ACH</p>
                <div className="mt-2.5 space-y-4">
                  <FieldGrid>
                    <Field
                      id="pss-achvol"
                      label="Volume you could collect by ACH"
                      prefix="$"
                      value={achVolume}
                      onChange={setAchVolume}
                      hint="The share your customers would genuinely agree to, not the share that is eligible."
                    />
                    <Field
                      id="pss-achpay"
                      label="How many payments that is"
                      value={achPayments}
                      onChange={setAchPayments}
                      hint="Drives whether the per payment cap binds."
                    />
                  </FieldGrid>
                  <SelectField
                    id="pss-achprice"
                    label="ACH pricing"
                    value={achPriceId}
                    onChange={setAchPriceId}
                    options={ACH_PRICE_OPTIONS.map((p) => ({ value: p.id, label: p.label }))}
                  />
                </div>
              </div>

              <div>
                <p className="text-label uppercase text-muted-foreground">Interchange you are leaving on the table</p>
                <div className="mt-2.5">
                  <FieldGrid>
                    <Field
                      id="pss-commercial"
                      label="Commercial card share"
                      suffix="%"
                      value={commercialShare}
                      onChange={setCommercialShare}
                      hint="Corporate, purchasing and small business cards. Level 2 and Level 3 data touch nothing else."
                    />
                    <Field
                      id="pss-downgrade"
                      label="Downgraded share"
                      suffix="%"
                      value={downgradeShare}
                      onChange={setDowngradeShare}
                      hint="Volume clearing non-qualified. Capped so it cannot overlap the commercial share."
                    />
                  </FieldGrid>
                </div>
              </div>

              <div>
                <p className="text-label uppercase text-muted-foreground">Reprice what is negotiable</p>
                <div className="mt-2.5 space-y-4">
                  <Field
                    id="pss-removable"
                    label="Monthly line items you can remove"
                    prefix="$"
                    value={removableFees}
                    onChange={setRemovableFees}
                    hint="A PCI non-compliance fee is a penalty, not a price. It is fully removable."
                  />
                  <FieldGrid>
                    <Field
                      id="pss-targetpct"
                      label="Target markup"
                      suffix="%"
                      value={targetPct}
                      onChange={setTargetPct}
                      hint={`${benchmark?.label ?? "Your band"}: ${pct(benchmark?.markupPct ?? 0, 2)} published.`}
                    />
                    <Field
                      id="pss-targetitem"
                      label="Target per transaction"
                      prefix="$"
                      value={targetPerItem}
                      onChange={setTargetPerItem}
                      hint={`${money(benchmark?.markupPerItem ?? 0)} published at your volume.`}
                    />
                  </FieldGrid>
                </div>
              </div>

              <div>
                <p className="text-label uppercase text-muted-foreground">Surcharging, off by default</p>
                <div className="mt-2.5">
                  <FieldGrid>
                    <Field
                      id="pss-surchargeshare"
                      label="Surchargeable credit share"
                      suffix="%"
                      value={surchargeShare}
                      onChange={setSurchargeShare}
                      hint="Credit only. Debit and prepaid cards cannot be surcharged."
                    />
                    <Field
                      id="pss-surchargerate"
                      label="Surcharge you would apply"
                      suffix="%"
                      value={surchargeRate}
                      onChange={setSurchargeRate}
                      hint="Capped at 3 percent or your own cost of acceptance, whichever is lower."
                    />
                  </FieldGrid>
                </div>
              </div>
            </div>
          )}
        </div>
      }
      results={
        <div>
          <Headline
            label="Identified saving, a year"
            value={money0(result.totalAnnual)}
            sub={`${money(result.totalMonthly)} a month. Your effective rate goes from ${pct(result.effectiveRate)} to ${pct(result.newEffectiveRate)}.`}
          />

          <div className="mt-5">
            <ResultRow label="Effective rate now" value={pct(result.effectiveRate)} emphasis />
            <ResultRow
              label="Pass through"
              value={money(result.passThrough)}
              note="Interchange and assessments. Not negotiable by anyone."
            />
            <ResultRow
              label="Processor markup"
              value={`${money(result.markup)} (${bps(result.markupRate)})`}
              note="The only part of your bill anybody can change."
            />
            <ResultRow label="Cost after every fix" value={money(result.newMonthlyCost)} emphasis />
          </div>

          <Verdict effectiveRate={result.effectiveRate} />

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Where the money is</p>
            <div className="mt-2">
              <MiniTable
                columns={["Lever", "Effort", "A year"]}
                align={["left", "left", "right"]}
                maxHeight="340px"
                rows={SAVINGS_LEVERS.map((lever) => {
                  const value = leverById(lever.id);
                  return [
                    <span key={lever.id}>
                      <span className="text-foreground">{lever.label}</span>
                      <span className="block text-micro text-muted-foreground">{lever.catch}</span>
                    </span>,
                    <Pill key={`${lever.id}-e`} tone={effortTone(lever.effort)}>
                      {lever.effort}
                    </Pill>,
                    <span key={`${lever.id}-v`}>{money0(value?.annual ?? 0)}</span>,
                  ];
                })}
              />
            </div>
          </div>

          {result.doNothing ? (
            <Callout tone="good">
              Do nothing. The Processing Savings Calculator finds {money0(result.totalAnnual)} a year here, which is
              under this site&rsquo;s {money0(DO_NOTHING_FLOOR_ANNUAL)} threshold. Repricing or moving an account is a
              week of somebody&rsquo;s attention, a re-integration and a real chance of a settlement gap. At this size
              the work costs more than it returns. Re-check in a year, or after your volume changes materially.
            </Callout>
          ) : (
            <Callout tone={result.improvementBps >= 50 ? "warn" : "neutral"}>
              Your markup is <strong className="text-foreground">{bps(result.markupRate)}</strong> over pass through,
              and {money0(result.totalAnnual)} a year of that is recoverable. Start at the top of the table: the levers
              are listed in the order the model applies them, and each one is priced on the volume and the fees the
              ones above it left behind. Priced against your original statement instead, which is what every other
              savings calculator on this query does, the same six levers would add up to a bigger number that nobody
              can collect, because they overlap.
            </Callout>
          )}

          <Caveat>
            Pass through is an estimate unless you replaced it with a real interchange line. Everything downstream of
            it moves when it moves, so a merchant with an itemized statement should enter the real figure before
            reading the markup. Nothing here is sent anywhere.
          </Caveat>
        </div>
      }
    />
  );
}

export default ProcessingSavingsCalculator;
