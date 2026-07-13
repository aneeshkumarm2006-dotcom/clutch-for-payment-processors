import type { BlogContentWidth, BlogCoverLayout, BlogStatus } from "@/lib/enums";
import type { EngineEntity } from "@/lib/engine";
import type { BlogPostEngineData } from "@/config/content-engine";
import {
  blankSeoValues,
  blankStructuredDataValues,
  toBlockFormValues,
  toBlocksPayload,
  toSeoFormValues,
  toSeoPayload,
  toStructuredDataFormValues,
  toStructuredDataPayload,
  type BlockFormValue,
  type SeoFormValues,
  type StructuredDataFormValues,
} from "@/components/content/serialize";

/**
 * Form ↔ model serialization for the BlogForm (TODO §6.1 / PRD §10.8).
 *
 * Everything is held as a controlled value so inputs never go uncontrolled.
 * `status` is supplied by the action (Save draft vs Publish), mirroring the
 * ProcessorForm. `publishedAt` is kept as a `YYYY-MM-DD` string for the date
 * input; the Zod validator coerces it to a Date (blank → unset).
 */
export interface BlogFormValues {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverImageAlt: string;
  author: string;
  tags: string[];
  relatedProcessors: string[];
  publishedAt: string;
  contentWidth: BlogContentWidth;
  coverLayout: BlogCoverLayout;
  seo: SeoFormValues;
  blocks: BlockFormValue[];
  structuredData: StructuredDataFormValues;
}

export function blankBlogValues(): BlogFormValues {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    coverImageAlt: "",
    author: "",
    tags: [],
    relatedProcessors: [],
    publishedAt: "",
    contentWidth: "standard",
    coverLayout: "standard",
    seo: blankSeoValues(),
    blocks: [],
    structuredData: blankStructuredDataValues(),
  };
}

type LeanBlog = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v));

/** A stored Date → the `YYYY-MM-DD` value a `<input type="date">` expects. */
function toDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function toBlogFormValues(doc: LeanBlog): BlogFormValues {
  return {
    title: str(doc.title),
    slug: str(doc.slug),
    excerpt: str(doc.excerpt),
    content: str(doc.content),
    coverImage: str(doc.coverImage),
    coverImageAlt: str(doc.coverImageAlt),
    author: str(doc.author),
    tags: Array.isArray(doc.tags) ? doc.tags.map((t) => String(t)) : [],
    relatedProcessors: Array.isArray(doc.relatedProcessors)
      ? doc.relatedProcessors.map((p) => String(p))
      : [],
    publishedAt: toDateInput(doc.publishedAt),
    contentWidth: doc.contentWidth === "wide" ? "wide" : "standard",
    coverLayout: doc.coverLayout === "wide" ? "wide" : "standard",
    seo: toSeoFormValues(doc.seo as never),
    blocks: toBlockFormValues(doc.blocks as never),
    structuredData: toStructuredDataFormValues(doc.structuredData as never),
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v);

/** Convert form values → the API/Zod payload. `status` is supplied by the action. */
export function toBlogPayload(values: BlogFormValues, status: BlogStatus): Record<string, unknown> {
  return {
    title: values.title,
    slug: blankToUndef(values.slug),
    excerpt: blankToUndef(values.excerpt),
    content: values.content,
    coverImage: blankToUndef(values.coverImage),
    coverImageAlt: blankToUndef(values.coverImageAlt),
    author: values.author,
    tags: values.tags.map((t) => t.trim()).filter(Boolean),
    relatedProcessors: values.relatedProcessors,
    status,
    publishedAt: blankToUndef(values.publishedAt),
    contentWidth: values.contentWidth,
    coverLayout: values.coverLayout,
    seo: toSeoPayload(values.seo),
    // This form mounts <BlockEditor>, so it states blocks explicitly. The /seoteam
    // editor writes the same document — `PRESERVE_ON_OMIT` stops either one from
    // deleting fields the other owns.
    blocks: toBlocksPayload(values.blocks),
    structuredData: toStructuredDataPayload(values.structuredData),
  };
}

/** The EngineEntity the /admin blog schema preview renders from. */
export function toBlogEnginePreview(
  values: BlogFormValues,
  savedSlug?: string,
): EngineEntity<BlogPostEngineData> {
  const slug = values.slug.trim() || savedSlug || "";
  return {
    contentType: "blogPost",
    path: `/blog/${slug}`,
    seo: toSeoPayload(values.seo) as never,
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
