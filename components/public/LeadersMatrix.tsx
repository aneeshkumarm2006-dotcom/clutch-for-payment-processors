"use client";

import * as React from "react";
import { cn, formatRating, formatCount } from "@/lib/utils";
import {
  LEADER_AXES,
  DEFAULT_X_AXIS,
  DEFAULT_Y_AXIS,
  type LeaderAxis,
  type LeaderPoint,
} from "@/lib/leaders-shared";

/**
 * LeadersMatrix (Phase 2 / Stage 7.2 — PRD §5, §16) — accessible 2×2 quadrant
 * scatter of published processors. Pure inline SVG (no chart dependency):
 *
 *  - Two axis-toggle controls pick which metric maps to X and to Y (adoption /
 *    satisfaction / editor score); the dividing lines sit at the 50% mark so the
 *    plot always reads as four quadrants, top-right being "Leaders".
 *  - One focusable `<a>` dot per processor → its profile, colored by listing tier,
 *    with a hover/focus tooltip. Keyboard users tab dot-to-dot; a screen-reader
 *    list mirrors every point. Hover motion is dropped under `prefers-reduced-motion`.
 */

// Plot geometry (SVG user units; the SVG scales responsively to its container).
const W = 760;
const H = 580;
const PAD = { top: 44, right: 28, bottom: 60, left: 64 };
const PX0 = PAD.left;
const PX1 = W - PAD.right;
const PY0 = PAD.top;
const PY1 = H - PAD.bottom;

const axisLabel = (a: LeaderAxis) => LEADER_AXES.find((x) => x.value === a)!.label;
const axisTitle = (a: LeaderAxis) => LEADER_AXES.find((x) => x.value === a)!.axisTitle;

const TIER_DOT: Record<LeaderPoint["listingTier"], string> = {
  premier: "fill-accent",
  verified: "fill-success",
  free: "fill-ink-400",
};

const TIER_SWATCH: Record<LeaderPoint["listingTier"], string> = {
  premier: "bg-accent",
  verified: "bg-success",
  free: "bg-ink-400",
};

/** Map a 0..1 metric to its pixel coordinate (Y is inverted — up = more). */
const toX = (m: number) => PX0 + m * (PX1 - PX0);
const toY = (m: number) => PY1 - m * (PY1 - PY0);

function AxisToggle({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: LeaderAxis;
  onChange: (a: LeaderAxis) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden className="text-label uppercase tracking-wide text-ink-500">
        {legend}
      </span>
      <div className="inline-flex rounded-md border bg-card p-0.5">
        {LEADER_AXES.map((a) => {
          const active = a.value === value;
          return (
            <button
              key={a.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(a.value)}
              className={cn(
                "rounded px-2.5 py-1 text-small transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
              )}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function LeadersMatrix({ points, className }: { points: LeaderPoint[]; className?: string }) {
  const [xAxis, setXAxis] = React.useState<LeaderAxis>(DEFAULT_X_AXIS);
  const [yAxis, setYAxis] = React.useState<LeaderAxis>(DEFAULT_Y_AXIS);
  const [active, setActive] = React.useState<number | null>(null);

  // X and Y must differ (a matched pair collapses every dot onto the diagonal).
  // Selecting the other axis's metric swaps them instead of duplicating.
  const pickX = (a: LeaderAxis) => {
    if (a === yAxis) setYAxis(xAxis);
    setXAxis(a);
  };
  const pickY = (a: LeaderAxis) => {
    if (a === xAxis) setXAxis(yAxis);
    setYAxis(a);
  };

  const plotted = React.useMemo(
    () =>
      points.map((p) => {
        const mx = p.metrics[xAxis];
        const my = p.metrics[yAxis];
        return { p, mx, my, px: toX(mx), py: toY(my) };
      }),
    [points, xAxis, yAxis],
  );

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground",
          className,
        )}
      >
        No published processors to plot yet. Check back once the directory fills in.
      </div>
    );
  }

  const xTitle = axisTitle(xAxis);
  const yTitle = axisTitle(yAxis);
  const active_ = active != null ? plotted[active] : null;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <AxisToggle legend="Horizontal axis" value={xAxis} onChange={pickX} />
          <AxisToggle legend="Vertical axis" value={yAxis} onChange={pickY} />
        </div>
        {/* Tier legend */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-muted-foreground">
          {(["premier", "verified", "free"] as const).map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-full", TIER_SWATCH[t])} aria-hidden />
              <span className="capitalize">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="group"
          aria-label={`Leaders matrix: ${yTitle} (vertical) against ${xTitle} (horizontal). ${points.length} processors plotted.`}
        >
          {/* Plot frame */}
          <rect
            x={PX0}
            y={PY0}
            width={PX1 - PX0}
            height={PY1 - PY0}
            className="fill-ink-50 stroke-border dark:fill-ink-900/40"
            strokeWidth={1}
          />

          {/* Quadrant dividers at the 50% mark */}
          <line
            x1={(PX0 + PX1) / 2}
            y1={PY0}
            x2={(PX0 + PX1) / 2}
            y2={PY1}
            className="stroke-border-strong"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <line
            x1={PX0}
            y1={(PY0 + PY1) / 2}
            x2={PX1}
            y2={(PY0 + PY1) / 2}
            className="stroke-border-strong"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Quadrant labels */}
          <text x={PX1 - 10} y={PY0 + 18} textAnchor="end" className="fill-accent text-[13px] font-semibold">
            Leaders
          </text>
          <text x={PX0 + 10} y={PY0 + 18} textAnchor="start" className="fill-ink-500 text-[13px]">
            Strong {axisLabel(yAxis).toLowerCase()}
          </text>
          <text x={PX1 - 10} y={PY1 - 10} textAnchor="end" className="fill-ink-500 text-[13px]">
            Strong {axisLabel(xAxis).toLowerCase()}
          </text>
          <text x={PX0 + 10} y={PY1 - 10} textAnchor="start" className="fill-ink-400 text-[13px]">
            Emerging
          </text>

          {/* Axis titles + direction hints */}
          <text x={(PX0 + PX1) / 2} y={H - 18} textAnchor="middle" className="fill-foreground text-[13px] font-medium">
            {xTitle} →
          </text>
          <text
            x={-(PY0 + PY1) / 2}
            y={18}
            textAnchor="middle"
            transform="rotate(-90)"
            className="fill-foreground text-[13px] font-medium"
          >
            {yTitle} →
          </text>

          {/* Dots (drawn after labels so they sit on top); active dot last for z-order */}
          {plotted.map(({ p, px, py }, i) => {
            if (i === active) return null;
            return <Dot key={p.slug} p={p} px={px} py={py} onActivate={() => setActive(i)} onLeave={() => setActive(null)} />;
          })}
          {active_ && (
            <Dot
              p={active_.p}
              px={active_.px}
              py={active_.py}
              isActive
              onActivate={() => setActive(active)}
              onLeave={() => setActive(null)}
            />
          )}
        </svg>

        {/* Tooltip (HTML overlay positioned by the active dot's fractional coords) */}
        {active_ && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[15rem] -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md"
            style={{ left: `${(active_.px / W) * 100}%`, top: `calc(${(active_.py / H) * 100}% - 12px)` }}
            role="status"
          >
            <p className="text-small font-semibold text-foreground">{active_.p.name}</p>
            <dl className="mt-1 space-y-0.5 text-micro text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>Rating</dt>
                <dd className="tabular-nums text-foreground">
                  {active_.p.ratingCount > 0 ? `${formatRating(active_.p.ratingAverage)} / 5` : "No reviews"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Reviews</dt>
                <dd className="tabular-nums text-foreground">{formatCount(active_.p.ratingCount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Editor score</dt>
                <dd className="tabular-nums text-foreground">
                  {active_.p.editorScore > 0 ? `${formatRating(active_.p.editorScore)} / 5` : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Screen-reader / no-pointer fallback: every plotted point as a link */}
      <ul className="sr-only">
        {plotted.map(({ p }) => (
          <li key={p.slug}>
            <a href={`/processor/${p.slug}`}>
              {p.name}: {axisTitle(xAxis)} {p.metrics[xAxis] >= 0.5 ? "high" : "low"}, {axisTitle(yAxis)}{" "}
              {p.metrics[yAxis] >= 0.5 ? "high" : "low"}.
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single processor dot: an SVG anchor (focusable, links to the profile). */
function Dot({
  p,
  px,
  py,
  isActive,
  onActivate,
  onLeave,
}: {
  p: LeaderPoint;
  px: number;
  py: number;
  isActive?: boolean;
  onActivate: () => void;
  onLeave: () => void;
}) {
  return (
    <a
      href={`/processor/${p.slug}`}
      onMouseEnter={onActivate}
      onMouseLeave={onLeave}
      onFocus={onActivate}
      onBlur={onLeave}
      aria-label={`${p.name} — rating ${
        p.ratingCount > 0 ? `${formatRating(p.ratingAverage)} out of 5` : "no reviews"
      }, ${formatCount(p.ratingCount)} reviews. View profile.`}
      className="cursor-pointer outline-none [&:focus-visible_circle]:stroke-ring"
    >
      <circle
        cx={px}
        cy={py}
        r={isActive ? 8.5 : 6}
        className={cn(
          TIER_DOT[p.listingTier],
          "stroke-card transition-[r] duration-150 motion-reduce:transition-none",
        )}
        strokeWidth={2}
      />
    </a>
  );
}

export default LeadersMatrix;
