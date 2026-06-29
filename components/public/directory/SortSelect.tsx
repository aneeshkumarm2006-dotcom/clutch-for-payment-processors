"use client";

import { SORT_OPTIONS } from "@/lib/processors-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilters } from "@/components/public/directory/use-filters";

/** Directory sort control (DESIGN §6.3 / PRD §9.2). Drives the `sort` param. */
export function SortSelect() {
  const { params, setParam } = useFilters();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-small text-muted-foreground sm:inline">Sort</span>
      <Select value={params.sort} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger className="h-9 w-[11rem]" aria-label="Sort processors">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default SortSelect;
