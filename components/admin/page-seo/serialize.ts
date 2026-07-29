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
  /**
   * Landing pages only — a `route` record's page renders these from code.
   * Optional because forms that own just the SEO half of a record reuse this
   * shape: the homepage editor, for one, has no URL or H1 of its own to offer.
   */
  heading?: string;
  subheading?: string;
  path?: string;
  isPublished?: boolean;
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
    heading: "",
    subheading: "",
    path: "",
    isPublished: false,
    seo: blankSeoValues(),
    faqs: [],
    blocks: [],
    structuredData: blankStructuredDataValues(),
  };
}

export function toPageSeoFormValues(doc: LeanPageSeo): PageSeoFormValues {
  return {
    heading: str(doc.heading),
    subheading: str(doc.subheading),
    path: str(doc.path),
    isPublished: doc.isPublished !== false,
    seo: toSeoFormValues(doc.seo as never),
    faqs: (doc.faqs ?? []).map((f) => ({ question: str(f.question), answer: str(f.answer) })),
    blocks: toBlockFormValues(doc.blocks as never),
    structuredData: toStructuredDataFormValues(doc.structuredData as never),
  };
}

/**
 * Form → PUT body. The page-shaped fields are only sent for a landing page:
 * `route` records have no use for them, and the API drops them anyway — sending
 * them would just make an empty `heading` box look like a cleared value.
 */
export function toPageSeoPayload(
  values: PageSeoFormValues,
  opts: { isLanding?: boolean } = {},
): Record<string, unknown> {
  return {
    ...(opts.isLanding
      ? {
          heading: values.heading?.trim() || undefined,
          subheading: values.subheading?.trim() || undefined,
          path: values.path?.trim(),
          isPublished: values.isPublished ?? true,
        }
      : {}),
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
