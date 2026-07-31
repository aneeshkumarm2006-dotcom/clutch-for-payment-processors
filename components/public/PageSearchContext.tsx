"use client";

import * as React from "react";

/**
 * Tracks whether an in-page search box is currently on screen, so the navbar
 * can drop its own duplicate search while one is visible (home hero, `/search`)
 * and bring it back once you scroll past it.
 *
 * Route-agnostic on purpose: any page that renders a `<SearchBox>` in `main`
 * suppresses the navbar copy automatically, with no per-route allowlist to keep
 * in sync. Page boxes register by id, so several on one page (or a route change
 * mid-scroll) can't leave the count stuck.
 */

interface PageSearchContextValue {
  /** True while at least one in-page search box intersects the viewport. */
  visible: boolean;
  /** Called by page-level search boxes as their visibility changes. */
  report: (id: string, visible: boolean) => void;
}

const PageSearchContext = React.createContext<PageSearchContextValue | null>(null);

/** Navbar height — a box scrolled under the sticky header counts as hidden. */
const NAV_OFFSET = 64;

// Layout effects run before the browser paints, so the first measurement lands
// in the same frame as hydration and nothing flickers. Falls back on the server,
// where React warns about `useLayoutEffect` and there is nothing to measure.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function PageSearchProvider({ children }: { children: React.ReactNode }) {
  const [visibleIds, setVisibleIds] = React.useState<string[]>([]);

  // Hands the swap over to React (see the `page-search-live` rule in globals.css).
  // Parent layout effects run after their children's, so by the time this fires
  // every page box has already reported and the CSS fallback can safely go.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("page-search-live");
    return () => root.classList.remove("page-search-live");
  }, []);

  // Stable identity (functional update, no state dependency) — consumers keep it
  // in an effect dependency array, so a churning callback would re-run their
  // IntersectionObservers on every render.
  const report = React.useCallback((id: string, visible: boolean) => {
    setVisibleIds((prev) => {
      const has = prev.includes(id);
      if (has === visible) return prev; // no-op → no re-render
      return visible ? [...prev, id] : prev.filter((x) => x !== id);
    });
  }, []);

  const value = React.useMemo<PageSearchContextValue>(
    () => ({ visible: visibleIds.length > 0, report }),
    [visibleIds, report],
  );

  return <PageSearchContext.Provider value={value}>{children}</PageSearchContext.Provider>;
}

/** True when a page-level search box is on screen. Safe outside the provider. */
export function usePageSearchVisible(): boolean {
  return React.useContext(PageSearchContext)?.visible ?? false;
}

/**
 * Reports an element's viewport visibility to the provider for as long as it is
 * mounted. `enabled` is false for the navbar's own boxes — they must not count
 * as page search. No provider (or no IntersectionObserver) is a silent no-op.
 */
export function usePageSearchAnchor(
  ref: React.RefObject<HTMLElement>,
  { id, enabled }: { id: string; enabled: boolean },
) {
  const report = React.useContext(PageSearchContext)?.report;

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !report || !el) return;

    // Measure once up front: the observer's first callback is async, so without
    // this the navbar would paint its search for a frame on the way in.
    const rect = el.getBoundingClientRect();
    report(id, rect.bottom > NAV_OFFSET && rect.top < window.innerHeight);

    // Shrink the top of the root by the navbar's height for the same reason —
    // a box sliding *under* the sticky header is already hidden, so the swap
    // belongs there rather than when its last pixel clears the viewport.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => report(id, entry?.isIntersecting ?? false), {
            rootMargin: `-${NAV_OFFSET}px 0px 0px 0px`,
          });
    observer?.observe(el);

    return () => {
      observer?.disconnect();
      report(id, false); // unmount (route change) must not leave the nav search hidden
    };
  }, [ref, id, enabled, report]);
}
