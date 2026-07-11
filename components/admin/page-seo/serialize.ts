/** Form ↔ model serialization for the PageSeoForm. */
export interface FaqFormValue {
  question: string;
  answer: string;
}

export interface PageSeoFormValues {
  seo: { metaTitle: string; metaDescription: string; ogImage: string; keywords: string };
  faqs: FaqFormValue[];
}

type LeanPageSeo = Record<string, unknown> & {
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string; keywords?: string[] };
  faqs?: { question?: string; answer?: string }[];
};

const str = (v: unknown) => (v == null ? "" : String(v));

export function toPageSeoFormValues(doc: LeanPageSeo): PageSeoFormValues {
  return {
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

export function toPageSeoPayload(values: PageSeoFormValues): Record<string, unknown> {
  return {
    seo: {
      metaTitle: blankToUndef(values.seo.metaTitle),
      metaDescription: blankToUndef(values.seo.metaDescription),
      ogImage: blankToUndef(values.seo.ogImage),
      keywords: values.seo.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    },
    // Empty rows are dropped by the validator (faqsSchema).
    faqs: values.faqs,
  };
}
