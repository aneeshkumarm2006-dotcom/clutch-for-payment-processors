"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, PlugZap, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SourceKey, SeriesPoint, SourceResult } from "@/lib/analyticshub/types";
import { computeDelta, COST_METRICS } from "@/lib/analyticshub/format";
import { useHub } from "./context";
import { useSourceData } from "./hooks";
import { SOURCE_META, formatValue, metricDef } from "./metrics";
import { KpiCard } from "./kpi/KpiCard";
import { LineChart, type ChartSeries } from "./charts/LineChart";
import { DetailTable } from "./DetailTable";
import { metricColor, sourceHue } from "./charts/colors";

/** Series points for one metric, in date order. */
function pointsFor(series: SeriesPoint[], metric: string): Array<{ date: string; value: number }> {
  return series.filter((p) => p.metric === metric).map((p) => ({ date: p.date, value: p.value }));
}

export function SourcePage({ source }: { source: SourceKey }) {
  const meta = SOURCE_META[source];
  const { isDark } = useHub();
  const { data, previous, loading, error } = useSourceData(source);
  const currency = (data?.meta?.currency as string) ?? "USD";

  return (
    <div className="mx-auto max-w-content space-y-6">
      <header>
        <h1 className="text-h1 tracking-tighter2 text-foreground">{meta.label}</h1>
        <p className="mt-1 text-body text-muted-foreground">{meta.blurb}</p>
      </header>

      {loading && !data ? (
        <LoadingState kpiCount={meta.kpiKeys.length} />
      ) : error ? (
        <FullCard tone="error" icon={AlertTriangle} title="Couldn't load this source" body={error} />
      ) : !data || data.status === "not_connected" ? (
        <ConnectCard label={meta.label} />
      ) : data.status === "reconnect_needed" ? (
        <FullCard
          tone="warning"
          icon={AlertTriangle}
          title="Reconnect needed"
          body={data.error ?? "The credential was revoked or expired."}
          action
        />
      ) : data.status === "error" ? (
        <FullCard tone="error" icon={AlertTriangle} title="This source returned an error" body={data.error ?? "Unknown error."} />
      ) : (
        <Loaded source={source} meta={meta} data={data} previous={previous} currency={currency} isDark={isDark} />
      )}
    </div>
  );
}

function Loaded({
  source,
  meta,
  data,
  previous,
  currency,
  isDark,
}: {
  source: SourceKey;
  meta: (typeof SOURCE_META)[SourceKey];
  data: SourceResult;
  previous: SourceResult | null;
  currency: string;
  isDark: boolean;
}) {
  const kpiCols = Math.min(meta.kpiKeys.length, 5);
  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        style={{ gridTemplateColumns: undefined }}
      >
        {meta.kpiKeys.map((key) => {
          const def = metricDef(source, key);
          const value = data.totals[key];
          const isAllTime = meta.allTimeKeys?.includes(key);
          const prev = previous?.totals[key];
          const isCost = def.cost || COST_METRICS.has(key);
          const delta = isAllTime ? undefined : computeDelta(value, prev, isCost);
          const spark = pointsFor(data.series, key).map((p) => p.value);
          return (
            <KpiCard
              key={key}
              label={def.label}
              value={formatValue(def.kind, value, currency)}
              delta={delta}
              spark={spark.length > 1 ? spark : undefined}
              color={sourceHue(source, isDark)}
            />
          );
        })}
      </div>

      {/* Daily chart of the source's key metrics */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-h4 text-foreground">Daily {meta.label.toLowerCase()}</h2>
        <LineChart
          currency={currency}
          series={meta.chartKeys.map((key, i): ChartSeries => {
            const def = metricDef(source, key);
            return {
              key,
              label: def.label,
              kind: def.kind,
              color: metricColor(source, i, meta.chartKeys.length, isDark),
              points: pointsFor(data.series, key),
            };
          })}
        />
      </div>

      {/* Detail tables */}
      {data.detail?.map((table) => (
        <DetailTable key={table.key} table={table} currency={currency} />
      ))}
    </div>
  );
}

function LoadingState({ kpiCount }: { kpiCount: number }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function ConnectCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-card px-6 py-16 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent-subtle text-accent-subtle-foreground">
        <PlugZap className="size-5" />
      </span>
      <h2 className="text-h3 text-foreground">{label} isn&apos;t connected</h2>
      <p className="max-w-sm text-body text-muted-foreground">Add your credentials once in Settings and this page fills with data.</p>
      <Link
        href="/analyticshub/settings"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground"
      >
        Connect in settings <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function FullCard({
  tone,
  icon: Icon,
  title,
  body,
  action,
}: {
  tone: "error" | "warning";
  icon: typeof AlertTriangle;
  title: string;
  body: string;
  action?: boolean;
}) {
  const color = tone === "error" ? "var(--destructive)" : "var(--warning)";
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <h2 className="text-h4 text-foreground">{title}</h2>
          <p className="mt-1 break-words text-small text-muted-foreground">{body}</p>
          {action && (
            <Link href="/analyticshub/settings" className="mt-3 inline-flex items-center gap-1.5 text-small font-medium text-accent hover:underline">
              Reconnect in settings <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default SourcePage;
