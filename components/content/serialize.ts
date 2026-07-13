import type { IBlock, ISeo, IStructuredData } from "@/models/shared";

/**
 * Shared form ↔ model serialization for the three panels every content type now
 * carries: SEO, blocks, and structured-data overrides.
 *
 * Defined once because five forms (Processor, Category, Blog, PageSeo, SeoPost)
 * mount the same panels. Hand-rolling the mapping per form is how `seo.keywords`
 * silently went missing from blog posts — one serializer forgot a field and
 * nothing complained.
 *
 * Form convention (matching the rest of the admin): everything is a controlled
 * string, `""` means unset. The exception is `robotsIndex`/`robotsFollow`, which
 * are tri-state booleans — see below.
 */

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export interface SeoFormValues {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  twitterCard: "" | "summary" | "summary_large_image";
  canonicalUrl: string;
  /**
   * TRI-STATE. `undefined` = never set = "emit no robots directive", which is
   * what every existing page must keep doing. Do NOT default these to `false`, and
   * do NOT coerce them with `Boolean()` — that would noindex the entire site.
   */
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  focusKeyword: string;
}

export function blankSeoValues(): SeoFormValues {
  return {
    metaTitle: "",
    metaDescription: "",
    ogImage: "",
    keywords: "",
    ogTitle: "",
    ogDescription: "",
    twitterCard: "",
    canonicalUrl: "",
    robotsIndex: undefined,
    robotsFollow: undefined,
    focusKeyword: "",
  };
}

export function toSeoFormValues(seo: Partial<ISeo> | undefined | null): SeoFormValues {
  return {
    metaTitle: seo?.metaTitle ?? "",
    metaDescription: seo?.metaDescription ?? "",
    ogImage: seo?.ogImage ?? "",
    keywords: (seo?.keywords ?? []).join(", "),
    ogTitle: seo?.ogTitle ?? "",
    ogDescription: seo?.ogDescription ?? "",
    twitterCard: seo?.twitterCard ?? "",
    canonicalUrl: seo?.canonicalUrl ?? "",
    // Preserved as-is, including `undefined`.
    robotsIndex: seo?.robotsIndex,
    robotsFollow: seo?.robotsFollow,
    focusKeyword: seo?.focusKeyword ?? "",
  };
}

const blank = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function toSeoPayload(values: SeoFormValues): Record<string, unknown> {
  return {
    metaTitle: blank(values.metaTitle),
    metaDescription: blank(values.metaDescription),
    ogImage: blank(values.ogImage),
    keywords: values.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    ogTitle: blank(values.ogTitle),
    ogDescription: blank(values.ogDescription),
    twitterCard: values.twitterCard === "" ? undefined : values.twitterCard,
    canonicalUrl: blank(values.canonicalUrl),
    robotsIndex: values.robotsIndex,
    robotsFollow: values.robotsFollow,
    focusKeyword: blank(values.focusKeyword),
  };
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export type BlockFormValue = { type: string; id: string; data: Record<string, unknown> };

export function toBlockFormValues(blocks: IBlock[] | undefined | null): BlockFormValue[] {
  if (!blocks?.length) return [];
  return blocks.map((b) => ({ type: b.type, id: b.id, data: { ...(b.data ?? {}) } }));
}

/**
 * Blocks pass through structurally unchanged — the zod discriminated union does
 * the real work server-side. Returned as `[]` (not `undefined`) when empty, which
 * is deliberate: `[]` means "the editor cleared them", while omitting the key
 * entirely means "this form doesn't manage blocks". Only forms that actually mount
 * <BlockEditor> should call this. See `PRESERVE_ON_OMIT` in `lib/api.ts`.
 */
export function toBlocksPayload(blocks: BlockFormValue[] | undefined): BlockFormValue[] {
  return blocks ?? [];
}

// ---------------------------------------------------------------------------
// Structured-data overrides
// ---------------------------------------------------------------------------

export interface StructuredDataFormValues {
  disabledTypes: string[];
  customJsonLd: string;
  customMode: "append" | "replace";
}

export function blankStructuredDataValues(): StructuredDataFormValues {
  return { disabledTypes: [], customJsonLd: "", customMode: "append" };
}

export function toStructuredDataFormValues(
  sd: IStructuredData | undefined | null,
): StructuredDataFormValues {
  return {
    disabledTypes: sd?.disabledTypes ?? [],
    customJsonLd: sd?.customJsonLd ?? "",
    customMode: sd?.customMode ?? "append",
  };
}

export function toStructuredDataPayload(
  values: StructuredDataFormValues | undefined,
): Record<string, unknown> {
  return {
    disabledTypes: values?.disabledTypes?.length ? values.disabledTypes : undefined,
    customJsonLd: blank(values?.customJsonLd ?? ""),
    customMode: values?.customMode ?? "append",
  };
}
