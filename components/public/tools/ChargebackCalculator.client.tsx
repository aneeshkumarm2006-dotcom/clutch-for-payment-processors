"use client";

import * as React from "react";
import { CHARGEBACK_DEFAULTS, CHARGEBACK_PROCESSOR_FEES, CHARGEBACK_PROGRAMS } from "@/lib/tools-data/chargebacks";
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
 * Chargeback ratio and true cost, two modes on one page.
 *
 * The gap this exploits: the pages ranking for the ratio query contradict each
 * other on which month's transactions form the denominator, and several still
 * describe programmes the networks have since consolidated or renamed. Each
 * programme row here carries its own denominator and its own source, so the page
 * can be specific where the competition is vague.
 *
 * Cost mode's own gap: no ranking calculator knows what the merchant's processor
 * charges per chargeback, and this site has the profiles that do.
 */
export function ChargebackCalculator() {
  const [mode, setMode] = React.useState<"ratio" | "cost">("ratio");

  const [transactions, setTransactions] = React.useState(String(CHARGEBACK_DEFAULTS.monthlyTransactions));
  const [chargebacks, setChargebacks] = React.useState(String(CHARGEBACK_DEFAULTS.monthlyChargebacks));
  const [disputedVolume, setDisputedVolume] = React.useState(String(CHARGEBACK_DEFAULTS.disputedVolume));
  const [totalVolume, setTotalVolume] = React.useState(String(CHARGEBACK_DEFAULTS.totalVolume));

  const [aov, setAov] = React.useState(String(CHARGEBACK_DEFAULTS.averageOrderValue));
  const [cogs, setCogs] = React.useState(String(CHARGEBACK_DEFAULTS.costOfGoods));
  const [shipping, setShipping] = React.useState(String(CHARGEBACK_DEFAULTS.shipping));
  const [processingFee, setProcessingFee] = React.useState(String(CHARGEBACK_DEFAULTS.processingFeePaid));
  const [feeSlug, setFeeSlug] = React.useState(CHARGEBACK_PROCESSOR_FEES[0]?.processorSlug ?? "custom");
  const [customFee, setCustomFee] = React.useState(String(CHARGEBACK_DEFAULTS.chargebackFee));
  const [staffMinutes, setStaffMinutes] = React.useState(String(CHARGEBACK_DEFAULTS.staffMinutes));
  const [staffRate, setStaffRate] = React.useState(String(CHARGEBACK_DEFAULTS.staffHourlyRate));

  const txns = Math.max(0, num(transactions));
  const cbs = Math.max(0, num(chargebacks));
  const ratioByCount = txns > 0 ? (cbs / txns) * 100 : 0;
  const ratioByVolume = num(totalVolume) > 0 ? (num(disputedVolume) / num(totalVolume)) * 100 : 0;

  const feeProfile = CHARGEBACK_PROCESSOR_FEES.find((p) => p.processorSlug === feeSlug);
  const cbFee = feeProfile ? feeProfile.fee : Math.max(0, num(customFee));
  const labour = (Math.max(0, num(staffMinutes)) / 60) * Math.max(0, num(staffRate));
  const perChargeback =
    Math.max(0, num(aov)) + Math.max(0, num(cogs)) + Math.max(0, num(shipping)) + Math.max(0, num(processingFee)) + cbFee + labour;
  const monthlyCost = perChargeback * cbs;
  const salesToReplace = num(aov) > 0 ? perChargeback / num(aov) : 0;

  const standing = (p: (typeof CHARGEBACK_PROGRAMS)[number]) => {
    const ratio = p.metric.toLowerCase().includes("volume") ? ratioByVolume : ratioByCount;
    const overRatio = ratio >= p.ratioPct;
    const overCount = p.countMin > 0 ? cbs >= p.countMin : true;
    // Programmes that pair a ratio with a count trip only when BOTH are met.
    const breached = p.countMin > 0 ? overRatio && overCount : overRatio;
    const close = !breached && overRatio;
    return breached ? "breached" : close ? "close" : "clear";
  };

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "ratio" | "cost")}
            options={[
              { value: "ratio", label: "Am I over the threshold?" },
              { value: "cost", label: "What does one cost me?" },
            ]}
          />

          {mode === "ratio" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="cb-txns" label="Transactions per month" value={transactions} onChange={setTransactions} />
                <Field id="cb-cbs" label="Chargebacks per month" value={chargebacks} onChange={setChargebacks} />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="cb-dispvol"
                  label="Disputed dollar volume"
                  prefix="$"
                  value={disputedVolume}
                  onChange={setDisputedVolume}
                  hint="Some programmes measure dollars, not counts."
                />
                <Field id="cb-totvol" label="Total dollar volume" prefix="$" value={totalVolume} onChange={setTotalVolume} />
              </FieldGrid>
            </div>
          ) : (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="cb-aov" label="Average order value" prefix="$" value={aov} onChange={setAov} />
                <Field id="cb-cogs" label="Cost of goods" prefix="$" value={cogs} onChange={setCogs} />
              </FieldGrid>
              <FieldGrid>
                <Field id="cb-ship" label="Shipping and fulfilment" prefix="$" value={shipping} onChange={setShipping} />
                <Field
                  id="cb-procfee"
                  label="Processing fee already paid"
                  prefix="$"
                  value={processingFee}
                  onChange={setProcessingFee}
                  hint="Not refunded on a chargeback."
                />
              </FieldGrid>
              <SelectField
                id="cb-fee"
                label="Chargeback fee"
                value={feeSlug}
                onChange={setFeeSlug}
                options={[
                  ...CHARGEBACK_PROCESSOR_FEES.map((p) => ({ value: p.processorSlug, label: `${p.name} (${money(p.fee)})` })),
                  { value: "custom", label: "Enter my own" },
                ]}
              />
              {!feeProfile && (
                <Field id="cb-customfee" label="Your chargeback fee" prefix="$" value={customFee} onChange={setCustomFee} />
              )}
              <FieldGrid>
                <Field id="cb-mins" label="Staff time per case" suffix="min" value={staffMinutes} onChange={setStaffMinutes} />
                <Field id="cb-rate" label="Hourly cost of that time" prefix="$" value={staffRate} onChange={setStaffRate} />
              </FieldGrid>
            </div>
          )}
        </div>
      }
      results={
        mode === "ratio" ? (
          <div>
            <Headline
              label="Chargeback ratio by count"
              value={pct(ratioByCount)}
              sub={`${Math.round(cbs)} chargebacks against ${Math.round(txns).toLocaleString("en-US")} transactions.`}
            />
            <div className="mt-5">
              <ResultRow label="By count" value={pct(ratioByCount)} emphasis />
              <ResultRow label="By dollar volume" value={pct(ratioByVolume)} note="Which one applies depends on the programme" />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Where you stand</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Programme", "Threshold", "Standing"]}
                  align={["left", "left", "right"]}
                  maxHeight="300px"
                  rows={CHARGEBACK_PROGRAMS.map((p) => {
                    const s = standing(p);
                    return [
                      <span key={p.program}>
                        <span className="text-foreground">{p.program}</span>
                        <span className="block text-micro text-muted-foreground">{p.network}</span>
                      </span>,
                      <span key={`${p.program}-t`} className="text-muted-foreground">
                        {pct(p.ratioPct, 2)}
                        {p.countMin > 0 ? ` and ${p.countMin.toLocaleString("en-US")}+` : ""}
                      </span>,
                      <Pill key={`${p.program}-s`} tone={s === "breached" ? "bad" : s === "close" ? "warn" : "good"}>
                        {s === "breached" ? "Over" : s === "close" ? "Ratio over, count under" : "Clear"}
                      </Pill>,
                    ];
                  })}
                />
              </div>
            </div>

            <Callout tone={ratioByCount >= 0.9 ? "warn" : "neutral"}>
              The denominator is not the same for every programme, and that is not a detail. Some measure the current
              month&rsquo;s transactions, some the previous month&rsquo;s, and some count only card-not-present
              settled transactions. Each row above carries its own definition and its own source.
            </Callout>

            <Caveat>
              Programme thresholds are contractual card network rules, not law, and the networks revise them. Your
              acquirer applies its own limits on top, usually tighter. Treat this as an early warning rather than a
              compliance determination.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="True cost of one chargeback"
              value={money(perChargeback)}
              sub={`On a ${money(num(aov))} order. That is ${salesToReplace.toFixed(1)}x the order value.`}
            />
            <div className="mt-5">
              <ResultRow label="Revenue reversed" value={money(Math.max(0, num(aov)))} />
              <ResultRow label="Goods and fulfilment lost" value={money(Math.max(0, num(cogs)) + Math.max(0, num(shipping)))} />
              <ResultRow label="Processing fee, not refunded" value={money(Math.max(0, num(processingFee)))} />
              <ResultRow label="Chargeback fee" value={money(cbFee)} note={feeProfile?.name} />
              <ResultRow label="Staff time" value={money(labour)} />
              <ResultRow label="Total per chargeback" value={money(perChargeback)} emphasis />
            </div>

            <Callout>
              At {Math.round(cbs)} chargebacks a month that is{" "}
              <strong className="text-foreground">{money0(monthlyCost)} a month</strong>, or{" "}
              {money0(monthlyCost * 12)} a year. You would need{" "}
              <strong className="text-foreground">{Math.ceil(salesToReplace)} more sales</strong> at this order value
              to replace the revenue from a single one.
            </Callout>

            <Caveat>
              Excludes the second-order costs, which are usually larger: acquirer monitoring fees once you trip a
              programme, a reserve imposed on your account, and the risk of losing processing altogether.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default ChargebackCalculator;
