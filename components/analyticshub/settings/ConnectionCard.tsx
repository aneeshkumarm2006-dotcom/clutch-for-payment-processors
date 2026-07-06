"use client";

import * as React from "react";
import { CheckCircle2, Circle, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnState } from "../context";

/**
 * Shared chrome for a Settings connection card: title, live status badge, body,
 * and an optional collapsible "how-to". Matches the repo's `rounded-lg border
 * bg-card p-5` section pattern.
 */
export function StatusBadge({ state }: { state: ConnState }) {
  const map = {
    connected: { icon: CheckCircle2, label: "Connected", cls: "text-success", tint: "var(--success)" },
    reconnect_needed: { icon: AlertTriangle, label: "Reconnect needed", cls: "text-warning", tint: "var(--warning)" },
    not_connected: { icon: Circle, label: "Not connected", cls: "text-muted-foreground", tint: "var(--muted-foreground)" },
  }[state];
  const Icon = map.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-micro font-medium", map.cls)}
      style={{ backgroundColor: `color-mix(in srgb, ${map.tint} 12%, transparent)` }}
    >
      <Icon className="size-3.5" />
      {map.label}
    </span>
  );
}

export function ConnectionCard({
  title,
  description,
  state,
  children,
}: {
  title: string;
  description?: string;
  state?: ConnState;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h4 text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-small text-muted-foreground">{description}</p>}
        </div>
        {state && <StatusBadge state={state} />}
      </div>
      {children}
    </section>
  );
}

/** A collapsible "How to get this" helper. */
export function HowTo({ label = "How to get these", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border border-border bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-small font-medium text-foreground"
      >
        {label}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-1.5 border-t border-border px-3 py-2.5 text-small text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Inline error/success line. */
export function FormMessage({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-small text-destructive">
      {error}
    </p>
  );
}
