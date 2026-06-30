import "server-only";
import { revalidatePath } from "next/cache";
import { analyzeHtmlForSeo } from "@/lib/html-analyze";

/** Shared helpers for the /seoteam post write routes. */

/** Estimated reading time in minutes from the body HTML (~200 wpm, min 1). */
export function computeReadingTime(html: string): number {
  return Math.max(1, Math.round(analyzeHtmlForSeo(html).wordCount / 200));
}

/**
 * On-demand revalidation so a publish/edit appears on the public blog instantly
 * (the index + post + sitemap are ISR-cached). Pass the previous slug too when a
 * slug changed so the old URL is refreshed as well.
 */
export function revalidateBlogPaths(slug?: string, prevSlug?: string): void {
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
  if (prevSlug && prevSlug !== slug) revalidatePath(`/blog/${prevSlug}`);
}
