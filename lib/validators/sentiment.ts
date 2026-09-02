import { z } from "zod";
import { SENTIMENT_TONES } from "@/lib/enums";
import { emptyToUndefined, optionalUrl } from "./common";

/**
 * Validation for the off-site sentiment sections on a processor's reviews page
 * (the Google-listing and Reddit overviews). Shapes and the reasoning behind them
 * live in `models/sentiment.ts`.
 *
 * Two things this file is responsible for that the model cannot be:
 *
 *  - **Dropping the rows an editor never filled.** Every repeatable list in the
 *    admin keeps a trailing blank row, so without a `rows()`-style filter the
 *    first save after clicking "Add" would fail on a row nobody typed in. Same
 *    device as `faqsSchema` and the block validators.
 *  - **Normalizing an empty section to `undefined`.** The form always states both
 *    sections (it renders them, so it cannot omit them without triggering
 *    `PRESERVE_ON_OMIT`), which means "the editor cleared this" arrives as a
 *    shell of empty strings. Collapsing that shell to `undefined` is what lets
 *    `diffSetUnset` actually `$unset` it. Without it, clearing a section would
 *    save an empty object that renders nothing but still reads as "present".
 */

/** Empty string to undefined, then a bounded trimmed string. */
const text = (max: number, msg?: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, msg ?? `Keep under ${max} characters`).optional(),
  );

/** A blank numeric input is unset, not 0. Same trap `emptyToUndefined` exists for. */
const optionalNumber = (opts: { min: number; max?: number; int?: boolean }) =>
  z.preprocess(emptyToUndefined, (() => {
    let n = z.coerce.number().min(opts.min, `Must be ${opts.min} or more`);
    if (opts.max !== undefined) n = n.max(opts.max, `Must be ${opts.max} or less`);
    return (opts.int ? n.int("Whole numbers only") : n).optional();
  })());

/**
 * Drop rows where every field is blank, then validate what is left.
 * Lifted from `rows()` in `./blocks.ts` — same problem, same fix.
 */
const rows = <T extends z.ZodTypeAny>(row: T, max: number, maxMsg: string) =>
  z.preprocess(
    (v) => {
      if (!Array.isArray(v)) return v;
      const kept = v.filter((it) => {
        if (it === null || typeof it !== "object") return true;
        return Object.values(it as Record<string, unknown>).some((val) =>
          Array.isArray(val)
            ? val.some((s) => String(s).trim() !== "")
            : String(val ?? "").trim() !== "",
        );
      });
      return kept.length ? kept : undefined;
    },
    z.array(row).max(max, maxMsg).optional(),
  );

/** Trimmed, de-duplicated, non-empty string list. Blank overall becomes undefined. */
const stringList = (max: number, maxMsg: string) =>
  z.preprocess(
    (v) => {
      const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : v;
      if (!Array.isArray(list)) return list;
      const cleaned = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
      return cleaned.length ? cleaned : undefined;
    },
    z.array(z.string()).max(max, maxMsg).optional(),
  );

const toneField = z.preprocess(emptyToUndefined, z.enum(SENTIMENT_TONES).optional());

const themeSchema = z.object({
  label: z.string().trim().min(1, "Give the theme a label").max(120, "Keep under 120 characters"),
  detail: text(400),
  // Defaulted rather than optional: the renderer groups by tone, and an untoned
  // theme would have nowhere to go.
  tone: z.preprocess((v) => (v === "" || v == null ? "mixed" : v), z.enum(SENTIMENT_TONES)),
});

const quoteSchema = z.object({
  text: z.string().trim().min(1, "Add the quote text").max(1200, "Keep under 1200 characters"),
  author: text(120),
  context: text(120),
  date: text(60),
  rating: optionalNumber({ min: 1, max: 5 }),
  url: optionalUrl,
});

const threadSchema = z.object({
  title: z.string().trim().min(1, "Add the thread title").max(300, "Keep under 300 characters"),
  url: z.string().trim().min(1, "A thread needs a link").url("Must be a valid URL"),
  subreddit: text(80),
  date: text(60),
  takeaway: text(400),
  upvotes: optionalNumber({ min: 0, int: true }),
  comments: optionalNumber({ min: 0, int: true }),
});

/** Fields both overviews share. Spread into each so neither carries the other's. */
const sentimentBase = {
  heading: text(200),
  // Long cap: this is the section's whole argument, not a meta description.
  summary: text(4000, "Keep under 4000 characters"),
  themes: rows(themeSchema, 12, "Keep it under 12 themes"),
  quotes: rows(quoteSchema, 8, "Keep it under 8 quotes"),
  checkedOn: text(60),
};

/**
 * Collapse a section whose every field came back empty.
 *
 * Runs AFTER parsing, so it sees the post-preprocess shape: blank strings are
 * already `undefined` and empty row arrays already `undefined`. Anything left is
 * something an editor typed.
 */
const collapseEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  schema.transform((v) => {
    if (!v || typeof v !== "object") return undefined;
    const kept = Object.values(v as Record<string, unknown>).some((x) => x !== undefined);
    return kept ? (v as z.infer<T>) : undefined;
  });

/**
 * The processor's Google listing.
 *
 * `rating` and `reviewCount` are transcribed from the listing and are shown
 * labelled as Google's. They never reach the site's own aggregate and never reach
 * JSON-LD — see the header of `models/sentiment.ts`.
 */
export const googleReviewsOverviewSchema = collapseEmpty(
  z
    .object({
      ...sentimentBase,
      rating: optionalNumber({ min: 0, max: 5 }),
      reviewCount: optionalNumber({ min: 0, int: true }),
      breakdown: rows(
        z.object({
          stars: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5)),
          count: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0)),
        }),
        5,
        "A star breakdown has at most 5 rows",
      ),
      profileUrl: optionalUrl,
      profileName: text(200),
    })
    .optional(),
);

/** What Reddit says. No rating, because Reddit has none. */
export const redditOverviewSchema = collapseEmpty(
  z
    .object({
      ...sentimentBase,
      tone: toneField,
      subreddits: stringList(10, "Keep it under 10 subreddits"),
      volumeNote: text(200),
      searchUrl: optionalUrl,
      threads: rows(threadSchema, 10, "Keep it under 10 threads"),
    })
    .optional(),
);

export type GoogleReviewsOverviewInput = z.infer<typeof googleReviewsOverviewSchema>;
export type RedditOverviewInput = z.infer<typeof redditOverviewSchema>;
