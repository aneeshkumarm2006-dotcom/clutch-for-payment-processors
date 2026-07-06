import type { ConfigStore } from "../config-store";
import type { DateRange } from "../dates";
import { notConnected, type SourceKey, type SourceResult } from "../types";
import { fetchLeads } from "./leads";
import { fetchGa4 } from "./ga4";
import { fetchGsc } from "./gsc";
import { fetchMeta } from "./meta";
import { fetchGads } from "./gads";
import { stubEnabled, stubSource } from "./stub";

/**
 * lib/analyticshub/sources/registry.ts — maps a source key to its fetcher.
 *
 * Each fetcher returns a normalized `SourceResult` and NEVER throws for a
 * provider/credential problem — it returns a `not_connected` / `reconnect_needed`
 * / `error` result instead, so one dead source can't break `/data/all`.
 */
export async function fetchSource(
  store: ConfigStore,
  source: SourceKey,
  range: DateRange,
): Promise<SourceResult> {
  if (stubEnabled()) return stubSource(source, range);
  switch (source) {
    case "leads":
      return fetchLeads(range);
    case "ga4":
      return fetchGa4(store, range);
    case "gsc":
      return fetchGsc(store, range);
    case "meta":
      return fetchMeta(store, range);
    case "gads":
      return fetchGads(store, range);
    default:
      return notConnected();
  }
}
