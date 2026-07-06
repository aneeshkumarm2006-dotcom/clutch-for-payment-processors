import type { Ctx } from "./context";
import { jsonResponse } from "./http";
import { coerceRange, previousPeriod, type DateRange } from "../dates";
import { readCache, writeCache } from "../cache";
import { fetchSource } from "../sources/registry";
import { SOURCE_KEYS, sourceError, type AllData, type SourceKey, type SourceResult } from "../types";

/**
 * lib/analyticshub/handlers/data.ts — the read side.
 *
 * `GET data/<source>` and `GET data/all` resolve the range from `?from&to`
 * (default = last 7 days), serve a 6-hour cache unless `?refresh=1`, and wrap
 * every source fetch so one failure yields that source's own errored result —
 * never a 500 that takes down the others. `?compare=1` also returns the previous
 * equivalent period (used by KPI deltas).
 */

async function getSource(
  ctx: Ctx,
  source: SourceKey,
  range: DateRange,
  refresh: boolean,
): Promise<SourceResult> {
  if (!refresh) {
    const cached = await readCache(ctx.store, source, range);
    if (cached) return cached;
  }
  let result: SourceResult;
  try {
    result = await fetchSource(ctx.store, source, range);
  } catch (err) {
    result = sourceError((err as Error).message || "Unexpected error fetching this source.");
  }
  await writeCache(ctx.store, source, range, result);
  return result;
}

async function allSources(ctx: Ctx, range: DateRange, refresh: boolean): Promise<AllData> {
  const entries = await Promise.all(
    SOURCE_KEYS.map(async (s) => [s, await getSource(ctx, s, range, refresh)] as const),
  );
  return Object.fromEntries(entries) as AllData;
}

export async function dataHandler(ctx: Ctx, source: SourceKey | "all"): Promise<Response> {
  const range = coerceRange(ctx.url.searchParams.get("from"), ctx.url.searchParams.get("to"));
  const refresh = ctx.url.searchParams.get("refresh") === "1";
  const compare = ctx.url.searchParams.get("compare") === "1";
  const prev = compare ? previousPeriod(range) : null;

  if (source === "all") {
    const data = await allSources(ctx, range, refresh);
    const previous = prev ? await allSources(ctx, prev, refresh) : undefined;
    return jsonResponse({ range, previousRange: prev ?? undefined, data, previous, generatedAt: Date.now() });
  }

  const data = await getSource(ctx, source, range, refresh);
  const previous = prev ? await getSource(ctx, source, prev, refresh) : undefined;
  return jsonResponse({ range, previousRange: prev ?? undefined, source, data, previous, generatedAt: Date.now() });
}
