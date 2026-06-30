import type { BlogStatus, BlogTemplate, KeywordRel } from "@/lib/enums";

/**
 * Form ↔ model serialization for the /seoteam editor. Mirrors the admin BlogForm
 * serialize but adds the SEO-team fields: template, keyword backlinks, and the
 * first-occurrence toggle. Everything is a controlled value so inputs never go
 * uncontrolled. `status` is supplied by the Save-draft / Publish action.
 */
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
  author: string;
  tags: string[];
  template: BlogTemplate;
  keywords: KeywordRow[];
  linkFirstOccurrenceOnly: boolean;
  publishedAt: string;
  seo: { metaTitle: string; metaDescription: string; ogImage: string };
}

export function blankSeoValues(): SeoFormValues {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    author: "",
    tags: [],
    template: "generic",
    keywords: [],
    linkFirstOccurrenceOnly: true,
    publishedAt: "",
    seo: { metaTitle: "", metaDescription: "", ogImage: "" },
  };
}

type LeanBlog = Record<string, unknown> & {
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
};

const str = (v: unknown) => (v == null ? "" : String(v));

function toDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
  return {
    title: str(doc.title),
    slug: str(doc.slug),
    excerpt: str(doc.excerpt),
    content: str(doc.content),
    coverImage: str(doc.coverImage),
    author: str(doc.author),
    tags: Array.isArray(doc.tags) ? doc.tags.map((t) => String(t)) : [],
    template: (doc.template as BlogTemplate) ?? "generic",
    keywords: toKeywordRows(doc.keywords),
    linkFirstOccurrenceOnly: doc.linkFirstOccurrenceOnly !== false,
    publishedAt: toDateInput(doc.publishedAt),
    seo: {
      metaTitle: str(doc.seo?.metaTitle),
      metaDescription: str(doc.seo?.metaDescription),
      ogImage: str(doc.seo?.ogImage),
    },
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v);

/** Convert form values → the API/Zod payload. `status` is supplied by the action. */
export function toSeoPayload(values: SeoFormValues, status: BlogStatus): Record<string, unknown> {
  return {
    title: values.title,
    slug: blankToUndef(values.slug),
    excerpt: blankToUndef(values.excerpt),
    content: values.content,
    coverImage: blankToUndef(values.coverImage),
    author: values.author,
    tags: values.tags.map((t) => t.trim()).filter(Boolean),
    template: values.template,
    // Drop incomplete rows (a keyword needs both a phrase and a URL to link).
    keywords: values.keywords
      .map((k) => ({ keyword: k.keyword.trim(), url: k.url.trim(), rel: k.rel }))
      .filter((k) => k.keyword && k.url),
    linkFirstOccurrenceOnly: values.linkFirstOccurrenceOnly,
    status,
    publishedAt: blankToUndef(values.publishedAt),
    seo: {
      metaTitle: blankToUndef(values.seo.metaTitle),
      metaDescription: blankToUndef(values.seo.metaDescription),
      ogImage: blankToUndef(values.seo.ogImage),
    },
  };
}
