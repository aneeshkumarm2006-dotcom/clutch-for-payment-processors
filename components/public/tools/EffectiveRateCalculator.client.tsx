"use client";

import * as React from "react";
import {
  CalcShell,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ModeTabs,
  ResultRow,
  Verdict,
  bps,
  money,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The effective rate calculator behind `/tools/effective-rate-calculator`.
 *
 * Quick mode is the division every competitor already does. Full mode is the
 * reason this page exists: it splits the effective rate into pass-through cost
 * (interchange plus card brand assessments, which no processor can discount) and
 * processor markup (the only part anyone can negotiate). Not one calculator
 * ranking for this term does that split, and without it the output is a dead end:
 * "your rate is 2.9%" is not a decision, "your markup is 68 basis points" is.
 *
 * Everything runs in the browser. Every incumbent statement-analysis service
 * requires a PDF upload and a phone number, to a company that sells payment
 * processing. Not sending the numbers anywhere is the product difference, so do
 * not add a network call here.
 */

/**
 * Fallback pass-through estimate when a statement does not itemise interchange,
 * which is the norm on flat-rate and tiered pricing. A band, not a point value:
 * interchange depends on card type, merchant category and channel, and any tool
 * printing a single precise figure for an unknown merchant is guessing.
 */
const ESTIMATED_PASS_THROUGH = { low: 1.7, high: 2.1, mid: 1.9 };

export function EffectiveRateCalculator() {
  const [mode, setMode] = React.useState<"quick" | "full">("quick");

  const [volume, setVolume] = React.useState("52000");
  const [fees, setFees] = React.useState("1196");

  const [knowsInterchange, setKnowsInterchange] = React.useState(false);
  const [interchange, setInterchange] = React.useState("960");
  const [discount, setDiscount] = React.useState("1196");
  const [perItem, setPerItem] = React.useState("0");
  const [statementFee, setStatementFee] = React.useState("25");
  const [gatewayFee, setGatewayFee] = React.useState("20");
  const [pciFee, setPciFee] = React.useState("15");
  const [otherFees, setOtherFees] = React.useState("0");

  const cardVolume = Math.max(0, num(volume));

  const quickFees = Math.max(0, num(fees));
  const fullFees =
    Math.max(0, num(discount)) +
    Math.max(0, num(perItem)) +
    Math.max(0, num(statementFee)) +
    Math.max(0, num(gatewayFee)) +
    Math.max(0, num(pciFee)) +
    Math.max(0, num(otherFees));

  const totalFees = mode === "quick" ? quickFees : fullFees;
  const effective = cardVolume > 0 ? (totalFees / cardVolume) * 100 : 0;

  const passThroughDollars = knowsInterchange
    ? Math.max(0, num(interchange))
    : (cardVolume * ESTIMATED_PASS_THROUGH.mid) / 100;
  const passThroughRate = cardVolume > 0 ? (passThroughDollars / cardVolume) * 100 : 0;
  const markupDollars = totalFees - passThroughDollars;
  const markupRate = cardVolume > 0 ? (markupDollars / cardVolume) * 100 : 0;

  const fixedShare =
    Math.max(0, num(statementFee)) +
    Math.max(0, num(gatewayFee)) +
    Math.max(0, num(pciFee)) +
    Math.max(0, num(otherFees));

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "quick" | "full")}
            options={[
              { value: "quick", label: "Quick" },
              { value: "full", label: "Full statement" },
            ]}
          />

          <Field
            id="erc-volume"
            label="Total card volume this month"
            prefix="$"
            value={volume}
            onChange={setVolume}
            hint="Gross processing volume, from page one of your statement."
          />

          {mode === "quick" ? (
            <Field
              id="erc-fees"
              label="Total fees this month"
              prefix="$"
              value={fees}
              onChange={setFees}
              hint="Everything the processor took: discount, per-item, and every monthly charge."
            />
          ) : (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="erc-discount" label="Discount and processing charges" prefix="$" value={discount} onChange={setDiscount} />
                <Field id="erc-peritem" label="Per-item and authorisation fees" prefix="$" value={perItem} onChange={setPerItem} />
              </FieldGrid>
              <div>
                <p className="text-label uppercase text-muted-foreground">
                  Fixed line items, the ones worth questioning
                </p>
                <div className="mt-2.5 space-y-4">
                  <FieldGrid>
                    <Field id="erc-statement" label="Statement and account fee" prefix="$" value={statementFee} onChange={setStatementFee} />
                    <Field id="erc-gateway" label="Gateway fee" prefix="$" value={gatewayFee} onChange={setGatewayFee} />
                  </FieldGrid>
                  <FieldGrid>
                    <Field
                      id="erc-pci"
                      label="PCI fees"
                      prefix="$"
                      value={pciFee}
                      onChange={setPciFee}
                      hint="A non-compliance fee is a penalty, not a cost. It is avoidable."
                    />
                    <Field
                      id="erc-other"
                      label="Everything else"
                      prefix="$"
                      value={otherFees}
                      onChange={setOtherFees}
                      hint="Monthly minimum, batch fees, network access, regulatory."
                    />
                  </FieldGrid>
                </div>
              </div>
            </div>
          )}

          <div className="rounded border bg-muted px-4 py-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={knowsInterchange}
                onChange={() => setKnowsInterchange((v) => !v)}
                className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]"
              />
              <span className="text-small text-foreground">
                My statement itemises interchange
                <span className="block text-micro text-muted-foreground">
                  Interchange-plus statements do. Flat-rate and tiered ones do not, and that is the point of them.
                </span>
              </span>
            </label>
            {knowsInterchange && (
              <div className="mt-3">
                <Field
                  id="erc-interchange"
                  label="Interchange plus card brand assessments"
                  prefix="$"
                  value={interchange}
                  onChange={setInterchange}
                />
              </div>
            )}
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Effective rate"
            value={pct(effective)}
            sub={`${money(totalFees)} of fees on ${money(cardVolume)} of card volume.`}
          />
          <Verdict effectiveRate={effective} />

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Where it goes</p>
            <div className="mt-2">
              <ResultRow
                label="Pass-through cost"
                value={`${money(passThroughDollars)} (${pct(passThroughRate)})`}
                note={
                  knowsInterchange
                    ? "Interchange and assessments, from your statement. Not negotiable."
                    : `Estimated at ${pct(ESTIMATED_PASS_THROUGH.mid, 1)}, a typical US small-business mix. Not negotiable.`
                }
              />
              <ResultRow
                label="Processor markup"
                value={`${money(markupDollars)} (${bps(markupRate)})`}
                note="The only part anyone can move."
                emphasis
              />
              {mode === "full" && fixedShare > 0 && (
                <ResultRow
                  label="Of which fixed monthly charges"
                  value={money(fixedShare)}
                  note={
                    cardVolume > 0
                      ? `${pct((fixedShare / cardVolume) * 100)} of volume, and it does not fall when you sell less.`
                      : undefined
                  }
                />
              )}
            </div>
          </div>

          {markupRate > 0 && (
            <p className="mt-5 rounded border border-border-strong bg-muted px-4 py-3 text-small text-muted-foreground">
              {markupRate < 0.2
                ? "A markup under 20 basis points is very competitive. There is little left to negotiate here."
                : markupRate < 0.5
                  ? "20 to 50 basis points over interchange is a normal, competitive markup for a US small business."
                  : markupRate < 1
                    ? "Over 50 basis points. Worth a conversation, especially if your volume has grown since you signed."
                    : "Over 100 basis points of markup. On a merchant with no unusual risk, that is high enough to quote against."}
            </p>
          )}

          {!knowsInterchange && (
            <Caveat>
              The split uses an estimated {pct(ESTIMATED_PASS_THROUGH.low, 1)} to{" "}
              {pct(ESTIMATED_PASS_THROUGH.high, 1)} pass-through band. For a real markup figure,
              tick the box above and enter the interchange total from your statement.
            </Caveat>
          )}
          <Caveat>Nothing you type here is uploaded or stored. It is arithmetic in your browser.</Caveat>
        </div>
      }
    />
  );
}

export default EffectiveRateCalculator;
