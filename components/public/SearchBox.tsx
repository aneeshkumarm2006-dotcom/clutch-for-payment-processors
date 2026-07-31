"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Layers, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { usePageSearchAnchor } from "@/components/public/PageSearchContext";
import type { SuggestItem, SuggestResults, SuggestType } from "@/lib/search-types";

/**
 * Search input that navigates to the cross-collection `/search` page (PRD §9.5).
 * Pass `target="/processors"` to drive the directory's `q` facet instead (used
 * where a results-only directory view is wanted).
 *
 * Typing opens a live combobox: debounced calls to `/api/search/suggest` return
 * processors, categories, and articles, and Enter (or a click) jumps straight to
 * one — the Search button is only needed for the full results page. Follows the
 * ARIA 1.2 combobox pattern: the input owns `aria-activedescendant`, the options
 * are never focused, so keyboard and pointer stay in sync. Requests are aborted
 * when the query moves on, and every resolved query is memoised for the session
 * so backspacing never re-fetches.
 *
 * Page-level boxes (the default) announce their viewport visibility through
 * `PageSearchContext`, which is what lets the navbar hide its duplicate search
 * while one is on screen. Pass `chrome` for boxes that live in the navbar/menu.
 */

const MIN_QUERY = 2;
const DEBOUNCE_MS = 140;

const GROUP_LABEL: Record<SuggestType, string> = {
  processor: "Processors",
  category: "Categories",
  blog: "Articles",
};

export function SearchBox({
  size = "md",
  placeholder = "Search payment processors…",
  defaultValue = "",
  className,
  autoFocus = false,
  target = "/search",
  chrome = false,
}: {
  size?: "md" | "lg";
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
  /** Destination page for the query. Defaults to the cross-collection `/search`. */
  target?: "/search" | "/processors";
  /**
   * Set for boxes rendered in site chrome (navbar, mobile menu). They stay out
   * of the page-search registry so they can't suppress themselves.
   */
  chrome?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);
  const [items, setItems] = React.useState<SuggestItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const cache = React.useRef(new Map<string, SuggestItem[]>());
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const reactId = React.useId();
  const listId = `${reactId}-listbox`;
  const optionId = (i: number) => `${reactId}-option-${i}`;

  const q = value.trim();
  const enoughText = q.length >= MIN_QUERY;

  // Lets the navbar drop its own search while this one is on screen.
  usePageSearchAnchor(rootRef, { id: reactId, enabled: !chrome });

  // Fetch suggestions for the current query. Debounced, cached, and aborted on
  // every keystroke so a slow response can never overwrite a newer one.
  React.useEffect(() => {
    if (!enoughText) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cached = cache.current.get(q);
    if (cached) {
      setItems(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`suggest ${res.status}`);
        const data = (await res.json()) as SuggestResults;
        const next = Array.isArray(data.items) ? data.items : [];
        cache.current.set(q, next);
        setItems(next);
        setLoading(false);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // superseded — leave state alone
        setItems([]);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, enoughText]);

  // A new result set invalidates the highlight.
  React.useEffect(() => setActive(-1), [items]);

  // Close when focus or a click lands outside the box.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /** Rows the keyboard can land on: each suggestion, then "see all results". */
  const optionCount = items.length + (enoughText ? 1 : 0);
  const seeAllIndex = enoughText ? items.length : -1;
  const showPanel = open && enoughText;

  function submitSearch(term: string) {
    const next = term.trim();
    setOpen(false);
    trackEvent("directory_search", { q: next });
    router.push(next ? `${target}?q=${encodeURIComponent(next)}` : target);
  }

  function goTo(item: SuggestItem) {
    setOpen(false);
    trackEvent("search_suggestion_select", { q, type: item.type, href: item.href });
    router.push(item.href);
  }

  function choose(index: number) {
    if (index === seeAllIndex) submitSearch(value);
    else if (items[index]) goTo(items[index]);
  }

  function move(delta: number) {
    if (!optionCount) return;
    setOpen(true);
    setActive((prev) => {
      const next = prev + delta;
      if (next < 0) return optionCount - 1;
      if (next >= optionCount) return 0;
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Enter":
        if (showPanel && active >= 0) {
          e.preventDefault();
          choose(active);
        }
        break;
      case "Escape":
        if (showPanel) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  // Keep the highlighted row inside the scroll area during keyboard nav.
  React.useEffect(() => {
    if (!showPanel || active < 0) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, showPanel]);

  const big = size === "lg";

  return (
    // `data-page-search` is what the pre-hydration CSS rule in globals.css looks
    // for; React takes over from there.
    <div
      ref={rootRef}
      data-page-search={chrome ? undefined : ""}
      className={cn("relative", className)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(value);
        }}
        role="search"
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border-strong bg-card",
          big ? "p-2 shadow-sm" : "p-1.5",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-subtle",
        )}
      >
        {loading ? (
          <Loader2
            className={cn("ml-2 shrink-0 animate-spin text-ink-400", big ? "size-5" : "size-4")}
            aria-hidden
          />
        ) : (
          <Search
            className={cn("ml-2 shrink-0 text-ink-400", big ? "size-5" : "size-4")}
            aria-hidden
          />
        )}
        <input
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search payment processors"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground",
            "[&::-webkit-search-cancel-button]:appearance-none",
            big ? "text-[0.9375rem]" : "text-[0.875rem]",
          )}
        />
        <Button type="submit" variant="primary" size={big ? "md" : "sm"}>
          Search
        </Button>
      </form>

      {showPanel && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          data-lenis-prevent
          className={cn(
            "absolute right-0 top-[calc(100%+0.375rem)] z-50 w-[max(100%,22rem)] max-w-[calc(100vw-2rem)]",
            "max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain",
            // `text-left` resets inherited centering (the home hero centers its column).
            "rounded-lg border border-border-strong bg-card py-1.5 text-left shadow-pop",
          )}
        >
          {items.length === 0 && loading && (
            <p className="px-3 py-3 text-small text-muted-foreground">Searching…</p>
          )}

          {items.length === 0 && !loading && (
            <p className="px-3 py-3 text-small text-muted-foreground">
              No quick matches for “{q}”.
            </p>
          )}

          {items.map((item, i) => (
            <React.Fragment key={item.id}>
              {items[i - 1]?.type !== item.type && (
                <p
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-label uppercase tracking-wide text-ink-500"
                >
                  {GROUP_LABEL[item.type]}
                </p>
              )}
              <div
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2",
                  active === i && "bg-ink-100 dark:bg-ink-800",
                )}
              >
                <SuggestIcon item={item} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small text-foreground">
                    <Highlight text={item.label} query={q} />
                  </span>
                  {item.sublabel && (
                    <span className="mt-0.5 block truncate text-[0.75rem] leading-snug text-muted-foreground">
                      {item.sublabel}
                    </span>
                  )}
                </span>
              </div>
            </React.Fragment>
          ))}

          <div
            id={optionId(seeAllIndex)}
            role="option"
            aria-selected={active === seeAllIndex}
            onMouseMove={() => setActive(seeAllIndex)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(seeAllIndex)}
            className={cn(
              "mt-1 flex cursor-pointer items-center justify-between gap-3 border-t border-border px-3 py-2.5",
              active === seeAllIndex && "bg-ink-100 dark:bg-ink-800",
            )}
          >
            <span className="truncate text-small font-medium text-accent">
              See all results for “{q}”
            </span>
            <CornerDownLeft className="size-3.5 shrink-0 text-ink-400" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestIcon({ item }: { item: SuggestItem }) {
  if (item.type === "processor") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-ink-0">
        {item.logo ? (
          <Image
            src={item.logo}
            alt=""
            width={32}
            height={32}
            className="size-8 object-contain p-1"
            unoptimized
          />
        ) : (
          <span className="text-small font-semibold text-ink-400">
            {item.label.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
    );
  }

  const Icon = item.type === "category" ? Layers : FileText;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded border bg-ink-0">
      <Icon className="size-4 text-ink-400" aria-hidden />
    </span>
  );
}

/** Bolds the typed substring inside a suggestion label. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-foreground">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

export default SearchBox;
