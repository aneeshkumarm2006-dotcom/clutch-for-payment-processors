import connectToDatabase from "@/lib/db";
import { Lead } from "@/models/Lead";
import { Review } from "@/models/Review";
import type { DateRange } from "../dates";
import { parseISODay, zeroFill } from "../dates";
import { toLeadRow } from "../serialize";
import { sourceError, type SourceResult, type DetailTable } from "../types";

/**
 * lib/analyticshub/sources/leads.ts — the "Leads" growth source.
 *
 * This site has no end-user signups; the real inbound-growth signal is the `Lead`
 * model (quote / get-matched / contact captures). Primary series = new leads/day
 * (zero-filled); secondary = reviews/day. Totals carry the range sums plus the
 * ALL-TIME lead total. Detail = the 10 most recent leads (email stays private —
 * see serialize.ts). A DB failure returns a `sourceError` so it never touches the
 * other sources (independent failure).
 */

interface DayCount {
  _id: string;
  count: number;
}

async function dailyCounts(
  model: typeof Lead | typeof Review,
  fromDate: Date,
  toExclusive: Date,
): Promise<Map<string, number>> {
  const rows = (await model.aggregate([
    { $match: { createdAt: { $gte: fromDate, $lt: toExclusive } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
        count: { $sum: 1 },
      },
    },
  ])) as DayCount[];
  return new Map(rows.map((r) => [r._id, r.count]));
}

export async function fetchLeads(range: DateRange): Promise<SourceResult> {
  try {
    await connectToDatabase();

    const fromDate = parseISODay(range.from);
    const toExclusive = new Date(parseISODay(range.to).getTime() + 86_400_000); // end day inclusive

    const [leadDays, reviewDays, allTimeTotal, recent] = await Promise.all([
      dailyCounts(Lead, fromDate, toExclusive),
      dailyCounts(Review, fromDate, toExclusive),
      Lead.countDocuments({}),
      Lead.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const leadPoints = [...leadDays].map(([date, value]) => ({ date, value }));
    const reviewPoints = [...reviewDays].map(([date, value]) => ({ date, value }));

    const series = [
      ...zeroFill("leads", "leads", range, leadPoints),
      ...zeroFill("leads", "reviews", range, reviewPoints),
    ];

    const leadsInRange = leadPoints.reduce((s, p) => s + p.value, 0);
    const reviewsInRange = reviewPoints.reduce((s, p) => s + p.value, 0);

    const detail: DetailTable[] = [
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
        rows: recent.map((d) => {
          const r = toLeadRow(d);
          return {
            name: r.name,
            business: r.business ?? "—",
            volume: r.volume ?? "—",
            source: r.source ?? "—",
            createdAt: r.createdAt ?? "—",
          };
        }),
      },
    ];

    return {
      status: "ok",
      series,
      totals: { leads: leadsInRange, reviews: reviewsInRange, total: allTimeTotal },
      detail,
    };
  } catch (err) {
    return sourceError(
      (err as Error).message ||
        "Could not read leads from the database. Check MONGODB_URI and that the database is reachable.",
    );
  }
}
