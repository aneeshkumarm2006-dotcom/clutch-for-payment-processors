import type { ConfigStore } from "../config-store";
import { KEYS, getJSON } from "../config-store";
import type { DateRange } from "../dates";
import { zeroFill } from "../dates";
import { notConnected, reconnectNeeded, sourceError, type SourceResult } from "../types";

/**
 * lib/analyticshub/sources/meta.ts — Meta (Facebook) Ads via the Graph API.
 *
 * `time_increment=1` gives daily insight rows: spend, impressions, clicks, CPC,
 * CPM, results (purchase conversions), ROAS. An expired/invalid token (Graph
 * error code 190) → reconnect_needed. Also exports the validation + ad-account
 * listing used by the Settings card (never store a token that doesn't work).
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaConfig {
  token: string;
  accountId: string; // numeric (no act_ prefix)
  accountLabel?: string;
  status?: "connected" | "reconnect_needed";
}

interface MetaError {
  error?: { message?: string; code?: number; type?: string };
}

interface ActionEntry {
  action_type?: string;
  value?: string;
}
interface InsightRow {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  actions?: ActionEntry[];
  action_values?: ActionEntry[];
  purchase_roas?: ActionEntry[];
}

const PURCHASE_TYPES = new Set([
  "purchase",
  "offsite_conversion.fct_purchase",
  "omni_purchase",
]);

function sumActions(entries: ActionEntry[] | undefined, types: Set<string>): number {
  if (!entries) return 0;
  return entries.reduce((s, a) => (a.action_type && types.has(a.action_type) ? s + parseFloat(a.value ?? "0") : s), 0);
}

function n(v: string | undefined): number {
  const x = parseFloat(v ?? "0");
  return Number.isFinite(x) ? x : 0;
}

/** Map a Graph error to reconnect (expired token) vs. plain error. */
function classifyMetaError(status: number, body: MetaError): { reconnect: boolean; message: string } {
  const code = body.error?.code;
  const reconnect = status === 401 || code === 190 || code === 102 || code === 10;
  return { reconnect, message: body.error?.message || `Meta request failed (${status}).` };
}

export async function fetchMeta(store: ConfigStore, range: DateRange): Promise<SourceResult> {
  const config = await getJSON<MetaConfig>(store, KEYS.meta);
  if (!config || !config.accountId || !config.token) return notConnected();

  const params = new URLSearchParams({
    level: "account",
    fields: "spend,impressions,clicks,cpc,cpm,actions,action_values,purchase_roas",
    time_increment: "1",
    time_range: JSON.stringify({ since: range.from, until: range.to }),
    limit: "500",
    access_token: config.token,
  });

  let rows: InsightRow[] = [];
  try {
    const res = await fetch(`${GRAPH}/act_${config.accountId}/insights?${params.toString()}`);
    const body = (await res.json()) as { data?: InsightRow[] } & MetaError;
    if (!res.ok) {
      const { reconnect, message } = classifyMetaError(res.status, body);
      return reconnect ? reconnectNeeded(message) : sourceError(message);
    }
    rows = body.data ?? [];
  } catch (err) {
    return sourceError((err as Error).message);
  }

  const spend: Array<{ date: string; value: number }> = [];
  const impressions: Array<{ date: string; value: number }> = [];
  const clicks: Array<{ date: string; value: number }> = [];
  const cpc: Array<{ date: string; value: number }> = [];
  const cpm: Array<{ date: string; value: number }> = [];
  const results: Array<{ date: string; value: number }> = [];
  const roas: Array<{ date: string; value: number }> = [];

  for (const r of rows) {
    const date = r.date_start ?? "";
    spend.push({ date, value: n(r.spend) });
    impressions.push({ date, value: n(r.impressions) });
    clicks.push({ date, value: n(r.clicks) });
    cpc.push({ date, value: n(r.cpc) });
    cpm.push({ date, value: n(r.cpm) });
    results.push({ date, value: sumActions(r.actions, PURCHASE_TYPES) });
    roas.push({ date, value: sumActions(r.purchase_roas, PURCHASE_TYPES) });
  }

  const series = [
    ...zeroFill("meta", "spend", range, spend),
    ...zeroFill("meta", "impressions", range, impressions),
    ...zeroFill("meta", "clicks", range, clicks),
    ...zeroFill("meta", "cpc", range, cpc),
    ...zeroFill("meta", "cpm", range, cpm),
    ...zeroFill("meta", "results", range, results),
    ...zeroFill("meta", "roas", range, roas),
  ];

  const totalSpend = spend.reduce((s, p) => s + p.value, 0);
  const totalImpr = impressions.reduce((s, p) => s + p.value, 0);
  const totalClicks = clicks.reduce((s, p) => s + p.value, 0);
  const totalResults = results.reduce((s, p) => s + p.value, 0);
  // Spend-weighted average ROAS across the range.
  const weightedRoas = spend.reduce((s, p, i) => s + p.value * (roas[i]?.value ?? 0), 0);

  const totals = {
    spend: totalSpend,
    impressions: totalImpr,
    clicks: totalClicks,
    cpc: totalClicks ? totalSpend / totalClicks : 0,
    cpm: totalImpr ? (totalSpend / totalImpr) * 1000 : 0,
    results: totalResults,
    roas: totalSpend ? weightedRoas / totalSpend : 0,
  };

  return { status: "ok", series, totals, meta: { currency: (config as { currency?: string }).currency ?? "USD", account: config.accountLabel } };
}

// ---------------------------------------------------------------------------
// Settings-card helpers: validate a token and list its ad accounts
// ---------------------------------------------------------------------------
export interface MetaAdAccount {
  accountId: string;
  name: string;
  currency?: string;
}

export async function listMetaAdAccounts(
  token: string,
): Promise<{ ok: true; accounts: MetaAdAccount[] } | { ok: false; error: string }> {
  try {
    const params = new URLSearchParams({ fields: "account_id,name,currency", limit: "200", access_token: token });
    const res = await fetch(`${GRAPH}/me/adaccounts?${params.toString()}`);
    const body = (await res.json()) as {
      data?: Array<{ account_id?: string; name?: string; currency?: string }>;
    } & MetaError;
    if (!res.ok) return { ok: false, error: body.error?.message || `Meta token validation failed (${res.status}).` };
    const accounts = (body.data ?? [])
      .filter((a) => a.account_id)
      .map((a) => ({ accountId: a.account_id!, name: a.name || a.account_id!, currency: a.currency }));
    return { ok: true, accounts };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
