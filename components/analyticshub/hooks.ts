"use client";

import * as React from "react";
import { useHub } from "./context";
import type { AllData, SourceKey, SourceResult } from "@/lib/analyticshub/types";
import type { DateRange } from "@/lib/analyticshub/dates";

/**
 * components/analyticshub/hooks.ts — client data fetching against the hub API.
 *
 * Reads the range + refresh nonce from context. A manual Refresh (nonce bump)
 * appends `?refresh=1` to bust the 6h server cache; a range change does not.
 * Requests abort on change so a slow response can't clobber a newer one.
 */

export interface FetchState<T> {
  loading: boolean;
  data: T | null;
  previous: T | null;
  error: string | null;
  range: DateRange;
}

function useHubFetch<T>(path: string, compare: boolean): FetchState<T> {
  const { range, refreshNonce, reportUpdated } = useHub();
  const [state, setState] = React.useState<FetchState<T>>({
    loading: true,
    data: null,
    previous: null,
    error: null,
    range,
  });
  const nonceRef = React.useRef(-1);

  React.useEffect(() => {
    const shouldBust = nonceRef.current !== -1 && nonceRef.current !== refreshNonce;
    nonceRef.current = refreshNonce;

    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null, range }));

    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (compare) params.set("compare", "1");
    if (shouldBust) params.set("refresh", "1");

    fetch(`/api/analyticshub/${path}?${params.toString()}`, { signal: ctrl.signal, credentials: "same-origin" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error((json.error as string) || `Request failed (${res.status}).`);
        return json;
      })
      .then((json) => {
        setState({
          loading: false,
          data: (json.data as T) ?? null,
          previous: (json.previous as T) ?? null,
          error: null,
          range,
        });
        if (typeof json.generatedAt === "number") reportUpdated(json.generatedAt);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setState({ loading: false, data: null, previous: null, error: err.message, range });
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, range.from, range.to, refreshNonce, compare, reportUpdated]);

  return state;
}

/** One source (current + previous period for deltas). */
export function useSourceData(source: SourceKey, compare = true): FetchState<SourceResult> {
  return useHubFetch<SourceResult>(`data/${source}`, compare);
}

/** All sources at once (Overview). */
export function useAllData(compare = true): FetchState<AllData> {
  return useHubFetch<AllData>("data/all", compare);
}
