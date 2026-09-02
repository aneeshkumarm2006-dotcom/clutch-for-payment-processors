/**
 * One rule, two callers: is `/processor/<slug>/reviews` worth indexing?
 *
 * The route reads it to decide `robots`, and `getSitemapEntries` reads it to
 * decide whether to list the URL. They have to give the same answer. When they
 * did not, the failure was silent in both directions:
 *
 *   - Sitemap says yes, page says noindex → Search Console reports the URL as
 *     "Excluded by 'noindex' tag" against a file that asked for it to be indexed.
 *   - Page says index, sitemap says no → an indexable page with unique editorial
 *     copy on it is never advertised, and gets found only through the one internal
 *     link on the profile.
 *
 * The second half is what actually shipped. The route counted an editor's blocks
 * and FAQs as content; the sitemap only looked at `ratingCount`, so a processor
 * with a fully written reviews page and no merchant submissions yet (MYR POS was
 * the first) had an indexable page that the sitemap left out.
 *
 * Lives in its own module rather than in `lib/public-data.ts` so the route can
 * import the rule without pulling the whole mongoose data layer along with it.
 * `lib/sentiment.ts` is split from `models/sentiment.ts` for the same reason.
 */
import { hasSentimentContent } from "@/lib/sentiment";

/**
 * Reviews OR an editor's own sections. Either one gives the URL something that
 * exists nowhere else on the site, which is the whole bar for indexing it.
 *
 * A processor with neither still gets a rendered page: it is linked from the
 * profile and it is where the "write a review" CTA lands. It just isn't a page
 * worth asking Google to crawl yet.
 *
 * The off-site overviews count for the same reason blocks do, and they are the
 * case the rule was extended for: a processor whose whole story is on its Google
 * listing and in two Reddit threads now has a written page about exactly that,
 * with no on-site review and no block on it. `hasSentimentContent` decides what
 * counts as written, so an empty section an editor opened and abandoned does not
 * put the URL in the sitemap.
 */
export function hasReviewContent(
  ratingCount: number,
  blocks?: unknown[] | null,
  faqs?: unknown[] | null,
  sentiment?: { googleReviews?: unknown; reddit?: unknown } | null,
): boolean {
  return (
    ratingCount > 0 ||
    Boolean(blocks?.length) ||
    Boolean(faqs?.length) ||
    hasSentimentContent(sentiment?.googleReviews) ||
    hasSentimentContent(sentiment?.reddit)
  );
}

/**
 * The Mongo projection `hasReviewContent` needs, as a `.select()` string.
 *
 * Exported so the sitemap query and the rule cannot drift a second time: adding a
 * field to the rule without adding it here would make the sitemap evaluate the
 * rule against `undefined` and quietly answer "no content" for every processor.
 */
export const REVIEW_CONTENT_SELECT =
  "ratingCount reviewsPage.blocks reviewsPage.faqs reviewsPage.googleReviews reviewsPage.reddit";
