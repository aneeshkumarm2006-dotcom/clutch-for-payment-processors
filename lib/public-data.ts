import type { SortOrder } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BlogPost, Category, Processor, Review, type ISiteSettings } from "@/models";
import { POPULAR_COMPARE_PAIRS, comparePairToParam } from "@/lib/compare-pairs";
import { buildMentionFilter } from "@/lib/top-mentions";
import {
  toBlogCardData,
  toBlogPostData,
  toCategoryData,
  toProcessorCardData,
  toProcessorDetailData,
  toReviewCardData,
  type BlogCardData,
  type BlogPostData,
  type CategoryData,
  type ProcessorCardData,
  type ProcessorDetailData,
  type ReviewCardData,
} from "@/lib/serialize";

/**
 * Resilient public read helpers (Stage 3 / M3). Every function catches a Mongo
 * outage and returns a safe default so SSG/ISR pages render an empty state (and
 * `next build` doesn't fail) when the DB is unreachable.
 */

/** Card-facing projection — keep payloads small. */
const CARD_FIELDS =
  "name slug logo website affiliateUrl tagline shortDescription ratingAverage ratingCount fees.onlineCardRate fees.monthlyFee payoutTime bestFor paymentMethods isVerified isSponsored listingTier";

export async function getPublishedCategories(): Promise<CategoryData[]> {
  try {
    await connectToDatabase();
    const cats = await Category.find({ isPublished: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();
    return cats.map(toCategoryData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getPublishedCategories failed:", err);
    return [];
  }
}

export async function getCategoryBySlug(slug: string) {
  try {
    await connectToDatabase();
    return await Category.findOne({ slug, isPublished: true }).lean();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getCategoryBySlug failed:", err);
    return null;
  }
}

/**
 * Featured processors for the homepage (PRD §9.1): `isFeatured` first, then top
 * rated to fill the row when there aren't enough featured ones.
 */
export async function getFeaturedProcessors(limit = 6): Promise<ProcessorCardData[]> {
  try {
    await connectToDatabase();
    const featured = await Processor.find({ isPublished: true, isFeatured: true })
      .sort({ ratingAverage: -1, ratingCount: -1 })
      .limit(limit)
      .select(CARD_FIELDS)
      .lean();

    if (featured.length >= limit) return featured.map(toProcessorCardData);

    const fillIds = featured.map((p) => p._id);
    const fill = await Processor.find({ isPublished: true, _id: { $nin: fillIds } })
      .sort({ ratingAverage: -1, ratingCount: -1 })
      .limit(limit - featured.length)
      .select(CARD_FIELDS)
      .lean();

    return [...featured, ...fill].map(toProcessorCardData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getFeaturedProcessors failed:", err);
    return [];
  }
}

export async function getTopRatedProcessors(limit = 3): Promise<ProcessorCardData[]> {
  try {
    await connectToDatabase();
    const items = await Processor.find({ isPublished: true })
      .sort({ ratingAverage: -1, ratingCount: -1 })
      .limit(limit)
      .select(CARD_FIELDS)
      .lean();
    return items.map(toProcessorCardData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getTopRatedProcessors failed:", err);
    return [];
  }
}

/** Full processor for the profile page (published only; categories populated). */
export async function getProcessorBySlug(slug: string): Promise<ProcessorDetailData | null> {
  try {
    await connectToDatabase();
    const doc = await Processor.findOne({ slug, isPublished: true })
      .populate("categories", "name slug")
      .lean();
    if (!doc) return null;
    return toProcessorDetailData(doc);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getProcessorBySlug failed:", err);
    return null;
  }
}

/**
 * Alternatives for a profile (PRD §9.3): other published processors sharing the
 * primary (first) category, excluding self; falls back to top-rated.
 */
export async function getAlternatives(
  processor: Pick<ProcessorDetailData, "id" | "categories">,
  limit = 4,
): Promise<ProcessorCardData[]> {
  try {
    await connectToDatabase();
    const primaryCategoryId = processor.categories[0]?.id;

    const base = { isPublished: true, _id: { $ne: processor.id } };
    let items = primaryCategoryId
      ? await Processor.find({ ...base, categories: primaryCategoryId })
          .sort({ ratingAverage: -1, ratingCount: -1 })
          .limit(limit)
          .select(CARD_FIELDS)
          .lean()
      : [];

    if (items.length < limit) {
      const have = new Set(items.map((p) => String(p._id)));
      have.add(processor.id);
      const fill = await Processor.find({ isPublished: true, _id: { $nin: Array.from(have) } })
        .sort({ ratingAverage: -1, ratingCount: -1 })
        .limit(limit - items.length)
        .select(CARD_FIELDS)
        .lean();
      items = [...items, ...fill];
    }

    return items.map(toProcessorCardData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getAlternatives failed:", err);
    return [];
  }
}

/**
 * Full detail for a set of processor slugs, for the Compare matrix (PRD §9.4).
 * Published only; returned in the SAME order as the requested slugs (so the
 * column order matches the `?ids=` query). Unknown/unpublished slugs drop out.
 */
export async function getProcessorsBySlugs(slugs: string[]): Promise<ProcessorDetailData[]> {
  if (slugs.length === 0) return [];
  try {
    await connectToDatabase();
    const docs = await Processor.find({ slug: { $in: slugs }, isPublished: true })
      .populate("categories", "name slug")
      .lean();

    const bySlug = new Map(docs.map((d) => [String(d.slug), d]));
    return slugs
      .map((s) => bySlug.get(s))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map(toProcessorDetailData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getProcessorsBySlugs failed:", err);
    return [];
  }
}

/** Slugs of all published processors for `generateStaticParams` (resilient → []). */
export async function getAllPublishedProcessorSlugs(): Promise<string[]> {
  try {
    await connectToDatabase();
    const docs = await Processor.find({ isPublished: true }).select("slug").lean();
    return docs.map((d) => String(d.slug));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getAllPublishedProcessorSlugs failed:", err);
    return [];
  }
}

/** Minimal {name, slug, logo} of every published processor — for the review/compare pickers. */
export async function getPublishedProcessorOptions(): Promise<
  { name: string; slug: string; logo?: string }[]
> {
  try {
    await connectToDatabase();
    const docs = await Processor.find({ isPublished: true })
      .select("name slug logo")
      .sort({ name: 1 })
      .lean();
    return docs.map((d) => ({
      name: String(d.name),
      slug: String(d.slug),
      logo: d.logo ? String(d.logo) : undefined,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getPublishedProcessorOptions failed:", err);
    return [];
  }
}

export async function getAllPublishedCategorySlugs(): Promise<string[]> {
  try {
    await connectToDatabase();
    const docs = await Category.find({ isPublished: true }).select("slug").lean();
    return docs.map((d) => String(d.slug));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getAllPublishedCategorySlugs failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Reviews (PRD §9.3 #reviews) — only ever the APPROVED set is public.
// Shared by the profile page (initial SSR list) and GET /api/reviews (the
// client-side filter/sort/paginate calls). One query builder → they agree.
// ---------------------------------------------------------------------------

export const REVIEWS_PAGE_SIZE = 5;

export type ReviewSort = "newest" | "highest" | "most-helpful";

export interface ApprovedReviewsParams {
  processorId: string;
  sort?: ReviewSort;
  page?: number;
  limit?: number;
  industry?: string;
  verifiedOnly?: boolean;
  minRating?: number;
  /** A "Top mentions" chip label — narrows to reviews mentioning that topic. */
  mention?: string;
}

export interface ReviewsResult {
  items: ReviewCardData[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

const REVIEW_SORTS: Record<ReviewSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  highest: { overallRating: -1, createdAt: -1 },
  "most-helpful": { helpfulCount: -1, createdAt: -1 },
};

/** Approved reviews for a processor, filtered + sorted + paginated. */
export async function getApprovedReviews(params: ApprovedReviewsParams): Promise<ReviewsResult> {
  const pageSize = params.limit ?? REVIEWS_PAGE_SIZE;
  const page = Math.max(1, params.page ?? 1);
  try {
    await connectToDatabase();

    const filter: Record<string, unknown> = {
      processor: params.processorId,
      status: "approved",
    };
    if (params.industry) filter.industry = params.industry;
    if (params.verifiedOnly) filter.isVerified = true;
    if (params.minRating && params.minRating > 0) {
      filter.overallRating = { $gte: params.minRating };
    }
    // "Top mentions" chip → text filter over title/body/pros/cons (same curated
    // dictionary as extraction). Unknown labels are ignored (returns null).
    if (params.mention) {
      const mentionFilter = buildMentionFilter(params.mention);
      if (mentionFilter) Object.assign(filter, mentionFilter);
    }

    const sort = REVIEW_SORTS[params.sort ?? "newest"];

    const [docs, total] = await Promise.all([
      Review.find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Review.countDocuments(filter),
    ]);

    return {
      items: docs.map(toReviewCardData),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getApprovedReviews failed:", err);
    return { items: [], total: 0, page, totalPages: 1, pageSize };
  }
}

/** Distinct industries among a processor's approved reviews (drives the filter). */
export async function getReviewIndustries(processorId: string): Promise<string[]> {
  try {
    await connectToDatabase();
    const values = await Review.distinct("industry", {
      processor: processorId,
      status: "approved",
    });
    return values
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getReviewIndustries failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Blog (PRD §9.9) — only the PUBLISHED set is ever public. Shared by the /blog
// index, /blog/[slug] post page, generateStaticParams, and the homepage teaser.
// ---------------------------------------------------------------------------

export const BLOG_PAGE_SIZE = 9;

export interface BlogIndexResult {
  items: BlogCardData[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

/** Published posts, newest first, paginated (PRD §9.9 index grid). */
export async function getPublishedBlogPosts(
  page = 1,
  limit = BLOG_PAGE_SIZE,
): Promise<BlogIndexResult> {
  const pageNum = Math.max(1, page);
  try {
    await connectToDatabase();
    const filter = { status: "published" as const };
    const [docs, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((pageNum - 1) * limit)
        .limit(limit)
        .select("title slug excerpt coverImage author tags publishedAt createdAt")
        .lean(),
      BlogPost.countDocuments(filter),
    ]);
    return {
      items: docs.map(toBlogCardData),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      pageSize: limit,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getPublishedBlogPosts failed:", err);
    return { items: [], total: 0, page: pageNum, totalPages: 1, pageSize: limit };
  }
}

/**
 * A single published post + its related processor cards (PRD §9.9). Returns the
 * post plus the published `relatedProcessors` flattened to card data, and a few
 * recent sibling posts to fill the "more reading" rail.
 */
export async function getBlogPostBySlug(slug: string): Promise<{
  post: BlogPostData;
  relatedProcessors: ProcessorCardData[];
  morePosts: BlogCardData[];
} | null> {
  try {
    await connectToDatabase();
    const doc = await BlogPost.findOne({ slug, status: "published" })
      .populate({
        path: "relatedProcessors",
        match: { isPublished: true },
        select: CARD_FIELDS,
      })
      .lean();
    if (!doc) return null;

    const relatedRaw = Array.isArray(doc.relatedProcessors) ? doc.relatedProcessors : [];
    const relatedProcessors = relatedRaw
      .map((p) => p as unknown as Record<string, unknown>)
      .filter((p) => p && typeof p === "object" && "name" in p)
      .map(toProcessorCardData);

    const moreDocs = await BlogPost.find({ status: "published", _id: { $ne: doc._id } })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .select("title slug excerpt coverImage author tags publishedAt createdAt")
      .lean();

    return {
      post: toBlogPostData(doc),
      relatedProcessors,
      morePosts: moreDocs.map(toBlogCardData),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getBlogPostBySlug failed:", err);
    return null;
  }
}

/** Recent published posts for the homepage/footer teaser (resilient → []). */
export async function getRecentBlogPosts(limit = 3): Promise<BlogCardData[]> {
  try {
    await connectToDatabase();
    const docs = await BlogPost.find({ status: "published" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .select("title slug excerpt coverImage author tags publishedAt createdAt")
      .lean();
    return docs.map(toBlogCardData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getRecentBlogPosts failed:", err);
    return [];
  }
}

/** Slugs of all published posts for `generateStaticParams` (resilient → []). */
export async function getAllPublishedBlogSlugs(): Promise<string[]> {
  try {
    await connectToDatabase();
    const docs = await BlogPost.find({ status: "published" }).select("slug").lean();
    return docs.map((d) => String(d.slug));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getAllPublishedBlogSlugs failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sitemap entries (PRD §13). `{ path, lastModified }` for every published
// processor / category / blog post. Resilient → [] so `app/sitemap.ts` never
// throws during build without a DB.
// ---------------------------------------------------------------------------

export interface SitemapEntry {
  path: string;
  lastModified: Date;
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    await connectToDatabase();
    const [processors, categories, posts] = await Promise.all([
      Processor.find({ isPublished: true }).select("slug updatedAt").lean(),
      Category.find({ isPublished: true }).select("slug updatedAt").lean(),
      BlogPost.find({ status: "published" }).select("slug updatedAt").lean(),
    ]);

    const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));
    const toEntry = (prefix: string) => (d: { slug?: unknown; updatedAt?: unknown }) => ({
      path: `${prefix}/${String(d.slug)}`,
      lastModified: toDate(d.updatedAt),
    });

    // Curated pretty-compare URLs (Stage 7.3 / PRD §9.4): emit a pair only when
    // BOTH its processors are published (mirrors the page's `dynamicParams=false`),
    // dating it to the newer of the two so the sitemap can't list a 404.
    const pubBySlug = new Map(processors.map((p) => [String(p.slug), toDate(p.updatedAt)]));
    const compareEntries: SitemapEntry[] = POPULAR_COMPARE_PAIRS.flatMap((pair) => {
      const dates = pair.map((s) => pubBySlug.get(s));
      if (dates.some((d) => d === undefined)) return [];
      const lastModified = (dates as Date[]).reduce((a, b) => (a > b ? a : b));
      return [{ path: `/compare/${comparePairToParam(pair)}`, lastModified }];
    });

    return [
      ...processors.map(toEntry("/processor")),
      ...categories.map(toEntry("/category")),
      ...posts.map(toEntry("/blog")),
      ...compareEntries,
    ];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getSitemapEntries failed:", err);
    return [];
  }
}

export interface DirectoryStats {
  processors: number;
  reviews: number;
  categories: number;
}

/** Counts for the homepage trust/stat row (PRD §9.1). */
export async function getDirectoryStats(): Promise<DirectoryStats> {
  try {
    await connectToDatabase();
    const [processors, reviews, categories] = await Promise.all([
      Processor.countDocuments({ isPublished: true }),
      Review.countDocuments({ status: "approved" }),
      Category.countDocuments({ isPublished: true }),
    ]);
    return { processors, reviews, categories };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getDirectoryStats failed:", err);
    return { processors: 0, reviews: 0, categories: 0 };
  }
}

/**
 * Featured categories for the homepage grid (PRD §9.1): the settings'
 * `featuredCategorySlugs` in order, falling back to the first published ones.
 */
export function pickFeaturedCategories(
  all: CategoryData[],
  settings: Pick<ISiteSettings, "featuredCategorySlugs">,
  limit = 8,
): CategoryData[] {
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const featured = (settings.featuredCategorySlugs ?? [])
    .map((slug) => bySlug.get(slug))
    .filter((c): c is CategoryData => Boolean(c));

  if (featured.length >= limit) return featured.slice(0, limit);

  const seen = new Set(featured.map((c) => c.slug));
  const fill = all.filter((c) => !seen.has(c.slug)).slice(0, limit - featured.length);
  return [...featured, ...fill];
}
