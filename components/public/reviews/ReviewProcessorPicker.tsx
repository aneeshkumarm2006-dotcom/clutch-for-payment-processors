"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Search, SearchX } from "lucide-react";

interface PickerOption {
  name: string;
  slug: string;
  logo?: string;
}

/**
 * Client-side filterable list of processors for the no-slug `/write-review`
 * entry point. Each row links to `/write-review/[slug]`. Keeps the directory
 * out of it — this is a focused "which processor are you reviewing?" picker.
 */
export function ReviewProcessorPicker({ options }: { options: PickerOption[] }) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-card p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-subtle">
        <Search className="ml-2 size-4 shrink-0 text-ink-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a processor…"
          aria-label="Search for a processor to review"
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-lg border border-dashed py-12 text-center">
          <SearchX className="size-7 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-body text-muted-foreground">
            No processor matches “{query}”.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-ink-150 overflow-hidden rounded-lg border dark:divide-ink-800">
          {filtered.map((o) => (
            <li key={o.slug}>
              <Link
                href={`/write-review/${o.slug}`}
                className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:hover:bg-ink-900"
              >
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-ink-0">
                  {o.logo ? (
                    <Image
                      src={o.logo}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 object-contain p-1"
                      unoptimized
                    />
                  ) : (
                    <span className="text-small font-semibold text-ink-400">
                      {o.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-body font-medium text-foreground">{o.name}</span>
                <ChevronRight className="size-4 text-ink-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ReviewProcessorPicker;
