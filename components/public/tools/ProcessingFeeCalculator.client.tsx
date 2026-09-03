"use client";

import * as React from "react";
import {
  CalcShell,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ResultRow,
  Verdict,
  money,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The generic processing fee calculator behind
 * `/tools/credit-card-processing-fee-calculator`.
 *
 * The two things it models that the ranking competitors do not:
 *
 *  1. **Fixed monthly fees.** Statement, gateway, PCI, monthly minimum. They do
 *     not scale with volume, so they are the main reason a 2.9% quote turns into
 *     a 3.5% effective rate on a small account. Every calculator on page one for
 *     this query excludes them, and one of them says so on the page.
 *  2. **Channel mix.** Card-present, online and keyed are priced differently by
 *     every processor. A tool that asks only for total volume averages away the
 *     single biggest structural difference between two merchants on identical
 *     published rates.
 *
 * The monthly minimum is applied the way an agreement applies it: it is a floor
 * on the processing charge, not an additional line, so a merchant already above
 * it pays nothing extra.
 */

const asShare = (v: string) => Math.max(0, Math.min(100, num(v)));

export function ProcessingFeeCalculator() {
  const [volume, setVolume] = React.useState("25000");
  const [count, setCount] = React.useState("420");

  const [cpShare, setCpShare] = React.useState("60");
  const [keyedShare, setKeyedShare] = React.useState("5");

  const [cpRate, setCpRate] = React.useState("2.6");
  const [cpFixed, setCpFixed] = React.useState("0.15");
  const [onlineRate, setOnlineRate] = React.useState("2.9");
  const [onlineFixed, setOnlineFixed] = React.useState("0.30");
  const [keyedRate, setKeyedRate] = React.useState("3.5");
  const [keyedFixed, setKeyedFixed] = React.useState("0.15");

  const [monthlyFees, setMonthlyFees] = React.useState("35");
  const [monthlyMinimum, setMonthlyMinimum] = React.useState("0");

  const monthVolume = Math.max(0, num(volume));
  const monthCount = Math.max(0, num(count));

  // Shares are entered for card-present and keyed; online is the remainder, so
  // the three always total 100 and the merchant can never enter an impossible mix.
  const cp = asShare(cpShare);
  const keyed = Math.min(asShare(keyedShare), Math.max(0, 100 - cp));
  const online = Math.max(0, 100 - cp - keyed);

  const slice = (share: number) => ({
    volume: (monthVolume * share) / 100,
    count: (monthCount * share) / 100,
  });

  const legs = [
    { key: "cp", label: "Card present", share: cp, rate: num(cpRate), fixed: num(cpFixed) },
    { key: "online", label: "Online", share: online, rate: num(onlineRate), fixed: num(onlineFixed) },
    { key: "keyed", label: "Keyed", share: keyed, rate: num(keyedRate), fixed: num(keyedFixed) },
  ].map((leg) => {
    const s = slice(leg.share);
    return { ...leg, cost: (s.volume * leg.rate) / 100 + s.count * leg.fixed, sliceVolume: s.volume };
  });

  const processingCost = legs.reduce((sum, l) => sum + l.cost, 0);
  const minimum = Math.max(0, num(monthlyMinimum));
  // A monthly minimum tops the processing charge UP to the floor. It is not an
  // extra line on top of a bill that already cleared it.
  const minimumTopUp = processingCost < minimum ? minimum - processingCost : 0;
  const fixedMonthly = Math.max(0, num(monthlyFees));
  const total = processingCost + minimumTopUp + fixedMonthly;
  const effective = monthVolume > 0 ? (total / monthVolume) * 100 : 0;
  const avgTicket = monthCount > 0 ? monthVolume / monthCount : 0;
  const headlineRate = legs.reduce((sum, l) => sum + (l.rate * l.share) / 100, 0);

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Your volume</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="pfc-volume" label="Monthly card volume" prefix="$" value={volume} onChange={setVolume} />
                <Field
                  id="pfc-count"
                  label="Transactions per month"
                  value={count}
                  onChange={setCount}
                  hint={avgTicket > 0 ? `Average ticket ${money(avgTicket)}` : undefined}
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Channel mix</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field
                  id="pfc-cp-share"
                  label="Card present"
                  suffix="%"
                  value={cpShare}
                  onChange={setCpShare}
                />
                <Field
                  id="pfc-keyed-share"
                  label="Manually keyed"
                  suffix="%"
                  value={keyedShare}
                  onChange={setKeyedShare}
                  hint={`Online is the remainder: ${online.toFixed(0)}%`}
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Your quoted rates</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field id="pfc-cp-rate" label="Card present rate" suffix="%" value={cpRate} onChange={setCpRate} />
                <Field id="pfc-cp-fixed" label="Card present per item" prefix="$" value={cpFixed} onChange={setCpFixed} />
              </FieldGrid>
              <FieldGrid>
                <Field id="pfc-on-rate" label="Online rate" suffix="%" value={onlineRate} onChange={setOnlineRate} />
                <Field id="pfc-on-fixed" label="Online per item" prefix="$" value={onlineFixed} onChange={setOnlineFixed} />
              </FieldGrid>
              <FieldGrid>
                <Field id="pfc-kd-rate" label="Keyed rate" suffix="%" value={keyedRate} onChange={setKeyedRate} />
                <Field id="pfc-kd-fixed" label="Keyed per item" prefix="$" value={keyedFixed} onChange={setKeyedFixed} />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">The part quotes leave out</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field
                  id="pfc-monthly"
                  label="Fixed monthly fees"
                  prefix="$"
                  value={monthlyFees}
                  onChange={setMonthlyFees}
                  hint="Statement, gateway, PCI, account maintenance."
                />
                <Field
                  id="pfc-minimum"
                  label="Monthly minimum"
                  prefix="$"
                  value={monthlyMinimum}
                  onChange={setMonthlyMinimum}
                  hint="Charged only if processing falls below it."
                />
              </FieldGrid>
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Total monthly cost"
            value={money(total)}
            sub={`${money(total * 12)} a year on ${money(monthVolume)} a month.`}
          />
          <div className="mt-5">
            {legs
              .filter((l) => l.share > 0)
              .map((l) => (
                <ResultRow
                  key={l.key}
                  label={`${l.label} (${l.share.toFixed(0)}%)`}
                  value={money(l.cost)}
                  note={`${pct(l.rate)} + ${money(l.fixed)} on ${money(l.sliceVolume)}`}
                />
              ))}
            {minimumTopUp > 0 && (
              <ResultRow
                label="Monthly minimum top-up"
                value={money(minimumTopUp)}
                note="Your processing fell below the floor in your agreement."
              />
            )}
            <ResultRow label="Fixed monthly fees" value={money(fixedMonthly)} />
            <ResultRow label="Effective rate" value={pct(effective)} emphasis />
          </div>
          <Verdict effectiveRate={effective} />
          {effective > headlineRate + 0.01 && monthVolume > 0 && (
            <p className="mt-4 rounded border border-border-strong bg-muted px-4 py-3 text-small text-muted-foreground">
              You were quoted about {pct(headlineRate)}. You are actually paying {pct(effective)}, a
              gap of {pct(effective - headlineRate)}, which is {money(total - (monthVolume * headlineRate) / 100)} a
              month. Per-item fees and fixed monthly charges are the difference.
            </p>
          )}
          <Caveat>
            This prices the rate structure you entered. It cannot see fees you have not told it about,
            so check the total against your last statement.
          </Caveat>
        </div>
      }
    />
  );
}

export default ProcessingFeeCalculator;
