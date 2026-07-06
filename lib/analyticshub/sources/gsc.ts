import type { ConfigStore } from "../config-store";
import type { DateRange } from "../dates";
import { zeroFill } from "../dates";
import { notConnected, reconnectNeeded, sourceError, type SourceResult, type DetailTable } from "../types";
import { getGoogleAccessToken, readGoogleConfig } from "./google-oauth";

/**
 * lib/analyticshub/sources/gsc.ts — Search Console via the Search Analytics API.
 *
 * A date-dimensioned query drives the daily series (clicks, impressions, CTR,
 * position); a second dimensionless query yields correct RANGE totals (CTR and
 * average position are ratios/weighted — not summable). A query-dimensioned call
 * supplies the top-20 queries. 401 → reconnect_needed.
 */

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}
interface GscResp {
  rows?: GscRow[];
  error?: { message?: string };
}
type QueryResult = { ok: true; rows: GscRow[] } | { ok: false; reconnect: boolean; error: string };

async function gscQuery(token: string, siteUrl: string, body: unknown): Promise<QueryResult> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await res.json()) as GscResp;
    if (!res.ok) {
      return { ok: false, reconnect: res.status === 401, error: data.error?.message || `Search Console request failed (${res.status}).` };
    }
    return { ok: true, rows: data.rows ?? [] };
  } catch (err) {
    return { ok: false, reconnect: false, error: (err as Error).message };
  }
}

export async function fetchGsc(store: ConfigStore, range: DateRange): Promise<SourceResult> {
  const config = await readGoogleConfig(store);
  if (!config || !config.siteUrl) return notConnected();

  const tok = await getGoogleAccessToken(store, config);
  if (!tok.ok) return tok.reconnect ? reconnectNeeded(tok.error) : sourceError(tok.error);
  const token = tok.token;
  const site = config.siteUrl;
  const base = { startDate: range.from, endDate: range.to };

  const daily = await gscQuery(token, site, { ...base, dimensions: ["date"], rowLimit: 1000 });
  if (!daily.ok) return daily.reconnect ? reconnectNeeded(daily.error) : sourceError(daily.error);

  const clicks: Array<{ date: string; value: number }> = [];
  const impressions: Array<{ date: string; value: number }> = [];
  const ctr: Array<{ date: string; value: number }> = [];
  const position: Array<{ date: string; value: number }> = [];
  for (const row of daily.rows) {
    const date = row.keys?.[0] ?? "";
    clicks.push({ date, value: row.clicks ?? 0 });
    impressions.push({ date, value: row.impressions ?? 0 });
    ctr.push({ date, value: (row.ctr ?? 0) * 100 }); // store as a percent 0–100
    position.push({ date, value: row.position ?? 0 });
  }

  const series = [
    ...zeroFill("gsc", "clicks", range, clicks),
    ...zeroFill("gsc", "impressions", range, impressions),
    ...zeroFill("gsc", "ctr", range, ctr),
    ...zeroFill("gsc", "position", range, position),
  ];

  // Accurate range totals (single dimensionless row).
  const totalsQ = await gscQuery(token, site, { ...base, dimensions: [], rowLimit: 1 });
  const t = totalsQ.ok ? totalsQ.rows[0] : undefined;
  const totals = {
    clicks: t?.clicks ?? clicks.reduce((s, p) => s + p.value, 0),
    impressions: t?.impressions ?? impressions.reduce((s, p) => s + p.value, 0),
    ctr: (t?.ctr ?? 0) * 100,
    position: t?.position ?? 0,
  };

  // Detail: top queries.
  const detail: DetailTable[] = [];
  const queries = await gscQuery(token, site, { ...base, dimensions: ["query"], rowLimit: 20 });
  if (queries.ok) {
    detail.push({
      key: "top-queries",
      title: "Top queries",
      columns: [
        { key: "query", label: "Query", type: "text", align: "left" },
        { key: "clicks", label: "Clicks", type: "number", align: "right" },
        { key: "impressions", label: "Impressions", type: "number", align: "right" },
        { key: "ctr", label: "CTR", type: "percent", align: "right" },
        { key: "position", label: "Position", type: "number", align: "right" },
      ],
      rows: queries.rows.map((r) => ({
        query: r.keys?.[0] ?? "—",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: (r.ctr ?? 0) * 100,
        position: Number((r.position ?? 0).toFixed(1)),
      })),
    });
  }

  return { status: "ok", series, totals, detail: detail.length ? detail : undefined };
}
