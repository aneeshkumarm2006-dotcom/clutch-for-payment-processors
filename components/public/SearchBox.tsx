"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

/**
 * Search input that navigates to the cross-collection `/search` page (PRD §9.5).
 * Pass `target="/processors"` to drive the directory's `q` facet instead (used
 * where a results-only directory view is wanted).
 */
export function SearchBox({
  size = "md",
  placeholder = "Search payment processors…",
  defaultValue = "",
  className,
  autoFocus = false,
  target = "/search",
}: {
  size?: "md" | "lg";
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
  /** Destination page for the query. Defaults to the cross-collection `/search`. */
  target?: "/search" | "/processors";
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    trackEvent("directory_search", { q });
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target);
  }

  const big = size === "lg";

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border-strong bg-card",
        big ? "p-2 shadow-sm" : "p-1.5",
        "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-subtle",
        className,
      )}
    >
      <Search className={cn("ml-2 shrink-0 text-ink-400", big ? "size-5" : "size-4")} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search payment processors"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground",
          big ? "text-[0.9375rem]" : "text-[0.875rem]",
        )}
      />
      <Button type="submit" variant="primary" size={big ? "md" : "sm"}>
        Search
      </Button>
    </form>
  );
}

export default SearchBox;
