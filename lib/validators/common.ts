import { z } from "zod";

/** A 24-char hex Mongo ObjectId arriving as a string from a form/API client. */
export const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/**
 * Normalize an empty form value (`""`/`null`) to `undefined` before coercion.
 * Without this, `z.coerce.number("")` yields `0` — so a blank optional number
 * field (foundedYear, editorScore, sponsorRank) would wrongly persist as 0.
 */
export const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;

/** Empty string → undefined, otherwise a validated URL. Forms send "" for blank fields. */
export const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().url("Must be a valid URL").optional(),
);

/** Lowercase, hyphen-separated slug (URL-safe). Optional on input — auto-derived when blank. */
export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

/**
 * Shared SEO block (PRD §8). Defaults to an empty object so the field is always present.
 *
 * The length caps here are hard *guardrails*, not style advice. Ideal lengths
 * (~50–60 title, ~150–160 description) are enforced as **warnings** by
 * `evaluateSeo` in `lib/seo-checks.ts`, which is the right place for them: a
 * long-but-deliberate title should nag, not block. A hard `.max(70)` here did
 * block — it made the compare page's own seeded 84-char title unsaveable through
 * the admin form. Keep these caps generous enough to never fight real copy.
 */
export const seoSchema = z
  .object({
    metaTitle: z.string().trim().max(120, "Keep under 120 characters").optional(),
    metaDescription: z.string().trim().max(320, "Keep under 320 characters").optional(),
    ogImage: optionalUrl,
    // Accept a comma-separated string or an array; normalize to a trimmed, non-empty
    // string[] (or undefined when blank). Forms send a comma-separated string.
    keywords: z.preprocess(
      (v) => {
        const list = Array.isArray(v)
          ? v
          : typeof v === "string"
            ? v.split(",")
            : v;
        if (!Array.isArray(list)) return list;
        const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
        return cleaned.length ? cleaned : undefined;
      },
      z.array(z.string()).max(20, "Keep it under 20 keywords").optional(),
    ),

    // --- Per-page SEO controls (Phase 3) ---

    // Scoped strictly to OG/Twitter. These must NEVER fall back into `metaTitle`:
    // `buildMetadata` treats any custom meta title as absolute, so leaking a social
    // headline into it would strip the "· PayCompare" suffix off the SERP title.
    ogTitle: z.string().trim().max(200, "Keep under 200 characters").optional(),
    ogDescription: z.string().trim().max(400, "Keep under 400 characters").optional(),
    twitterCard: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.enum(["summary", "summary_large_image"]).optional(),
    ),

    canonicalUrl: optionalUrl,

    // Tri-state on purpose — `undefined` must survive as `undefined` all the way
    // to `buildMetadata`, which emits no robots key at all for it. Coercing a blank
    // form value to `false` here would noindex every page that has never been
    // touched, i.e. all of them.
    robotsIndex: z.preprocess(emptyToUndefined, z.boolean().optional()),
    robotsFollow: z.preprocess(emptyToUndefined, z.boolean().optional()),

    focusKeyword: z.string().trim().max(100).optional(),
  })
  .default({});

export type SeoInput = z.infer<typeof seoSchema>;

/** A single FAQ Q&A pair (PRD §13 FAQPage). Both fields required when present. */
export const faqItemSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300, "Keep under 300 characters"),
  answer: z.string().trim().min(1, "Answer is required").max(1200, "Keep under 1200 characters"),
});

/**
 * A list of FAQ items. Rows where BOTH fields are blank are dropped (the admin
 * editor starts an empty row); a partially-filled row still errors so nothing is
 * silently lost. Normalizes an all-empty list to `undefined` so it `$unset`s.
 */
export const faqsSchema = z.preprocess(
  (v) => {
    if (!Array.isArray(v)) return v;
    const rows = v.filter((it) => {
      const o = it as { question?: unknown; answer?: unknown };
      const q = typeof o?.question === "string" ? o.question.trim() : "";
      const a = typeof o?.answer === "string" ? o.answer.trim() : "";
      return q !== "" || a !== "";
    });
    return rows.length ? rows : undefined;
  },
  z.array(faqItemSchema).max(20, "Keep it under 20 FAQs").optional(),
);

export type FaqsInput = z.infer<typeof faqsSchema>;
