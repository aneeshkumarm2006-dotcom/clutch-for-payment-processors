import { z } from "zod";
import { BLOG_TEMPLATES, KEYWORD_RELS } from "@/lib/enums";
import { blogPostInput } from "./blogPost";

/**
 * Validators for the /seoteam publishing flow. These EXTEND the existing
 * `blogPostInput` with the SEO-team-only fields (template, keyword backlinks,
 * link-occurrence toggle). The two surfaces write to the same `BlogPost`
 * collection; `views`/`readingTimeMinutes` are server-managed and deliberately
 * absent here so the form can never set them.
 */

/** One keyword backlink row: a keyword, its target URL, and the `rel` to apply. */
export const keywordLinkSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required"),
  url: z.string().trim().url("Must be a valid URL"),
  rel: z.enum(KEYWORD_RELS).default("dofollow"),
});

export type KeywordLinkInput = z.infer<typeof keywordLinkSchema>;

/**
 * Writable SEO-team post fields (PRD §8.6 + keyword backlinks / templates).
 * `relatedProcessors` is OMITTED on purpose: the SEO editor doesn't manage it, so
 * leaving it out of the schema means a /seoteam save never clears related
 * processors an admin set via /admin/blog (the full-replace PUT only $sets parsed
 * keys). `views`/`readingTimeMinutes` are likewise absent (server-managed).
 */
export const seoBlogPostInput = blogPostInput.omit({ relatedProcessors: true }).extend({
  template: z.enum(BLOG_TEMPLATES).default("generic"),
  keywords: z.array(keywordLinkSchema).default([]),
  linkFirstOccurrenceOnly: z.boolean().default(true),
  // Ids of SEO checks the author manually marked as reviewed (see lib/seo-checks).
  seoOverrides: z.array(z.string()).default([]),
});

export const seoBlogPostUpdate = seoBlogPostInput.partial();

export type SeoBlogPostInput = z.infer<typeof seoBlogPostInput>;
