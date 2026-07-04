"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CalendarClock, Eye, FileEdit, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { SeoFormValues, Visibility } from "@/components/seoteam/serialize";

/**
 * Shopify-style Visibility control: Draft (hidden) · Visible (live now) ·
 * Scheduled (live at a future date). Owns the transition logic so a Scheduled
 * post always carries a future date and a Visible post never does; `publishedAt`
 * is stored as an ISO string and converted to/from the browser-local datetime
 * input here. Time-dependent rendering is deferred to after mount to avoid
 * server/client hydration mismatches.
 */
const OPTIONS: { value: Visibility; label: string; icon: LucideIcon }[] = [
  { value: "draft", label: "Draft", icon: FileEdit },
  { value: "visible", label: "Visible", icon: Eye },
  { value: "scheduled", label: "Scheduled", icon: CalendarClock },
];

function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local); // datetime-local has no tz → parsed as local time
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function inOneHourIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

export function VisibilityCard() {
  const { control, setValue } = useFormContext<SeoFormValues>();
  const visibility = (useWatch({ control, name: "visibility" }) as Visibility) ?? "draft";
  const publishedAt = (useWatch({ control, name: "publishedAt" }) as string) ?? "";

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const select = (next: Visibility) => {
    if (next === "visible") {
      // A Visible post must not carry a future date (that would be Scheduled).
      if (publishedAt && new Date(publishedAt).getTime() > Date.now()) {
        setValue("publishedAt", "", { shouldDirty: true });
      }
    } else if (next === "scheduled") {
      if (!publishedAt || new Date(publishedAt).getTime() <= Date.now()) {
        setValue("publishedAt", inOneHourIso(), { shouldDirty: true });
      }
    }
    setValue("visibility", next, { shouldDirty: true });
  };

  const scheduledDate = publishedAt ? new Date(publishedAt) : null;
  const isFuture = mounted && scheduledDate ? scheduledDate.getTime() > Date.now() : true;

  let hint = "Hidden — not shown on the blog.";
  if (visibility === "visible") hint = "Live now on the blog.";
  else if (visibility === "scheduled") {
    hint =
      mounted && scheduledDate && isFuture
        ? `Goes live ${scheduledDate.toLocaleString()}.`
        : "Pick a future date, or it publishes immediately.";
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-h4 text-foreground">Visibility</h2>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = visibility === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {o.label}
              </button>
            );
          })}
        </div>

        {visibility === "scheduled" && (
          <div className="space-y-1.5">
            <label
              htmlFor="visibility-date"
              className="text-[0.8125rem] font-medium text-ink-700 dark:text-ink-300"
            >
              Publish date &amp; time
            </label>
            <Input
              id="visibility-date"
              type="datetime-local"
              value={mounted ? isoToLocalInput(publishedAt) : ""}
              min={mounted ? isoToLocalInput(new Date().toISOString()) : undefined}
              onChange={(e) =>
                setValue("publishedAt", localInputToIso(e.target.value), { shouldDirty: true })
              }
            />
          </div>
        )}

        <p
          className={cn(
            "text-micro",
            visibility === "scheduled" && mounted && !isFuture
              ? "text-warning"
              : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      </div>
    </div>
  );
}

export default VisibilityCard;
