"use client";

import * as React from "react";
import { HIGH_RISK_DEFAULTS } from "@/lib/tools-data/high-risk";
import {
  compareHighRiskCost,
  premiumPaybackMonths,
  type AccountTerms,
  type HighRiskCostInput,
} from "@/lib/calc/high-risk";
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
  Verdict,
  bps,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The total cost of acceptance on a high risk merchant account, in three views.
 *
 * The gap this exploits: every page ranking for "high risk merchant account
 * fees" publishes a rate range and stops. None of them totals the account. The
 * three things that actually decide the answer are the annual card brand
 * registration fees, which are fixed dollars and therefore brutal at low volume,
 * the network specialty program fees, which are new in 2026 and appear on no
 * competing page, and the rolling reserve, which is not a fee at all and is
 * routinely either ignored or priced as forgone deposit interest.
 *
 * The reserve is modeled here as a working capital hole carried at a borrowing
 * rate, matching `/tools/rolling-reserve-calculator`, which owns the release
 * timeline. This page computes the carry cost and links there rather than
 * duplicating the month by month schedule.
 *
 * State lives in React state, never in the query string, and the defaults are a
 * real business so the server rendered HTML already contains dollar figures.
 */
export function HighRiskCostCalculator() {
  const D = HIGH_RISK_DEFAULTS;
  const [mode, setMode] = React.useState<"total" | "premium" | "reserve">("total");

  // The business
  const [volume, setVolume] = React.useState(String(D.monthlyVolume));
  const [ticket, setTicket] = React.useState(String(D.averageTicket));

  // The high risk account
  const [hrRate, setHrRate] = React.useState(String(D.hrRatePct));
  const [hrPerTxn, setHrPerTxn] = React.useState(String(D.hrPerTransaction));
  const [hrMonthlyFixed, setHrMonthlyFixed] = React.useState(String(D.hrMonthlyFixed));
  const [hrGatewayPerTxn, setHrGatewayPerTxn] = React.useState(String(D.hrGatewayPerTransaction));
  const [registrations, setRegistrations] = React.useState(String(D.annualRegistrationFees));
  const [setupFee, setSetupFee] = React.useState(String(D.setupFee));

  // Disputes and the standard account
  const [cbRate, setCbRate] = React.useState(String(D.chargebackRatePct));
  const [hrCbFee, setHrCbFee] = React.useState(String(D.hrChargebackFee));
  const [stdRate, setStdRate] = React.useState(String(D.stdRatePct));
  const [stdPerTxn, setStdPerTxn] = React.useState(String(D.stdPerTransaction));
  const [stdMonthlyFixed, setStdMonthlyFixed] = React.useState(String(D.stdMonthlyFixed));
  const [stdCbFee, setStdCbFee] = React.useState(String(D.stdChargebackFee));

  // Reserve, redundancy and prevention
  const [reservePct, setReservePct] = React.useState(String(D.reservePct));
  const [holdMonths, setHoldMonths] = React.useState(String(D.reserveHoldMonths));
  const [borrowRate, setBorrowRate] = React.useState(String(D.borrowingRatePct));
  const [extraMids, setExtraMids] = React.useState(String(D.extraMids));
  const [alertsPerMonth, setAlertsPerMonth] = React.useState(String(D.alertsPerMonth));
  const [alertCost, setAlertCost] = React.useState(String(D.alertCost));
  const [monitoring, setMonitoring] = React.useState(String(D.monitoringMonthlyFee));
  const [targetCbRate, setTargetCbRate] = React.useState(String(D.targetChargebackRatePct));

  const highRiskTerms: AccountTerms = {
    ratePct: num(hrRate),
    perTransaction: num(hrPerTxn),
    gatewayPerTransaction: num(hrGatewayPerTxn),
    monthlyFixed: num(hrMonthlyFixed),
    midCount: 1 + Math.max(0, Math.round(num(extraMids))),
    setupFee: num(setupFee),
    setupAmortizeMonths: D.setupAmortizeMonths,
    annualRegistrationFees: num(registrations),
    specialtyVolumeBps: D.specialtyVolumeBps,
    specialtyPerTransaction: D.specialtyPerTransaction,
    specialtySharePct: D.specialtySharePct,
    chargebackFee: num(hrCbFee),
    alertsPerMonth: num(alertsPerMonth),
    alertCost: num(alertCost),
    monitoringMonthlyFee: num(monitoring),
    reservePct: num(reservePct),
    reserveHoldMonths: num(holdMonths),
    borrowingRatePct: num(borrowRate),
  };

  // The same business on ordinary terms: no reserve, no registrations, no
  // specialty fees, no alerts, one merchant account.
  const standardTerms: AccountTerms = {
    ratePct: num(stdRate),
    perTransaction: num(stdPerTxn),
    gatewayPerTransaction: 0,
    monthlyFixed: num(stdMonthlyFixed),
    midCount: 1,
    setupFee: 0,
    setupAmortizeMonths: D.setupAmortizeMonths,
    annualRegistrationFees: 0,
    specialtyVolumeBps: 0,
    specialtyPerTransaction: 0,
    specialtySharePct: 0,
    chargebackFee: num(stdCbFee),
    alertsPerMonth: 0,
    alertCost: 0,
    monitoringMonthlyFee: 0,
    reservePct: 0,
    reserveHoldMonths: 0,
    borrowingRatePct: num(borrowRate),
  };

  const input: HighRiskCostInput = {
    monthlyVolume: num(volume),
    averageTicket: num(ticket),
    chargebackRatePct: num(cbRate),
    targetChargebackRatePct: num(targetCbRate),
    highRisk: highRiskTerms,
    standard: standardTerms,
  };

  const c = compareHighRiskCost(input);
  const hr = c.highRisk;
  const std = c.standard;

  const paybackOn = (spend: number) => premiumPaybackMonths(c.annualPremium, spend);
  const paybackLabel = (spend: number) => {
    const m = paybackOn(spend);
    return Number.isFinite(m) ? `${m.toFixed(1)} months` : "Never";
  };

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "total" | "premium" | "reserve")}
            options={[
              { value: "total", label: "Total cost" },
              { value: "premium", label: "Versus standard" },
              { value: "reserve", label: "Reserve and MIDs" },
            ]}
          />

          {mode === "total" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="hrc-volume"
                  label="Monthly card volume"
                  prefix="$"
                  value={volume}
                  onChange={setVolume}
                />
                <Field
                  id="hrc-ticket"
                  label="Average ticket"
                  prefix="$"
                  value={ticket}
                  onChange={setTicket}
                  hint={`${hr.transactionsPerMonth.toLocaleString("en-US")} transactions a month.`}
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-rate"
                  label="Discount rate"
                  suffix="%"
                  value={hrRate}
                  onChange={setHrRate}
                  hint="US providers publish 3.00% to 6.00%."
                />
                <Field
                  id="hrc-pertxn"
                  label="Per transaction fee"
                  prefix="$"
                  value={hrPerTxn}
                  onChange={setHrPerTxn}
                  hint="Published range $0.10 to $0.50."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-monthly"
                  label="Monthly fixed fees"
                  prefix="$"
                  value={hrMonthlyFixed}
                  onChange={setHrMonthlyFixed}
                  hint="Account, statement, PCI and gateway, per merchant account."
                />
                <Field
                  id="hrc-gwtxn"
                  label="Gateway per transaction"
                  prefix="$"
                  value={hrGatewayPerTxn}
                  onChange={setHrGatewayPerTxn}
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-registrations"
                  label="Card brand registration, a year"
                  prefix="$"
                  value={registrations}
                  onChange={setRegistrations}
                  hint="Visa $950 plus Mastercard $1,000 from 1 May 2026. Zero if you are not in a registered category."
                />
                <Field
                  id="hrc-setup"
                  label="Setup fee, one time"
                  prefix="$"
                  value={setupFee}
                  onChange={setSetupFee}
                  hint="Charged per merchant account, spread over the first 12 months here."
                />
              </FieldGrid>
            </div>
          )}

          {mode === "premium" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="hrc-cbrate"
                  label="Your chargeback rate"
                  suffix="%"
                  value={cbRate}
                  onChange={setCbRate}
                  hint={`${hr.chargebacksPerMonth.toFixed(1)} disputes a month. The Visa merchant line is 1.5%.`}
                />
                <Field
                  id="hrc-hrcbfee"
                  label="High risk chargeback fee"
                  prefix="$"
                  value={hrCbFee}
                  onChange={setHrCbFee}
                  hint="Published range $15 to $35."
                />
              </FieldGrid>
              <p className="text-label uppercase text-muted-foreground">
                The standard account the same business would have been offered
              </p>
              <FieldGrid>
                <Field
                  id="hrc-stdrate"
                  label="Standard discount rate"
                  suffix="%"
                  value={stdRate}
                  onChange={setStdRate}
                  hint="2.9% is the published US flat rate."
                />
                <Field
                  id="hrc-stdpertxn"
                  label="Standard per transaction"
                  prefix="$"
                  value={stdPerTxn}
                  onChange={setStdPerTxn}
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-stdmonthly"
                  label="Standard monthly fees"
                  prefix="$"
                  value={stdMonthlyFixed}
                  onChange={setStdMonthlyFixed}
                />
                <Field
                  id="hrc-stdcbfee"
                  label="Standard chargeback fee"
                  prefix="$"
                  value={stdCbFee}
                  onChange={setStdCbFee}
                  hint="$15 on Stripe and Braintree, $20 on PayPal, $0 on Square, $15 on Helcim only if you lose."
                />
              </FieldGrid>
            </div>
          )}

          {mode === "reserve" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="hrc-reserve"
                  label="Rolling reserve"
                  suffix="%"
                  value={reservePct}
                  onChange={setReservePct}
                  hint="Published range 5% to 15%."
                />
                <Field
                  id="hrc-hold"
                  label="Hold period"
                  suffix="mo"
                  value={holdMonths}
                  onChange={setHoldMonths}
                  hint="90 to 180 days is the usual band."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-borrow"
                  label="What borrowing costs you"
                  suffix="%"
                  value={borrowRate}
                  onChange={setBorrowRate}
                  hint="A borrowing rate, not a savings rate. 6.75% is the bank prime loan rate."
                />
                <Field
                  id="hrc-mids"
                  label="Extra merchant accounts"
                  value={extraMids}
                  onChange={setExtraMids}
                  inputMode="numeric"
                  hint="Beyond the first, for redundancy."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-alerts"
                  label="Prevention alerts a month"
                  value={alertsPerMonth}
                  onChange={setAlertsPerMonth}
                  inputMode="numeric"
                />
                <Field
                  id="hrc-alertcost"
                  label="Cost per alert"
                  prefix="$"
                  value={alertCost}
                  onChange={setAlertCost}
                  hint="$15 RDR or CDRN, $29 Ethoca, one vendor published these rates."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="hrc-monitoring"
                  label="Mitigation platform, a month"
                  prefix="$"
                  value={monitoring}
                  onChange={setMonitoring}
                  hint="No US figure is published. Enter your quote."
                />
                <Field
                  id="hrc-targetcb"
                  label="Chargeback rate you could reach"
                  suffix="%"
                  value={targetCbRate}
                  onChange={setTargetCbRate}
                />
              </FieldGrid>
            </div>
          )}
        </div>
      }
      results={
        mode === "total" ? (
          <div>
            <Headline
              label="Total cost of acceptance"
              value={pct(hr.effectiveRatePct)}
              sub={`${money0(hr.totalAnnualCost)} a year on ${money0(hr.annualVolume)} of volume, or ${money(hr.costPerTransaction)} per transaction.`}
            />
            <div className="mt-5">
              <ResultRow label="Discount rate" value={`${money(hr.monthly.discount)} / mo`} />
              <ResultRow label="Per transaction fees" value={`${money(hr.monthly.perTransaction + hr.monthly.gatewayPerTransaction)} / mo`} note="Acquirer plus gateway" />
              <ResultRow label="Monthly fixed fees" value={`${money(hr.monthly.fixedFees)} / mo`} />
              <ResultRow label="Network specialty fees" value={`${money(hr.monthly.networkSpecialty)} / mo`} note="10 bps plus $0.02 a transaction" />
              <ResultRow label="Chargeback fees and alerts" value={`${money(hr.monthly.chargebackFees + hr.monthly.alerts + hr.monthly.monitoring)} / mo`} />
              <ResultRow label="Card brand registration" value={`${money(hr.annualRegistrations)} / yr`} />
              <ResultRow label="Setup, first year" value={`${money(hr.annualSetupCharge)} / yr`} />
              <ResultRow label="Cash fees, a year" value={money0(hr.annualCashFees)} note={`${pct(hr.cashEffectiveRatePct)} of volume`} />
              <ResultRow label="Reserve carry cost" value={money0(hr.reserveAnnualCarryCost)} note={`Financing ${money0(hr.reserveSteadyStateLocked)} you cannot touch`} />
              <ResultRow label="Total, a year" value={money0(hr.totalAnnualCost)} emphasis />
            </div>

            <Verdict effectiveRate={hr.effectiveRatePct} />

            <Callout>
              Of that {pct(hr.effectiveRatePct)}, {pct(hr.cashEffectiveRatePct)} is cash leaving your
              account and {pct(hr.effectiveRatePct - hr.cashEffectiveRatePct)} is the cost of financing a
              reserve balance that is still legally yours. They are different problems with different
              fixes, which is why they are separated here rather than blended.
            </Callout>

            <Caveat>
              Excludes the early termination fee, which US high risk providers publish at $250 to $1,000 or
              the remaining contract value. It is a cost of leaving rather than a cost of processing, so it
              is not in the annual figure, but it belongs in the decision.
            </Caveat>
          </div>
        ) : mode === "premium" ? (
          <div>
            <Headline
              label="What the classification costs you"
              value={money0(c.annualPremium)}
              sub={`A year. That is ${bps(c.premiumBps / 100)} of volume, or ${money(c.premiumPerTransaction)} on every transaction.`}
            />
            <div className="mt-5">
              <ResultRow label="High risk account" value={pct(hr.effectiveRatePct)} note={`${money0(hr.totalAnnualCost)} a year`} />
              <ResultRow label="Standard account" value={pct(std.effectiveRatePct)} note={`${money0(std.totalAnnualCost)} a year`} />
              <ResultRow label="Premium" value={pct(hr.effectiveRatePct - std.effectiveRatePct)} note={`${money0(c.annualPremium)} a year, ${money0(c.monthlyPremium)} a month`} emphasis />
              <ResultRow label="Of which reserve carry" value={pct(c.reserveShareOfPremiumPct, 1)} note="The rest is fees" />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">
                What that premium buys you the room to spend
              </p>
              <div className="mt-2">
                <MiniTable
                  columns={["One-time spend", "Paid back in"]}
                  rows={[5000, 15000, 30000, 60000].map((s) => [
                    <span key={s}>{money0(s)}</span>,
                    <span key={`${s}-p`}>{paybackLabel(s)}</span>,
                  ])}
                />
              </div>
            </div>

            <Callout tone={c.disputeReduction.shareOfPremiumPct < 25 ? "warn" : "good"}>
              Cutting your dispute rate from {pct(num(cbRate), 2)} to {pct(c.disputeReduction.targetRatePct, 2)}{" "}
              saves <strong className="text-foreground">{money0(c.disputeReduction.annualFeeSaving)}</strong> a
              year in chargeback and alert fees, which is only{" "}
              {pct(c.disputeReduction.shareOfPremiumPct, 1)} of the premium. The fees are not the prize.
              A lower ratio is the evidence you need to renegotiate the rate and the reserve, and those are
              where the other {pct(100 - c.disputeReduction.shareOfPremiumPct, 1)} sits.
            </Callout>

            <Caveat>
              Both sides model the same business: same volume, same ticket, same transaction count and the
              same {hr.chargebacksPerMonth.toFixed(1)} disputes a month. Only the terms differ, so the gap
              is the price of the classification and nothing else.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Working capital locked in reserve"
              value={money0(hr.reserveSteadyStateLocked)}
              sub={`${money0(hr.reserveWithheldPerMonth)} withheld every month, held ${Math.round(num(holdMonths))} months, so the balance plateaus and stays there.`}
            />
            <div className="mt-5">
              <ResultRow label="Withheld each month" value={money0(hr.reserveWithheldPerMonth)} />
              <ResultRow label="Steady state locked" value={money0(hr.reserveSteadyStateLocked)} note="Volume x reserve % x hold months" emphasis />
              <ResultRow label="Cost to carry it, a year" value={money0(hr.reserveAnnualCarryCost)} note={`At ${pct(num(borrowRate))} borrowing`} />
              <ResultRow label="Every extra merchant account" value={money0(c.extraMidAnnualCost)} note="Fixed fees, registration and setup, billed again" />
              <ResultRow label="Alerts and mitigation" value={`${money0((hr.monthly.alerts + hr.monthly.monitoring) * 12)} / yr`} />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Reserve as a share of the premium</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Line", "A year", "Share"]}
                  align={["left", "right", "right"]}
                  rows={[
                    [
                      <span key="fees">Fees</span>,
                      <span key="fees-v">{money0(c.annualPremium - hr.reserveAnnualCarryCost)}</span>,
                      <Pill key="fees-p" tone="neutral">
                        {pct(100 - c.reserveShareOfPremiumPct, 1)}
                      </Pill>,
                    ],
                    [
                      <span key="res">Reserve carry</span>,
                      <span key="res-v">{money0(hr.reserveAnnualCarryCost)}</span>,
                      <Pill key="res-p" tone={c.reserveShareOfPremiumPct > 25 ? "warn" : "neutral"}>
                        {pct(c.reserveShareOfPremiumPct, 1)}
                      </Pill>,
                    ],
                  ]}
                />
              </div>
            </div>

            <Callout>
              A reserve is collateral, not a charge. Every dollar comes back if disputes do not consume it.
              What it costs is the {money0(hr.reserveSteadyStateLocked)} you have to finance somewhere
              else, which is {money0(hr.reserveAnnualCarryCost)} a year at{" "}
              {pct(num(borrowRate))}. Pricing it as forgone deposit interest instead understates it by
              roughly an order of magnitude.
            </Callout>

            <Caveat>
              Running a second merchant account for redundancy is legitimate and costs{" "}
              {money0(c.extraMidAnnualCost)} a year here. Splitting volume between accounts so that neither
              one&rsquo;s dispute ratio reaches a monitoring threshold is not: Visa&rsquo;s rules let it
              permanently prohibit a merchant that enters into an agreement under a new name with the
              intent to circumvent them.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default HighRiskCostCalculator;
