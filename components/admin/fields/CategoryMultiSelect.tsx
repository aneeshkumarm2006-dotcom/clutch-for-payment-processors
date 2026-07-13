"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CategoryOption {
  id: string;
  name: string;
  /** Optional — only the ProcessorForm needs it, to preview the breadcrumb schema. */
  slug?: string;
}

/**
 * Multi-select for linking records by id (PRD §10.3 Editorial: a processor's
 * categories; PRD §10.8: a blog post's related processors). Popover checkbox
 * list + removable chips. Controlled: `value` is the selected ids.
 */
export function CategoryMultiSelect({
  options,
  value,
  onChange,
  id,
  placeholder = "Select categories…",
  emptyText = "No categories yet. Create one first.",
}: {
  options: CategoryOption[];
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value);

  const toggle = (optionId: string) => {
    const next = new Set(selected);
    if (next.has(optionId)) next.delete(optionId);
    else next.add(optionId);
    onChange(options.filter((o) => next.has(o.id)).map((o) => o.id));
  };

  const selectedOptions = options.filter((o) => selected.has(o.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            id={id}
            className="w-full justify-between font-normal"
            aria-expanded={open}
          >
            <span className={cn(selectedOptions.length === 0 && "text-muted-foreground")}>
              {selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} selected`}
            </span>
            <ChevronsUpDown className="size-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-small text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="max-h-64 overflow-auto">
              {options.map((option) => {
                const checked = selected.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(option.id)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-small hover:bg-ink-100 dark:hover:bg-ink-800"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className={cn("flex-1", checked && "text-foreground")}>{option.name}</span>
                    {checked && <Check className="size-4 text-accent" />}
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1 rounded-sm bg-accent-subtle py-0.5 pl-2 pr-1 text-small text-accent-subtle-foreground"
            >
              {option.name}
              <button
                type="button"
                onClick={() => toggle(option.id)}
                aria-label={`Remove ${option.name}`}
                className="rounded-sm p-0.5 hover:bg-violet-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-violet-900"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryMultiSelect;
