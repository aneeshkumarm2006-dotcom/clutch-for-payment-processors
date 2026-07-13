import { z } from "zod";
import { optionalUrl } from "./common";

/**
 * Modular content blocks (Phase 3).
 *
 * This file is the ONLY validation standing between a request body and the
 * `blocks` array in Mongo. The `data` field is `Schema.Types.Mixed`, and Mongoose
 * neither casts nor validates anything inside Mixed — `runValidators: true` is a
 * no-op there. So every write path that can touch `blocks` must parse it through
 * `blocksSchema`, or arbitrary JSON lands in the database.
 *
 * Adding a block type is a three-line change: a member here, an edit component in
 * `components/content/blocks/`, and a render component in
 * `components/public/blocks/`. Register the key in `config/content-engine.ts`.
 */

/**
 * Drop rows the editor left completely blank, then require the rest to be
 * complete. The editor always keeps a trailing empty row for the next entry, so
 * without this every save would fail on a row the user never meant to fill.
 * Mirrors `faqsSchema` in `./common.ts`.
 */
const rows = <T extends z.ZodTypeAny>(
  row: T,
  opts: { min: number; max: number; minMsg: string; maxMsg: string },
) =>
  z.preprocess(
    (v) => {
      if (!Array.isArray(v)) return v;
      return v.filter((it) => {
        if (it === null || typeof it !== "object") return true;
        return Object.values(it as Record<string, unknown>).some((val) =>
          Array.isArray(val)
            ? val.some((s) => String(s).trim() !== "")
            : String(val ?? "").trim() !== "",
        );
      });
    },
    z.array(row).min(opts.min, opts.minMsg).max(opts.max, opts.maxMsg),
  );

const stringList = z.preprocess(
  (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : v),
  z.array(z.string()).max(30),
);

// --- Per-type payloads ------------------------------------------------------

const richtextData = z.object({
  html: z.string().min(1, "Add some content or remove this block"),
});

/** Schema-aware: feeds FAQPage. */
const faqData = z.object({
  title: z.string().trim().max(200).optional(),
  items: rows(
    z.object({
      question: z.string().trim().min(1, "Question is required").max(300),
      answer: z.string().trim().min(1, "Answer is required").max(1200),
    }),
    { min: 1, max: 20, minMsg: "Add at least one question", maxMsg: "Keep it under 20 questions" },
  ),
});

/**
 * Schema-aware: feeds ItemList. Each row names a compared thing (and optionally
 * links to it) — that name/url pair is what becomes the ListItem. `cells` are the
 * comparison values, positionally aligned with `headers`.
 */
const comparisonData = z.object({
  title: z.string().trim().max(200).optional(),
  headers: stringList.refine((h) => h.length > 0, "Add at least one column"),
  rows: rows(
    z.object({
      name: z.string().trim().min(1, "Name is required").max(200),
      url: optionalUrl,
      cells: stringList,
    }),
    { min: 1, max: 30, minMsg: "Add at least one row", maxMsg: "Keep it under 30 rows" },
  ),
});

const featureGridData = z.object({
  title: z.string().trim().max(200).optional(),
  items: rows(
    z.object({
      title: z.string().trim().min(1, "Title is required").max(200),
      description: z.string().trim().max(600).optional(),
      icon: z.string().trim().max(100).optional(),
    }),
    { min: 1, max: 24, minMsg: "Add at least one feature", maxMsg: "Keep it under 24 features" },
  ),
});

const prosConsData = z
  .object({
    title: z.string().trim().max(200).optional(),
    pros: stringList,
    cons: stringList,
  })
  .refine((d) => d.pros.length > 0 || d.cons.length > 0, {
    message: "Add at least one pro or con",
    path: ["pros"],
  });

const ctaData = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(200),
  body: z.string().trim().max(600).optional(),
  buttonLabel: z.string().trim().min(1, "Button label is required").max(80),
  buttonUrl: z.string().trim().min(1, "Button URL is required"),
});

const mediaData = z.object({
  url: z.string().trim().min(1, "Choose an image"),
  alt: z.string().trim().max(300).optional(),
  caption: z.string().trim().max(300).optional(),
});

/**
 * Raw HTML / embed codes. Sanitized at render time by `lib/sanitize-html.ts` —
 * this only bounds the size. Never render this without that sanitizer.
 */
const htmlEmbedData = z.object({
  html: z.string().max(20_000, "Embed is too large").min(1, "Paste an embed code"),
});

// --- The union --------------------------------------------------------------

const block = <K extends string, D extends z.ZodTypeAny>(type: K, data: D) =>
  z.object({
    type: z.literal(type),
    // Stable across reorders — it's the React key. Generated client-side.
    id: z.string().trim().min(1),
    data,
  });

export const blockSchema = z.discriminatedUnion("type", [
  block("richtext", richtextData),
  block("faq", faqData),
  block("comparison", comparisonData),
  block("featureGrid", featureGridData),
  block("prosCons", prosConsData),
  block("cta", ctaData),
  block("media", mediaData),
  block("htmlEmbed", htmlEmbedData),
]);

export type BlockInput = z.infer<typeof blockSchema>;
export type BlockType = BlockInput["type"];

export const BLOCK_TYPES = [
  "richtext",
  "faq",
  "comparison",
  "featureGrid",
  "prosCons",
  "cta",
  "media",
  "htmlEmbed",
] as const satisfies readonly BlockType[];

/**
 * A page's ordered block list.
 *
 * ⚠️ Deliberately does NOT normalize `[]` to `undefined`, unlike `faqsSchema`.
 * Blocks are a TRI-STATE, and collapsing the two falsy cases would break it:
 *
 *   key absent / undefined → "I don't manage blocks" → preserve what's stored
 *   `[]`                   → "I manage blocks and the editor emptied them" → clear
 *   `[…]`                  → set
 *
 * The distinction exists because a BlogPost has two full-replace writers
 * (`/api/blog/[id]` and `/api/seoteam/posts/[id]`). Whichever one doesn't render
 * the block editor must leave the other's work alone — see `PRESERVE_ON_OMIT` and
 * `diffSetUnset` in `lib/api.ts`. Normalize `[]` away and an editor could never
 * delete their last block; drop the preserve list and one panel silently wipes the
 * other. Both halves are load-bearing.
 */
export const blocksSchema = z.array(blockSchema).max(60, "Keep it under 60 blocks").optional();

export type BlocksInput = z.infer<typeof blocksSchema>;

/** Max size of a hand-authored JSON-LD blob. Guards against a huge JSON.parse. */
const CUSTOM_JSONLD_MAX = 16_000;

/**
 * Per-page structured-data overrides. `customJsonLd` must parse — an invalid blob
 * blocks the save rather than silently emitting nothing (or worse, emitting a
 * broken `<script>`), which is the whole point of validating it here.
 */
export const structuredDataSchema = z
  .object({
    disabledTypes: z.preprocess(
      (v) => (Array.isArray(v) && v.length ? v : undefined),
      z.array(z.string().trim()).max(20).optional(),
    ),
    fieldOverrides: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional(),
    customJsonLd: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .max(CUSTOM_JSONLD_MAX, `Keep custom JSON-LD under ${CUSTOM_JSONLD_MAX} characters`)
        .refine(
          (s) => {
            try {
              const parsed: unknown = JSON.parse(s);
              return typeof parsed === "object" && parsed !== null;
            } catch {
              return false;
            }
          },
          { message: "Not valid JSON — fix the syntax before saving" },
        )
        .optional(),
    ),
    customMode: z.enum(["append", "replace"]).default("append"),
  })
  .optional();

export type StructuredDataInput = z.infer<typeof structuredDataSchema>;
