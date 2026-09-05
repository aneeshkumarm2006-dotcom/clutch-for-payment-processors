"use client";

import * as React from "react";
import { JUNK_FEES, JUNK_FEE_DEFAULTS } from "@/lib/tools-data/junk-fees";
import type { JunkFee } from "@/lib/tools-data/junk-fees";
import { junkFeeByVolume, junkFeeTotals } from "@/lib/calc/junk-fees";
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
  Verdict,
  bps,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The Junk Fee Annualizer.
 *
 * The gap this exploits: every page ranking for hidden merchant account fees is
 * a list of fee names with a vague range beside each one, and none of them adds
 * up. The two things a merchant actually needs are the annual total and the
 * same total expressed as a rate, because a set of $10 lines is invisible
 * monthly and is worth tens of basis points on a small account.
 *
 * Three modes, because the page answers three questions: what is this costing
 * me, which line do I attack first, and which of these am I wrong to be angry
 * about. The third exists to keep the other two credible. Assessments and
 * interchange are genuine pass through and the tool says so in the same table
 * that calls an annual fee margin.
 *
 * Everything runs in the browser. No upload, no email gate, no network call:
 * every incumbent statement-analysis service wants a PDF and a phone number, to
 * a company that sells payment processing.
 *
 * A narrow data import, never the `@/lib/tools-data` barrel, because one route
 * serves every calculator and anything imported here ships to all of them.
 */

const FREQUENCY_SUFFIX: Record<JunkFee["frequency"], string> = {
  monthly: "/mo",
  annual: "/yr",
  "per-business-day": "/day",
  amortized: "one off",
};

const VERDICT_LABEL: Record<JunkFee["verdict"], string> = {
  "pass-through": "Pass through",
  "real-service": "Real service",
  mixed: "Mixed",
  margin: "Pure margin",
};

const VERDICT_TONE: Record<JunkFee["verdict"], "good" | "warn" | "bad" | "neutral"> = {
  "pass-through": "good",
  "real-service": "good",
  mixed: "warn",
  margin: "bad",
};

const NEGOTIABILITY_LABEL: Record<JunkFee["negotiability"], string> = {
  remove: "Ask it off",
  negotiate: "Negotiable",
  replace: "Switch to fix",
  fixed: "Not negotiable",
};

const NEGOTIABILITY_TONE: Record<JunkFee["negotiability"], "good" | "warn" | "bad" | "neutral"> = {
  remove: "good",
  negotiate: "warn",
  replace: "warn",
  fixed: "neutral",
};

/** The ladder under the headline. Fixed dollars against volume is the whole point. */
const VOLUME_LADDER = [5000, 10000, 25000, 50000, 100000];

export function JunkFeeCalculator() {
  const [mode, setMode] = React.useState<"bill" | "removal" | "legit">("bill");

  const [volume, setVolume] = React.useState(String(JUNK_FEE_DEFAULTS.monthlyVolume));
  const [rate, setRate] = React.useState(String(JUNK_FEE_DEFAULTS.effectiveRatePct));
  const [term, setTerm] = React.useState(String(JUNK_FEE_DEFAULTS.remainingTermMonths));

  const [ticked, setTicked] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(JUNK_FEES.map((f) => [f.id, f.defaultOn])),
  );
  // Two decimals in the input boxes, so a 10 cent batch fee reads as 0.10 rather
  // than 0.1. Deterministic, so the server and the client render the same field.
  const [amounts, setAmounts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(JUNK_FEES.map((f) => [f.id, f.defaultAmount.toFixed(2)])),
  );

  const selected = JUNK_FEES.filter((f) => ticked[f.id]);

  const input = {
    monthlyVolume: Math.max(0, num(volume)),
    effectiveRatePct: Math.max(0, num(rate)),
    remainingTermMonths: Math.max(0, num(term)),
    lines: selected.map((f) => ({
      id: f.id,
      label: f.label,
      amount: Math.max(0, num(amounts[f.id] ?? "0")),
      frequency: f.frequency,
      model: f.model,
    })),
  };

  const result = junkFeeTotals(input);
  const ladder = junkFeeByVolume(input, VOLUME_LADDER);
  // Both ends of the ladder, narrowed once. `noUncheckedIndexedAccess` types
  // `ladder[0]` as possibly absent, and the honest reading of an empty ladder is
  // that there is no sentence to write, so the callout below renders off this
  // rather than asserting a row exists.
  const ladderLow = ladder[0];
  const ladderHigh = ladder[ladder.length - 1];
  const ladderEnds = ladderLow && ladderHigh ? { low: ladderLow, high: ladderHigh } : null;
  const byId = new Map(result.lines.map((l) => [l.id, l]));

  // Deliberately the "remove" group only. A gateway is a real service and a
  // terminal rental is a purchase decision, so folding either into a headline
  // called avoidable would overstate what one phone call achieves. Both still
  // appear in the ranked list with their own route.
  const avoidable = result.ranked.filter((l) => {
    const fee = JUNK_FEES.find((f) => f.id === l.id);
    return l.annualCost > 0 && fee?.negotiability === "remove";
  });
  const avoidableTotal = avoidable.reduce((s, l) => s + l.annualCost, 0);
  const topTarget = result.ranked.find((l) => l.annualCost > 0);
  const topFee = topTarget ? JUNK_FEES.find((f) => f.id === topTarget.id) : undefined;

  const showTerm = Boolean(ticked["early-termination"]);

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "bill" | "removal" | "legit")}
            options={[
              { value: "bill", label: "What is this costing me?" },
              { value: "removal", label: "What do I kill first?" },
              { value: "legit", label: "Which of these are legitimate?" },
            ]}
          />

          <FieldGrid>
            <Field
              id="jf-volume"
              label="Card volume a month"
              prefix="$"
              value={volume}
              onChange={setVolume}
              hint="Card sales only. This is the denominator for the basis point figure."
            />
            <Field
              id="jf-rate"
              label="Your current processing rate"
              suffix="%"
              value={rate}
              onChange={setRate}
              hint="All in, before the lines below. Only the monthly minimum reads it."
            />
          </FieldGrid>

          {showTerm && (
            <FieldGrid>
              <Field
                id="jf-term"
                label="Months left on your contract"
                value={term}
                onChange={setTerm}
                hint="Used to spread the early termination fee. It is a cost of staying, not a monthly charge."
              />
            </FieldGrid>
          )}

          <div>
            <p className="text-label uppercase text-muted-foreground">Lines on your statement</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {JUNK_FEES.map((fee) => (
                <CheckboxRow
                  key={fee.id}
                  checked={Boolean(ticked[fee.id])}
                  onChange={() => setTicked((prev) => ({ ...prev, [fee.id]: !prev[fee.id] }))}
                  label={fee.label}
                  hint={fee.statementLabels[0]}
                />
              ))}
            </div>
          </div>

          {selected.length > 0 && (
            <div>
              <p className="text-label uppercase text-muted-foreground">Amounts, as billed</p>
              <div className="mt-3">
                <FieldGrid>
                  {selected.map((fee) => (
                    <Field
                      key={fee.id}
                      id={`jf-amt-${fee.id}`}
                      label={fee.label}
                      prefix="$"
                      suffix={FREQUENCY_SUFFIX[fee.frequency]}
                      value={amounts[fee.id] ?? ""}
                      onChange={(v) => setAmounts((prev) => ({ ...prev, [fee.id]: v }))}
                      hint={fee.sourced ? undefined : "No published US figure. Read this one off your statement."}
                    />
                  ))}
                </FieldGrid>
              </div>
            </div>
          )}
        </div>
      }
      results={
        mode === "bill" ? (
          <div>
            <Headline
              label="These lines cost you a year"
              value={money(result.annualTotal)}
              sub={`${money(result.monthlyTotal)} a month, on ${money0(result.annualVolume)} of annual card volume.`}
            />

            <div className="mt-5">
              <ResultRow
                label="Added to your rate"
                value={bps(result.addedRatePct)}
                note="Fixed dollars, expressed against your volume"
                emphasis
              />
              <ResultRow
                label="All in, per dollar processed"
                value={pct(result.allInRatePct, 3)}
                note={`${pct(Math.max(0, num(rate)), 2)} stated plus ${pct(result.addedRatePct, 3)} of fixed fees`}
              />
              <ResultRow
                label="Your monthly processing charge"
                value={money(result.monthlyProcessingCharge)}
                note="What a monthly minimum is measured against"
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Line by line, a year</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Fee", "A year", "Bps"]}
                  align={["left", "right", "right"]}
                  maxHeight="300px"
                  empty="Tick a line to price it."
                  rows={result.ranked.map((line) => [
                    <span key={line.id}>
                      <span className="text-foreground">{line.label}</span>
                      {line.dormant && (
                        <span className="block text-micro text-muted-foreground">
                          A floor, not a charge. Your discount fees already clear it.
                        </span>
                      )}
                    </span>,
                    money(line.annualCost),
                    bps(line.addedBps / 100),
                  ])}
                />
              </div>
            </div>

            <Verdict effectiveRate={result.allInRatePct} />

            {ladderEnds && (
              <Callout tone={result.addedBps >= 40 ? "warn" : "neutral"}>
                The same {money(result.annualTotal)} bill is{" "}
                <strong className="text-foreground">{bps(ladderEnds.low.addedBps / 100)}</strong> at{" "}
                {money0(ladderEnds.low.monthlyVolume)} a month and{" "}
                <strong className="text-foreground">{bps(ladderEnds.high.addedBps / 100)}</strong> at{" "}
                {money0(ladderEnds.high.monthlyVolume)} a month. Fixed fees are a rate, and the rate
                is set by how little you process.
              </Callout>
            )}

            <Caveat>
              Interchange and card network assessments are not counted here. They are genuine pass
              through, they are the largest part of your bill, and no processor can waive them.
            </Caveat>
          </div>
        ) : mode === "removal" ? (
          <div>
            <Headline
              label="Avoidable, on your own numbers"
              value={money(avoidableTotal)}
              sub={
                avoidable.length > 0
                  ? `${avoidable.length} of the ${result.ranked.filter((l) => l.annualCost > 0).length} lines you ticked should come off for the asking.`
                  : "Nothing you have ticked is in the ask-it-off group. The rest need a negotiation or a switch."
              }
            />

            <div className="mt-5">
              <ResultRow label="What you pay now" value={money(result.annualTotal)} note="A year" />
              <ResultRow
                label="What is left after the cuts"
                value={money(result.annualTotal - avoidableTotal)}
                note={`${bps((result.addedBps - (result.annualVolume > 0 ? (avoidableTotal / result.annualVolume) * 10000 : 0)) / 100)} instead of ${bps(result.addedBps / 100)}`}
                emphasis
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Ranked, most expensive first</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Fee and what to do", "A year", "Route"]}
                  align={["left", "right", "right"]}
                  maxHeight="420px"
                  empty="Tick a line to rank it."
                  rows={result.ranked
                    .filter((line) => line.annualCost > 0)
                    .map((line) => {
                      const fee = JUNK_FEES.find((f) => f.id === line.id);
                      return [
                        <span key={line.id}>
                          <span className="text-foreground">{line.label}</span>
                          <span className="block text-micro text-muted-foreground">{fee?.removal}</span>
                        </span>,
                        money(line.annualCost),
                        <Pill
                          key={`${line.id}-p`}
                          tone={fee ? NEGOTIABILITY_TONE[fee.negotiability] : "neutral"}
                        >
                          {fee ? NEGOTIABILITY_LABEL[fee.negotiability] : "Unknown"}
                        </Pill>,
                      ];
                    })}
                />
              </div>
            </div>

            {topFee && topTarget && (
              <Callout tone="good">
                Start with <strong className="text-foreground">{topFee.label}</strong> at{" "}
                {money(topTarget.annualCost)} a year. {topFee.removal}
              </Callout>
            )}

            <Caveat>
              Ranked by annual dollars, not by how easy the call is. A processor that will not move on
              any of these has told you something useful about the next twelve months.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Of what you ticked, pure margin"
              value={money(
                selected
                  .filter((f) => f.verdict === "margin")
                  .reduce((s, f) => s + (byId.get(f.id)?.annualCost ?? 0), 0),
              )}
              sub="A year. The rest is either a real service or money that leaves your processor entirely."
            />

            <div className="mt-5">
              <MiniTable
                columns={["Fee", "What it is", "Typical"]}
                align={["left", "left", "left"]}
                maxHeight="480px"
                rows={JUNK_FEES.map((fee) => [
                  <span key={fee.id}>
                    <span className={ticked[fee.id] ? "text-foreground" : "text-muted-foreground"}>
                      {fee.label}
                    </span>
                    <span className="block text-micro text-muted-foreground">
                      {fee.statementLabels.join(", ")}
                    </span>
                  </span>,
                  <Pill key={`${fee.id}-v`} tone={VERDICT_TONE[fee.verdict]}>
                    {VERDICT_LABEL[fee.verdict]}
                  </Pill>,
                  <span key={`${fee.id}-t`} className="text-micro text-muted-foreground">
                    {fee.typicalRange}
                  </span>,
                ])}
              />
            </div>

            <Callout>
              Pass through is not junk. Interchange goes to the bank that issued your customer&rsquo;s
              card and assessments go to the card network, at published rates: Visa 0.14% on credit,
              Mastercard 0.13%, and Mastercard&rsquo;s network access fee at $0.0195 an
              authorization. Anyone offering to cut your interchange is describing something else.
            </Callout>

            <Caveat>
              A PCI compliance program fee can buy a real quarterly scan from an approved scanning
              vendor and a real breach warranty. Ask which vendor is attached to your account. If
              nobody can name one, you are paying for a login to a questionnaire.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default JunkFeeCalculator;
