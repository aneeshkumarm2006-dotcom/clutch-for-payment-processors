import type { ProcessorInput } from "@/lib/validators";
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
} from "@/lib/enums";

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

export interface SeoFormValues {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
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
    seo: { metaTitle: "", metaDescription: "", ogImage: "" },
    isPublished: false,
  };
}

/** A lean processor document (loose typing — the edit page passes `.lean()` output). */
type LeanProcessor = Record<string, unknown> & {
  fees?: Partial<Record<FeeKey, string>>;
  categories?: unknown[];
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
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
    seo: {
      metaTitle: str(doc.seo?.metaTitle),
      metaDescription: str(doc.seo?.metaDescription),
      ogImage: str(doc.seo?.ogImage),
    },
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
    seo: {
      metaTitle: blankToUndef(values.seo.metaTitle),
      metaDescription: blankToUndef(values.seo.metaDescription),
      ogImage: blankToUndef(values.seo.ogImage),
    },
  } satisfies Record<keyof ProcessorInput, unknown>;
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
};
