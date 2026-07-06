/**
 * lib/analyticshub/types.ts — the ONE normalized shape every source maps into.
 *
 * A fetch returns daily `{ source, metric, date, value }` points, a `totals` map
 * (metric → summed/derived value for the range), and optional `detail` top-N
 * tables — all wrapped in a `SourceResult` whose `status` lets the UI render
 * connected / not-connected / reconnect-needed / errored uniformly. Every source
 * funnels its own failures into its own `SourceResult.error`, so one dead token
 * never touches another source (independent failure).
 */

export const SOURCE_KEYS = ["ga4", "gsc", "meta", "gads", "leads"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export type SourceStatus = "ok" | "not_connected" | "reconnect_needed" | "error";

/** A single daily datapoint in the normalized shape. */
export interface SeriesPoint {
  source: string;
  metric: string;
  /** ISO day, `YYYY-MM-DD` (UTC). */
  date: string;
  value: number;
}

/** A top-N detail table (e.g. GA4 top pages, GSC top queries). */
export interface DetailTable {
  key: string;
  title: string;
  columns: DetailColumn[];
  rows: DetailRow[];
}

export interface DetailColumn {
  key: string;
  label: string;
  /** How to render/right-align the cell. */
  type: "text" | "number" | "percent" | "duration" | "currency" | "link";
  align?: "left" | "right";
}

export type DetailRow = Record<string, string | number>;

export interface SourceResult {
  status: SourceStatus;
  series: SeriesPoint[];
  totals: Record<string, number>;
  detail?: DetailTable[];
  /** Provider error, surfaced verbatim to the operator. */
  error?: string;
  /** Extra context the UI may use — e.g. `{ currency: "USD" }`, account label. */
  meta?: Record<string, unknown>;
}

/** Convenience: an empty, not-connected result. */
export function notConnected(): SourceResult {
  return { status: "not_connected", series: [], totals: {} };
}

/** Convenience: an errored result carrying the provider message verbatim. */
export function sourceError(message: string): SourceResult {
  return { status: "error", series: [], totals: {}, error: message };
}

/** Convenience: a revoked/expired-credential result. */
export function reconnectNeeded(message?: string): SourceResult {
  return { status: "reconnect_needed", series: [], totals: {}, error: message };
}

/** The `/data/all` response: one SourceResult per source, keyed by source. */
export type AllData = Record<SourceKey, SourceResult>;
