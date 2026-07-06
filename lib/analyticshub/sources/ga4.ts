import type { ConfigStore } from "../config-store";
import type { DateRange } from "../dates";
import { zeroFill } from "../dates";
import { notConnected, reconnectNeeded, sourceError, type SourceResult, type DetailTable } from "../types";
import { getGoogleAccessToken, readGoogleConfig } from "./google-oauth";

/**
 * lib/analyticshub/sources/ga4.ts — GA4 via the Data API `runReport` (raw fetch).
 *
 * One date-dimensioned report powers the daily series; `metricAggregations:
 * ["TOTAL"]` yields correct RANGE totals (GA4 dedupes users across days — a naive
 * sum of daily `totalUsers` would overcount). Two extra reports supply the top-10
 * pages and top-10 traffic sources. A 401 → reconnect_needed; other API errors
 * surface verbatim; detail failures never fail the whole source.
 */

const METRICS = [
  { key: "sessions", ga4: "sessions" },
  { key: "totalUsers", ga4: "totalUsers" },
  { key: "newUsers", ga4: "newUsers" },
  { key: "engagedSessions", ga4: "engagedSessions" },
  { key: "keyEvents", ga4: "keyEvents" },
  { key: "avgEngagement", ga4: "averageSessionDuration" },
] as const;

interface Ga4Row {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}
interface Ga4Report {
  rows?: Ga4Row[];
  totals?: Ga4Row[];
  metricHeaders?: Array<{ name?: string }>;
}

type ReportResult = { ok: true; data: Ga4Report } | { ok: false; reconnect: boolean; error: string };

async function runReport(token: string, propertyId: string, body: unknown): Promise<ReportResult> {
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Ga4Report & { error?: { message?: string; status?: string } };
    if (!res.ok) {
      return { ok: false, reconnect: res.status === 401, error: data.error?.message || `GA4 request failed (${res.status}).` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, reconnect: false, error: (err as Error).message };
  }
}

function ga4Date(v: string | undefined): string {
  // "20260706" → "2026-07-06"
  if (!v || v.length !== 8) return v ?? "";
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function num(v: string | undefined): number {
  const n = parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export async function fetchGa4(store: ConfigStore, range: DateRange): Promise<SourceResult> {
  const config = await readGoogleConfig(store);
  if (!config || !config.propertyId) return notConnected();

  const tok = await getGoogleAccessToken(store, config);
  if (!tok.ok) return tok.reconnect ? reconnectNeeded(tok.error) : sourceError(tok.error);
  const token = tok.token;
  const property = config.propertyId;

  const dateRanges = [{ startDate: range.from, endDate: range.to }];

  const main = await runReport(token, property, {
    dateRanges,
    dimensions: [{ name: "date" }],
    metrics: METRICS.map((m) => ({ name: m.ga4 })),
    metricAggregations: ["TOTAL"],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: "100000",
  });
  if (!main.ok) return main.reconnect ? reconnectNeeded(main.error) : sourceError(main.error);

  // Per-metric daily points.
  const perMetric: Record<string, Array<{ date: string; value: number }>> = {};
  for (const m of METRICS) perMetric[m.key] = [];
  for (const row of main.data.rows ?? []) {
    const date = ga4Date(row.dimensionValues?.[0]?.value);
    (row.metricValues ?? []).forEach((mv, i) => {
      const m = METRICS[i];
      if (m) perMetric[m.key]!.push({ date, value: num(mv.value) });
    });
  }
  const series = METRICS.flatMap((m) => zeroFill("ga4", m.key, range, perMetric[m.key]!));

  // Range totals (deduped by GA4).
  const totalsRow = main.data.totals?.[0]?.metricValues ?? [];
  const totals: Record<string, number> = {};
  METRICS.forEach((m, i) => {
    totals[m.key] = num(totalsRow[i]?.value);
  });

  // Detail: top pages + top sources (best-effort).
  const detail: DetailTable[] = [];
  const [pages, sources] = await Promise.all([
    runReport(token, property, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: "10",
    }),
    runReport(token, property, {
      dateRanges,
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "10",
    }),
  ]);

  if (pages.ok) {
    detail.push({
      key: "top-pages",
      title: "Top pages",
      columns: [
        { key: "page", label: "Page", type: "text", align: "left" },
        { key: "views", label: "Views", type: "number", align: "right" },
        { key: "sessions", label: "Sessions", type: "number", align: "right" },
      ],
      rows: (pages.data.rows ?? []).map((r) => ({
        page: r.dimensionValues?.[0]?.value ?? "—",
        views: num(r.metricValues?.[0]?.value),
        sessions: num(r.metricValues?.[1]?.value),
      })),
    });
  }
  if (sources.ok) {
    detail.push({
      key: "top-sources",
      title: "Top sources",
      columns: [
        { key: "source", label: "Source / medium", type: "text", align: "left" },
        { key: "sessions", label: "Sessions", type: "number", align: "right" },
        { key: "users", label: "Users", type: "number", align: "right" },
      ],
      rows: (sources.data.rows ?? []).map((r) => ({
        source: r.dimensionValues?.[0]?.value ?? "—",
        sessions: num(r.metricValues?.[0]?.value),
        users: num(r.metricValues?.[1]?.value),
      })),
    });
  }

  return { status: "ok", series, totals, detail: detail.length ? detail : undefined };
}
