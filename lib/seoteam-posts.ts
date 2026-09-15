import "server-only";
import { revalidatePath } from "next/cache";
import { analyzeHtmlForSeo } from "@/lib/html-analyze";
import { pingIndexNow } from "@/lib/indexnow";

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

/**
 * IndexNow counterpart to `revalidateBlogPaths`: same slug/prevSlug shape, same
 * call sites, so the two stay in step. Revalidation makes the change visible on
 * this site; this makes it visible to Bing and friends. See `lib/indexnow.ts`.
 *
 * Fire-and-forget by construction — `pingIndexNow` returns void and never
 * throws, so a call here cannot fail or slow the write it follows.
 *
 * `index` adds `/blog` and is passed only when the post list actually changed
 * (a post published, unpublished, deleted, or moved to a new slug). A body edit
 * to an already-live post leaves the index alone: submitting every URL that
 * merely *contains* a link to the changed page is how a publisher gets its
 * submissions throttled.
 *
 * Only call this for posts that are or were live. A draft that was never
 * published has no URL an engine could know about, and submitting one asks five
 * crawlers to fetch a 404 on a page that never existed.
 */
export function pingBlogPaths(
  slug?: string,
  prevSlug?: string,
  opts: { index?: boolean } = {},
): void {
  const urls: string[] = [];
  if (slug) urls.push(`/blog/${slug}`);
  if (prevSlug && prevSlug !== slug) urls.push(`/blog/${prevSlug}`);
  if (opts.index && urls.length) urls.push("/blog");
  if (urls.length) pingIndexNow(urls);
}
