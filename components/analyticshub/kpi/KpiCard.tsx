"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Delta } from "@/lib/analyticshub/format";
import { Sparkline } from "../charts/Sparkline";

/**
 * components/analyticshub/kpi/KpiCard.tsx — a KPI tile: label, big tabular value,
 * a sparkline, and a period-over-period delta. The delta uses restrained
 * success/destructive tints on a small pill (NOT a color flood — the Mono Minimal
 * doc forbids red/green floods), and colors on `delta.good` so a falling cost
 * reads positive.
 */
export function KpiCard({
  label,
  value,
  delta,
  spark,
  color,
  loading,
  className,
}: {
  label: string;
  value: string;
  delta?: Delta;
  spark?: number[];
  color?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-1.5">
        <CardTitle className="text-label uppercase text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="text-h2 leading-none tabular-nums text-foreground">{value}</div>
            {delta && <DeltaPill delta={delta} />}
          </div>
        )}
        <div className="h-9">
          {loading ? (
            <Skeleton className="h-9 w-full" />
          ) : spark && spark.length > 1 ? (
            <Sparkline values={spark} color={color ?? "var(--muted-foreground)"} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaPill({ delta }: { delta: Delta }) {
  if (delta.pct == null || delta.direction === "flat") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-micro font-medium text-muted-foreground">
        <Minus className="size-3" />
        {delta.label}
      </span>
    );
  }
  const good = delta.good === true;
  const Icon = delta.direction === "up" ? ArrowUpRight : ArrowDownRight;
  // Restrained tint via color-mix (the theme's success/destructive are plain
  // var() hexes, so a Tailwind `/10` opacity modifier would render a full flood).
  const c = good ? "var(--success)" : "var(--destructive)";
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-micro font-medium tabular-nums"
      style={{ backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}
    >
      <Icon className="size-3" />
      {delta.label}
    </span>
  );
}

export default KpiCard;
