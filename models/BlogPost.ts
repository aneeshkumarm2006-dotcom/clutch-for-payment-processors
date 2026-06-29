import { Schema, model, models, type Model, type Types } from "mongoose";
import { BLOG_STATUSES, type BlogStatus } from "@/lib/enums";
import { SeoSchema, type ISeo } from "./shared";
import { autoSlugFrom } from "./slug";

/** BlogPost (PRD §8.6). Content stored as rich HTML/MDX from the admin Tiptap editor. */
export interface IBlogPost {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  author: string;
  tags: string[];
  relatedProcessors: Types.ObjectId[];
  status: BlogStatus;
  publishedAt?: Date;
  seo: ISeo;
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
    author: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    relatedProcessors: { type: [Schema.Types.ObjectId], ref: "Processor", default: [] },
    status: { type: String, enum: BLOG_STATUSES, default: "draft" },
    publishedAt: { type: Date },
    seo: { type: SeoSchema, default: () => ({}) },
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
