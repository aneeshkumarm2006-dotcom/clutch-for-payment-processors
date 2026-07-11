import { z } from "zod";
import { seoSchema, faqsSchema } from "./common";

/**
 * Writable PageSeo fields. `pageKey`/`path` identify the static route and are set
 * at seed time; the admin only edits `title`, `seo`, and `faqs`. The update route
 * uses the partial variant so it never rewrites the immutable key/path.
 */
export const pageSeoInput = z.object({
  pageKey: z.string().trim().min(1),
  title: z.string().trim().min(1, "Title is required"),
  path: z.string().trim().min(1),
  seo: seoSchema,
  faqs: faqsSchema,
});

export const pageSeoUpdate = pageSeoInput.partial();

export type PageSeoInput = z.infer<typeof pageSeoInput>;
