import type { ConfigStore } from "../config-store";
import { KEYS, getJSON, setJSON } from "../config-store";
import type { DateRange } from "../dates";
import { zeroFill } from "../dates";
import { notConnected, reconnectNeeded, sourceError, type SourceResult } from "../types";

/**
 * lib/analyticshub/sources/gads.ts — Google Ads via the REST `searchStream`
 * endpoint (raw fetch, no client library). The most involved connector but it
 * must never block anything else — every failure returns a normalized result.
 *
 * Credentials (all entered in Settings): developer token, its own OAuth client
 * id/secret + refresh token, customer id, and optional MCC login-customer-id. We
 * refresh the access token via that OAuth client; `invalid_grant` →
 * reconnect_needed.
 */

const API_VERSION = "v18";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GadsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string; // digits only
  loginCustomerId?: string; // MCC, digits only
  status?: "connected" | "reconnect_needed";
}

type TokenResult = { ok: true; token: string } | { ok: false; reconnect: boolean; error: string };

async function gadsAccessToken(config: GadsConfig): Promise<TokenResult> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!res.ok || !body.access_token) {
      return {
        ok: false,
        reconnect: body.error === "invalid_grant",
        error: body.error_description || body.error || `Google Ads token refresh failed (${res.status}).`,
      };
    }
    return { ok: true, token: body.access_token };
  } catch (err) {
    return { ok: false, reconnect: false, error: (err as Error).message };
  }
}

const digits = (s: string) => s.replace(/\D/g, "");

interface GadsRow {
  segments?: { date?: string };
  metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number };
}
type QueryResult = { ok: true; rows: GadsRow[] } | { ok: false; reconnect: boolean; error: string };

async function searchStream(config: GadsConfig, token: string, query: string): Promise<QueryResult> {
  try {
    const customer = digits(config.customerId);
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      "developer-token": config.developerToken,
      "content-type": "application/json",
    };
    if (config.loginCustomerId) headers["login-customer-id"] = digits(config.loginCustomerId);

    const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customer}/googleAds:searchStream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if (!res.ok) {
      let message = `Google Ads request failed (${res.status}).`;
      try {
        const parsed = JSON.parse(text) as Array<{ error?: { message?: string } }> | { error?: { message?: string } };
        const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
        if (errObj?.message) message = errObj.message;
      } catch {
        /* keep default */
      }
      return { ok: false, reconnect: res.status === 401, error: message };
    }
    const batches = JSON.parse(text) as Array<{ results?: GadsRow[] }>;
    const rows = batches.flatMap((b) => b.results ?? []);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, reconnect: false, error: (err as Error).message };
  }
}

function num(v: string | number | undefined): number {
  const x = typeof v === "number" ? v : parseFloat(v ?? "0");
  return Number.isFinite(x) ? x : 0;
}

export async function fetchGads(store: ConfigStore, range: DateRange): Promise<SourceResult> {
  const config = await getJSON<GadsConfig>(store, KEYS.gads);
  if (!config || !config.customerId || !config.refreshToken) return notConnected();

  const tok = await gadsAccessToken(config);
  if (!tok.ok) {
    if (tok.reconnect) await setJSON(store, KEYS.gads, { ...config, status: "reconnect_needed" });
    return tok.reconnect ? reconnectNeeded(tok.error) : sourceError(tok.error);
  }

  const query = `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'`;
  const q = await searchStream(config, tok.token, query);
  if (!q.ok) {
    if (q.reconnect) await setJSON(store, KEYS.gads, { ...config, status: "reconnect_needed" });
    return q.reconnect ? reconnectNeeded(q.error) : sourceError(q.error);
  }

  // Aggregate by day (searchStream returns one row per day at customer level).
  const cost: Array<{ date: string; value: number }> = [];
  const impressions: Array<{ date: string; value: number }> = [];
  const clicks: Array<{ date: string; value: number }> = [];
  const conversions: Array<{ date: string; value: number }> = [];
  const byDay = new Map<string, { cost: number; impr: number; clk: number; conv: number }>();
  for (const r of q.rows) {
    const date = r.segments?.date ?? "";
    const cur = byDay.get(date) ?? { cost: 0, impr: 0, clk: 0, conv: 0 };
    cur.cost += num(r.metrics?.costMicros) / 1_000_000;
    cur.impr += num(r.metrics?.impressions);
    cur.clk += num(r.metrics?.clicks);
    cur.conv += num(r.metrics?.conversions);
    byDay.set(date, cur);
  }
  for (const [date, v] of byDay) {
    cost.push({ date, value: v.cost });
    impressions.push({ date, value: v.impr });
    clicks.push({ date, value: v.clk });
    conversions.push({ date, value: v.conv });
  }

  const totalCost = cost.reduce((s, p) => s + p.value, 0);
  const totalConv = conversions.reduce((s, p) => s + p.value, 0);
  const costPerConversion: Array<{ date: string; value: number }> = [...byDay].map(([date, v]) => ({
    date,
    value: v.conv ? v.cost / v.conv : 0,
  }));

  const series = [
    ...zeroFill("gads", "cost", range, cost),
    ...zeroFill("gads", "impressions", range, impressions),
    ...zeroFill("gads", "clicks", range, clicks),
    ...zeroFill("gads", "conversions", range, conversions),
    ...zeroFill("gads", "costPerConversion", range, costPerConversion),
  ];

  const totals = {
    cost: totalCost,
    impressions: impressions.reduce((s, p) => s + p.value, 0),
    clicks: clicks.reduce((s, p) => s + p.value, 0),
    conversions: totalConv,
    costPerConversion: totalConv ? totalCost / totalConv : 0,
  };

  return { status: "ok", series, totals };
}

/** Settings-card validation: run a 1-row probe query. Never store creds that fail. */
export async function validateGads(
  config: GadsConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tok = await gadsAccessToken(config);
  if (!tok.ok) return { ok: false, error: tok.error };
  const q = await searchStream(config, tok.token, "SELECT customer.id FROM customer LIMIT 1");
  return q.ok ? { ok: true } : { ok: false, error: q.error };
}
