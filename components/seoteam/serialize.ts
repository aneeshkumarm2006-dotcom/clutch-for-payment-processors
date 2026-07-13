import type { BlogStatus, BlogTemplate, KeywordRel } from "@/lib/enums";
import type { EngineEntity } from "@/lib/engine";
import type { BlogPostEngineData } from "@/config/content-engine";
// Aliased: this module already exports its OWN `SeoFormValues` (the whole post
// form) and `toSeoPayload` (the whole post payload). The shared ones below cover
// just the `seo` block / blocks / schema overrides.
import {
  blankSeoValues as blankSeoBlock,
  blankStructuredDataValues,
  toBlockFormValues,
  toBlocksPayload,
  toSeoFormValues as toSeoBlockValues,
  toSeoPayload as toSeoBlockPayload,
  toStructuredDataFormValues,
  toStructuredDataPayload,
  type BlockFormValue,
  type SeoFormValues as SeoBlockValues,
  type StructuredDataFormValues,
} from "@/components/content/serialize";

/**
 * Form ↔ model serialization for the /seoteam editor. Mirrors the admin BlogForm
 * serialize but adds the SEO-team fields: template, keyword backlinks, and the
 * first-occurrence toggle. Everything is a controlled value so inputs never go
 * uncontrolled.
 *
 * Publishing is modeled Shopify-style via `visibility`:
 *   - `draft`     → status "draft" (hidden, work-in-progress)
 *   - `visible`   → status "published", publishes now (or keeps its past date)
 *   - `scheduled` → status "published" with a FUTURE `publishedAt`; the public
 *                    read-gate keeps it hidden until that moment (see publishedFilter).
 * `publishedAt` is carried as an ISO string (timezone-safe); the VisibilityCard
 * converts to/from the browser-local `datetime-local` input.
 */
export type Visibility = "draft" | "visible" | "scheduled";

export interface KeywordRow {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

export interface SeoFormValues {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverImageAlt: string;
  author: string;
  tags: string[];
  template: BlogTemplate;
  keywords: KeywordRow[];
  linkFirstOccurrenceOnly: boolean;
  /** Ids of SEO checks the author manually marked as reviewed (override warnings). */
  seoOverrides: string[];
  visibility: Visibility;
  /** ISO 8601 string, or "" when unset. */
  publishedAt: string;
  seo: SeoBlockValues;
  blocks: BlockFormValue[];
  structuredData: StructuredDataFormValues;
}

export function blankSeoValues(): SeoFormValues {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    coverImageAlt: "",
    author: "",
    tags: [],
    template: "generic",
    keywords: [],
    linkFirstOccurrenceOnly: true,
    seoOverrides: [],
    visibility: "draft",
    publishedAt: "",
    seo: blankSeoBlock(),
    blocks: [],
    structuredData: blankStructuredDataValues(),
  };
}

type LeanBlog = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v));

/** Normalize a stored date to an ISO string (timezone-safe), or "". */
function toIso(v: unknown): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function toKeywordRows(v: unknown): KeywordRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((k) => k as Record<string, unknown>)
    .filter((k) => k && typeof k === "object")
    .map((k) => ({
      keyword: str(k.keyword),
      url: str(k.url),
      rel: (k.rel as KeywordRel) ?? "dofollow",
    }));
}

export function toSeoFormValues(doc: LeanBlog): SeoFormValues {
  const publishedAt = toIso(doc.publishedAt);
  const status = (doc.status as BlogStatus) ?? "draft";
  const visibility: Visibility =
    status !== "published"
      ? "draft"
      : publishedAt && new Date(publishedAt).getTime() > Date.now()
        ? "scheduled"
        : "visible";

  return {
    title: str(doc.title),
    slug: str(doc.slug),
    excerpt: str(doc.excerpt),
    content: str(doc.content),
    coverImage: str(doc.coverImage),
    coverImageAlt: str(doc.coverImageAlt),
    author: str(doc.author),
    tags: Array.isArray(doc.tags) ? doc.tags.map((t) => String(t)) : [],
    template: (doc.template as BlogTemplate) ?? "generic",
    keywords: toKeywordRows(doc.keywords),
    linkFirstOccurrenceOnly: doc.linkFirstOccurrenceOnly !== false,
    seoOverrides: Array.isArray(doc.seoOverrides) ? doc.seoOverrides.map(String) : [],
    visibility,
    publishedAt,
    seo: toSeoBlockValues(doc.seo as never),
    blocks: toBlockFormValues(doc.blocks as never),
    structuredData: toStructuredDataFormValues(doc.structuredData as never),
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v);

/**
 * Convert form values → the API/Zod payload. `status` + `publishedAt` derive from
 * `visibility`; the VisibilityCard guarantees a Scheduled post carries a future
 * date and a Visible post never carries a future one, so the mapping is uniform.
 */
export function toSeoPayload(values: SeoFormValues): Record<string, unknown> {
  const status: BlogStatus = values.visibility === "draft" ? "draft" : "published";
  return {
    title: values.title,
    slug: blankToUndef(values.slug),
    excerpt: blankToUndef(values.excerpt),
    content: values.content,
    coverImage: blankToUndef(values.coverImage),
    coverImageAlt: blankToUndef(values.coverImageAlt),
    author: values.author,
    tags: values.tags.map((t) => t.trim()).filter(Boolean),
    template: values.template,
    // Drop incomplete rows (a keyword needs both a phrase and a URL to link).
    keywords: values.keywords
      .map((k) => ({ keyword: k.keyword.trim(), url: k.url.trim(), rel: k.rel }))
      .filter((k) => k.keyword && k.url),
    linkFirstOccurrenceOnly: values.linkFirstOccurrenceOnly,
    seoOverrides: values.seoOverrides,
    status,
    publishedAt: blankToUndef(values.publishedAt),
    seo: toSeoBlockPayload(values.seo),
    // This form mounts <BlockEditor>, so it states blocks explicitly — including
    // `[]` for "the editor deleted them all". The /admin blog form writes the same
    // document, and `PRESERVE_ON_OMIT` keeps whichever form omits a field from
    // clobbering the other's work.
    blocks: toBlocksPayload(values.blocks),
    structuredData: toStructuredDataPayload(values.structuredData),
  };
}

/** The EngineEntity the /seoteam schema preview renders from. */
export function toBlogEnginePreview(
  values: SeoFormValues,
  savedSlug?: string,
): EngineEntity<BlogPostEngineData> {
  const slug = values.slug.trim() || savedSlug || "";
  return {
    contentType: "blogPost",
    path: `/blog/${slug}`,
    seo: toSeoBlockPayload(values.seo) as never,
    blocks: values.blocks as never,
    structuredData: toStructuredDataPayload(values.structuredData) as never,
    data: {
      title: values.title,
      slug,
      description: values.excerpt,
      image: values.coverImage,
      author: values.author,
      datePublished: values.publishedAt || undefined,
    },
  };
}
