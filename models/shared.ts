import { Schema } from "mongoose";

/**
 * Reusable SEO block embedded on Processor, Category, BlogPost, PageSeo, and
 * SiteSettings (as `defaultSeo`). Because every model shares this one sub-schema,
 * a field added here lands on all of them at once.
 *
 * Two fields carry real risk and are documented where they're consumed
 * (`buildMetadata` in `lib/seo.ts`):
 *
 *  - `robotsIndex` is a tri-state on purpose. `undefined` (every pre-existing
 *    document) must mean "say nothing", NOT "noindex" — coercing it with
 *    `Boolean()` would de-index the entire site on the next deploy.
 *  - `canonicalUrl` is only honoured when its origin matches the site's own.
 *    A cross-origin canonical silently de-indexes the page that sets it.
 */
export interface ISeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  /** `<meta name="keywords">` terms. Ignored by Google, kept for other engines/tools. */
  keywords?: string[];

  /** OG/Twitter headline. Deliberately separate from `metaTitle` — see `buildMetadata`. */
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: "summary" | "summary_large_image";
  /** Absolute URL. Ignored unless same-origin with SITE_URL. */
  canonicalUrl?: string;
  /** Tri-state: undefined = inherit/say nothing, false = noindex, true = index. */
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  /** The one term this page is trying to rank for. Drives on-page SEO checks. */
  focusKeyword?: string;
}

export const SeoSchema = new Schema<ISeo>(
  {
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    keywords: { type: [String], default: undefined },

    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    twitterCard: { type: String, enum: ["summary", "summary_large_image"] },
    canonicalUrl: { type: String, trim: true },
    // No `default:` on either robots flag — the absence of a value is meaningful.
    robotsIndex: { type: Boolean },
    robotsFollow: { type: Boolean },
    focusKeyword: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * A single FAQ Q&A pair. Embedded (as an array) on Category, Processor, and
 * PageSeo. Rendered as a visible FAQ section AND emitted as FAQPage JSON-LD.
 */
export interface IFaqItem {
  question: string;
  answer: string;
}

export const FaqSchema = new Schema<IFaqItem>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

/**
 * One content block in a page's `blocks[]` array. Array order IS render order.
 *
 * `data` is Mixed because each block type has a different payload shape. Mongoose
 * will not cast or validate anything inside it — `runValidators` is a no-op on
 * Mixed — so the zod discriminated union in `lib/validators/blocks.ts` is the ONLY
 * thing standing between a request body and the database. Every write path must
 * run it.
 *
 * `type` and `id` are kept as real typed fields rather than folded into `data`
 * so they stay queryable: migrations and audits need `find({"blocks.type": "faq"})`.
 *
 * `minimize: false` because Mongoose strips empty objects by default — a block
 * whose `data` is legitimately `{}` would otherwise come back with `data` missing.
 *
 * Note for future maintainers: every write in this codebase goes through
 * `findByIdAndUpdate` + an explicit `$set`, which bypasses Mongoose's change
 * tracker entirely. The moment someone reaches for `doc.save()` on a document
 * with blocks, they will need `doc.markModified("blocks")` or their edit will be
 * silently dropped.
 */
export interface IBlock {
  type: string;
  /** Stable client-generated id. Used as the React key across reorders. */
  id: string;
  data: Record<string, unknown>;
}

export const BlockSchema = new Schema<IBlock>(
  {
    type: { type: String, required: true, trim: true },
    id: { type: String, required: true, trim: true },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false, minimize: false },
);

/**
 * Per-page overrides for the structured-data engine (`lib/engine`). All optional:
 * an absent block means "emit exactly what the config says".
 *
 * `customJsonLd` is stored as a raw JSON *string* (that's what the admin textarea
 * produces). The engine must `JSON.parse` it and emit the resulting object —
 * handing the string itself to `JSON.stringify` would double-encode it into a
 * quoted string and produce an invalid `<script>` body.
 */
export interface IStructuredData {
  /** schema.org @types to suppress on this page, e.g. ["FAQPage"]. */
  disabledTypes?: string[];
  /** Per-@type field overrides: { Product: { name: "…" } }. Whitelisted at render. */
  fieldOverrides?: Record<string, Record<string, unknown>>;
  /** Raw JSON-LD authored by hand. Validated as parseable before it can be saved. */
  customJsonLd?: string;
  /** Whether `customJsonLd` adds to, or stands in for, the generated nodes. */
  customMode?: "append" | "replace";
}

export const StructuredDataSchema = new Schema<IStructuredData>(
  {
    disabledTypes: { type: [String], default: undefined },
    fieldOverrides: { type: Schema.Types.Mixed, default: undefined },
    customJsonLd: { type: String },
    customMode: { type: String, enum: ["append", "replace"], default: "append" },
  },
  { _id: false, minimize: false },
);
