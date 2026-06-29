"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MIN_RATING_OPTIONS } from "@/lib/processors-query";
import { FACET_GROUPS, type FacetGroup } from "@/lib/directory-facets";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFilters } from "@/components/public/directory/use-filters";
import { hasActiveFilters } from "@/lib/processors-query";

/**
 * FilterRail (DESIGN §6.3 / PRD §9.2). Every facet drives a URL query param via
 * `useFilters`. Long groups collapse to 6 with a show-more toggle. Lives in the
 * left column on desktop and inside the mobile filter Sheet under `lg`.
 */
export function FilterRail({ className }: { className?: string }) {
  const { params, toggleInList, toggleBool, setParam, clearAll } = useFilters();
  const active = hasActiveFilters(params);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-h4 text-foreground">Filters</h2>
        {active && (
          <button
            type="button"
            onClick={() => clearAll()}
            className="text-small font-medium text-accent hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-3 border-b border-border pb-6">
        <ToggleRow
          id="verifiedOnly"
          label="Verified only"
          checked={params.verifiedOnly}
          onChange={(on) => toggleBool("verifiedOnly", on)}
        />
        <ToggleRow
          id="highRisk"
          label="High-risk friendly"
          checked={params.highRisk}
          onChange={(on) => toggleBool("highRisk", on)}
        />
      </div>

      {/* Minimum rating */}
      <div className="border-b border-border pb-6">
        <p className="text-label uppercase text-ink-500">Minimum rating</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MIN_RATING_OPTIONS.map((o) => {
            const selected = params.minRating === Number(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setParam("minRating", selected ? undefined : o.value)}
                className={cn(
                  "h-8 rounded border px-3 text-small transition-colors",
                  selected
                    ? "border-violet-200 bg-violet-50 font-medium text-violet-700 dark:border-violet-800 dark:bg-accent-subtle dark:text-accent-subtle-foreground"
                    : "border-border text-ink-600 hover:border-border-strong hover:text-foreground dark:text-ink-300",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checkbox facets */}
      {FACET_GROUPS.map((group) => (
        <CheckboxFacet
          key={group.key}
          group={group}
          selected={params[group.key]}
          onToggle={(token) => toggleInList(group.key, token)}
        />
      ))}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="cursor-pointer text-body text-ink-700 dark:text-ink-300">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CheckboxFacet({
  group,
  selected,
  onToggle,
}: {
  group: FacetGroup;
  selected: string[];
  onToggle: (token: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const COLLAPSED = 6;
  const canCollapse = group.options.length > COLLAPSED;
  const visible = expanded || !canCollapse ? group.options : group.options.slice(0, COLLAPSED);

  return (
    <div className="border-b border-border pb-6 last:border-0">
      <p className="text-label uppercase text-ink-500">{group.label}</p>
      <ul className="mt-3 space-y-2">
        {visible.map((opt) => {
          const id = `${group.key}-${opt.value}`;
          const checked = selected.includes(opt.value);
          return (
            <li key={opt.value} className="flex items-center gap-2.5">
              <Checkbox id={id} checked={checked} onCheckedChange={() => onToggle(opt.value)} />
              <Label
                htmlFor={id}
                className="cursor-pointer text-body font-normal text-ink-700 dark:text-ink-300"
              >
                {opt.label}
              </Label>
            </li>
          );
        })}
      </ul>
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-small font-medium text-accent hover:underline"
        >
          {expanded ? "Show less" : `Show all ${group.options.length}`}
        </button>
      )}
    </div>
  );
}

export default FilterRail;
