import type { SeriesPoint } from "./types";

/**
 * lib/analyticshub/dates.ts — range presets, previous-period math, and day
 * bucketing. Everything is computed in **UTC** so results are deterministic and
 * serverless-safe (no host-timezone drift); `YYYY-MM-DD` day strings match what
 * the GA4 / GSC / Meta / Ads APIs expect. A single-owner glanceable dashboard
 * doesn't need per-property timezone alignment — noted in the setup guide.
 */

export interface DateRange {
  /** ISO day, inclusive. */
  from: string;
  /** ISO day, inclusive. */
  to: string;
}

export const PRESETS = ["today", "yesterday", "7d", "28d", "90d"] as const;
export type PresetKey = (typeof PRESETS)[number];

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "90d": "Last 90 days",
};

export const DEFAULT_PRESET: PresetKey = "7d";

/** Midnight-UTC Date for `now` (defaults to real now). */
function utcMidnight(now: number = Date.now()): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODay(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, day ?? 1));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Resolve a preset to a concrete `{ from, to }` range (inclusive). */
export function resolvePreset(preset: PresetKey, now: number = Date.now()): DateRange {
  const today = utcMidnight(now);
  switch (preset) {
    case "today":
      return { from: isoDay(today), to: isoDay(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: isoDay(y), to: isoDay(y) };
    }
    case "7d":
      return { from: isoDay(addDays(today, -6)), to: isoDay(today) };
    case "28d":
      return { from: isoDay(addDays(today, -27)), to: isoDay(today) };
    case "90d":
      return { from: isoDay(addDays(today, -89)), to: isoDay(today) };
  }
}

/** Inclusive day count of a range. */
export function daysBetween(range: DateRange): number {
  const from = parseISODay(range.from);
  const to = parseISODay(range.to);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/**
 * The immediately-preceding equivalent period. For a 7-day range ending today,
 * this is the 7 days before `from`. Used for the KPI % deltas.
 */
export function previousPeriod(range: DateRange): DateRange {
  const len = daysBetween(range);
  const from = parseISODay(range.from);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  return { from: isoDay(prevFrom), to: isoDay(prevTo) };
}

/** Every ISO day in `[from, to]`, inclusive. */
export function enumerateDays(range: DateRange): string[] {
  const out: string[] = [];
  let cur = parseISODay(range.from);
  const end = parseISODay(range.to);
  while (cur.getTime() <= end.getTime()) {
    out.push(isoDay(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * Zero-fill a sparse metric series so charts have a point per day. Given the days
 * of a range and the points a source returned for one metric, produce one point
 * per day (missing days → 0).
 */
export function zeroFill(
  source: string,
  metric: string,
  range: DateRange,
  points: Array<{ date: string; value: number }>,
): SeriesPoint[] {
  const byDay = new Map(points.map((p) => [p.date, p.value]));
  return enumerateDays(range).map((date) => ({
    source,
    metric,
    date,
    value: byDay.get(date) ?? 0,
  }));
}

/** Validate an arbitrary `?from&to` pair; falls back to the default preset. */
export function coerceRange(from: string | null, to: string | null, now: number = Date.now()): DateRange {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (from && to && re.test(from) && re.test(to) && from <= to) {
    return { from, to };
  }
  return resolvePreset(DEFAULT_PRESET, now);
}
