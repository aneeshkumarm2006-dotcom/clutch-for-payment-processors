import type { SourceKey } from "@/lib/analyticshub/types";

/**
 * components/analyticshub/charts/colors.ts — the chart palette.
 *
 * Mono Minimal is monochrome + one violet accent, but a multi-source overlay
 * needs distinguishable series, so charts are the one place color is EARNED by
 * function. Five distinct hue families (violet, blue, green, vermillion, amber),
 * theme-aware so each clears WCAG 3:1 against its card surface: a DARK-on-white
 * set and a BRIGHT-on-dark set. Both were validated — not eyeballed — for
 * pairwise separation under deuteranopia / protanopia / tritanopia
 * (scripts: scratchpad validators; light min ΔE ≈ 20, dark ≈ 20; all ≥ 3:1).
 * GA4 stays anchored on the brand violet. Within one source, metrics are
 * lightness steps of the source hue, disambiguated by the always-on legend.
 */

export const SOURCE_HUE_LIGHT: Record<SourceKey, string> = {
  ga4: "#6D28D9",
  gsc: "#075985",
  meta: "#009E73",
  gads: "#D55E00",
  leads: "#92400E",
};

export const SOURCE_HUE_DARK: Record<SourceKey, string> = {
  ga4: "#A855F7",
  gsc: "#0EA5E9",
  meta: "#4ADE80",
  gads: "#FB923C",
  leads: "#FACC15",
};

export function sourceHue(source: SourceKey, isDark: boolean): string {
  return (isDark ? SOURCE_HUE_DARK : SOURCE_HUE_LIGHT)[source];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hex: string, target: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(target);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Lighten (t>0 toward white) or darken (t<0 toward black) a hex color. */
export function shade(hex: string, t: number): string {
  return t >= 0 ? mix(hex, "#ffffff", t) : mix(hex, "#000000", -t);
}

/**
 * Color for metric `index` of `count` within one source: a lightness ramp of the
 * source hue. On dark surfaces we ramp toward black (keep it readable), on light
 * toward white — always keeping the base hue as one of the steps.
 */
export function metricColor(source: SourceKey, index: number, count: number, isDark: boolean): string {
  const base = sourceHue(source, isDark);
  if (count <= 1 || index <= 0) return base;
  const frac = index / (count - 1);
  // Light theme: base → lighter. Dark theme: base → slightly darker/desaturated.
  const t = isDark ? -(frac * 0.5) : -0.1 + frac * 0.55;
  return shade(base, t);
}

/** Stable color for a (source, metric) pair used in the Overview overlay. */
export function seriesColor(
  source: SourceKey,
  metricKey: string,
  sourceMetricKeys: string[],
  isDark: boolean,
): string {
  const idx = sourceMetricKeys.indexOf(metricKey);
  return metricColor(source, idx < 0 ? 0 : idx, Math.max(1, sourceMetricKeys.length), isDark);
}
