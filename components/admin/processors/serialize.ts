import type { ProcessorInput } from "@/lib/validators";
import type { EngineEntity } from "@/lib/engine";
import type { ProcessorEngineData, ProcessorReviewsEngineData } from "@/config/content-engine";
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
import type {
  CompanySize,
  ContractType,
  Feature,
  Integration,
  ListingTier,
  PaymentMethod,
  PayoutTime,
  PciLevel,
  PricingModel,
  Region,
  SentimentTone,
} from "@/lib/enums";
import { STAR_LEVELS } from "@/lib/sentiment";

/**
 * Form ↔ model serialization for the ProcessorForm (TODO §2.2).
 *
 * The form holds everything as controlled values: optional numbers + tri-state
 * booleans + optional enums are kept as STRINGS ("" = unset) so inputs never go
 * uncontrolled. `toProcessorPayload` converts back to the API/Zod shape on
 * submit; `toProcessorFormValues` hydrates the edit form from a saved document.
 */

export const FEE_FIELDS = [
  { key: "onlineCardRate", label: "Online card rate", placeholder: "2.9% + $0.30" },
  { key: "inPersonCardRate", label: "In-person card rate", placeholder: "2.6% + $0.10" },
  { key: "keyedInRate", label: "Keyed-in rate", placeholder: "3.5% + $0.15" },
  { key: "internationalRate", label: "International surcharge", placeholder: "+1.5%" },
  { key: "achRate", label: "ACH rate", placeholder: "0.8% (cap $5)" },
  { key: "monthlyFee", label: "Monthly fee", placeholder: "$0" },
  { key: "setupFee", label: "Setup fee", placeholder: "$0" },
  { key: "chargebackFee", label: "Chargeback fee", placeholder: "$15" },
  { key: "monthlyMinimum", label: "Monthly minimum", placeholder: "None" },
  { key: "pciFee", label: "PCI fee", placeholder: "$0" },
  { key: "earlyTerminationFee", label: "Early termination fee", placeholder: "$0" },
  { key: "refundPolicy", label: "Refund policy", placeholder: "Processing fee not returned" },
] as const;

export type FeeKey = (typeof FEE_FIELDS)[number]["key"];
export type FeesFormValues = Record<FeeKey, string>;

/**
 * The SEO / blocks / structured-data shapes are shared across every content form
 * — see `components/content/serialize.ts`. Re-exported here so existing imports of
 * `SeoFormValues` from this module keep working.
 */
export type { SeoFormValues };

export interface FaqFormValue {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Off-site sentiment (the Google + Reddit overviews on the reviews page)
//
// Same controlled-string convention as everything else in this file: numbers and
// optional enums are held as strings so no input ever goes uncontrolled, and
// `toGoogleOverviewPayload` / `toRedditOverviewPayload` convert on submit. The
// zod side (`lib/validators/sentiment.ts`) drops blank rows and collapses a
// section with nothing in it to `undefined`, so the form can keep its trailing
// empties and still save cleanly.
// ---------------------------------------------------------------------------

export interface SentimentThemeFormValue {
  label: string;
  detail: string;
  /** Never blank: an untoned theme has no column to render in. */
  tone: SentimentTone;
}

export interface SentimentQuoteFormValue {
  text: string;
  author: string;
  context: string;
  date: string;
  rating: string;
  url: string;
}

export interface RedditThreadFormValue {
  title: string;
  url: string;
  subreddit: string;
  date: string;
  takeaway: string;
  upvotes: string;
  comments: string;
}

/**
 * The star histogram is a FIXED five rows (5 down to 1), not a repeatable list.
 * The rows are the same five every time and an editor transcribing a Google
 * listing is reading them off in that order — "add a row, choose which star it
 * is" would be a worse version of a form that already knows the answer. Blank
 * rows are dropped on submit, so filling in two of the five is valid.
 */
export interface StarBreakdownFormValue {
  stars: string;
  count: string;
}

export interface GoogleOverviewFormValues {
  heading: string;
  profileName: string;
  profileUrl: string;
  rating: string;
  reviewCount: string;
  breakdown: StarBreakdownFormValue[];
  summary: string;
  themes: SentimentThemeFormValue[];
  quotes: SentimentQuoteFormValue[];
  checkedOn: string;
}

export interface RedditOverviewFormValues {
  heading: string;
  tone: SentimentTone | "";
  subreddits: string[];
  volumeNote: string;
  searchUrl: string;
  summary: string;
  threads: RedditThreadFormValue[];
  themes: SentimentThemeFormValue[];
  quotes: SentimentQuoteFormValue[];
  checkedOn: string;
}

export const blankTheme = (): SentimentThemeFormValue => ({
  label: "",
  detail: "",
  tone: "positive",
});

export const blankQuote = (): SentimentQuoteFormValue => ({
  text: "",
  author: "",
  context: "",
  date: "",
  rating: "",
  url: "",
});

export const blankThread = (): RedditThreadFormValue => ({
  title: "",
  url: "",
  subreddit: "",
  date: "",
  takeaway: "",
  upvotes: "",
  comments: "",
});

const blankBreakdown = (): StarBreakdownFormValue[] =>
  STAR_LEVELS.map((stars) => ({ stars: String(stars), count: "" }));

export function blankGoogleOverviewValues(): GoogleOverviewFormValues {
  return {
    heading: "",
    profileName: "",
    profileUrl: "",
    rating: "",
    reviewCount: "",
    breakdown: blankBreakdown(),
    summary: "",
    themes: [],
    quotes: [],
    checkedOn: "",
  };
}

export function blankRedditOverviewValues(): RedditOverviewFormValues {
  return {
    heading: "",
    tone: "",
    subreddits: [],
    volumeNote: "",
    searchUrl: "",
    summary: "",
    threads: [],
    themes: [],
    quotes: [],
    checkedOn: "",
  };
}

/**
 * The "Reviews page" tab (`/processor/<slug>/reviews`).
 *
 * A whole second page's worth of editorial on the same document, so it gets its
 * own nested form values rather than being flattened into the processor's. The
 * shapes are the shared panel ones, which is the point: the SEO panel, block
 * editor, FAQ field and schema panel all mount against `reviewsPage.*` with no
 * changes to any of them.
 */
export interface ReviewsPageFormValues {
  heading: string;
  intro: string;
  seo: SeoFormValues;
  faqs: FaqFormValue[];
  blocks: BlockFormValue[];
  structuredData: StructuredDataFormValues;
  googleReviews: GoogleOverviewFormValues;
  reddit: RedditOverviewFormValues;
}

export function blankReviewsPageValues(): ReviewsPageFormValues {
  return {
    heading: "",
    intro: "",
    seo: blankSeoValues(),
    faqs: [],
    blocks: [],
    structuredData: blankStructuredDataValues(),
    googleReviews: blankGoogleOverviewValues(),
    reddit: blankRedditOverviewValues(),
  };
}

/** All form values as controlled (no `undefined`). */
export interface ProcessorFormValues {
  name: string;
  slug: string;
  logo: string;
  website: string;
  affiliateUrl: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;

  foundedYear: string;
  headquarters: string;
  companySize: CompanySize | "";
  supportedRegions: Region[];

  pricingModel: PricingModel[];
  pricingSummary: string;
  fees: FeesFormValues;
  contractType: ContractType | "";
  freeTrial: "" | "true" | "false";
  payoutTime: PayoutTime | "";
  /** `YYYY-MM-DD` for `<input type="date">`; "" = never verified. */
  lastVerifiedAt: string;

  paymentMethods: PaymentMethod[];
  integrations: Integration[];
  currencies: string;
  features: Feature[];
  pciLevel: PciLevel | "";
  highRiskFriendly: boolean;

  categories: string[];
  bestFor: string[];
  industries: string[];
  pros: string[];
  cons: string[];
  screenshots: string[];
  demoVideoUrl: string;
  editorScore: string;

  listingTier: ListingTier;
  isVerified: boolean;
  isSponsored: boolean;
  sponsorRank: string;
  isFeatured: boolean;
  isPublished: boolean;

  seo: SeoFormValues;
  faqs: FaqFormValue[];
  blocks: BlockFormValue[];
  structuredData: StructuredDataFormValues;
  reviewsPage: ReviewsPageFormValues;
}

/** A stored Date → the `YYYY-MM-DD` value an `<input type="date">` expects. */
function toDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function blankFees(): FeesFormValues {
  return FEE_FIELDS.reduce((acc, f) => {
    acc[f.key] = "";
    return acc;
  }, {} as FeesFormValues);
}

export function blankProcessorValues(): ProcessorFormValues {
  return {
    name: "",
    slug: "",
    logo: "",
    website: "",
    affiliateUrl: "",
    tagline: "",
    shortDescription: "",
    longDescription: "",
    foundedYear: "",
    headquarters: "",
    companySize: "",
    supportedRegions: [],
    pricingModel: [],
    pricingSummary: "",
    fees: blankFees(),
    contractType: "",
    freeTrial: "",
    payoutTime: "",
    lastVerifiedAt: "",
    paymentMethods: [],
    integrations: [],
    currencies: "",
    features: [],
    pciLevel: "",
    highRiskFriendly: false,
    categories: [],
    bestFor: [],
    industries: [],
    pros: [],
    cons: [],
    screenshots: [],
    demoVideoUrl: "",
    editorScore: "",
    listingTier: "free",
    isVerified: false,
    isSponsored: false,
    sponsorRank: "",
    isFeatured: false,
    seo: blankSeoValues(),
    faqs: [],
    blocks: [],
    structuredData: blankStructuredDataValues(),
    reviewsPage: blankReviewsPageValues(),
    isPublished: false,
  };
}

/** A lean processor document (loose typing — the edit page passes `.lean()` output). */
type LeanProcessor = Record<string, unknown> & {
  fees?: Partial<Record<FeeKey, string>>;
  categories?: unknown[];
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string; keywords?: string[] };
  faqs?: { question?: string; answer?: string }[];
};

const str = (v: unknown) => (v == null ? "" : String(v));

/** Hydrate the form from a saved processor (edit mode). */
export function toProcessorFormValues(doc: LeanProcessor): ProcessorFormValues {
  const base = blankProcessorValues();
  const fees = blankFees();
  for (const f of FEE_FIELDS) fees[f.key] = str(doc.fees?.[f.key]);

  return {
    ...base,
    name: str(doc.name),
    slug: str(doc.slug),
    logo: str(doc.logo),
    website: str(doc.website),
    affiliateUrl: str(doc.affiliateUrl),
    tagline: str(doc.tagline),
    shortDescription: str(doc.shortDescription),
    longDescription: str(doc.longDescription),
    foundedYear: str(doc.foundedYear),
    headquarters: str(doc.headquarters),
    companySize: (doc.companySize as ProcessorFormValues["companySize"]) || "",
    supportedRegions: (doc.supportedRegions as Region[]) ?? [],
    pricingModel: (doc.pricingModel as PricingModel[]) ?? [],
    pricingSummary: str(doc.pricingSummary),
    fees,
    contractType: (doc.contractType as ProcessorFormValues["contractType"]) || "",
    freeTrial: doc.freeTrial === true ? "true" : doc.freeTrial === false ? "false" : "",
    payoutTime: (doc.payoutTime as ProcessorFormValues["payoutTime"]) || "",
    lastVerifiedAt: toDateInput(doc.lastVerifiedAt),
    paymentMethods: (doc.paymentMethods as PaymentMethod[]) ?? [],
    integrations: (doc.integrations as Integration[]) ?? [],
    currencies: str(doc.currencies),
    features: (doc.features as Feature[]) ?? [],
    pciLevel: (doc.pciLevel as ProcessorFormValues["pciLevel"]) || "",
    highRiskFriendly: Boolean(doc.highRiskFriendly),
    categories: Array.isArray(doc.categories) ? doc.categories.map((c) => String(c)) : [],
    bestFor: (doc.bestFor as string[]) ?? [],
    industries: (doc.industries as string[]) ?? [],
    pros: (doc.pros as string[]) ?? [],
    cons: (doc.cons as string[]) ?? [],
    screenshots: (doc.screenshots as string[]) ?? [],
    demoVideoUrl: str(doc.demoVideoUrl),
    editorScore: str(doc.editorScore),
    listingTier: (doc.listingTier as ListingTier) ?? "free",
    isVerified: Boolean(doc.isVerified),
    isSponsored: Boolean(doc.isSponsored),
    sponsorRank: str(doc.sponsorRank),
    isFeatured: Boolean(doc.isFeatured),
    isPublished: Boolean(doc.isPublished),
    seo: toSeoFormValues(doc.seo),
    faqs: (doc.faqs ?? []).map((f) => ({ question: str(f.question), answer: str(f.answer) })),
    blocks: toBlockFormValues(doc.blocks as never),
    structuredData: toStructuredDataFormValues(doc.structuredData as never),
    reviewsPage: toReviewsPageFormValues(doc.reviewsPage),
  };
}

/** Hydrate the Reviews-page tab. An absent sub-document is simply a blank tab. */
export function toReviewsPageFormValues(raw: unknown): ReviewsPageFormValues {
  const rp = (raw ?? {}) as Record<string, unknown>;
  const faqs = (rp.faqs ?? []) as { question?: unknown; answer?: unknown }[];
  return {
    heading: str(rp.heading),
    intro: str(rp.intro),
    seo: toSeoFormValues(rp.seo as never),
    faqs: faqs.map((f) => ({ question: str(f.question), answer: str(f.answer) })),
    blocks: toBlockFormValues(rp.blocks as never),
    structuredData: toStructuredDataFormValues(rp.structuredData as never),
    googleReviews: toGoogleOverviewFormValues(rp.googleReviews),
    reddit: toRedditOverviewFormValues(rp.reddit),
  };
}

// ---------------------------------------------------------------------------
// Off-site sentiment: document <-> form
// ---------------------------------------------------------------------------

const rowArr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

const toThemeValues = (v: unknown): SentimentThemeFormValue[] =>
  rowArr(v).map((t) => ({
    label: str(t.label),
    detail: str(t.detail),
    // A stored theme always has a tone (the schema defaults it), but a document
    // written before this field existed would not.
    tone: (t.tone as SentimentTone) || "mixed",
  }));

const toQuoteValues = (v: unknown): SentimentQuoteFormValue[] =>
  rowArr(v).map((q) => ({
    text: str(q.text),
    author: str(q.author),
    context: str(q.context),
    date: str(q.date),
    rating: str(q.rating),
    url: str(q.url),
  }));

/**
 * Hydrate the fixed five histogram rows from however many the document stored.
 *
 * Driven by `STAR_LEVELS` rather than by the stored array, so a listing that only
 * published three of its five bars still renders all five inputs in the right
 * order with the missing two blank.
 */
function toBreakdownValues(v: unknown): StarBreakdownFormValue[] {
  const byStar = new Map(rowArr(v).map((b) => [Number(b.stars), b.count]));
  return STAR_LEVELS.map((stars) => ({
    stars: String(stars),
    count: str(byStar.get(stars)),
  }));
}

export function toGoogleOverviewFormValues(raw: unknown): GoogleOverviewFormValues {
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    heading: str(g.heading),
    profileName: str(g.profileName),
    profileUrl: str(g.profileUrl),
    rating: str(g.rating),
    reviewCount: str(g.reviewCount),
    breakdown: toBreakdownValues(g.breakdown),
    summary: str(g.summary),
    themes: toThemeValues(g.themes),
    quotes: toQuoteValues(g.quotes),
    checkedOn: str(g.checkedOn),
  };
}

export function toRedditOverviewFormValues(raw: unknown): RedditOverviewFormValues {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    heading: str(r.heading),
    tone: (r.tone as SentimentTone) || "",
    subreddits: Array.isArray(r.subreddits) ? r.subreddits.map((x) => String(x)) : [],
    volumeNote: str(r.volumeNote),
    searchUrl: str(r.searchUrl),
    summary: str(r.summary),
    threads: rowArr(r.threads).map((t) => ({
      title: str(t.title),
      url: str(t.url),
      subreddit: str(t.subreddit),
      date: str(t.date),
      takeaway: str(t.takeaway),
      upvotes: str(t.upvotes),
      comments: str(t.comments),
    })),
    themes: toThemeValues(r.themes),
    quotes: toQuoteValues(r.quotes),
    checkedOn: str(r.checkedOn),
  };
}

/**
 * Form values to payload.
 *
 * Blank strings go through as-is: `sentimentSchema`'s preprocessors turn `""`
 * into `undefined` per field, drop rows where every field is blank, and collapse
 * a section with nothing left in it. The one thing the form must do itself is
 * drop histogram rows with no count — those rows carry a non-blank `stars`, so
 * the blank-row filter cannot see them as empty and the required `count` would
 * fail validation on a listing that only published three bars.
 */
export function toGoogleOverviewPayload(v: GoogleOverviewFormValues): Record<string, unknown> {
  return {
    heading: v.heading,
    profileName: v.profileName,
    profileUrl: v.profileUrl,
    rating: v.rating,
    reviewCount: v.reviewCount,
    breakdown: v.breakdown.filter((b) => b.count.trim() !== ""),
    summary: v.summary,
    themes: v.themes,
    quotes: v.quotes,
    checkedOn: v.checkedOn,
  };
}

export function toRedditOverviewPayload(v: RedditOverviewFormValues): Record<string, unknown> {
  return {
    heading: v.heading,
    tone: v.tone,
    subreddits: v.subreddits,
    volumeNote: v.volumeNote,
    searchUrl: v.searchUrl,
    summary: v.summary,
    threads: v.threads,
    themes: v.themes,
    quotes: v.quotes,
    checkedOn: v.checkedOn,
  };
}

/**
 * Reviews-page values → payload.
 *
 * Always returns an object, never `undefined`. This form DOES render the tab, so
 * it must state the reviews page explicitly on every save — including "the editor
 * emptied it". Returning `undefined` for a blank tab would hit the
 * `PRESERVE_ON_OMIT` rule and make a cleared field impossible to clear.
 */
export function toReviewsPagePayload(values: ReviewsPageFormValues): Record<string, unknown> {
  return {
    heading: blankToUndef(values.heading),
    intro: blankToUndef(values.intro),
    seo: toSeoPayload(values.seo),
    faqs: values.faqs,
    blocks: toBlocksPayload(values.blocks),
    structuredData: toStructuredDataPayload(values.structuredData),
    googleReviews: toGoogleOverviewPayload(values.googleReviews),
    reddit: toRedditOverviewPayload(values.reddit),
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v);

/** Convert form values → the API/Zod payload shape. `isPublished` is supplied by the action. */
export function toProcessorPayload(
  values: ProcessorFormValues,
  isPublished: boolean,
): Record<string, unknown> {
  const fees: Record<string, string> = {};
  for (const f of FEE_FIELDS) {
    const v = values.fees[f.key]?.trim();
    if (v) fees[f.key] = v;
  }

  return {
    name: values.name,
    slug: blankToUndef(values.slug),
    logo: blankToUndef(values.logo),
    website: values.website,
    affiliateUrl: blankToUndef(values.affiliateUrl),
    tagline: blankToUndef(values.tagline),
    shortDescription: blankToUndef(values.shortDescription),
    longDescription: blankToUndef(values.longDescription),
    foundedYear: values.foundedYear, // emptyToUndefined preprocess handles ""
    headquarters: blankToUndef(values.headquarters),
    companySize: blankToUndef(values.companySize),
    supportedRegions: values.supportedRegions,
    pricingModel: values.pricingModel,
    pricingSummary: blankToUndef(values.pricingSummary),
    fees,
    contractType: blankToUndef(values.contractType),
    freeTrial: values.freeTrial === "" ? undefined : values.freeTrial === "true",
    payoutTime: blankToUndef(values.payoutTime),
    // "" clears the stamp: `emptyToUndefined` runs before `z.coerce.date()`, which
    // would otherwise turn an empty string into 1970.
    lastVerifiedAt: values.lastVerifiedAt,
    paymentMethods: values.paymentMethods,
    integrations: values.integrations,
    currencies: blankToUndef(values.currencies),
    features: values.features,
    pciLevel: blankToUndef(values.pciLevel),
    highRiskFriendly: values.highRiskFriendly,
    categories: values.categories,
    bestFor: values.bestFor,
    industries: values.industries,
    pros: values.pros.map((p) => p.trim()).filter(Boolean),
    cons: values.cons.map((c) => c.trim()).filter(Boolean),
    screenshots: values.screenshots,
    demoVideoUrl: blankToUndef(values.demoVideoUrl),
    editorScore: values.editorScore, // emptyToUndefined preprocess handles ""
    listingTier: values.listingTier,
    isVerified: values.isVerified,
    isSponsored: values.isSponsored,
    sponsorRank: values.sponsorRank, // emptyToUndefined preprocess handles ""
    isFeatured: values.isFeatured,
    isPublished,
    seo: toSeoPayload(values.seo),
    // Empty rows are dropped by the validator (faqsSchema).
    faqs: values.faqs,
    // This form mounts <BlockEditor>, so it always states blocks explicitly —
    // including `[]` to mean "the editor deleted them all".
    blocks: toBlocksPayload(values.blocks),
    structuredData: toStructuredDataPayload(values.structuredData),
    reviewsPage: toReviewsPagePayload(values.reviewsPage),
  } satisfies Record<keyof ProcessorInput, unknown>;
}

/**
 * Facts the live schema preview needs but a draft form cannot know: ratings are
 * computed from approved reviews, and the slug is server-assigned on first save.
 * Supplied by the edit page from the saved document.
 */
export interface ProcessorPreviewBase {
  slug?: string;
  ratingAverage?: number;
  ratingCount?: number;
  primaryCategory?: { name: string; slug: string };
}

/**
 * Build the EngineEntity the <StructuredDataPanel> previews from — the live form
 * values MERGED OVER the saved document.
 *
 * The merge is the whole trick. Without it the preview would show a Product with
 * no `aggregateRating` (because `ratingAverage` lives on the server, not in the
 * form) and an editor would reasonably conclude they had broken the schema.
 */
export function toProcessorEnginePreview(
  values: ProcessorFormValues,
  base: ProcessorPreviewBase = {},
): EngineEntity<ProcessorEngineData> {
  const slug = values.slug.trim() || base.slug || "";
  return {
    contentType: "processor",
    path: `/processor/${slug}`,
    seo: toSeoPayload(values.seo) as never,
    faqs: values.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    blocks: values.blocks as never,
    structuredData: toStructuredDataPayload(values.structuredData) as never,
    data: {
      name: values.name,
      slug,
      description: values.shortDescription || values.tagline,
      logo: values.logo,
      website: values.affiliateUrl || values.website,
      pricingSummary: values.pricingSummary || values.fees.onlineCardRate,
      // From the saved doc — the form has no say in these.
      ratingAverage: base.ratingAverage,
      ratingCount: base.ratingCount,
      primaryCategory: base.primaryCategory,
    },
  };
}

/**
 * The reviews page's own schema preview. Same merge trick as
 * `toProcessorEnginePreview`: the aggregate rating lives on the server, so
 * without the saved values underneath, the preview would show a Product with no
 * `aggregateRating` and imply the editor had broken it.
 *
 * The individual `review` nodes are deliberately absent from the preview. They
 * are whatever the page renders at request time, which the form cannot know.
 */
export function toProcessorReviewsEnginePreview(
  values: ProcessorFormValues,
  base: ProcessorPreviewBase = {},
): EngineEntity<ProcessorReviewsEngineData> {
  const slug = values.slug.trim() || base.slug || "";
  const rp = values.reviewsPage;
  return {
    contentType: "processorReviews",
    path: `/processor/${slug}/reviews`,
    seo: toSeoPayload(rp.seo) as never,
    faqs: rp.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    blocks: rp.blocks as never,
    structuredData: toStructuredDataPayload(rp.structuredData) as never,
    data: {
      name: values.name,
      slug,
      description: rp.intro || values.shortDescription || values.tagline,
      logo: values.logo,
      ratingAverage: base.ratingAverage,
      ratingCount: base.ratingCount,
      primaryCategory: base.primaryCategory,
    },
  };
}

/** Which tab owns a field — so publish-validation can jump to the first error. */
export const FIELD_TAB: Record<string, string> = {
  name: "basics",
  slug: "basics",
  logo: "basics",
  website: "basics",
  affiliateUrl: "basics",
  tagline: "basics",
  shortDescription: "basics",
  longDescription: "basics",
  foundedYear: "company",
  headquarters: "company",
  companySize: "company",
  supportedRegions: "company",
  pricingModel: "pricing",
  pricingSummary: "pricing",
  fees: "pricing",
  contractType: "pricing",
  freeTrial: "pricing",
  payoutTime: "pricing",
  lastVerifiedAt: "pricing",
  paymentMethods: "capabilities",
  integrations: "capabilities",
  currencies: "capabilities",
  features: "capabilities",
  pciLevel: "capabilities",
  highRiskFriendly: "capabilities",
  categories: "editorial",
  bestFor: "editorial",
  industries: "editorial",
  pros: "editorial",
  cons: "editorial",
  screenshots: "editorial",
  demoVideoUrl: "editorial",
  editorScore: "editorial",
  listingTier: "merchandising",
  isVerified: "merchandising",
  isSponsored: "merchandising",
  sponsorRank: "merchandising",
  isFeatured: "merchandising",
  seo: "seo",
  blocks: "content",
  structuredData: "schema",
  reviewsPage: "reviews-page",
};
