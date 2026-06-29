import type { BlogStatus } from "@/lib/enums";

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
  author: string;
  tags: string[];
  relatedProcessors: string[];
  publishedAt: string;
  seo: { metaTitle: string; metaDescription: string; ogImage: string };
}

export function blankBlogValues(): BlogFormValues {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    author: "",
    tags: [],
    relatedProcessors: [],
    publishedAt: "",
    seo: { metaTitle: "", metaDescription: "", ogImage: "" },
  };
}

type LeanBlog = Record<string, unknown> & {
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
};

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
    author: str(doc.author),
    tags: Array.isArray(doc.tags) ? doc.tags.map((t) => String(t)) : [],
    relatedProcessors: Array.isArray(doc.relatedProcessors)
      ? doc.relatedProcessors.map((p) => String(p))
      : [],
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
export function toBlogPayload(values: BlogFormValues, status: BlogStatus): Record<string, unknown> {
  return {
    title: values.title,
    slug: blankToUndef(values.slug),
    excerpt: blankToUndef(values.excerpt),
    content: values.content,
    coverImage: blankToUndef(values.coverImage),
    author: values.author,
    tags: values.tags.map((t) => t.trim()).filter(Boolean),
    relatedProcessors: values.relatedProcessors,
    status,
    publishedAt: blankToUndef(values.publishedAt),
    seo: {
      metaTitle: blankToUndef(values.seo.metaTitle),
      metaDescription: blankToUndef(values.seo.metaDescription),
      ogImage: blankToUndef(values.seo.ogImage),
    },
  };
}
