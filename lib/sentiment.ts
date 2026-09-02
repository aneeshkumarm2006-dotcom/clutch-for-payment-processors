import { SENTIMENT_TONES, type SentimentTone } from "@/lib/enums";
import type { IGoogleReviewsOverview, IRedditOverview, ISentimentTheme } from "@/models/sentiment";

/**
 * The rules the off-site sentiment sections are read by, with no mongoose in
 * sight.
 *
 * Same reasoning as `lib/reviews-indexability.ts`: these are consulted by a
 * public route, by the sitemap, by the admin form and by a renderer, and only one
 * of those has any business pulling the data layer in behind it. The shapes come
 * from `models/sentiment.ts` as `import type`, which the compiler erases.
 */

/**
 * Does a section hold anything worth rendering?
 *
 * The admin form renders both sections, so it states both explicitly on every
 * save (omitting them would hit `PRESERVE_ON_OMIT` and make a cleared section
 * impossible to clear). A section an editor opened and abandoned therefore
 * arrives as a shell of empty strings. Without this test the shell would render
 * an empty card and, worse, would count as content for `hasReviewContent` and put
 * the URL in the sitemap.
 *
 * The bar is a summary, a theme, a quote, a thread, or a number. A lone heading
 * or `checkedOn` is chrome around nothing and does not count.
 */
export function hasSentimentContent(section: unknown): boolean {
  if (!section || typeof section !== "object") return false;
  const s = section as Record<string, unknown>;
  const filled = (v: unknown) =>
    Array.isArray(v) ? v.length > 0 : typeof v === "number" ? Number.isFinite(v) : Boolean(v);
  return (
    filled(s.summary) ||
    filled(s.themes) ||
    filled(s.quotes) ||
    filled(s.threads) ||
    filled(s.rating) ||
    filled(s.reviewCount) ||
    filled(s.breakdown) ||
    filled(s.volumeNote) ||
    filled(s.subreddits)
  );
}

/**
 * The five rows of a star histogram, highest first.
 *
 * Shared so the admin form's fixed five inputs and the renderer's five bars stay
 * the same list in the same order rather than two literals that can disagree.
 */
export const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

/** Either off-site section, when the page only needs to ask "is there one?". */
export type SentimentSection = IGoogleReviewsOverview | IRedditOverview;

/** True when at least one off-site section has something in it. */
export function hasAnySentiment(...sections: (SentimentSection | undefined | null)[]): boolean {
  return sections.some((s) => hasSentimentContent(s));
}

export const isSentimentTone = (v: unknown): v is SentimentTone =>
  typeof v === "string" && (SENTIMENT_TONES as readonly string[]).includes(v);

/**
 * Split themes into the two columns the renderer draws.
 *
 * "Mixed" rides with the criticisms rather than the praise. A theme an editor
 * could not call positive is a caveat, and a page that files caveats under
 * "what merchants like" is the kind of review page nobody trusts twice.
 */
export function groupThemes(themes?: ISentimentTheme[] | null) {
  const list = themes ?? [];
  return {
    positive: list.filter((t) => t.tone === "positive"),
    negative: list.filter((t) => t.tone !== "positive"),
  };
}

/** "smallbusiness", "/r/smallbusiness" and "r/smallbusiness" all render the same. */
export function formatSubreddit(name: string): string {
  const clean = name.trim().replace(/^\/?r\//i, "").replace(/^\/+|\/+$/g, "");
  return clean ? `r/${clean}` : "";
}

/** Tone as a reader-facing phrase. Used for the Reddit section's status chip. */
export const TONE_LABELS: Record<SentimentTone, string> = {
  positive: "Mostly positive",
  mixed: "Mixed",
  negative: "Mostly negative",
};

/** Tone as an editor-facing option label in the admin form. */
export const TONE_OPTION_LABELS: Record<SentimentTone, string> = {
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
};
