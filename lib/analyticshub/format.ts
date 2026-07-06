/**
 * lib/analyticshub/format.ts — number/date formatting for the hub.
 *
 * The repo's `lib/utils.ts` only has `formatCount` (compact) — a dashboard needs
 * currency, percent, duration, and signed-delta formatting too. All use
 * `Intl.NumberFormat` so locale/grouping is correct, and all are pure.
 */

const numberFmt = new Intl.NumberFormat("en-US");
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** `1234567` → `"1,234,567"`. */
export function fmtNumber(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return numberFmt.format(v);
}

/** `1234567` → `"1.2M"`. */
export function fmtCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return compactFmt.format(v);
}

/** Currency with a code (default USD). `12.3` → `"$12.30"`. */
export function fmtCurrency(v: number | null | undefined, currency = "USD"): string {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

/**
 * Percent from a RATIO. `0.0432` → `"4.32%"`. Pass `alreadyPercent` when the
 * value is already 0–100 (e.g. GSC CTR delivered as a fraction vs. Meta rates).
 */
export function fmtPercent(v: number | null | undefined, digits = 2, alreadyPercent = false): string {
  if (v == null || Number.isNaN(v)) return "—";
  const pct = alreadyPercent ? v : v * 100;
  return `${pct.toFixed(digits)}%`;
}

/** Seconds → `"1m 05s"` / `"45s"` (GA4 average engagement time). */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${String(rem).padStart(2, "0")}s` : `${rem}s`;
}

/** Average position (GSC) — one decimal, lower is better. `3.42` → `"3.4"`. */
export function fmtPosition(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(1);
}

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  /** Signed percent change vs. previous period, or null when incomputable. */
  pct: number | null;
  direction: DeltaDirection;
  /** `"+12.3%"`, `"−4.0%"`, `"—"`. */
  label: string;
  /**
   * Is this change GOOD? Accounts for cost metrics where DOWN is good. The UI
   * colors on `good` (restrained tint), not on raw direction — so a falling CPC
   * shows the positive tint, not red.
   */
  good: boolean | null;
}

/**
 * Compute a period-over-period delta. `costMetric` inverts the good/bad sense
 * (spend, CPC, CPM, cost/conversion, avg position — lower is better).
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  costMetric = false,
): Delta {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous) || previous === 0) {
    return { pct: null, direction: "flat", label: "—", good: null };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const direction: DeltaDirection = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const minus = "−"; // real minus sign, not hyphen — reads better with tabular nums
  const label =
    direction === "flat"
      ? "0%"
      : `${pct > 0 ? "+" : minus}${Math.abs(pct).toFixed(1)}%`;
  const good = direction === "flat" ? null : costMetric ? direction === "down" : direction === "up";
  return { pct, direction, label, good };
}

/** Metrics where a lower value is better (drives delta coloring + inversion). */
export const COST_METRICS = new Set([
  "spend",
  "cost",
  "cpc",
  "cpm",
  "costPerConversion",
  "costPerResult",
  "position",
]);
