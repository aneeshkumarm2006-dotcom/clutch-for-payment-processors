"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatValue, formatCompact, type MetricKind } from "../metrics";

/**
 * components/analyticshub/charts/LineChart.tsx — a hand-rolled SVG multi-line
 * chart (no chart library). 2px lines, a recessive grid, ~6 x-labels, an
 * always-on legend, and a crosshair + tooltip showing REAL values.
 *
 * No dual y-axis, ever. When the selected series' maxima differ by >30×, it
 * switches to INDEXED mode (each line scaled to its own max, a visible "indexed"
 * badge, tooltip still showing real values). Fixed internal viewBox coordinates
 * scale responsively; the pointer is mapped via the container's client rect.
 */

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  kind: MetricKind;
  points: Array<{ date: string; value: number }>;
}

const VW = 1000;
const VH = 320;
const M = { top: 16, right: 16, bottom: 28, left: 48 };
const INDEX_THRESHOLD = 30;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function LineChart({
  series,
  currency = "USD",
  height = 320,
  className,
}: {
  series: ChartSeries[];
  currency?: string;
  height?: number;
  className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const n = dates.length;

  const { indexed, globalMax, seriesMax } = React.useMemo(() => {
    const maxes = series.map((s) => Math.max(0, ...s.points.map((p) => p.value)));
    const positive = maxes.filter((m) => m > 0);
    const hi = Math.max(1, ...maxes);
    const lo = Math.min(...(positive.length ? positive : [1]));
    return { indexed: series.length > 1 && positive.length > 1 && hi / lo > INDEX_THRESHOLD, globalMax: hi, seriesMax: maxes };
  }, [series]);

  const chartW = VW - M.left - M.right;
  const chartH = VH - M.top - M.bottom;
  const xFor = (i: number) => M.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const axisMax = niceMax(globalMax);
  const yFor = (value: number, sMax: number) => {
    const denom = indexed ? sMax || 1 : axisMax;
    const frac = Math.max(0, Math.min(1, value / denom));
    return M.top + (1 - frac) * chartH;
  };

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const xLabelIdx = React.useMemo(() => {
    if (n <= 1) return [0];
    const count = Math.min(6, n);
    return Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (n - 1)));
  }, [n]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const xInChart = frac * VW - M.left;
    const i = Math.round((xInChart / chartW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const hoverX = hover != null ? xFor(hover) : null;

  return (
    <div className={cn("relative w-full", className)}>
      {indexed && (
        <span className="absolute right-0 top-0 z-10 rounded bg-accent-subtle px-1.5 py-0.5 text-micro font-medium text-accent-subtle-foreground">
          indexed
        </span>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Line chart of ${series.map((s) => s.label).join(", ")}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* grid */}
        {gridLines.map((g) => {
          const y = M.top + g * chartH;
          return (
            <g key={g}>
              <line x1={M.left} y1={y} x2={VW - M.right} y2={y} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {!indexed && (
                <text x={M.left - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                  {formatCompact(series[0]?.kind ?? "count", axisMax * (1 - g), currency)}
                </text>
              )}
            </g>
          );
        })}

        {/* x labels */}
        {xLabelIdx.map((i) => (
          <text key={i} x={xFor(i)} y={VH - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
            {shortDate(dates[i] ?? "")}
          </text>
        ))}

        {/* series lines */}
        {series.map((s) => {
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value, seriesMax[series.indexOf(s)] ?? 1).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* crosshair + dots */}
        {hoverX != null && (
          <line x1={hoverX} y1={M.top} x2={hoverX} y2={M.top + chartH} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
        {hover != null &&
          series.map((s, si) => {
            const p = s.points[hover];
            if (!p) return null;
            return <circle key={s.key} cx={xFor(hover)} cy={yFor(p.value, seriesMax[si] ?? 1)} r={3.5} fill={s.color} stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
          })}
      </svg>

      {/* tooltip */}
      {hover != null && hoverX != null && n > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-lg border border-border bg-popover p-2.5 text-small shadow-pop"
          style={{ left: `${Math.max(12, Math.min(88, (hoverX / VW) * 100))}%` }}
        >
          <div className="mb-1.5 text-micro uppercase tracking-widest text-muted-foreground">{shortDate(dates[hover] ?? "")}</div>
          <div className="space-y-1">
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.label}</span>
                </span>
                <span className="font-medium tabular-nums text-foreground">{formatValue(s.kind, s.points[hover]?.value, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* legend (always) */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-small text-muted-foreground">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default LineChart;
