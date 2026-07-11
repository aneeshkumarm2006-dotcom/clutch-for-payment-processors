import type { CategoryType } from "@/lib/enums";

export interface FaqFormValue {
  question: string;
  answer: string;
}

/** Form ↔ model serialization for the CategoryForm (TODO §2.3). */
export interface CategoryFormValues {
  name: string;
  slug: string;
  type: CategoryType;
  shortDescription: string;
  introContent: string;
  icon: string;
  displayOrder: string;
  isPublished: boolean;
  seo: { metaTitle: string; metaDescription: string; ogImage: string; keywords: string };
  faqs: FaqFormValue[];
}

export function blankCategoryValues(): CategoryFormValues {
  return {
    name: "",
    slug: "",
    type: "use-case",
    shortDescription: "",
    introContent: "",
    icon: "",
    displayOrder: "0",
    isPublished: false,
    seo: { metaTitle: "", metaDescription: "", ogImage: "", keywords: "" },
    faqs: [],
  };
}

type LeanCategory = Record<string, unknown> & {
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string; keywords?: string[] };
  faqs?: { question?: string; answer?: string }[];
};

const str = (v: unknown) => (v == null ? "" : String(v));

export function toCategoryFormValues(doc: LeanCategory): CategoryFormValues {
  return {
    name: str(doc.name),
    slug: str(doc.slug),
    type: (doc.type as CategoryType) ?? "use-case",
    shortDescription: str(doc.shortDescription),
    introContent: str(doc.introContent),
    icon: str(doc.icon),
    displayOrder: str(doc.displayOrder ?? 0),
    isPublished: Boolean(doc.isPublished),
    seo: {
      metaTitle: str(doc.seo?.metaTitle),
      metaDescription: str(doc.seo?.metaDescription),
      ogImage: str(doc.seo?.ogImage),
      keywords: (doc.seo?.keywords ?? []).join(", "),
    },
    faqs: (doc.faqs ?? []).map((f) => ({ question: str(f.question), answer: str(f.answer) })),
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v);

export function toCategoryPayload(values: CategoryFormValues): Record<string, unknown> {
  return {
    name: values.name,
    slug: blankToUndef(values.slug),
    type: values.type,
    shortDescription: blankToUndef(values.shortDescription),
    introContent: blankToUndef(values.introContent),
    icon: blankToUndef(values.icon),
    displayOrder: values.displayOrder, // coerced to int by the validator
    isPublished: values.isPublished,
    seo: {
      metaTitle: blankToUndef(values.seo.metaTitle),
      metaDescription: blankToUndef(values.seo.metaDescription),
      ogImage: blankToUndef(values.seo.ogImage),
      // Comma-separated string → string[] (or undefined); the validator also splits.
      keywords: values.seo.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    },
    // Empty rows are dropped by the validator (faqsSchema).
    faqs: values.faqs,
  };
}

/** Which field lives in which form section — for jumping to the first error. */
export const CATEGORY_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  type: "Type",
  displayOrder: "Display order",
};
