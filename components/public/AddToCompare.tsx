"use client";

import { GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompare, type CompareItem } from "@/components/public/compare/CompareContext";

/**
 * "Add to Compare" toggle for the ProcessorCard (DESIGN §6.2 / TODO §3.1). Adds
 * the processor to the shared compare store; disabled once the cap is reached
 * (unless this one is already selected).
 */
export function AddToCompare({ item, className }: { item: CompareItem; className?: string }) {
  const { has, toggle, isFull } = useCompare();
  const selected = has(item.slug);
  const disabled = isFull && !selected;
  const id = `compare-${item.slug}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 text-small",
        disabled ? "cursor-not-allowed text-ink-400" : "text-ink-600 dark:text-ink-300",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={selected}
        disabled={disabled}
        onCheckedChange={() => {
          toggle(item);
          if (!selected) trackEvent("add_to_compare", { processor: item.slug });
          else trackEvent("remove_from_compare", { processor: item.slug });
        }}
      />
      <span className="inline-flex items-center gap-1">
        <GitCompare className="size-3.5" aria-hidden />
        {selected ? "Added" : "Compare"}
      </span>
    </label>
  );
}

export default AddToCompare;
