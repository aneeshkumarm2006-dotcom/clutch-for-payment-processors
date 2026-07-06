"use client";

import * as React from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SourceKey, AllData } from "@/lib/analyticshub/types";
import { SOURCE_META } from "./metrics";

export interface MetricRef {
  source: SourceKey;
  metric: string;
}

const MAX = 5;
const keyOf = (m: MetricRef) => `${m.source}:${m.metric}`;

/**
 * Multi-select for the Overview comparison chart: metrics grouped by source,
 * 1–5 overlaid. Only offers metrics from sources that returned data.
 */
export function MetricPicker({
  data,
  selected,
  onChange,
}: {
  data: AllData | null;
  selected: MetricRef[];
  onChange: (next: MetricRef[]) => void;
}) {
  const available = React.useMemo(() => {
    const groups: Array<{ source: SourceKey; label: string; metrics: Array<{ key: string; label: string }> }> = [];
    (Object.keys(SOURCE_META) as SourceKey[]).forEach((source) => {
      if (data?.[source]?.status !== "ok") return;
      const meta = SOURCE_META[source];
      groups.push({
        source,
        label: meta.label,
        metrics: meta.chartKeys.map((k) => ({ key: k, label: meta.metrics[k]?.label ?? k })),
      });
    });
    return groups;
  }, [data]);

  const isSel = (m: MetricRef) => selected.some((s) => keyOf(s) === keyOf(m));

  function toggle(m: MetricRef) {
    if (isSel(m)) {
      onChange(selected.filter((s) => keyOf(s) !== keyOf(m)));
    } else if (selected.length < MAX) {
      onChange([...selected, m]);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-small font-medium text-foreground hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          Metrics ({selected.length})
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-96 w-64 overflow-auto p-2">
        {available.length === 0 ? (
          <p className="px-2 py-3 text-small text-muted-foreground">Connect a source to compare metrics.</p>
        ) : (
          available.map((g) => (
            <div key={g.source} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-micro uppercase tracking-widest text-muted-foreground">{g.label}</p>
              {g.metrics.map((m) => {
                const ref = { source: g.source, metric: m.key };
                const on = isSel(ref);
                const disabled = !on && selected.length >= MAX;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(ref)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-small hover:bg-muted disabled:opacity-40",
                      on ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m.label}
                    {on && <Check className="size-4 text-accent" />}
                  </button>
                );
              })}
            </div>
          ))
        )}
        <p className="px-2 pt-1 text-micro text-muted-foreground">Up to {MAX} metrics.</p>
      </PopoverContent>
    </Popover>
  );
}

export default MetricPicker;
