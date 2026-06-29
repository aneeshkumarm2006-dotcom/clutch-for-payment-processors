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
  })
  .default({});

export type SeoInput = z.infer<typeof seoSchema>;
