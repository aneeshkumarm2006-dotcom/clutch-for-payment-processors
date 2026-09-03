"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rateBand } from "@/lib/tools-rates";

/**
 * Shared primitives for the `/tools/*` calculators.
 *
 * One copy of the number formatting, the field chrome and the result chrome, so
 * five calculators cannot drift into looking like five different products. All
 * of it is client-side: these mount inside `"use client"` islands.
 *
 * NOTE for anyone editing the strings in this file or in any sibling calculator:
 * `npm run audit:dashes` walks Mongo documents, NOT source string literals, so
 * an em dash typed into a label here passes both audits and still ships. Grep
 * this directory directly when you touch the copy.
 */

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currency0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const money = (n: number): string => (Number.isFinite(n) ? currency.format(n) : "N/A");
export const money0 = (n: number): string => (Number.isFinite(n) ? currency0.format(n) : "N/A");
export const pct = (n: number, dp = 2): string =>
  Number.isFinite(n) ? `${n.toFixed(dp)}%` : "N/A";
export const bps = (n: number): string =>
  Number.isFinite(n) ? `${Math.round(n * 100)} bps` : "N/A";

/** Parse a user-typed number, tolerating commas, currency symbols and blanks. */
export const num = (v: string): number => {
  const parsed = Number.parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  prefix,
  suffix,
  value,
  onChange,
  id,
  inputMode = "decimal",
  className,
}: {
  label: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
  inputMode?: "decimal" | "numeric";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        {prefix && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-small text-muted-foreground"
            aria-hidden
          >
            {prefix}
          </span>
        )}
        <Input
          id={id}
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          className={cn(prefix && "pl-7", suffix && "pr-9")}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-small text-muted-foreground"
            aria-hidden
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-micro text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  id,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  hint?: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={id}>{label}</Label>
      {/* A native select, deliberately: it is one control in the initial HTML,
          works before hydration, and needs no portal inside a form grid. */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 flex h-10 w-full rounded border border-input bg-muted px-3 text-[0.875rem] text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-subtle"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-micro text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ModeTabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded border bg-muted p-1" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded px-3.5 py-1.5 text-small font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout and results
// ---------------------------------------------------------------------------

export function CalcShell({
  children,
  controls,
  results,
}: {
  children?: React.ReactNode;
  controls: React.ReactNode;
  results: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      {children && <div className="border-b px-5 py-4 sm:px-6">{children}</div>}
      <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
        <div className="px-5 py-6 sm:px-6">{controls}</div>
        <div className="border-t bg-muted/40 px-5 py-6 sm:px-6 lg:border-l lg:border-t-0">
          {results}
        </div>
      </div>
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function Headline({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-label uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-display leading-none tracking-tightest2 text-foreground tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-2 text-small text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ResultRow({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0">
        <span className={cn("text-body", emphasis ? "font-medium text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
        {note && <span className="block text-micro text-muted-foreground">{note}</span>}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "text-h4 text-foreground" : "text-body text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The verdict band. This is the output merchants actually came for: a number on
 * its own does not tell anyone whether to act. The bands live in `lib/tools.ts`
 * so every calculator scores a rate identically.
 */
export function Verdict({ effectiveRate }: { effectiveRate: number }) {
  if (!Number.isFinite(effectiveRate) || effectiveRate <= 0) return null;
  const band = rateBand(effectiveRate);
  const tone =
    band.label === "Excellent" || band.label === "Good"
      ? "border-success/40 bg-success/10"
      : band.label === "Average"
        ? "border-border-strong bg-muted"
        : "border-warning/40 bg-warning/10";

  return (
    <div className={cn("mt-5 rounded border px-4 py-3", tone)}>
      <p className="text-h4 text-foreground">{band.label}</p>
      <p className="mt-1 text-small text-muted-foreground">{band.note}</p>
    </div>
  );
}

export function Caveat({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 text-micro text-muted-foreground">{children}</p>;
}

export function Callout({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mt-5 rounded border px-4 py-3 text-small text-muted-foreground",
        tone === "good" && "border-success/40 bg-success/10",
        tone === "warn" && "border-warning/40 bg-warning/10",
        tone === "neutral" && "border-border-strong bg-muted",
      )}
    >
      {children}
    </p>
  );
}

export function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]"
      />
      <span className="text-small text-foreground">
        {label}
        {hint && <span className="block text-micro text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * A scrolling result table for the widgets whose output is a series rather than
 * a single figure: the reserve release timeline, the chargeback programme
 * standings, the MCC search results. Wide content scrolls inside its own box so
 * the page body never scrolls sideways.
 */
export function MiniTable({
  columns,
  rows,
  align,
  maxHeight,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  /** Per-column alignment; defaults to left for the first column, right for the rest. */
  align?: ("left" | "right")[];
  maxHeight?: string;
  empty?: string;
}) {
  const alignFor = (i: number) => align?.[i] ?? (i === 0 ? "left" : "right");

  if (rows.length === 0) {
    return (
      <p className="rounded border border-border-strong bg-muted px-4 py-6 text-center text-small text-muted-foreground">
        {empty ?? "Nothing to show yet."}
      </p>
    );
  }

  return (
    <div
      className={cn("overflow-x-auto rounded border", maxHeight && "overflow-y-auto")}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-small">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={cn(
                  "whitespace-nowrap border-b px-3 py-2 text-label uppercase text-muted-foreground",
                  alignFor(i) === "right" ? "text-right" : "text-left",
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={r} className="border-b last:border-b-0">
              {row.map((cell, i) => (
                <td
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className={cn(
                    "px-3 py-2 text-foreground",
                    alignFor(i) === "right" ? "text-right tabular-nums" : "text-left",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A coloured status pill, for the surcharge table and the chargeback standings. */
export function Pill({
  tone,
  children,
}: {
  tone: "good" | "warn" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded px-2 py-0.5 text-micro",
        tone === "good" && "bg-success/15 text-foreground",
        tone === "warn" && "bg-warning/20 text-foreground",
        tone === "bad" && "bg-destructive/15 text-foreground",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
