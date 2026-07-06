"use client";

import * as React from "react";

/**
 * A minimal, axis-less sparkline for KPI tiles. Recessive by design — one 1.5px
 * line over a faint area fill, scaled to its own range.
 */
export function Sparkline({
  values,
  color,
  height = 34,
  className,
}: {
  values: number[];
  color: string;
  height?: number;
  className?: string;
}) {
  const gid = React.useId();
  const W = 140;
  const H = 40;
  const n = values.length;
  if (n === 0) return <div style={{ height }} className={className} />;

  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4);

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height, width: "100%" }} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default Sparkline;
