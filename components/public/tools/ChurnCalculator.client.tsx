"use client";

import * as React from "react";
import { CHURN_DECLINE_REASONS, CHURN_DEFAULTS } from "@/lib/tools-data/churn";
import { involuntaryChurn } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ResultRow,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Involuntary churn: revenue lost to failed payments rather than to cancellations.
 *
 * Two things separate this from the nine vendor calculators competing for the
 * term. It isolates the involuntary slice instead of taking a blended churn
 * number, which is the actual question. And it annualises by COMPOUNDING: at a
 * 4% decline rate and 53% recovery the monthly rate is 1.88%, which compounds to
 * 20.37% a year, not the 22.56% you get by multiplying by twelve. That error is
 * the most common defect in the competing tools.
 */
export function ChurnCalculator() {
  const [subscribers, setSubscribers] = React.useState(String(CHURN_DEFAULTS.subscribers));
  const [arpu, setArpu] = React.useState(String(CHURN_DEFAULTS.arpu));
  const [declineRatePct, setDeclineRatePct] = React.useState(String(CHURN_DEFAULTS.declineRatePct));
  const [recoveryRatePct, setRecoveryRatePct] = React.useState(String(CHURN_DEFAULTS.recoveryRatePct));
  const [targetRecoveryPct, setTargetRecoveryPct] = React.useState(String(CHURN_DEFAULTS.targetRecoveryPct));

  const r = involuntaryChurn({
    subscribers: num(subscribers),
    arpu: num(arpu),
    declineRatePct: num(declineRatePct),
    recoveryRatePct: num(recoveryRatePct),
    targetRecoveryPct: num(targetRecoveryPct),
  });

  const noDeclines = num(declineRatePct) <= 0;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Your book</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="ch-subs" label="Active subscribers" value={subscribers} onChange={setSubscribers} />
                <Field
                  id="ch-arpu"
                  label="Average revenue per subscriber"
                  prefix="$"
                  value={arpu}
                  onChange={setArpu}
                  hint="Per month."
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Your payment failures</p>
            <div className="mt-2.5 space-y-4">
              <Field
                id="ch-decline"
                label="Monthly card decline rate"
                suffix="%"
                value={declineRatePct}
                onChange={setDeclineRatePct}
                hint="The share of renewal charges that fail on the first attempt."
              />
              <FieldGrid>
                <Field
                  id="ch-recovery"
                  label="Current recovery rate"
                  suffix="%"
                  value={recoveryRatePct}
                  onChange={setRecoveryRatePct}
                  hint="Of failures you win back through retries and dunning."
                />
                <Field
                  id="ch-target"
                  label="Target recovery rate"
                  suffix="%"
                  value={targetRecoveryPct}
                  onChange={setTargetRecoveryPct}
                />
              </FieldGrid>
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Lost to failed payments"
            value={money0(r.annualLost)}
            sub={`${money(r.monthlyLost)} a month, on ${money0(r.mrr)} of MRR.`}
          />

          <div className="mt-5">
            <ResultRow label="Monthly revenue at risk" value={money(r.monthlyAtRisk)} note="Renewals that fail on the first attempt" />
            <ResultRow label="Currently recovered" value={money(r.monthlyRecovered)} />
            <ResultRow label="Currently lost" value={money(r.monthlyLost)} emphasis />
            <ResultRow
              label="Subscribers lost per month"
              value={r.subscribersLostMonthly.toFixed(1)}
              note="To failed payments alone, not cancellations"
            />
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Involuntary churn rate</p>
            <div className="mt-2">
              <ResultRow label="Monthly" value={pct(r.churnMonthly * 100)} />
              <ResultRow
                label="Annualised"
                value={pct(r.churnAnnual * 100)}
                note="Compounded, not multiplied by twelve"
                emphasis
              />
              <ResultRow
                label="At your target recovery rate"
                value={pct(r.churnAtTargetAnnual * 100)}
                note={`Down from ${pct(r.churnAnnual * 100)}`}
              />
            </div>
          </div>

          {r.targetBelowCurrent ? (
            <Callout tone="warn">
              Your target is below your current recovery rate, so there is no upside to size. Raise it above{" "}
              {pct(num(recoveryRatePct), 0)} to see what better dunning is worth. The churn figures above still
              compute honestly, so read the target row as a worse outcome rather than a projection.
            </Callout>
          ) : (
            <Callout tone={r.annualUpside > 0 ? "good" : "neutral"}>
              Getting recovery from {pct(num(recoveryRatePct), 0)} to {pct(num(targetRecoveryPct), 0)} is worth{" "}
              <strong className="text-foreground">{money0(r.annualUpside)}</strong> a year, or{" "}
              {money(r.monthlyUpside)} a month. That is revenue you have already earned and already lost once.
            </Callout>
          )}

          {noDeclines && (
            <Callout>A zero percent decline rate means there is nothing to recover. Enter your real rate.</Callout>
          )}

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Why renewals fail</p>
            <div className="mt-2">
              <MiniTable
                columns={["Reason", "Share"]}
                rows={CHURN_DECLINE_REASONS.map((d) => [d.reason, d.share])}
              />
            </div>
          </div>

          <Caveat>
            Assumes a steady book and a constant decline rate. Annual churn is compounded month on month, which is
            the only correct way to annualise a rate, and is why this figure is lower than tools that multiply the
            monthly number by twelve.
          </Caveat>
        </div>
      }
    />
  );
}

export default ChurnCalculator;
