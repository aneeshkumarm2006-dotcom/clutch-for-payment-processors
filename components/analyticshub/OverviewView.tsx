"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AllData, SourceKey, SourceResult, DetailTable as DetailTableData } from "@/lib/analyticshub/types";
import { computeDelta } from "@/lib/analyticshub/format";
import { useHub } from "./context";
import { useAllData } from "./hooks";
import { SOURCE_META, formatValue, metricDef, type MetricKind } from "./metrics";
import { KpiCard } from "./kpi/KpiCard";
import { LineChart, type ChartSeries } from "./charts/LineChart";
import { MetricPicker, type MetricRef } from "./MetricPicker";
import { seriesColor, sourceHue } from "./charts/colors";

const SEL_KEY = "analyticshub:overview-metrics";

interface KpiDef {
  source: SourceKey;
  metric: string;
  label: string;
  kind: MetricKind;
  cost?: boolean;
}
const BASE_KPIS: KpiDef[] = [
  { source: "leads", metric: "leads", label: "New leads", kind: "count" },
  { source: "ga4", metric: "sessions", label: "Sessions", kind: "count" },
  { source: "ga4", metric: "keyEvents", label: "Conversions", kind: "count" },
  { source: "gsc", metric: "clicks", label: "Search clicks", kind: "count" },
];

function seriesValues(res: SourceResult | undefined, metric: string): number[] {
  return (res?.series ?? []).filter((p) => p.metric === metric).map((p) => p.value);
}

function combinedSpend(data: AllData | null): { total: number; daily: number[] } {
  const meta = data?.meta?.status === "ok" ? data.meta : null;
  const gads = data?.gads?.status === "ok" ? data.gads : null;
  const byDay = new Map<string, number>();
  for (const p of meta?.series ?? []) if (p.metric === "spend") byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.value);
  for (const p of gads?.series ?? []) if (p.metric === "cost") byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.value);
  const dates = [...byDay.keys()].sort();
  const daily = dates.map((d) => byDay.get(d) ?? 0);
  return { total: daily.reduce((s, v) => s + v, 0), daily };
}

export function OverviewView() {
  const { isDark, status } = useHub();
  const { data, previous, loading } = useAllData(true);

  const adConnected = status.sources.meta === "connected" || status.sources.gads === "connected";
  const currency =
    (data?.meta?.meta?.currency as string) ?? (data?.gads?.meta?.currency as string) ?? "USD";

  return (
    <div className="mx-auto max-w-content space-y-6">
      <header>
        <h1 className="text-h1 tracking-tighter2 text-foreground">Overview</h1>
        <p className="mt-1 text-body text-muted-foreground">How did we do? Everything at a glance.</p>
      </header>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {loading && !data
          ? Array.from({ length: adConnected ? 5 : 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : (
            <>
              {BASE_KPIS.map((k) => {
                const res = data?.[k.source];
                const ok = res?.status === "ok";
                const value = ok ? res.totals[k.metric] : undefined;
                const prev = previous?.[k.source]?.status === "ok" ? previous[k.source].totals[k.metric] : undefined;
                return (
                  <KpiCard
                    key={`${k.source}-${k.metric}`}
                    label={k.label}
                    value={ok ? formatValue(k.kind, value, currency) : "—"}
                    delta={ok ? computeDelta(value, prev, k.cost) : undefined}
                    spark={ok ? seriesValues(res, k.metric) : undefined}
                    color={sourceHue(k.source, isDark)}
                  />
                );
              })}
              {adConnected && <AdSpendKpi data={data} previous={previous} currency={currency} isDark={isDark} />}
            </>
          )}
      </div>

      {/* Comparison chart */}
      <ComparisonChart data={data} isDark={isDark} currency={currency} loading={loading && !data} />

      {/* Top-5 strips */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TopStrip
          title="Top queries"
          detail={findDetail(data?.gsc, "top-queries")}
          labelCol="query"
          valueCol="clicks"
          valueKind="count"
          href="/analyticshub/gsc"
          hrefLabel="Search Console"
          connected={data?.gsc?.status === "ok"}
        />
        <TopStrip
          title="Top pages"
          detail={findDetail(data?.ga4, "top-pages")}
          labelCol="page"
          valueCol="views"
          valueKind="count"
          href="/analyticshub/ga4"
          hrefLabel="Analytics"
          connected={data?.ga4?.status === "ok"}
        />
        <TopStrip
          title="Recent leads"
          detail={findDetail(data?.leads, "recent-leads")}
          labelCol="name"
          valueCol="createdAt"
          valueKind="text"
          href="/analyticshub/leads"
          hrefLabel="Leads"
          connected={data?.leads?.status === "ok"}
        />
      </div>
    </div>
  );
}

function AdSpendKpi({
  data,
  previous,
  currency,
  isDark,
}: {
  data: AllData | null;
  previous: AllData | null;
  currency: string;
  isDark: boolean;
}) {
  const cur = combinedSpend(data);
  const prev = combinedSpend(previous);
  return (
    <KpiCard
      label="Ad spend"
      value={formatValue("currency", cur.total, currency)}
      delta={computeDelta(cur.total, prev.total, true)}
      spark={cur.daily.length > 1 ? cur.daily : undefined}
      color={sourceHue("gads", isDark)}
    />
  );
}

function ComparisonChart({
  data,
  isDark,
  currency,
  loading,
}: {
  data: AllData | null;
  isDark: boolean;
  currency: string;
  loading: boolean;
}) {
  const [selected, setSelected] = React.useState<MetricRef[]>([
    { source: "leads", metric: "leads" },
    { source: "ga4", metric: "sessions" },
    { source: "gsc", metric: "clicks" },
  ]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SEL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MetricRef[];
        if (Array.isArray(parsed) && parsed.length) setSelected(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = (next: MetricRef[]) => {
    setSelected(next);
    try {
      localStorage.setItem(SEL_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const series: ChartSeries[] = selected
    .filter((s) => data?.[s.source]?.status === "ok")
    .map((s) => {
      const def = metricDef(s.source, s.metric);
      return {
        key: `${s.source}:${s.metric}`,
        label: `${SOURCE_META[s.source].label} · ${def.label}`,
        kind: def.kind,
        color: seriesColor(s.source, s.metric, SOURCE_META[s.source].chartKeys, isDark),
        points: (data?.[s.source]?.series ?? []).filter((p) => p.metric === s.metric).map((p) => ({ date: p.date, value: p.value })),
      };
    });

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-h4 text-foreground">Compare metrics</h2>
        <MetricPicker data={data} selected={selected} onChange={update} />
      </div>
      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : series.length === 0 ? (
        <p className="py-16 text-center text-small text-muted-foreground">Pick 1–5 metrics to overlay, or connect a source.</p>
      ) : (
        <LineChart series={series} currency={currency} height={300} />
      )}
    </div>
  );
}

function findDetail(res: SourceResult | undefined, key: string): DetailTableData | undefined {
  return res?.detail?.find((d) => d.key === key);
}

function TopStrip({
  title,
  detail,
  labelCol,
  valueCol,
  valueKind,
  href,
  hrefLabel,
  connected,
}: {
  title: string;
  detail?: DetailTableData;
  labelCol: string;
  valueCol: string;
  valueKind: MetricKind | "text";
  href: string;
  hrefLabel: string;
  connected?: boolean;
}) {
  const rows = (detail?.rows ?? []).slice(0, 5);
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-h4 text-foreground">{title}</h3>
        <Link href={href} className="inline-flex items-center gap-1 text-small text-accent hover:underline">
          {hrefLabel} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {!connected ? (
        <p className="flex-1 py-6 text-center text-small text-muted-foreground">Not connected</p>
      ) : rows.length === 0 ? (
        <p className="flex-1 py-6 text-center text-small text-muted-foreground">No data in this range.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-small">
              <span className="min-w-0 truncate text-muted-foreground" title={String(row[labelCol] ?? "")}>
                {String(row[labelCol] ?? "—")}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground">
                {valueKind === "count"
                  ? formatValue("count", Number(row[valueCol] ?? 0))
                  : String(row[valueCol] ?? "—").slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default OverviewView;
