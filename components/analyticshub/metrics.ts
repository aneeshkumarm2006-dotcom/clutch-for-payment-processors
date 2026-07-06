import type { SourceKey } from "@/lib/analyticshub/types";
import { fmtNumber, fmtCompact, fmtCurrency, fmtPercent, fmtDuration, fmtPosition } from "@/lib/analyticshub/format";

/**
 * components/analyticshub/metrics.ts — the display metadata every hub view reads:
 * per-source labels, which totals become KPI tiles, which series get charted, and
 * how each metric formats. Keeps the pages declarative (a source page is just
 * `SOURCE_META[source]` + data).
 */

export type MetricKind = "count" | "currency" | "percent" | "duration" | "position" | "ratio";

export interface MetricDef {
  label: string;
  kind: MetricKind;
  /** Lower is better — inverts delta coloring and marks it a cost metric. */
  cost?: boolean;
}

export interface SourceMeta {
  label: string;
  path: string;
  blurb: string;
  metrics: Record<string, MetricDef>;
  /** Totals keys rendered as KPI tiles (in order). */
  kpiKeys: string[];
  /** Series metric keys charted by default. */
  chartKeys: string[];
  /** Totals keys that are all-time / not period-comparable (no delta). */
  allTimeKeys?: string[];
}

export const SOURCE_META: Record<SourceKey, SourceMeta> = {
  ga4: {
    label: "Analytics",
    path: "ga4",
    blurb: "Google Analytics 4 — traffic, engagement, and key events.",
    metrics: {
      sessions: { label: "Sessions", kind: "count" },
      totalUsers: { label: "Users", kind: "count" },
      newUsers: { label: "New users", kind: "count" },
      engagedSessions: { label: "Engaged sessions", kind: "count" },
      keyEvents: { label: "Key events", kind: "count" },
      avgEngagement: { label: "Avg engagement", kind: "duration" },
    },
    kpiKeys: ["sessions", "totalUsers", "newUsers", "keyEvents", "engagedSessions"],
    chartKeys: ["sessions", "totalUsers", "newUsers", "engagedSessions", "keyEvents"],
  },
  gsc: {
    label: "Search Console",
    path: "gsc",
    blurb: "Google Search Console — clicks, impressions, and ranking.",
    metrics: {
      clicks: { label: "Clicks", kind: "count" },
      impressions: { label: "Impressions", kind: "count" },
      ctr: { label: "CTR", kind: "percent" },
      position: { label: "Avg position", kind: "position", cost: true },
    },
    kpiKeys: ["clicks", "impressions", "ctr", "position"],
    chartKeys: ["clicks", "impressions", "ctr", "position"],
  },
  meta: {
    label: "Meta Ads",
    path: "meta",
    blurb: "Meta (Facebook/Instagram) Ads — spend and performance.",
    metrics: {
      spend: { label: "Spend", kind: "currency", cost: true },
      impressions: { label: "Impressions", kind: "count" },
      clicks: { label: "Clicks", kind: "count" },
      cpc: { label: "CPC", kind: "currency", cost: true },
      cpm: { label: "CPM", kind: "currency", cost: true },
      results: { label: "Results", kind: "count" },
      roas: { label: "ROAS", kind: "ratio" },
    },
    kpiKeys: ["spend", "impressions", "clicks", "results", "roas"],
    chartKeys: ["spend", "clicks", "results"],
  },
  gads: {
    label: "Google Ads",
    path: "gads",
    blurb: "Google Ads — cost, clicks, and conversions.",
    metrics: {
      cost: { label: "Cost", kind: "currency", cost: true },
      impressions: { label: "Impressions", kind: "count" },
      clicks: { label: "Clicks", kind: "count" },
      conversions: { label: "Conversions", kind: "count" },
      costPerConversion: { label: "Cost / conv.", kind: "currency", cost: true },
    },
    kpiKeys: ["cost", "clicks", "conversions", "costPerConversion"],
    chartKeys: ["cost", "clicks", "conversions"],
  },
  leads: {
    label: "Leads",
    path: "leads",
    blurb: "Inbound growth — quote & get-matched leads, plus reviews.",
    metrics: {
      leads: { label: "New leads", kind: "count" },
      reviews: { label: "Reviews", kind: "count" },
      total: { label: "Total leads", kind: "count" },
    },
    kpiKeys: ["leads", "total", "reviews"],
    chartKeys: ["leads", "reviews"],
    allTimeKeys: ["total"],
  },
};

/** Format a value for display given its metric kind. */
export function formatValue(kind: MetricKind, value: number | null | undefined, currency = "USD"): string {
  if (value == null || Number.isNaN(value)) return "—";
  switch (kind) {
    case "currency":
      return fmtCurrency(value, currency);
    case "percent":
      return fmtPercent(value, 2, true); // stored as 0–100
    case "duration":
      return fmtDuration(value);
    case "position":
      return fmtPosition(value);
    case "ratio":
      return `${value.toFixed(2)}×`;
    case "count":
    default:
      return fmtNumber(value);
  }
}

/** Compact form for chart axes / sparkline peaks. */
export function formatCompact(kind: MetricKind, value: number, currency = "USD"): string {
  if (kind === "currency") return fmtCurrency(value, currency).replace(/\.00$/, "");
  if (kind === "percent") return `${value.toFixed(1)}%`;
  if (kind === "duration") return fmtDuration(value);
  if (kind === "position") return value.toFixed(1);
  if (kind === "ratio") return `${value.toFixed(1)}×`;
  return fmtCompact(value);
}

export function metricDef(source: SourceKey, key: string): MetricDef {
  return SOURCE_META[source].metrics[key] ?? { label: key, kind: "count" };
}
