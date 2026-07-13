import type { CategoryType } from "@/lib/enums";
import type { EngineEntity } from "@/lib/engine";
import type { CategoryEngineData } from "@/config/content-engine";
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
  seo: SeoFormValues;
  faqs: FaqFormValue[];
  blocks: BlockFormValue[];
  structuredData: StructuredDataFormValues;
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
    seo: blankSeoValues(),
    faqs: [],
    blocks: [],
    structuredData: blankStructuredDataValues(),
  };
}

type LeanCategory = Record<string, unknown> & {
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
    seo: toSeoFormValues(doc.seo as never),
    faqs: (doc.faqs ?? []).map((f) => ({ question: str(f.question), answer: str(f.answer) })),
    blocks: toBlockFormValues(doc.blocks as never),
    structuredData: toStructuredDataFormValues(doc.structuredData as never),
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
    seo: toSeoPayload(values.seo),
    // Empty rows are dropped by the validator (faqsSchema).
    faqs: values.faqs,
    blocks: toBlocksPayload(values.blocks),
    structuredData: toStructuredDataPayload(values.structuredData),
  };
}

/**
 * The EngineEntity the schema preview renders from. `items` is empty because a
 * category's ItemList is built from the processors that match it at request time —
 * the form has no way to know them, and inventing a fake list would make the
 * preview lie. The panel shows the ItemList as "nothing to emit yet" instead.
 */
export function toCategoryEnginePreview(
  values: CategoryFormValues,
  savedSlug?: string,
): EngineEntity<CategoryEngineData> {
  const slug = values.slug.trim() || savedSlug || "";
  return {
    contentType: "category",
    path: `/category/${slug}`,
    seo: toSeoPayload(values.seo) as never,
    faqs: values.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    blocks: values.blocks as never,
    structuredData: toStructuredDataPayload(values.structuredData) as never,
    data: {
      name: values.name,
      slug,
      description: values.shortDescription,
      items: [],
    },
  };
}

/** Which field lives in which form section — for jumping to the first error. */
export const CATEGORY_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  type: "Type",
  displayOrder: "Display order",
};
