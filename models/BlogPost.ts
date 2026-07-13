import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  BLOG_CONTENT_WIDTHS,
  BLOG_COVER_LAYOUTS,
  BLOG_STATUSES,
  BLOG_TEMPLATES,
  KEYWORD_RELS,
  type BlogContentWidth,
  type BlogCoverLayout,
  type BlogStatus,
  type BlogTemplate,
  type KeywordRel,
} from "@/lib/enums";
import {
  SeoSchema,
  BlockSchema,
  StructuredDataSchema,
  type ISeo,
  type IBlock,
  type IStructuredData,
} from "./shared";
import { autoSlugFrom } from "./slug";

/** One keyword backlink: an occurrence of `keyword` in the body links to `url` (PRD §SEO). */
export interface IKeywordLink {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

const KeywordLinkSchema = new Schema<IKeywordLink>(
  {
    keyword: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    rel: { type: String, enum: KEYWORD_RELS, default: "dofollow" },
  },
  { _id: false },
);

/** BlogPost (PRD §8.6). Content stored as rich HTML/MDX from the admin Tiptap editor. */
export interface IBlogPost {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  /** Author-supplied alt text for the cover image (accessibility + image-alt SEO check). */
  coverImageAlt?: string;
  author: string;
  tags: string[];
  relatedProcessors: Types.ObjectId[];
  status: BlogStatus;
  publishedAt?: Date;
  seo: ISeo;
  /**
   * Ordered content blocks. Unlike every other model, these render *around*
   * `content` rather than instead of it — `content` stays the authoritative HTML
   * body because the blog toolchain is built on it: `injectKeywordLinks` (the SEO
   * team's backlink workflow), `computeReadingTime`, and the word-count check in
   * `lib/seo-checks.ts` all read `content` and would see a block-only post as empty.
   */
  blocks?: IBlock[];
  structuredData?: IStructuredData;
  /** SEO template the post was created from (drives the editor's heading skeleton). */
  template: BlogTemplate;
  /** Reading-column width for the body on the public page (author layout control). */
  contentWidth: BlogContentWidth;
  /** Cover-image presentation on the public page (author layout control). */
  coverLayout: BlogCoverLayout;
  /** Keyword backlinks turned into anchors in the body on the public page (the SEO team's backlinks). */
  keywords: IKeywordLink[];
  /** Link only the first occurrence of each keyword (true, default) vs every occurrence. */
  linkFirstOccurrenceOnly: boolean;
  /** Ids of SEO checks the author manually marked as reviewed (override warnings). */
  seoOverrides: string[];
  /** Read counter, incremented best-effort on each public read (monitoring). */
  views: number;
  /** Estimated reading time in minutes, derived from the body word count on save. */
  readingTimeMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, trim: true },
    content: { type: String, required: true },
    coverImage: { type: String, trim: true },
    coverImageAlt: { type: String, trim: true },
    author: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    relatedProcessors: { type: [Schema.Types.ObjectId], ref: "Processor", default: [] },
    status: { type: String, enum: BLOG_STATUSES, default: "draft" },
    publishedAt: { type: Date },
    seo: { type: SeoSchema, default: () => ({}) },
    blocks: { type: [BlockSchema], default: undefined },
    structuredData: { type: StructuredDataSchema, default: undefined },
    template: { type: String, enum: BLOG_TEMPLATES, default: "generic" },
    contentWidth: { type: String, enum: BLOG_CONTENT_WIDTHS, default: "standard" },
    coverLayout: { type: String, enum: BLOG_COVER_LAYOUTS, default: "standard" },
    keywords: { type: [KeywordLinkSchema], default: [] },
    linkFirstOccurrenceOnly: { type: Boolean, default: true },
    seoOverrides: { type: [String], default: [] },
    views: { type: Number, default: 0 },
    readingTimeMinutes: { type: Number },
  },
  { timestamps: true },
);

BlogPostSchema.pre("validate", autoSlugFrom("title"));

// --- Indexes ---
BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ tags: 1 });
BlogPostSchema.index(
  { title: "text", excerpt: "text", tags: "text" },
  { weights: { title: 10, tags: 4, excerpt: 2 }, name: "blogpost_text" },
);

export const BlogPost: Model<IBlogPost> =
  (models.BlogPost as Model<IBlogPost>) || model<IBlogPost>("BlogPost", BlogPostSchema);

export default BlogPost;
