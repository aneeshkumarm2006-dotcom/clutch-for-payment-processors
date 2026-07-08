import { z } from "zod";
import { BLOG_CONTENT_WIDTHS, BLOG_COVER_LAYOUTS, BLOG_STATUSES } from "@/lib/enums";
import { objectIdString, optionalUrl, seoSchema, slugField } from "./common";

/** Writable BlogPost fields (PRD §8.6 / §10.8). */
export const blogPostInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: slugField.optional(),
  excerpt: z.string().trim().max(280).optional(),
  content: z.string().min(1, "Content is required"),
  coverImage: optionalUrl,
  coverImageAlt: z.string().trim().max(250).optional(),
  author: z.string().trim().min(1, "Author is required"),
  tags: z.array(z.string().trim()).default([]),
  relatedProcessors: z.array(objectIdString).default([]),
  status: z.enum(BLOG_STATUSES).default("draft"),
  publishedAt: z.coerce.date().optional(),
  contentWidth: z.enum(BLOG_CONTENT_WIDTHS).default("standard"),
  coverLayout: z.enum(BLOG_COVER_LAYOUTS).default("standard"),
  seo: seoSchema,
});

export const blogPostUpdate = blogPostInput.partial();

export type BlogPostInput = z.infer<typeof blogPostInput>;
