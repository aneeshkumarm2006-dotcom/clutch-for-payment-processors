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

/** Shared SEO block (PRD §8). Defaults to an empty object so the field is always present. */
export const seoSchema = z
  .object({
    metaTitle: z.string().trim().max(70, "Keep under 70 characters").optional(),
    metaDescription: z.string().trim().max(180, "Keep under 180 characters").optional(),
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
