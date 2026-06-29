import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: ReactNode;
}

/**
 * Stat strip (DESIGN §6.10 / PRD §9.3 header). A row of label-over-value cells
 * separated by hairlines (achieved with a 1px gap over a border-colored bg).
 * Values use tabular figures. Caller passes "—"/"Varies" for missing data.
 */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="bg-card px-4 py-3">
          <dt className="text-label uppercase text-ink-500">{it.label}</dt>
          <dd className="mt-1 text-[0.9375rem] font-semibold tabular-nums text-foreground">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default StatStrip;
