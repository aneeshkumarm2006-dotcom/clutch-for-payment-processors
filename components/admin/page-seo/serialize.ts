import type { EngineEntity } from "@/lib/engine";
import type { PageEngineData } from "@/config/content-engine";
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

/** Form ↔ model serialization for the PageSeoForm. */
export interface FaqFormValue {
  question: string;
  answer: string;
}

export interface PageSeoFormValues {
  seo: SeoFormValues;
  faqs: FaqFormValue[];
  blocks: BlockFormValue[];
  structuredData: StructuredDataFormValues;
}

type LeanPageSeo = Record<string, unknown> & {
  faqs?: { question?: string; answer?: string }[];
};

const str = (v: unknown) => (v == null ? "" : String(v));

export function blankPageSeoValues(): PageSeoFormValues {
  return {
    seo: blankSeoValues(),
    faqs: [],
    blocks: [],
    structuredData: blankStructuredDataValues(),
  };
}

export function toPageSeoFormValues(doc: LeanPageSeo): PageSeoFormValues {
  return {
    seo: toSeoFormValues(doc.seo as never),
    faqs: (doc.faqs ?? []).map((f) => ({ question: str(f.question), answer: str(f.answer) })),
    blocks: toBlockFormValues(doc.blocks as never),
    structuredData: toStructuredDataFormValues(doc.structuredData as never),
  };
}

export function toPageSeoPayload(values: PageSeoFormValues): Record<string, unknown> {
  return {
    seo: toSeoPayload(values.seo),
    // Empty rows are dropped by the validator (faqsSchema).
    faqs: values.faqs,
    blocks: toBlocksPayload(values.blocks),
    structuredData: toStructuredDataPayload(values.structuredData),
  };
}

export function toPageEnginePreview(
  values: PageSeoFormValues,
  page: { title: string; path: string },
): EngineEntity<PageEngineData> {
  return {
    contentType: "page",
    path: page.path,
    seo: toSeoPayload(values.seo) as never,
    faqs: values.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    blocks: values.blocks as never,
    structuredData: toStructuredDataPayload(values.structuredData) as never,
    data: { title: page.title, path: page.path },
  };
}
