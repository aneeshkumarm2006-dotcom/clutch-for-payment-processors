/**
 * On-page SEO checks (no external APIs). The scoring is PURE so the SAME logic
 * runs live in the editor (client, signals from the browser DOMParser) and on the
 * server (dashboard "SEO-ready" badge, signals from `lib/html-analyze.ts`).
 */

export interface SeoSignals {
  metaTitleLength: number;
  metaDescriptionLength: number;
  wordCount: number;
  hasCoverImage: boolean;
  internalLinks: number;
  externalLinks: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  /** Each target keyword + whether it appears in the body text. */
  keywords: { keyword: string; present: boolean }[];
}

export interface SeoCheck {
  id: string;
  label: string;
  status: "pass" | "warn";
  detail: string;
}

/** Ideal ranges (warnings are advisory; the Zod validators cap at 70/180). */
export const META_TITLE_MIN = 30;
export const META_TITLE_MAX = 60;
export const META_DESC_MIN = 120;
export const META_DESC_MAX = 160;
export const MIN_WORDS = 300;

/** Word count of plain (tag-stripped) text. */
export function countWords(plainText: string): number {
  const trimmed = plainText.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Case-insensitive presence of `keyword` in `plainText`. */
export function keywordInText(plainText: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  return k.length > 0 && plainText.toLowerCase().includes(k);
}

/** Build the pass/warn check list from already-extracted signals. */
export function evaluateSeo(s: SeoSignals): SeoCheck[] {
  const checks: SeoCheck[] = [];

  checks.push({
    id: "meta-title",
    label: "Meta title length",
    status:
      s.metaTitleLength >= META_TITLE_MIN && s.metaTitleLength <= META_TITLE_MAX ? "pass" : "warn",
    detail:
      s.metaTitleLength === 0
        ? "Not set — defaults to the post title."
        : `${s.metaTitleLength} chars (aim ${META_TITLE_MIN}–${META_TITLE_MAX}).`,
  });

  checks.push({
    id: "meta-description",
    label: "Meta description length",
    status:
      s.metaDescriptionLength >= META_DESC_MIN && s.metaDescriptionLength <= META_DESC_MAX
        ? "pass"
        : "warn",
    detail:
      s.metaDescriptionLength === 0
        ? "Not set — defaults to the excerpt."
        : `${s.metaDescriptionLength} chars (aim ${META_DESC_MIN}–${META_DESC_MAX}).`,
  });

  checks.push({
    id: "word-count",
    label: "Content length",
    status: s.wordCount >= MIN_WORDS ? "pass" : "warn",
    detail: `${s.wordCount} words${s.wordCount < MIN_WORDS ? ` (thin — aim ${MIN_WORDS}+).` : "."}`,
  });

  for (const k of s.keywords) {
    checks.push({
      id: `keyword:${k.keyword.toLowerCase()}`,
      label: `Keyword in body: "${k.keyword}"`,
      status: k.present ? "pass" : "warn",
      detail: k.present ? "Appears in the body." : "Not found in the body text.",
    });
  }

  checks.push({
    id: "links",
    label: "Internal vs external links",
    status: "pass",
    detail: `${s.internalLinks} internal · ${s.externalLinks} external.`,
  });

  checks.push({
    id: "image-alt",
    label: "Image alt text",
    status: s.imagesMissingAlt === 0 ? "pass" : "warn",
    detail:
      s.imagesTotal === 0
        ? "No inline images."
        : `${s.imagesMissingAlt} of ${s.imagesTotal} image(s) missing alt text.`,
  });

  checks.push({
    id: "cover-image",
    label: "Cover image",
    status: s.hasCoverImage ? "pass" : "warn",
    detail: s.hasCoverImage ? "Set." : "No cover image set.",
  });

  return checks;
}

/** A post is "SEO-ready" when every blocking check passes (the links count is informational). */
export function isSeoReady(checks: SeoCheck[]): boolean {
  return checks.every((c) => c.id === "links" || c.status === "pass");
}

export function seoWarnCount(checks: SeoCheck[]): number {
  return checks.filter((c) => c.id !== "links" && c.status === "warn").length;
}
