"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasActiveFilters } from "@/lib/processors-query";
import { FACET_GROUPS, facetOptionLabel } from "@/lib/directory-facets";
import { useFilters } from "@/components/public/directory/use-filters";

/** Removable chips for the active facets (DESIGN §6.3 — active facets). */
export function ActiveFilters({ className }: { className?: string }) {
  const { params, toggleInList, toggleBool, setParam, clearAll } = useFilters();
  if (!hasActiveFilters(params)) return null;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (params.q) {
    chips.push({ key: "q", label: `“${params.q}”`, onRemove: () => setParam("q", undefined) });
  }
  for (const group of FACET_GROUPS) {
    for (const token of params[group.key]) {
      chips.push({
        key: `${group.key}:${token}`,
        label: facetOptionLabel(group.key, token),
        onRemove: () => toggleInList(group.key, token),
      });
    }
  }
  if (params.minRating !== undefined) {
    chips.push({
      key: "minRating",
      label: `${params.minRating}★ & up`,
      onRemove: () => setParam("minRating", undefined),
    });
  }
  if (params.verifiedOnly) {
    chips.push({ key: "verifiedOnly", label: "Verified only", onRemove: () => toggleBool("verifiedOnly", false) });
  }
  if (params.highRisk) {
    chips.push({ key: "highRisk", label: "High-risk friendly", onRemove: () => toggleBool("highRisk", false) });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 py-1 pl-2.5 pr-1.5 text-small font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-accent-subtle dark:text-accent-subtle-foreground"
        >
          {chip.label}
          <X className="size-3.5" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => clearAll()}
        className="text-small font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

export default ActiveFilters;
