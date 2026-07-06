"use client";

import * as React from "react";
import { CalendarDays, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRESETS, PRESET_LABELS, type PresetKey } from "@/lib/analyticshub/dates";
import { useHub } from "./context";

/**
 * components/analyticshub/RangePicker.tsx — the shared date-range control in the
 * top bar. Presets (Today / Yesterday / Last 7·28·90) plus a custom from–to. The
 * selection lives in HubContext (persisted), so every page re-fetches on change.
 */
export function RangePicker() {
  const { preset, range, setPreset, setCustomRange } = useHub();
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(range.from);
  const [to, setTo] = React.useState(range.to);

  React.useEffect(() => {
    setFrom(range.from);
    setTo(range.to);
  }, [range.from, range.to]);

  const label = preset === "custom" ? `${range.from} → ${range.to}` : PRESET_LABELS[preset];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-small font-medium text-foreground hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="tabular-nums">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="space-y-0.5">
          {PRESETS.map((p: PresetKey) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPreset(p);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-small hover:bg-muted",
                preset === p ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {PRESET_LABELS[p]}
              {preset === p && <Check className="size-4 text-accent" />}
            </button>
          ))}
        </div>
        <div className="mt-2 border-t border-border pt-2">
          <p className="mb-1.5 px-1 text-micro uppercase tracking-widest text-muted-foreground">Custom range</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded border border-border bg-card px-2 py-1 text-small tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-border bg-card px-2 py-1 text-small tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="button"
            disabled={!from || !to || from > to}
            onClick={() => {
              setCustomRange(from, to);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-small font-medium text-primary-foreground disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default RangePicker;
