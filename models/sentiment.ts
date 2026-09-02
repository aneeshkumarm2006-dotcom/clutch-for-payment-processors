import { Schema } from "mongoose";
import { SENTIMENT_TONES, type SentimentTone } from "@/lib/enums";

/**
 * Off-site sentiment sections for `/processor/<slug>/reviews`.
 *
 * The reviews page has always had exactly one voice on it: merchants who wrote a
 * review HERE. That is the smallest of the three places a buyer actually looks.
 * They also read the processor's Google listing, and they search Reddit, and on a
 * high-risk processor with four on-site reviews those two are the whole evidence
 * base.
 *
 * So this holds an editor's WRITTEN SUMMARY of each of those places: what the
 * score is, what people keep saying, and a handful of quotes with a link back to
 * the source. It is deliberately not a scraper. Nothing here is fetched and
 * nothing updates itself, which is why each section carries a `checkedOn` stamp
 * saying when a human last read it.
 *
 * Three rules the rest of the code depends on:
 *
 * 1. **Every field is optional, and the whole section is optional.** Most
 *    processors will never have either one. An absent section renders nothing and
 *    counts for nothing. See `hasSentimentContent`.
 * 2. **Nothing here is HTML.** Every string reaches the DOM as a text node, so
 *    there is no sanitizer in the write path and there must never need to be. If
 *    a field ever becomes rich text it has to join `sanitizeBlocks`.
 * 3. **Nothing here feeds AggregateRating.** A Google rating is Google's
 *    aggregate of reviews collected by Google, and marking it up as this page's
 *    own `aggregateRating` is exactly the third-party-review markup Google issues
 *    manual actions over. The Product node keeps reading `ratingAverage` and
 *    `ratingCount`, computed from approved on-site reviews only. See
 *    `config/content-engine.ts`.
 */

/** A theme that keeps coming up, and which way it cuts. */
export interface ISentimentTheme {
  /** Short label, e.g. "Underwriting speed". */
  label: string;
  /** One sentence of detail. Optional: a bare label is a valid chip. */
  detail?: string;
  tone: SentimentTone;
}

export const SentimentThemeSchema = new Schema<ISentimentTheme>(
  {
    label: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
    tone: { type: String, enum: SENTIMENT_TONES, default: "mixed" },
  },
  { _id: false },
);

/** A short excerpt lifted from the source, with enough context to be checkable. */
export interface ISentimentQuote {
  text: string;
  /** Display name as the source shows it: "Marcus T." or "u/merchant_dev". */
  author?: string;
  /** Where within the source: "r/smallbusiness", "Google review". */
  context?: string;
  /** Free text ("August 2026"), not a Date: sources rarely publish a precise one. */
  date?: string;
  /** 1 to 5. Only meaningful for a star-rated source; ignored for Reddit. */
  rating?: number;
  /** Permalink to the review or comment, when one exists. */
  url?: string;
}

export const SentimentQuoteSchema = new Schema<ISentimentQuote>(
  {
    text: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
    context: { type: String, trim: true },
    date: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    url: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * Fields both sections share. One interface because the renderer draws the
 * summary, themes and quotes identically for either source. The difference
 * between them is only what sits in the header.
 */
interface ISentimentSectionBase {
  /** Section heading. Falls back to a generated one per source. */
  heading?: string;
  /** The read: what is actually going on over there. Plain text, paragraphs. */
  summary?: string;
  themes?: ISentimentTheme[];
  quotes?: ISentimentQuote[];
  /**
   * When a human last read the source, as free text ("19 August 2026").
   *
   * Free text rather than a Date because it is transcribed alongside the rest of
   * the section, and a real `Date` would imply the figures above it refresh with
   * it. They do not. It is a citation, shown next to the numbers so a stale score
   * reads as stale rather than as current.
   */
  checkedOn?: string;
}

const sentimentBaseFields = {
  heading: { type: String, trim: true },
  summary: { type: String, trim: true },
  themes: { type: [SentimentThemeSchema], default: undefined },
  quotes: { type: [SentimentQuoteSchema], default: undefined },
  checkedOn: { type: String, trim: true },
} as const;

/** One bar of a star histogram, as the Google listing publishes it. */
export interface IStarBreakdown {
  stars: number;
  count: number;
}

export const StarBreakdownSchema = new Schema<IStarBreakdown>(
  {
    stars: { type: Number, required: true, min: 1, max: 5 },
    count: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/**
 * The processor's Google listing (Business Profile / Maps).
 *
 * `rating` and `reviewCount` are the listing's own numbers, transcribed. They are
 * shown labelled as Google's, never merged into the site's average, and never
 * marked up. See the file header.
 */
export interface IGoogleReviewsOverview extends ISentimentSectionBase {
  rating?: number;
  reviewCount?: number;
  /** 5-to-1 star counts, when the listing shows them. Bars are drawn from this. */
  breakdown?: IStarBreakdown[];
  /** Link to the listing itself. */
  profileUrl?: string;
  /** What the listing is called on Google, when it differs from the processor. */
  profileName?: string;
}

export const GoogleReviewsOverviewSchema = new Schema<IGoogleReviewsOverview>(
  {
    ...sentimentBaseFields,
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, min: 0 },
    breakdown: { type: [StarBreakdownSchema], default: undefined },
    profileUrl: { type: String, trim: true },
    profileName: { type: String, trim: true },
  },
  { _id: false, minimize: false },
);

/** One Reddit thread worth pointing a reader at. */
export interface IRedditThread {
  title: string;
  url: string;
  /** With or without the "r/" prefix: the renderer normalizes it. */
  subreddit?: string;
  /** Free text ("March 2026"), same reasoning as `checkedOn`. */
  date?: string;
  /** Why this thread is here, in one line. */
  takeaway?: string;
  upvotes?: number;
  comments?: number;
}

export const RedditThreadSchema = new Schema<IRedditThread>(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    subreddit: { type: String, trim: true },
    date: { type: String, trim: true },
    takeaway: { type: String, trim: true },
    upvotes: { type: Number, min: 0 },
    comments: { type: Number, min: 0 },
  },
  { _id: false },
);

/**
 * What Reddit says.
 *
 * No rating, because Reddit has none. The headline signal is `tone` plus the
 * threads themselves, which is the honest shape: a subreddit does not average.
 */
export interface IRedditOverview extends ISentimentSectionBase {
  /** The overall read of the discussion. Drives the section's status chip. */
  tone?: SentimentTone;
  /** Subreddits the discussion lives in, with or without "r/". */
  subreddits?: string[];
  /** How much there is to read, in the editor's words ("about a dozen threads"). */
  volumeNote?: string;
  /** A Reddit search or hub link, for a reader who wants the raw thing. */
  searchUrl?: string;
  threads?: IRedditThread[];
}

export const RedditOverviewSchema = new Schema<IRedditOverview>(
  {
    ...sentimentBaseFields,
    tone: { type: String, enum: SENTIMENT_TONES },
    subreddits: { type: [String], default: undefined },
    volumeNote: { type: String, trim: true },
    searchUrl: { type: String, trim: true },
    threads: { type: [RedditThreadSchema], default: undefined },
  },
  { _id: false, minimize: false },
);

/**
 * The predicate that decides whether a section is "present" lives in
 * `lib/sentiment.ts`, not here: it is read by a public route, by the sitemap, by
 * the admin form and by the renderer, and none of those should pull mongoose in
 * behind it. Same split as `lib/reviews-indexability.ts`.
 */
export { hasSentimentContent } from "@/lib/sentiment";
