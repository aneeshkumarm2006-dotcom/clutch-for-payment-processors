import type { ConfigStore } from "./config-store";
import { KEYS, getJSON, setJSON } from "./config-store";
import type { DateRange } from "./dates";
import type { SourceResult } from "./types";

/**
 * lib/analyticshub/cache.ts — 6-hour TTL cache over the config store.
 *
 * Keyed `cache:<source>:<from>:<to>`. We cache ONLY successful fetches (a
 * not-connected / errored / reconnect-needed result must never be cached, or a
 * transient failure would stick for 6h). `?refresh=1` busts on read; connecting
 * or disconnecting a source busts all of its cache keys.
 */

const TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEnvelope {
  at: number;
  data: SourceResult;
}

/** Return a fresh cached result, or null if absent/expired. */
export async function readCache(
  store: ConfigStore,
  source: string,
  range: DateRange,
  now: number = Date.now(),
): Promise<SourceResult | null> {
  const env = await getJSON<CacheEnvelope>(store, KEYS.cache(source, range.from, range.to));
  if (!env) return null;
  if (now - env.at > TTL_MS) return null;
  return env.data;
}

/** Cache a result — but only if it succeeded. No-op otherwise. */
export async function writeCache(
  store: ConfigStore,
  source: string,
  range: DateRange,
  result: SourceResult,
  now: number = Date.now(),
): Promise<void> {
  if (result.status !== "ok") return;
  await setJSON(store, KEYS.cache(source, range.from, range.to), { at: now, data: result } satisfies CacheEnvelope);
}

/** Drop every cached range for a source (on connect/disconnect). */
export async function bustSource(store: ConfigStore, source: string): Promise<number> {
  return store.deleteByPrefix(KEYS.cachePrefix(source));
}

export const CACHE_TTL_MS = TTL_MS;
