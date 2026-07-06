import type { DateRange } from "../dates";
import { enumerateDays } from "../dates";
import { notConnected, type SourceKey, type SourceResult, type SeriesPoint, type DetailTable } from "../types";

/**
 * lib/analyticshub/sources/stub.ts — canned data for VISUAL VERIFICATION ONLY.
 *
 * Activated by `ANALYTICSHUB_STUB=1` (never set in production). Lets us screenshot
 * every rendered state — overview-with-data, source pages, not-connected, mobile —
 * without live Google/Meta/Mongo. Deterministic (seeded by metric+date) so
 * screenshots are stable. `gads` is intentionally left not_connected to exercise
 * the empty-state page.
 */
export function stubEnabled(): boolean {
  return process.env.ANALYTICSHUB_STUB === "1";
}

export const STUB_SOURCES: Record<string, "connected" | "not_connected" | "reconnect_needed"> = {
  ga4: "connected",
  gsc: "connected",
  meta: "connected",
  gads: "not_connected",
  leads: "connected",
};

// Deterministic 0..1 hash.
function seeded(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const COUNT = new Set(["sessions", "totalUsers", "newUsers", "engagedSessions", "keyEvents", "clicks", "impressions", "results", "leads", "reviews"]);

const SPECS: Record<Exclude<SourceKey, "gads">, Record<string, number>> = {
  ga4: { sessions: 420, totalUsers: 360, newUsers: 210, engagedSessions: 270, keyEvents: 28, avgEngagement: 96 },
  gsc: { clicks: 130, impressions: 5200, ctr: 2.5, position: 11.5 },
  meta: { spend: 84, impressions: 12000, clicks: 210, cpc: 0.4, cpm: 7, results: 9, roas: 2.3 },
  leads: { leads: 6, reviews: 2 },
};

function buildSeries(source: string, metrics: Record<string, number>, range: DateRange): { series: SeriesPoint[]; totals: Record<string, number> } {
  const days = enumerateDays(range);
  const series: SeriesPoint[] = [];
  const totals: Record<string, number> = {};
  for (const [metric, base] of Object.entries(metrics)) {
    let sum = 0;
    days.forEach((date, i) => {
      const trend = 1 + (i / Math.max(1, days.length - 1)) * 0.25; // gentle upward drift
      const jitter = 0.6 + 0.8 * seeded(`${source}:${metric}:${date}`);
      const raw = base * trend * jitter;
      const value = COUNT.has(metric) ? Math.round(raw) : Number(raw.toFixed(2));
      series.push({ source, metric, date, value });
      sum += value;
    });
    totals[metric] = COUNT.has(metric) ? sum : Number((sum / days.length).toFixed(2));
  }
  return { series, totals };
}

function ga4Detail(): DetailTable[] {
  return [
    {
      key: "top-pages",
      title: "Top pages",
      columns: [
        { key: "page", label: "Page", type: "text", align: "left" },
        { key: "views", label: "Views", type: "number", align: "right" },
        { key: "sessions", label: "Sessions", type: "number", align: "right" },
      ],
      rows: [
        ["/", 3120, 2610], ["/compare", 1840, 1520], ["/processor/stripe", 1210, 990], ["/for-processors", 880, 700],
        ["/processor/paypal", 760, 610], ["/blog/how-to-choose-a-payment-processor", 540, 470], ["/glossary", 410, 360],
        ["/methodology", 300, 270], ["/contact", 240, 210], ["/write-review", 180, 160],
      ].map(([page, views, sessions]) => ({ page, views, sessions } as Record<string, string | number>)),
    },
    {
      key: "top-sources",
      title: "Top sources",
      columns: [
        { key: "source", label: "Source / medium", type: "text", align: "left" },
        { key: "sessions", label: "Sessions", type: "number", align: "right" },
        { key: "users", label: "Users", type: "number", align: "right" },
      ],
      rows: [
        ["google / organic", 3820, 3210], ["(direct) / (none)", 1640, 1490], ["bing / organic", 520, 470],
        ["reddit.com / referral", 300, 280], ["linkedin.com / referral", 210, 195],
      ].map(([source, sessions, users]) => ({ source, sessions, users } as Record<string, string | number>)),
    },
  ];
}

function gscDetail(): DetailTable[] {
  const q = [
    ["payment processor", 210, 9200, 2.28, 8.4], ["best payment gateway", 160, 7100, 2.25, 11.2],
    ["stripe vs paypal", 140, 4300, 3.26, 6.1], ["merchant account", 96, 5200, 1.85, 14.7],
    ["square fees", 84, 3100, 2.71, 9.9], ["payment gateway comparison", 61, 2600, 2.35, 12.3],
    ["low fee payment processor", 44, 1900, 2.32, 15.8], ["high risk payment processor", 39, 1500, 2.6, 10.2],
  ];
  return [
    {
      key: "top-queries",
      title: "Top queries",
      columns: [
        { key: "query", label: "Query", type: "text", align: "left" },
        { key: "clicks", label: "Clicks", type: "number", align: "right" },
        { key: "impressions", label: "Impressions", type: "number", align: "right" },
        { key: "ctr", label: "CTR", type: "percent", align: "right" },
        { key: "position", label: "Position", type: "number", align: "right" },
      ],
      rows: q.map(([query, clicks, impressions, ctr, position]) => ({ query, clicks, impressions, ctr, position } as Record<string, string | number>)),
    },
  ];
}

function leadsDetail(): DetailTable[] {
  const rows = [
    ["Jordan Miles", "Northwind Coffee", "$50k-$250k", "get-matched", "2026-07-05"],
    ["Priya Raman", "Lumen Studio", "$10k-$50k", "quote", "2026-07-05"],
    ["Diego Alvarez", "Alto Fitness", "$250k-$1M", "get-matched", "2026-07-04"],
    ["Sam Whitaker", "—", "<$10k", "contact", "2026-07-04"],
    ["Chen Wei", "Harbor Goods", "$1M+", "quote", "2026-07-03"],
  ];
  return [
    {
      key: "recent-leads",
      title: "Recent leads",
      columns: [
        { key: "name", label: "Name", type: "text", align: "left" },
        { key: "business", label: "Business", type: "text", align: "left" },
        { key: "volume", label: "Monthly volume", type: "text", align: "left" },
        { key: "source", label: "Source", type: "text", align: "left" },
        { key: "createdAt", label: "Date", type: "text", align: "right" },
      ],
      rows: rows.map(([name, business, volume, source, createdAt]) => ({ name, business, volume, source, createdAt } as Record<string, string | number>)),
    },
  ];
}

export function stubSource(source: SourceKey, range: DateRange): SourceResult {
  if (source === "gads") return notConnected();
  const spec = SPECS[source as Exclude<SourceKey, "gads">];
  const { series, totals } = buildSeries(source, spec, range);
  if (source === "leads") totals.total = 342;
  const detail = source === "ga4" ? ga4Detail() : source === "gsc" ? gscDetail() : source === "leads" ? leadsDetail() : undefined;
  return { status: "ok", series, totals, detail, meta: source === "meta" ? { currency: "USD" } : undefined };
}
