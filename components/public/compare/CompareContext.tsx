"use client";

import * as React from "react";
import { COMPARE_MAX } from "@/components/public/compare/constants";

// Re-export so existing client imports (`import { COMPARE_MAX } from ".../CompareContext"`)
// keep working. Server Components must import it from `./constants` directly — a
// re-export through this "use client" module would still cross the RSC boundary
// and become a client-reference proxy.
export { COMPARE_MAX };

/**
 * Compare selection state (PRD §9.4 / TODO §3.1 "Add to Compare").
 *
 * A localStorage-backed client store holding up to 4 processors. The full
 * Compare page + slide-in tray are built in M5 (§5.1); this is the shared
 * selection layer the ProcessorCard checkbox and the global CompareBar use.
 */

export interface CompareItem {
  slug: string;
  name: string;
  logo?: string;
}

const STORAGE_KEY = "paycompare:compare";

interface CompareContextValue {
  items: CompareItem[];
  has: (slug: string) => boolean;
  toggle: (item: CompareItem) => void;
  remove: (slug: string) => void;
  /** Replace the whole selection (used by the Compare page to mirror its `?ids=`). */
  setAll: (items: CompareItem[]) => void;
  clear: () => void;
  isFull: boolean;
  max: number;
}

const CompareContext = React.createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CompareItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Load once on mount (kept out of initial state to avoid SSR hydration drift).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CompareItem[];
        if (Array.isArray(parsed)) setItems(parsed.slice(0, COMPARE_MAX));
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration so we don't clobber stored state on mount).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [items, hydrated]);

  // Stable action identities (functional updates → no `items` dependency). Keeping
  // these referentially stable is what stops consumer effects — e.g. the Compare
  // page mirroring its `?ids=` via `setAll` — from re-firing every render and
  // spiralling into an infinite update loop (React error #185).
  const toggle = React.useCallback((item: CompareItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.slug === item.slug)) {
        return prev.filter((i) => i.slug !== item.slug);
      }
      if (prev.length >= COMPARE_MAX) return prev; // ignore over-cap adds
      return [...prev, item];
    });
  }, []);

  const remove = React.useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const setAll = React.useCallback((next: CompareItem[]) => {
    // No-op when the selection is unchanged so we never schedule a redundant
    // state update (which would churn the value and re-run consumers needlessly).
    setItems((prev) => {
      const capped = next.slice(0, COMPARE_MAX);
      const same =
        prev.length === capped.length && prev.every((p, i) => p.slug === capped[i]?.slug);
      return same ? prev : capped;
    });
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const value = React.useMemo<CompareContextValue>(
    () => ({
      items,
      has: (slug: string) => items.some((i) => i.slug === slug),
      isFull: items.length >= COMPARE_MAX,
      max: COMPARE_MAX,
      toggle,
      remove,
      setAll,
      clear,
    }),
    [items, toggle, remove, setAll, clear],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const ctx = React.useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within <CompareProvider>");
  return ctx;
}
