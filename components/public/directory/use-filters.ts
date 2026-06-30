"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseDirectoryParams, type DirectoryParams } from "@/lib/directory-shared";

/**
 * Client hook backing the directory filter controls (TODO §3.4 — query-param
 * hydration so URLs are shareable/indexable). Every change pushes a new URL on
 * the SAME route (so /category/[slug] keeps its category context) and the server
 * page re-renders the results. Facet changes reset pagination to page 1.
 */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params: DirectoryParams = parseDirectoryParams(new URLSearchParams(searchParams.toString()));

  const snapshot = () => new URLSearchParams(searchParams.toString());

  const commit = (next: URLSearchParams, resetPage = true) => {
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return {
    params,

    /** Set/clear a single-value param (sort, q, minRating). */
    setParam(key: string, value?: string) {
      const next = snapshot();
      if (!value) next.delete(key);
      else next.set(key, value);
      commit(next);
    },

    /** Toggle a token in a comma-separated multi-value facet. */
    toggleInList(key: string, token: string) {
      const next = snapshot();
      const set = new Set((next.get(key) ?? "").split(",").filter(Boolean));
      if (set.has(token)) set.delete(token);
      else set.add(token);
      if (set.size) next.set(key, Array.from(set).join(","));
      else next.delete(key);
      commit(next);
    },

    /** Turn a boolean toggle (verifiedOnly, highRisk) on/off. */
    toggleBool(key: string, on: boolean) {
      const next = snapshot();
      if (on) next.set(key, "true");
      else next.delete(key);
      commit(next);
    },

    /** Jump to a page without resetting other params. */
    setPage(page: number) {
      const next = snapshot();
      if (page <= 1) next.delete("page");
      else next.set("page", String(page));
      commit(next, false);
    },

    /** Clear all facets (keep sort by default). */
    clearAll(preserve: string[] = ["sort"]) {
      const next = new URLSearchParams();
      for (const k of preserve) {
        const v = searchParams.get(k);
        if (v) next.set(k, v);
      }
      commit(next);
    },
  };
}
