import type { SortOrder } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BlogPost, Category, Processor, Review, type ISiteSettings } from "@/models";
import { POPULAR_COMPARE_PAIRS, comparePairToParam } from "@/lib/compare-pairs";
import { buildMentionFilter } from "@/lib/top-mentions";
import { hasReviewContent, REVIEW_CONTENT_SELECT } from "@/lib/reviews-indexability";
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
 * Resilient public read helpers (Stage 3 / M3). LISTING functions catch a Mongo
 * outage and return a safe default so SSG/ISR pages render an empty state (and
 * `next build` doesn't fail) when the DB is unreachable.
 *
 * DETAIL LOOKUPS DO NOT. See `rethrowLookupFailure` below — swallowing an error
 * there is how a five-second database blip turns into a cached 404.
 */

/**
 * Re-throw a failed single-entity lookup instead of reporting "not found".
 *
 * Every route that resolves one entity ends in `if (!x) notFound()`. When the
 * lookup swallowed a connection error and returned `null`, that reads as "this
 * page does not exist" — and Next.js caches the 404 for the route's whole
 * `revalidate` window. A transient Atlas hiccup during one ISR regeneration
 * therefore serves a hard 404 to every visitor, and to Googlebot, for the next
 * 30 minutes.
 *
 * This is not hypothetical. A crawl of all 278 sitemap URLs found 34 serving
 * `HTTP 404` with `X-Vercel-Cache: HIT` — eight published processors, their
 * eleven `/alternatives/*` pages, and fifteen curated `/compare/*` pairs — while
 * every one of those documents was present and `isPublished: true` in Mongo.
 * They were fine before and fine after; they had simply regenerated during a
 * connection failure. A sitemap that intermittently serves 404s is the fastest
 * way to get pages dropped from the index.
 *
 * Throwing instead produces a 500, which Next does NOT cache and which Google
 * treats as "try again later" rather than "this is gone". A real missing
 * document still returns `null` and still 404s, which is correct.
 */
function rethrowLookupFailure(fn: string, err: unknown): never {
  // eslint-disable-next-line no-console
  console.error(`[public-data] ${fn} failed (serving 500, not 404):`, err);
  throw err instanceof Error
    ? err
    : new Error(`[public-data] ${fn} failed: ${String(err)}`);
}

/** Card-facing projection — keep payloads small. */
const CARD_FIELDS =
  "name slug logo website affiliateUrl tagline shortDescription ratingAverage ratingCount fees.onlineCardRate fees.monthlyFee payoutTime bestFor paymentMethods isVerified isSponsored listingTier";

/**
 * Published categories for navigation (navbar, footer, homepage grid).
 *
 * `notRedirected` matters here: a category that has been consolidated into
 * another URL via `seo.redirectTo` still answers on its own path, with a 308.
 * Listing it in the site-wide footer put a redirect hop on every one of the 240
 * pages, wasting the link and the crawl. The sitemap already excluded these; the
 * navigation did not.
 */
export async function getPublishedCategories(): Promise<CategoryData[]> {
  try {
    await connectToDatabase();
    const cats = await Category.find({ isPublished: true, ...notRedirected })
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
    rethrowLookupFailure("getCategoryBySlug", err);
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
    rethrowLookupFailure("getProcessorBySlug", err);
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
    // Feeds `/compare/a-vs-b`, which calls `notFound()` when fewer than two
    // processors come back — so an empty array on error is a cached 404 too.
    rethrowLookupFailure("getProcessorsBySlugs", err);
  }
}

/**
 * Slugs of all published processors for `generateStaticParams` (resilient → []).
 * Redirected records are excluded so their 308 is a real one — see
 * `getAllPublishedBlogSlugs` for why prerendering defeats `redirect()`.
 */
export async function getAllPublishedProcessorSlugs(): Promise<string[]> {
  try {
    await connectToDatabase();
    const docs = await Processor.find({ isPublished: true, ...notRedirected })
      .select("slug")
      .lean();
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

/**
 * Sibling categories for internal linking (the buyers-guide "Related categories"
 * rail): same `parent` when one is set, otherwise same `type`. Published, excludes
 * self, ordered by displayOrder. Resilient → [].
 */
export async function getSiblingCategories(
  category: { _id: unknown; parent?: unknown; type?: unknown },
  limit = 6,
): Promise<{ name: string; slug: string }[]> {
  try {
    await connectToDatabase();
    const match: Record<string, unknown> = category.parent
      ? { parent: category.parent }
      : { type: category.type };
    const docs = await Category.find({
      ...match,
      isPublished: true,
      _id: { $ne: category._id },
    })
      .sort({ displayOrder: 1, name: 1 })
      .limit(limit)
      .select("name slug")
      .lean();
    return docs.map((d) => ({ name: String(d.name), slug: String(d.slug) }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getSiblingCategories failed:", err);
    return [];
  }
}

/**
 * Slugs for `generateStaticParams`. Redirected records are excluded so their 308
 * is a real one — see `getAllPublishedBlogSlugs` for why prerendering defeats
 * `redirect()`.
 */
export async function getAllPublishedCategorySlugs(): Promise<string[]> {
  try {
    await connectToDatabase();
    const docs = await Category.find({ isPublished: true, ...notRedirected })
      .select("slug")
      .lean();
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

/**
 * Page size on the dedicated reviews page (`/processor/<slug>/reviews`), where
 * the reviews ARE the content rather than one section of a profile. Larger than
 * `REVIEWS_PAGE_SIZE` on purpose: every extra review is unique, on-topic text in
 * the initial HTML, and fewer pages means fewer near-duplicate paginated URLs.
 */
export const REVIEWS_FULL_PAGE_SIZE = 20;

/** How many reviews on the profile before it defers to the full reviews page. */
export const REVIEWS_TEASER_COUNT = 3;

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

/**
 * A published post is only publicly visible once its publish time has arrived.
 * A future `publishedAt` marks a SCHEDULED post — kept out of every public read
 * until the clock passes it (no cron; the read-gate flips it live on time — see
 * the /seoteam scheduling flow). Legacy published posts with no date stay visible.
 */
function publishedFilter() {
  return {
    status: "published" as const,
    $or: [
      { publishedAt: { $lte: new Date() } },
      { publishedAt: { $exists: false } },
      { publishedAt: null },
    ],
  };
}

/**
 * Drop posts retired into another URL via `seo.redirectTo`.
 *
 * Spread into the LISTING queries only — the index grid, the "more reading"
 * rail, the homepage's recent posts. A consolidated post still answers on its
 * own URL (with a 308), but nothing should keep sending readers and crawlers at
 * a redirect: every such link is a hop that dilutes the link and wastes crawl
 * budget on a URL whose whole job is to point elsewhere.
 *
 * Also spread into the `generateStaticParams` slug lists, for a different
 * reason: a prerendered page CANNOT serve a 308 (see `getAllPublishedBlogSlugs`).
 *
 * Deliberately NOT applied to the by-slug lookups (`getBlogPostBySlug` and
 * friends). The route has to find the record to read `redirectTo` off it;
 * filtering there turns a 308 into a 404.
 *
 * `$in: [null, ""]` rather than an `$or`, for the reason `indexableFilter`
 * documents: Mongo matches a missing field against `null`, and this is spread
 * alongside `publishedFilter()`, which already owns the `$or` key — a second one
 * would silently replace the publish-date clause and start listing scheduled
 * posts.
 */
const notRedirected = { "seo.redirectTo": { $in: [null, ""] } } as const;

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
    const filter = { ...publishedFilter(), ...notRedirected };
    const [docs, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((pageNum - 1) * limit)
        .limit(limit)
        .select("title slug excerpt coverImage author tags publishedAt createdAt readingTimeMinutes")
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
    const doc = await BlogPost.findOne({ slug, ...publishedFilter() })
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

    const moreDocs = await BlogPost.find({ ...publishedFilter(), ...notRedirected, _id: { $ne: doc._id } })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .select("title slug excerpt coverImage author tags publishedAt createdAt readingTimeMinutes")
      .lean();

    return {
      post: toBlogPostData(doc),
      relatedProcessors,
      morePosts: moreDocs.map(toBlogCardData),
    };
  } catch (err) {
    rethrowLookupFailure("getBlogPostBySlug", err);
  }
}

/**
 * Preview a post by id REGARDLESS of status (draft / scheduled / published) for
 * the /seoteam full-page preview. Not gated by `publishedFilter` — the route is
 * behind the SEO-team auth. `morePosts` still shows only truly-live siblings.
 */
export async function getBlogPostForPreview(id: string): Promise<{
  post: BlogPostData;
  relatedProcessors: ProcessorCardData[];
  morePosts: BlogCardData[];
} | null> {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  try {
    await connectToDatabase();
    const doc = await BlogPost.findById(id)
      .populate({ path: "relatedProcessors", match: { isPublished: true }, select: CARD_FIELDS })
      .lean();
    if (!doc) return null;

    const relatedRaw = Array.isArray(doc.relatedProcessors) ? doc.relatedProcessors : [];
    const relatedProcessors = relatedRaw
      .map((p) => p as unknown as Record<string, unknown>)
      .filter((p) => p && typeof p === "object" && "name" in p)
      .map(toProcessorCardData);

    const moreDocs = await BlogPost.find({ ...publishedFilter(), ...notRedirected, _id: { $ne: doc._id } })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .select("title slug excerpt coverImage author tags publishedAt createdAt readingTimeMinutes")
      .lean();

    return {
      post: toBlogPostData(doc),
      relatedProcessors,
      morePosts: moreDocs.map(toBlogCardData),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getBlogPostForPreview failed:", err);
    return null;
  }
}

/** Recent published posts for the homepage/footer teaser (resilient → []). */
export async function getRecentBlogPosts(limit = 3): Promise<BlogCardData[]> {
  try {
    await connectToDatabase();
    const docs = await BlogPost.find({ ...publishedFilter(), ...notRedirected })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .select("title slug excerpt coverImage author tags publishedAt createdAt readingTimeMinutes")
      .lean();
    return docs.map(toBlogCardData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[public-data] getRecentBlogPosts failed:", err);
    return [];
  }
}

/**
 * Slugs of all published posts for `generateStaticParams` (resilient → []).
 *
 * Redirected posts are EXCLUDED, and that exclusion is what makes their 308
 * work. `redirect()` inside a prerendered page is not an HTTP redirect: the
 * build bakes it into a static shell that answers 200 and defers the navigation
 * to the client router, so a crawler sees a blank page with a soft redirect
 * instead of the permanent one the record asked for. Leaving the slug out sends
 * the route down the `dynamicParams = true` path, where it renders on demand and
 * `applySeoRedirect` can actually throw a 308.
 *
 * The route still resolves the post — `getBlogPostBySlug` is deliberately NOT
 * filtered — so the URL keeps working; it just stops being prerendered.
 */
export async function getAllPublishedBlogSlugs(): Promise<string[]> {
  try {
    await connectToDatabase();
    const docs = await BlogPost.find({ ...publishedFilter(), ...notRedirected })
      .select("slug")
      .lean();
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

/**
 * Exclude anything an editor has explicitly noindexed.
 *
 * `seo.robotsIndex` is tri-state: `undefined` on the vast majority of documents
 * means "say nothing about robots", and only an explicit `false` is a noindex.
 * So this must be `$ne: false`, never a truthiness test — `{ robotsIndex: true }`
 * would empty the sitemap of every record that has never been touched.
 *
 * Listing a noindexed URL in the sitemap is a contradiction Search Console
 * reports as an error: the file says "crawl and index this", the page says
 * "don't". It happens whenever a page is deliberately noindexed to consolidate a
 * duplicate, which is exactly what the eCommerce POS category is.
 */
const indexableFilter = {
  "seo.robotsIndex": { $ne: false },
  // A redirected URL is not a page. Listing it asks Google to crawl something
  // that answers 308, which at best wastes crawl budget and at worst reads as a
  // sitemap full of soft errors.
  //
  // `$in: [null, ""]` rather than an `$or`: Mongo matches a missing field
  // against `null`, and this filter is SPREAD into `publishedFilter()`, which
  // already owns the `$or` key. A second `$or` would silently replace the
  // publish-date clause and start listing scheduled posts.
  "seo.redirectTo": { $in: [null, ""] },
} as const;

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    await connectToDatabase();
    const [processors, categories, posts] = await Promise.all([
      Processor.find({ isPublished: true, ...indexableFilter })
        // Beyond `slug`/`updatedAt`: the fields `hasReviewContent` needs. None of
        // them are sitemap fields; they decide whether the reviews page is worth
        // listing at all (see below).
        .select(`slug updatedAt ${REVIEW_CONTENT_SELECT}`)
        .lean(),
      Category.find({ isPublished: true, ...indexableFilter }).select("slug updatedAt").lean(),
      BlogPost.find({ ...publishedFilter(), ...indexableFilter }).select("slug updatedAt").lean(),
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

    /**
     * `/processor/<slug>/reviews` — listed only once the page has something on it
     * that exists nowhere else: approved reviews, or an editor's own sections.
     *
     * The route itself renders for every published processor (it is linked from
     * the profile, and a zero-review page is a legitimate destination for the
     * "write a review" CTA), but a reviews page with nothing on it is thin content.
     * Advertising it in the sitemap asks Google to crawl and index a page whose
     * whole reason to exist hasn't happened yet, so the page noindexes itself in
     * that state and the sitemap agrees with it.
     *
     * Both sides now call `hasReviewContent` rather than re-implementing it. The
     * version here used to test `ratingCount` alone, which disagreed with the
     * route the moment a processor got a written reviews page before its first
     * merchant review.
     */
    const reviewEntries: SitemapEntry[] = processors
      .filter((p) =>
        hasReviewContent(
          Number(p.ratingCount ?? 0),
          p.reviewsPage?.blocks,
          p.reviewsPage?.faqs,
        ),
      )
      .map((p) => ({
        path: `/processor/${String(p.slug)}/reviews`,
        lastModified: toDate(p.updatedAt),
      }));

    return [
      ...processors.map(toEntry("/processor")),
      // Each processor also has a "/alternatives/<slug>" landing page.
      ...processors.map(toEntry("/alternatives")),
      ...reviewEntries,
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
