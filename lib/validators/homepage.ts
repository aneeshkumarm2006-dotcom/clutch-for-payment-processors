import { z } from "zod";
import { HOME_SECTION_KEYS } from "@/lib/homepage";
import { emptyToUndefined } from "./common";

/**
 * Landing-page editor payload (`/api/settings/homepage`).
 *
 * Every string is optional and blanks normalize to `undefined`, because blank
 * means "inherit the built-in default" everywhere in `resolveHomepage()` — the
 * form must be able to clear a field back to the default, and a `min(1)` here
 * would make that impossible.
 *
 * `enabled` is NOT optional-with-a-default: the form always sends a real boolean,
 * and a `.default(true)` would quietly re-enable a section whose key was dropped
 * from a payload.
 */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalText = (max: number) =>
  z.preprocess(blank, z.string().trim().max(max, `Keep under ${max} characters`).optional());

/**
 * Internal path or anchor (`/compare`, `#how-it-works`) — the CTAs on this page
 * all point inside the site. Absolute URLs are allowed so a link can go to a
 * partner/docs domain, but bare strings like "compare" are rejected: they would
 * resolve relative to the homepage and silently 404.
 */
const linkHref = z.preprocess(
  blank,
  z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v.startsWith("/") || v.startsWith("#") || /^https?:\/\//i.test(v),
      "Use a path (/compare), an anchor (#how-it-works), or a full https:// URL",
    )
    .optional(),
);

const limit = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int("Whole numbers only").min(0).max(max, `Max ${max}`).optional(),
  );

const sectionBase = (maxLimit: number) =>
  z.object({
    enabled: z.boolean(),
    eyebrow: optionalText(120),
    title: optionalText(200),
    actionLabel: optionalText(80),
    actionHref: linkHref,
    limit: limit(maxLimit),
  });

const stepSchema = z.object({
  icon: optionalText(40),
  title: optionalText(120),
  body: optionalText(400),
});

const ctaCardSchema = z.object({
  icon: optionalText(40),
  title: optionalText(160),
  body: optionalText(400),
  href: linkHref,
  cta: optionalText(80),
});

/**
 * Drop rows the editor left completely blank (the repeatable lists start one),
 * but keep partially-filled rows so nothing an author typed disappears silently.
 */
const droppingBlankRows = <T extends z.ZodTypeAny>(row: T, max: number) =>
  z.preprocess(
    (v) => {
      if (!Array.isArray(v)) return v;
      return v.filter((item) =>
        Object.values((item ?? {}) as Record<string, unknown>).some(
          (field) => typeof field === "string" && field.trim() !== "",
        ),
      );
    },
    z.array(row).max(max, `Keep it under ${max}`),
  );

export const homepageInput = z.object({
  // The hero headline/sub-headline are the long-standing top-level SiteSettings
  // fields (required there), so unlike everything else they can't be blanked.
  homepageHeroTitle: z.string().trim().min(1, "Hero title is required").max(200, "Keep under 200 characters"),
  homepageHeroSubtitle: z
    .string()
    .trim()
    .min(1, "Hero subtitle is required")
    .max(400, "Keep under 400 characters"),
  featuredCategorySlugs: z.array(z.string().trim()).max(24).default([]),

  homepage: z.object({
    hero: z.object({
      eyebrow: optionalText(120),
      searchEnabled: z.boolean(),
      searchPlaceholder: optionalText(160),
      primaryCtaEnabled: z.boolean(),
      primaryCtaLabel: optionalText(80),
      secondaryCtaEnabled: z.boolean(),
      secondaryCtaLabel: optionalText(80),
      secondaryCtaHref: linkHref,
      statsEnabled: z.boolean(),
      statProcessorsLabel: optionalText(80),
      statReviewsLabel: optionalText(80),
      statCategoriesLabel: optionalText(80),
    }),
    categories: sectionBase(24),
    featured: sectionBase(24),
    howItWorks: sectionBase(24).extend({ steps: droppingBlankRows(stepSchema, 8) }),
    compare: sectionBase(12),
    blog: sectionBase(12),
    ctaBand: z.object({
      enabled: z.boolean(),
      cards: droppingBlankRows(ctaCardSchema, 6),
    }),
    content: z.object({ enabled: z.boolean(), title: optionalText(200) }),
    faq: z.object({ enabled: z.boolean(), title: optionalText(200) }),
    sectionOrder: z.array(z.enum(HOME_SECTION_KEYS)).default([...HOME_SECTION_KEYS]),
  }),
});

export type HomepageInput = z.infer<typeof homepageInput>;
