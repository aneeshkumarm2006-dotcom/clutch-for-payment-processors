"use client";

import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/lib/labels";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Multi-select rendered as a checkbox grid (DESIGN §6.3 — violet when checked).
 * Used for the §8 enum capability groups: payment methods, integrations,
 * features, pricing models, supported regions. Controlled: `value` is the array
 * of selected tokens, `onChange` returns the next array.
 */
export function CheckboxGroup<T extends string>({
  options,
  value,
  onChange,
  getLabel = humanizeEnum,
  columns = 2,
  id,
}: {
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  getLabel?: (v: T) => string;
  columns?: 1 | 2 | 3;
  id?: string;
}) {
  const selected = new Set(value);

  const toggle = (option: T) => {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    // Preserve the canonical option order rather than click order.
    onChange(options.filter((o) => next.has(o)));
  };

  return (
    <div
      id={id}
      className={cn(
        "grid gap-x-4 gap-y-2.5",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((option) => {
        const checked = selected.has(option);
        return (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2.5 text-small text-ink-700 dark:text-ink-300"
          >
            <Checkbox checked={checked} onCheckedChange={() => toggle(option)} />
            <span className={cn(checked && "text-foreground")}>{getLabel(option)}</span>
          </label>
        );
      })}
    </div>
  );
}

export default CheckboxGroup;
