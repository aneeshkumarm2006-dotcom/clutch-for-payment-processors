"use client";

import * as React from "react";
import { RESERVE_CARRY_RATE, RESERVE_DEFAULTS, RESERVE_RANGES } from "@/lib/tools-data/reserve";
import { reserveTimeline } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  CheckboxRow,
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
 * Rolling reserve: what it locks up, and when any of it comes back.
 *
 * The point the timeline makes is that a reserve is not a fee that is paid and
 * gone. Under steady volume it is a permanent working-capital hole of
 * (monthly volume x reserve percentage x hold months) that only unwinds when you
 * stop processing, and even then the last release is months out.
 *
 * The carry cost is priced at a published reference rate with the rate named on
 * screen, because the honest cost of money you cannot touch is what it costs to
 * replace it, and inventing a number here would be worse than showing none.
 */
export function RollingReserveCalculator() {
  const [monthlyVolume, setMonthlyVolume] = React.useState(String(RESERVE_DEFAULTS.monthlyVolume));
  const [reservePct, setReservePct] = React.useState(String(RESERVE_DEFAULTS.reservePct));
  const [holdMonths, setHoldMonths] = React.useState(String(RESERVE_DEFAULTS.holdMonths));
  const [windDown, setWindDown] = React.useState(false);

  const V = Math.max(0, num(monthlyVolume));
  const p = Math.max(0, Math.min(100, num(reservePct)));
  const h = Math.max(0, Math.min(12, Math.round(num(holdMonths))));

  // A rolling reserve is a rolling percentage of every batch, so the start month
  // is presentational. It is fixed to the first of the current month on the
  // client only, to avoid a prerendered date going stale in the HTML.
  const [startMonth, setStartMonth] = React.useState<Date | null>(null);
  React.useEffect(() => {
    const now = new Date();
    setStartMonth(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  }, []);

  const months = Math.min(24, Math.max(12, h * 2 + 2));
  const { rows, withheldPerMonth, steadyStateLocked } = reserveTimeline({
    monthlyVolume: V,
    reservePct: p,
    holdMonths: h,
    startMonth: startMonth ?? new Date(Date.UTC(2026, 0, 1)),
    months,
    ...(windDown ? { stopAfterMonth: h } : {}),
  });

  const carry = steadyStateLocked * RESERVE_CARRY_RATE.value;
  // A percentage typed as a decimal is the one input error that silently
  // understates the answer by two orders of magnitude.
  const looksLikeDecimal = p > 0 && p < 1;

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Your terms</p>
            <div className="mt-2.5 space-y-4">
              <Field
                id="rr-volume"
                label="Monthly card volume"
                prefix="$"
                value={monthlyVolume}
                onChange={setMonthlyVolume}
              />
              <FieldGrid>
                <Field
                  id="rr-pct"
                  label="Reserve percentage"
                  suffix="%"
                  value={reservePct}
                  onChange={setReservePct}
                  hint="Off every batch."
                />
                <Field
                  id="rr-hold"
                  label="Hold period"
                  suffix="mo"
                  value={holdMonths}
                  onChange={setHoldMonths}
                  hint="Commonly 6 months, sometimes 180 days."
                />
              </FieldGrid>
            </div>
          </div>

          <div className="rounded border bg-muted px-4 py-3">
            <CheckboxRow
              checked={windDown}
              onChange={() => setWindDown((v) => !v)}
              label="Show what happens if I stop processing"
              hint="The balance only drains once the last batch has aged out."
            />
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">What acquirers typically impose</p>
            <div className="mt-2.5">
              <MiniTable
                columns={["Risk tier", "Reserve", "Hold"]}
                rows={RESERVE_RANGES.map((r) => [r.tier, r.reservePct, r.holdMonths])}
                align={["left", "right", "right"]}
              />
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label="Cash locked up at steady state"
            value={money0(steadyStateLocked)}
            sub={
              h === 0
                ? "A zero month hold locks nothing up."
                : `${money0(withheldPerMonth)} withheld every month, none of it back for ${h} months.`
            }
          />

          <div className="mt-5">
            <ResultRow label="Withheld per month" value={money(withheldPerMonth)} />
            <ResultRow
              label="First release"
              value={h === 0 ? "N/A" : (rows.find((r) => r.firstRelease)?.label ?? "N/A")}
              note={h === 0 ? undefined : `Month ${h + 1}, once the first batch has aged out`}
            />
            <ResultRow label="Peak locked up" value={money0(steadyStateLocked)} emphasis />
            {steadyStateLocked > 0 && (
              <ResultRow
                label="Annual cost of carrying it"
                value={money0(carry)}
                note={`At the ${pct(RESERVE_CARRY_RATE.value * 100, 2)} ${RESERVE_CARRY_RATE.label}, ${RESERVE_CARRY_RATE.source}`}
              />
            )}
          </div>

          {looksLikeDecimal && (
            <Callout tone="warn">
              A reserve of {p} percent is unusually small. If your agreement says 0.10, that is normally ten percent,
              so enter 10.
            </Callout>
          )}

          {h > 0 && V > 0 && p > 0 && (
            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">
                {windDown ? "Winding down" : "Month by month"}
              </p>
              <div className="mt-2">
                <MiniTable
                  columns={["Month", "Held", "Released", "Locked"]}
                  rows={rows.map((r) => [
                    r.firstRelease ? `${r.label} (first release)` : r.label,
                    r.held > 0 ? money0(r.held) : "0",
                    r.released > 0 ? money0(r.released) : "0",
                    money0(r.locked),
                  ])}
                  maxHeight="280px"
                />
              </div>
            </div>
          )}

          {windDown && h > 0 && (
            <Callout>
              The table shows the contractual schedule. In practice the final release usually takes longer: acquirers
              commonly hold reserve funds for around 180 days after an account closes, and that delay is deliberately
              not baked into the arithmetic above.
            </Callout>
          )}

          <Caveat>
            Assumes steady monthly volume. Real reserves are withheld per batch on a daily clock, so treat the month
            labels as the month a release begins rather than a settlement date.
          </Caveat>
        </div>
      }
    />
  );
}

export default RollingReserveCalculator;
