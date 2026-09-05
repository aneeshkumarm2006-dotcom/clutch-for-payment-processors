"use client";

import * as React from "react";
import type { DowngradeReason } from "@/lib/tools-data/downgrades";
import {
  CEDP_PARTICIPATION_FEE_PCT,
  CORPORATE_LADDER,
  DOWNGRADE_DEFAULTS,
  ENHANCED_DATA_LADDERS,
} from "@/lib/tools-data/downgrades";
import { downgradeCost, enhancedDataUplift } from "@/lib/calc/downgrade";
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
  bps,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Interchange downgrade cost, two modes on one page.
 *
 * The gap this exploits: almost nobody has built this. The pages ranking for
 * "interchange downgrade" are ISO blog posts that list the causes and then stop,
 * or offer a statement audit behind an email form. None of them puts a dollar
 * figure on a named cause, and none quotes the two rate sheet rows the figure
 * comes from.
 *
 * THE MODELLING DECISION THAT MATTERS. A transaction clears in exactly one
 * interchange program, so the causes are ALLOCATED worst first rather than
 * summed. `lib/calc/downgrade.ts` explains why at length; the short version is
 * that summing them produces a bigger, plausible, wrong number. The naive total
 * is rendered beside the real one so a reader can see the size of the error.
 *
 * NO `Verdict` HERE, on purpose. The rate bands score a merchant's blended
 * monthly effective rate. This tool outputs a DELTA, and scoring a delta against
 * those bands would be meaningless.
 *
 * The reason rows arrive as PROPS from `ToolWidget`, per the rule in that file:
 * `/tools/[tool]` is one route with one client manifest, so a widget imports the
 * narrow module or takes the data from the server. The defaults and the ladder
 * are small enough to import directly from the narrow module.
 */
export function DowngradeCalculator({ reasons }: { reasons: DowngradeReason[] }) {
  const [mode, setMode] = React.useState<"cost" | "uplift">("cost");

  const [volume, setVolume] = React.useState(String(DOWNGRADE_DEFAULTS.monthlyVolume));
  const [transactions, setTransactions] = React.useState(String(DOWNGRADE_DEFAULTS.monthlyTransactions));
  const [commercialShare, setCommercialShare] = React.useState(
    String(DOWNGRADE_DEFAULTS.commercialSharePct),
  );

  const [selected, setSelected] = React.useState<string[]>(() =>
    reasons.filter((r) => r.defaultOn).map((r) => r.id),
  );
  const [shares, setShares] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(reasons.map((r) => [r.id, String(r.defaultSharePct)])),
  );

  const [ladderId, setLadderId] = React.useState(DOWNGRADE_DEFAULTS.ladderId);
  const [fromLevel, setFromLevel] = React.useState(DOWNGRADE_DEFAULTS.currentLevel);
  const [toLevel, setToLevel] = React.useState(DOWNGRADE_DEFAULTS.targetLevel);

  const monthlyVolume = Math.max(0, num(volume));
  const monthlyTransactions = Math.max(0, num(transactions));
  const commercialPct = Math.min(100, Math.max(0, num(commercialShare)));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const result = React.useMemo(
    () =>
      downgradeCost(
        {
          monthlyVolume,
          monthlyTransactions,
          commercialSharePct: commercialPct,
          selections: selected.map((id) => ({ id, sharePct: num(shares[id] ?? "0") })),
        },
        reasons,
      ),
    [monthlyVolume, monthlyTransactions, commercialPct, selected, shares, reasons],
  );

  // Bound rather than indexed inline, because `noUncheckedIndexedAccess` is on.
  // The lines are already sorted worst first by the calc module.
  const worst = result.lines.at(0);
  const worstReason = worst ? reasons.find((r) => r.id === worst.id) : undefined;

  // Named constant rather than `ENHANCED_DATA_LADDERS[0]`: `noUncheckedIndexedAccess`
  // is on, so the indexed fallback is typed as possibly undefined.
  const ladder = ENHANCED_DATA_LADDERS.find((l) => l.id === ladderId) ?? CORPORATE_LADDER;
  const commercialVolume = (monthlyVolume * commercialPct) / 100;
  const commercialTransactions = (monthlyTransactions * commercialPct) / 100;
  const uplift = React.useMemo(
    () =>
      enhancedDataUplift(
        ladder,
        fromLevel,
        toLevel,
        commercialVolume,
        commercialTransactions,
        CEDP_PARTICIPATION_FEE_PCT,
      ),
    [ladder, fromLevel, toLevel, commercialVolume, commercialTransactions],
  );

  const sharedInputs = (
    <div className="space-y-4">
      <FieldGrid>
        <Field
          id="dg-volume"
          label="Monthly card volume"
          prefix="$"
          value={volume}
          onChange={setVolume}
        />
        <Field
          id="dg-txns"
          label="Card transactions a month"
          value={transactions}
          onChange={setTransactions}
          hint={
            monthlyTransactions > 0
              ? `Average ticket ${money(result.averageTicket)}.`
              : "Used for the per-transaction part of each fall."
          }
        />
      </FieldGrid>
      <Field
        id="dg-commercial"
        label="Share of volume on commercial cards"
        suffix="%"
        value={commercialShare}
        onChange={setCommercialShare}
        hint={`Corporate, purchasing, fleet and small business cards. That is ${money0(
          commercialVolume,
        )} a month.`}
      />
    </div>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "cost" | "uplift")}
            options={[
              { value: "cost", label: "What are downgrades costing me?" },
              { value: "uplift", label: "What is Level 3 data worth?" },
            ]}
          />

          {sharedInputs}

          {mode === "cost" ? (
            <div>
              <p className="text-label uppercase text-muted-foreground">Which of these applies?</p>
              <div className="mt-2 space-y-3 rounded border bg-muted px-4 py-4">
                {reasons.map((r) => {
                  const on = selected.includes(r.id);
                  return (
                    <div key={r.id}>
                      <CheckboxRow
                        checked={on}
                        onChange={() => toggle(r.id)}
                        label={r.label}
                        hint={`${r.fromProgram} becomes ${r.toProgram}.`}
                      />
                      {on && (
                        <div className="mt-2 pl-7">
                          <Field
                            id={`dg-share-${r.id}`}
                            label={
                              r.basis === "commercial"
                                ? "Share of commercial volume affected"
                                : "Share of total volume affected"
                            }
                            suffix="%"
                            value={shares[r.id] ?? "0"}
                            onChange={(v) => setShares((prev) => ({ ...prev, [r.id]: v }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <SelectField
                id="dg-ladder"
                label="Which commercial cards"
                value={ladderId}
                onChange={setLadderId}
                options={ENHANCED_DATA_LADDERS.map((l) => ({ value: l.id, label: l.label }))}
                hint={ladder.note}
              />
              <FieldGrid>
                <SelectField
                  id="dg-from"
                  label="Data you send today"
                  value={fromLevel}
                  onChange={setFromLevel}
                  options={ladder.rungs.map((r) => ({ value: r.id, label: r.label }))}
                />
                <SelectField
                  id="dg-to"
                  label="Data you would send"
                  value={toLevel}
                  onChange={setToLevel}
                  options={ladder.rungs.map((r) => ({ value: r.id, label: r.label }))}
                />
              </FieldGrid>
              <p className="text-micro text-muted-foreground">
                Priced on the commercial share of your volume only. Consumer cards have no enhanced data
                programs to qualify for, so Level 2 and Level 3 fields do nothing for them.
              </p>
            </div>
          )}
        </div>
      }
      results={
        mode === "cost" ? (
          <div>
            <Headline
              label="Downgrades are costing you"
              value={money0(result.annualTotal)}
              sub={`${money(result.monthlyTotal)} a month, which is ${bps(
                result.totalBps / 100,
              )} on your whole card volume.`}
            />

            <div className="mt-5">
              <ResultRow label="Monthly cost" value={money(result.monthlyTotal)} emphasis />
              <ResultRow
                label="Volume clearing in a worse program"
                value={`${pct(result.downgradedSharePct, 1)} of ${money0(monthlyVolume)}`}
              />
              <ResultRow
                label="Added cost on your effective rate"
                value={pct(result.totalBps / 100, 2)}
                note="Basis points on every dollar you take, not just the affected ones"
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Ranked, worst first</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Cause", "Delta", "Volume hit", "A year"]}
                  align={["left", "right", "right", "right"]}
                  maxHeight="360px"
                  empty="Nothing selected. Tick the causes you know apply, or step through them one at a time."
                  rows={result.lines.map((l) => [
                    <span key={l.id}>
                      <span className="text-foreground">{l.label}</span>
                      <span className="block text-micro text-muted-foreground">
                        {l.fromProgram} becomes {l.toProgram}
                      </span>
                      {l.clipped && (
                        <Pill key={`${l.id}-c`} tone="warn">
                          Capped: no volume left to downgrade
                        </Pill>
                      )}
                    </span>,
                    <span key={`${l.id}-d`} className="text-muted-foreground">
                      {pct(l.deltaPct, 2)}
                      {l.deltaCents > 0 ? ` + ${l.deltaCents}c` : ""}
                    </span>,
                    money0(l.affectedVolume),
                    money0(l.annualCost),
                  ])}
                />
              </div>
            </div>

            {worst && worstReason && (
              <div className="mt-5 rounded border border-border-strong bg-muted px-4 py-3">
                <p className="text-label uppercase text-muted-foreground">
                  Worst rate impact: {money0(worst.annualCost)} a year
                </p>
                <p className="mt-1.5 text-small text-foreground">{worst.label}</p>
                <p className="mt-1 text-small text-muted-foreground">{worstReason.trigger}</p>
                <p className="mt-2 text-small text-foreground">{worstReason.fix}</p>
                <p className="mt-2 text-micro text-muted-foreground">{worstReason.rangeNote}</p>
              </div>
            )}

            <Callout tone={result.anyClipped ? "warn" : "neutral"}>
              A transaction clears in exactly one interchange program, so it can only downgrade once. This
              calculator allocates the causes worst first and stops at your whole volume. Adding them up
              independently, which is what every other model does, gives{" "}
              <strong className="text-foreground">{money(result.naiveMonthlyTotal)}</strong> a month against
              the {money(result.monthlyTotal)} shown above.
            </Callout>

            <Caveat>
              Every delta is the difference between two rows on a published US rate sheet, quoted beside the
              cause. Visa rates are the schedule effective 18 April 2026 and Mastercard rates the schedule
              effective 17 April 2026. Your acquirer adds its own markup on top of interchange, and on a flat
              rate account it absorbs the downgrade instead of passing it on, so this is the cost to whoever
              is carrying the interchange, which on interchange plus is you.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label={uplift.empty ? "Nothing to price" : "Moving up is worth"}
              value={
                uplift.empty
                  ? "N/A"
                  : uplift.annualLow === uplift.annualHigh
                    ? `${money0(uplift.annualLow)} a year`
                    : `${money0(uplift.annualLow)} to ${money0(uplift.annualHigh)}`
              }
              sub={
                uplift.empty
                  ? "Neither network publishes a program at both of those levels for these cards."
                  : `A year, on ${money0(uplift.commercialVolume)} a month of commercial volume. The range is the gap between the two networks; where you land depends on your Visa and Mastercard mix.`
              }
            />

            <div className="mt-5">
              <MiniTable
                columns={["Network", "From", "To", "A year"]}
                align={["left", "left", "left", "right"]}
                rows={uplift.legs.map((l) => [
                  <span key={l.network} className="text-foreground">
                    {l.network}
                  </span>,
                  l.available ? (
                    <span key={`${l.network}-f`} className="text-muted-foreground">
                      {l.fromProgram}
                      <span className="block text-micro">
                        {pct(l.fromPct, 2)} + {money(l.fromCents / 100)}
                      </span>
                    </span>
                  ) : (
                    <span key={`${l.network}-f`} className="text-muted-foreground">
                      {l.unavailableNote}
                    </span>
                  ),
                  l.available ? (
                    <span key={`${l.network}-t`} className="text-muted-foreground">
                      {l.toProgram}
                      <span className="block text-micro">
                        {pct(l.toPct, 2)} + {money(l.toCents / 100)}
                      </span>
                    </span>
                  ) : (
                    ""
                  ),
                  l.available ? (
                    <span key={`${l.network}-s`} className={l.annualSaving < 0 ? "text-muted-foreground" : ""}>
                      {money0(l.annualSaving)}
                    </span>
                  ) : (
                    <Pill key={`${l.network}-n`} tone="neutral">
                      No program
                    </Pill>
                  ),
                ])}
              />
            </div>

            {uplift.legs.some((l) => l.available && l.annualSaving < 0) && (
              <Callout tone="warn">
                One of these moves costs money rather than saving it. Visa prices Business Product 3 above
                Business Product 2, so on small business cards Level 2 is the cheap rung and Level 3 is not
                the next step up. The deep Level 3 discount lives on corporate, purchasing and fleet cards.
              </Callout>
            )}

            {uplift.legs.some((l) => l.network === "Visa" && l.participationFeePct !== 0) && (
              <Callout>
                The Visa figure already nets off the{" "}
                <strong className="text-foreground">{pct(CEDP_PARTICIPATION_FEE_PCT, 2)}</strong> Commercial
                Enhanced Data Program participation fee charged on enhanced data submissions. That fee is not
                in the Visa rate sheet; it comes from processor documentation and is dated in the assumptions
                below.
              </Callout>
            )}

            <Caveat>
              Assumes commercial cards carry the same average ticket as the rest of your book, so the
              transaction count is split in the same proportion as the volume. On most B2B accounts the
              commercial ticket is larger, which makes the percentage part of this saving bigger and the per
              transaction part smaller. Level 3 also has to be sent correctly to be worth anything: Visa
              requires the line items, tax and freight to sum exactly to the authorization amount.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default DowngradeCalculator;
