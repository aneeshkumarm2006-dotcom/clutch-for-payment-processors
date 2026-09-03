"use client";

import * as React from "react";
import { FED_HOLIDAYS, PAYOUT_PROFILES } from "@/lib/tools-data/payouts";
import { payoutDate } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ResultRow,
  SelectField,
  money,
  num,
} from "@/components/public/tools/ToolKit";

/**
 * "I took a card payment today. When does the money actually arrive?"
 *
 * Every page ranking for this describes the rule in prose and not one resolves
 * it to a date. Resolving it is the entire product, and it is exact: the Federal
 * Reserve publishes its holiday calendar years ahead with deterministic
 * observance rules, and the processors publish their own timing and cutoffs.
 *
 * The one thing this deliberately does NOT promise is the final leg. Once funds
 * leave the processor, when they post is the receiving bank's business, and the
 * processors say so themselves.
 */
export function PayoutDateCalculator() {
  const [slug, setSlug] = React.useState(PAYOUT_PROFILES[0]?.processorSlug ?? "");
  const [saleDate, setSaleDate] = React.useState("");
  const [saleTime, setSaleTime] = React.useState("14:00");
  const [speed, setSpeed] = React.useState<"standard" | "nextDay" | "instant">("standard");

  // Today is set on the client only. Prerendering it would bake the build date
  // into the HTML and quietly serve a stale answer for as long as the page is
  // cached, which on a date calculator is the worst possible failure.
  React.useEffect(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setSaleDate(local.toISOString().slice(0, 10));
  }, []);

  const profile = PAYOUT_PROFILES.find((p) => p.processorSlug === slug) ?? PAYOUT_PROFILES[0];
  const hasCutoff = Boolean(profile && profile.cutoff && profile.cutoff !== "none");

  const result = profile
    ? payoutDate({ profile, saleDate, saleTime, speed, holidays: FED_HOLIDAYS })
    : null;

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <SelectField
            id="pd-processor"
            label="Processor"
            value={slug}
            onChange={setSlug}
            options={PAYOUT_PROFILES.map((p) => ({ value: p.processorSlug, label: p.name }))}
          />

          <FieldGrid>
            <div className="min-w-0">
              <label
                htmlFor="pd-date"
                className="text-[0.8125rem] font-medium leading-none text-ink-700 dark:text-ink-300"
              >
                Date of the sale
              </label>
              <input
                id="pd-date"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded border border-input bg-muted px-3 text-[0.875rem] text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-subtle"
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="pd-time"
                className="text-[0.8125rem] font-medium leading-none text-ink-700 dark:text-ink-300"
              >
                Time of the sale
              </label>
              <input
                id="pd-time"
                type="time"
                value={saleTime}
                onChange={(e) => setSaleTime(e.target.value)}
                disabled={!hasCutoff}
                className="mt-1.5 flex h-10 w-full rounded border border-input bg-muted px-3 text-[0.875rem] text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-subtle disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="mt-1.5 text-micro text-muted-foreground">
                {hasCutoff
                  ? `Batch cutoff ${profile?.cutoff}.`
                  : `${profile?.name} publishes no hourly cutoff, so the time of day does not change the answer.`}
              </p>
            </div>
          </FieldGrid>

          <SelectField
            id="pd-speed"
            label="Payout speed"
            value={speed}
            onChange={(v) => setSpeed(v as "standard" | "nextDay" | "instant")}
            options={[
              { value: "standard", label: `Standard (${profile?.standardDays ?? 2} business days)` },
              { value: "nextDay", label: "Next business day" },
              { value: "instant", label: "Instant, for a fee" },
            ]}
          />
        </div>
      }
      results={
        <div>
          {result ? (
            <>
              <Headline
                label="Expected in your account"
                value={result.settlement.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                sub={`${result.weekday}, ${result.calendarDays} calendar ${result.calendarDays === 1 ? "day" : "days"} after the sale.`}
              />

              <div className="mt-5">
                <ResultRow
                  label="Batch"
                  value={result.missedCutoff ? "Next day" : "Same day"}
                  note={
                    result.missedCutoff
                      ? `The sale was after the ${profile?.cutoff} cutoff, so it lands in the next batch.`
                      : hasCutoff
                        ? `Inside the ${profile?.cutoff} cutoff.`
                        : "No hourly cutoff published."
                  }
                />
                <ResultRow
                  label="Business days waited"
                  value={speed === "instant" ? "0" : String(speed === "nextDay" ? 1 : (profile?.standardDays ?? 0))}
                />
                {result.skipped.length > 0 && (
                  <ResultRow
                    label="Days skipped"
                    value={String(result.calendarDays - (speed === "instant" ? 0 : speed === "nextDay" ? 1 : (profile?.standardDays ?? 0)))}
                    note={`Because of ${result.skipped.join(" and ")}.`}
                  />
                )}
              </div>

              {speed === "instant" && profile && (
                <Callout>
                  <strong className="text-foreground">Instant payouts at {profile.name}:</strong> {profile.instant}
                </Callout>
              )}
            </>
          ) : (
            <>
              <Headline
                label={profile?.name ?? "Payout timing"}
                value={`${profile?.standardDays ?? 2} business days`}
                sub="Pick a sale date to resolve it to an actual calendar date."
              />
              <div className="mt-5">
                <ResultRow label="Standard payout" value={`${profile?.standardDays ?? 2} business days`} />
                <ResultRow label="Batch cutoff" value={hasCutoff ? (profile?.cutoff ?? "N/A") : "None published"} />
              </div>
            </>
          )}

          {profile?.note && (
            <p className="mt-5 rounded border border-border-strong bg-muted px-4 py-3 text-small text-muted-foreground">
              {profile.note}
            </p>
          )}

          <Caveat>
            This is the date funds are expected to leave the processor. When they post is the receiving bank&rsquo;s
            decision, and banks commonly add a day. New accounts also sit on a longer first payout at most
            processors.
          </Caveat>
        </div>
      }
    />
  );
}

export default PayoutDateCalculator;
