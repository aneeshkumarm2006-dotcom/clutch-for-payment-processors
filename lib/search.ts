import { connectToDatabase } from "@/lib/db";
import { BlogPost, Category, Processor } from "@/models";
import {
  toCategoryData,
  toProcessorCardData,
  type CategoryData,
  type ProcessorCardData,
} from "@/lib/serialize";
import type { SuggestItem, SuggestResults } from "@/lib/search-types";

/**
 * Cross-collection search (PRD §9.5 / TODO §5.2).
 *
 * Searches Processor + Category + BlogPost. Each collection carries a `$text`
 * index (PRD §1.1); we run the text search first (ranked by relevance) and, when
 * it under-fills, supplement with a `$regex` pass so short/partial queries
 * ("strip" → "Stripe") still match. Public-safe: published/approved scope only.
 * Resilient — a Mongo outage yields empty groups, never a thrown page.
 */

export interface BlogLinkData {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
}

export interface SearchResults {
  query: string;
  processors: ProcessorCardData[];
  categories: CategoryData[];
  blog: BlogLinkData[];
  total: number;
}

type Lean = Record<string, unknown>;

const PROCESSOR_FIELDS =
  "name slug logo website affiliateUrl tagline shortDescription ratingAverage ratingCount fees.onlineCardRate fees.monthlyFee payoutTime bestFor paymentMethods isVerified isSponsored listingTier";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Merge a relevance-ranked text pass with a regex top-up, de-duped by `_id` and
 * capped at `limit`. Each caller supplies its own typed query thunks; the text
 * thunk may throw if no text index exists in the env, in which case regex alone
 * carries the result.
 */
async function mergeSearch(
  runText: () => Promise<Lean[]>,
  runRegex: () => Promise<Lean[]>,
  limit: number,
): Promise<Lean[]> {
  const seen = new Set<string>();
  const out: Lean[] = [];

  try {
    for (const d of await runText()) {
      const id = String(d._id);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(d);
      }
    }
  } catch {
    /* no text index here — regex below covers it */
  }

  if (out.length < limit) {
    try {
      for (const d of await runRegex()) {
        const id = String(d._id);
        if (!seen.has(id)) {
          seen.add(id);
          out.push(d);
          if (out.length >= limit) break;
        }
      }
    } catch {
      /* ignore — return whatever the text pass found */
    }
  }

  return out.slice(0, limit);
}

export async function searchAll(rawQuery: string, limit = 12): Promise<SearchResults> {
  const query = rawQuery.trim();
  const empty: SearchResults = { query, processors: [], categories: [], blog: [], total: 0 };
  if (!query) return empty;

  const rx = { $regex: escapeRegex(query), $options: "i" };

  try {
    await connectToDatabase();

    const [processorDocs, categoryDocs, blogDocs] = await Promise.all([
      mergeSearch(
        () =>
          Processor.find({ isPublished: true, $text: { $search: query } })
            .select(PROCESSOR_FIELDS)
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .lean(),
        () =>
          Processor.find({
            isPublished: true,
            $or: [{ name: rx }, { tagline: rx }, { shortDescription: rx }, { bestFor: rx }],
          })
            .select(PROCESSOR_FIELDS)
            .limit(limit)
            .lean(),
        limit,
      ),
      mergeSearch(
        () =>
          Category.find({ isPublished: true, $text: { $search: query } })
            .select("name slug type shortDescription icon")
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .lean(),
        () =>
          Category.find({ isPublished: true, $or: [{ name: rx }, { shortDescription: rx }] })
            .select("name slug type shortDescription icon")
            .limit(limit)
            .lean(),
        limit,
      ),
      mergeSearch(
        () =>
          BlogPost.find({ status: "published", $text: { $search: query } })
            .select("title slug excerpt")
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .lean(),
        () =>
          BlogPost.find({
            status: "published",
            $or: [{ title: rx }, { excerpt: rx }, { tags: rx }],
          })
            .select("title slug excerpt")
            .limit(limit)
            .lean(),
        limit,
      ),
    ]);

    const processors = processorDocs.map(toProcessorCardData);
    const categories = categoryDocs.map(toCategoryData);
    const blog: BlogLinkData[] = blogDocs.map((d) => ({
      id: String(d._id),
      title: String(d.title ?? ""),
      slug: String(d.slug ?? ""),
      excerpt: d.excerpt ? String(d.excerpt) : undefined,
    }));

    return {
      query,
      processors,
      categories,
      blog,
      total: processors.length + categories.length + blog.length,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[search] searchAll failed:", err);
    return empty;
  }
}

/** Shortest query worth hitting the database for — one letter matches everything. */
export const SUGGEST_MIN_QUERY = 2;

/**
 * Logos are stored inline as base64 data URIs (see `scripts/add-processors.ts`),
 * which would put ~10KB on every row of a keystroke-rate response. Only hosted
 * URLs travel with a suggestion; the box falls back to a letter monogram.
 */
function remoteLogo(v: unknown): string | undefined {
  const s = String(v ?? "");
  return /^https?:\/\//i.test(s) ? s : undefined;
}

/**
 * Keep typeahead sublabels to a single line's worth of text. Placeholder copy
 * (a lone "." and friends) is dropped rather than rendered as an empty line.
 */
function clip(v: unknown, max = 90): string | undefined {
  const s = String(v ?? "").trim();
  if (s.replace(/[^\p{L}\p{N}]/gu, "").length < 3) return undefined;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Typeahead feed behind `/api/search/suggest` — the same matching rules as
 * `searchAll` (text index first, regex top-up) but with a minimal projection,
 * so a request fired on every keystroke stays a few hundred bytes instead of
 * full card payloads. Processors lead, then categories, then articles; the
 * caller renders them in that order. Fails soft to an empty list.
 */
export async function searchSuggest(rawQuery: string, limit = 5): Promise<SuggestResults> {
  const query = rawQuery.trim();
  if (query.length < SUGGEST_MIN_QUERY) return { query, items: [] };

  const rx = { $regex: escapeRegex(query), $options: "i" };
  const minor = Math.max(1, Math.min(3, limit));

  try {
    await connectToDatabase();

    const [processorDocs, categoryDocs, blogDocs] = await Promise.all([
      mergeSearch(
        () =>
          Processor.find({ isPublished: true, $text: { $search: query } })
            .select("name slug logo tagline")
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .lean(),
        () =>
          Processor.find({ isPublished: true, $or: [{ name: rx }, { tagline: rx }, { bestFor: rx }] })
            .select("name slug logo tagline")
            .limit(limit)
            .lean(),
        limit,
      ),
      mergeSearch(
        () =>
          Category.find({ isPublished: true, $text: { $search: query } })
            .select("name slug shortDescription")
            .sort({ score: { $meta: "textScore" } })
            .limit(minor)
            .lean(),
        () =>
          Category.find({ isPublished: true, $or: [{ name: rx }, { shortDescription: rx }] })
            .select("name slug shortDescription")
            .limit(minor)
            .lean(),
        minor,
      ),
      mergeSearch(
        () =>
          BlogPost.find({ status: "published", $text: { $search: query } })
            .select("title slug excerpt")
            .sort({ score: { $meta: "textScore" } })
            .limit(minor)
            .lean(),
        () =>
          BlogPost.find({ status: "published", $or: [{ title: rx }, { excerpt: rx }, { tags: rx }] })
            .select("title slug excerpt")
            .limit(minor)
            .lean(),
        minor,
      ),
    ]);

    const items: SuggestItem[] = [
      ...processorDocs.map((d) => ({
        id: String(d._id),
        type: "processor" as const,
        label: String(d.name ?? ""),
        sublabel: clip(d.tagline),
        href: `/processor/${String(d.slug ?? "")}`,
        logo: remoteLogo(d.logo),
      })),
      ...categoryDocs.map((d) => ({
        id: String(d._id),
        type: "category" as const,
        label: String(d.name ?? ""),
        sublabel: clip(d.shortDescription),
        href: `/category/${String(d.slug ?? "")}`,
      })),
      ...blogDocs.map((d) => ({
        id: String(d._id),
        type: "blog" as const,
        label: String(d.title ?? ""),
        sublabel: clip(d.excerpt),
        href: `/blog/${String(d.slug ?? "")}`,
      })),
    ];

    return { query, items };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[search] searchSuggest failed:", err);
    return { query, items: [] };
  }
}
