import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  COMPANY_SIZES,
  CONTRACT_TYPES,
  FEATURES,
  INTEGRATIONS,
  LISTING_TIERS,
  PAYMENT_METHODS,
  PAYOUT_TIMES,
  PCI_LEVELS,
  PRICING_MODELS,
  type CompanySize,
  type ContractType,
  type Feature,
  type Integration,
  type ListingTier,
  type PaymentMethod,
  type PayoutTime,
  type PciLevel,
  type PricingModel,
} from "@/lib/enums";
import { SeoSchema, type ISeo } from "./shared";
import { autoSlugFrom } from "./slug";

/**
 * Processor — the core model (PRD §8.1).
 *
 * Ratings (`ratingAverage`, `ratingCount`, `subRatings`) are DENORMALIZED and
 * recomputed from approved Reviews by `lib/ratings.ts` (Stage 2). They are never
 * edited by hand. Only `editorScore` is a manual editorial input.
 */

/** Structured fee table (PRD §8.1). All optional — a null/absent field renders as "Varies"/"—". */
export interface IProcessorFees {
  onlineCardRate?: string;
  inPersonCardRate?: string;
  keyedInRate?: string;
  internationalRate?: string;
  achRate?: string;
  monthlyFee?: string;
  setupFee?: string;
  chargebackFee?: string;
  monthlyMinimum?: string;
  pciFee?: string;
  earlyTerminationFee?: string;
  refundPolicy?: string;
}

/** Computed sub-rating averages (PRD §8.1). */
export interface IProcessorSubRatings {
  easeOfUse: number;
  pricing: number;
  support: number;
  features: number;
  reliability: number;
}

/** Auto-derived neutral keyword chip (PRD §8.1 — recomputed from approved reviews). */
export interface IProcessorTopMention {
  keyword: string;
  count: number;
}

export interface IProcessor {
  name: string;
  slug: string;
  logo?: string;
  website: string;
  affiliateUrl?: string;
  tagline?: string;
  shortDescription?: string;
  longDescription?: string;

  // Company facts
  foundedYear?: number;
  headquarters?: string;
  companySize?: CompanySize;
  supportedRegions: string[];

  // Pricing
  pricingModel: PricingModel[];
  pricingSummary?: string;
  fees: IProcessorFees;
  contractType?: ContractType;
  freeTrial?: boolean;
  payoutTime?: PayoutTime;

  // Capabilities
  paymentMethods: PaymentMethod[];
  integrations: Integration[];
  currencies?: string;
  features: Feature[];
  pciLevel?: PciLevel;
  highRiskFriendly: boolean;

  // Editorial / categorization
  categories: Types.ObjectId[];
  bestFor: string[];
  industries: string[];
  pros: string[];
  cons: string[];
  screenshots: string[];
  demoVideoUrl?: string;

  // Ratings (denormalized — recomputed from approved reviews)
  ratingAverage: number;
  ratingCount: number;
  subRatings: IProcessorSubRatings;
  topMentions: IProcessorTopMention[];
  editorScore?: number;

  // Merchandising / ranking
  listingTier: ListingTier;
  isVerified: boolean;
  isSponsored: boolean;
  sponsorRank?: number;
  isFeatured: boolean;
  isPublished: boolean;

  // SEO
  seo: ISeo;

  createdAt: Date;
  updatedAt: Date;
}

const FeesSchema = new Schema<IProcessorFees>(
  {
    onlineCardRate: { type: String, trim: true },
    inPersonCardRate: { type: String, trim: true },
    keyedInRate: { type: String, trim: true },
    internationalRate: { type: String, trim: true },
    achRate: { type: String, trim: true },
    monthlyFee: { type: String, trim: true },
    setupFee: { type: String, trim: true },
    chargebackFee: { type: String, trim: true },
    monthlyMinimum: { type: String, trim: true },
    pciFee: { type: String, trim: true },
    earlyTerminationFee: { type: String, trim: true },
    refundPolicy: { type: String, trim: true },
  },
  { _id: false },
);

const SubRatingsSchema = new Schema<IProcessorSubRatings>(
  {
    easeOfUse: { type: Number, default: 0, min: 0, max: 5 },
    pricing: { type: Number, default: 0, min: 0, max: 5 },
    support: { type: Number, default: 0, min: 0, max: 5 },
    features: { type: Number, default: 0, min: 0, max: 5 },
    reliability: { type: Number, default: 0, min: 0, max: 5 },
  },
  { _id: false },
);

// Denormalized "Top mentions" chips (PRD §8.1) — recomputed by lib/ratings.ts
// from approved review text; never hand-edited.
const TopMentionSchema = new Schema<IProcessorTopMention>(
  {
    keyword: { type: String, required: true, trim: true },
    count: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ProcessorSchema = new Schema<IProcessor>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, trim: true },
    website: { type: String, required: true, trim: true },
    affiliateUrl: { type: String, trim: true },
    tagline: { type: String, trim: true },
    shortDescription: { type: String, trim: true },
    longDescription: { type: String },

    foundedYear: { type: Number },
    headquarters: { type: String, trim: true },
    companySize: { type: String, enum: COMPANY_SIZES },
    supportedRegions: { type: [String], default: [] },

    pricingModel: { type: [String], enum: PRICING_MODELS, default: [] },
    pricingSummary: { type: String, trim: true },
    fees: { type: FeesSchema, default: () => ({}) },
    contractType: { type: String, enum: CONTRACT_TYPES },
    freeTrial: { type: Boolean },
    payoutTime: { type: String, enum: PAYOUT_TIMES },

    paymentMethods: { type: [String], enum: PAYMENT_METHODS, default: [] },
    integrations: { type: [String], enum: INTEGRATIONS, default: [] },
    currencies: { type: String, trim: true },
    features: { type: [String], enum: FEATURES, default: [] },
    pciLevel: { type: String, enum: PCI_LEVELS },
    highRiskFriendly: { type: Boolean, default: false },

    categories: { type: [Schema.Types.ObjectId], ref: "Category", default: [] },
    bestFor: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    pros: { type: [String], default: [] },
    cons: { type: [String], default: [] },
    screenshots: { type: [String], default: [] },
    demoVideoUrl: { type: String, trim: true },

    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    subRatings: { type: SubRatingsSchema, default: () => ({}) },
    topMentions: { type: [TopMentionSchema], default: [] },
    editorScore: { type: Number, min: 0, max: 5 },

    listingTier: { type: String, enum: LISTING_TIERS, default: "free" },
    isVerified: { type: Boolean, default: false },
    isSponsored: { type: Boolean, default: false },
    sponsorRank: { type: Number },
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },

    seo: { type: SeoSchema, default: () => ({}) },
  },
  { timestamps: true },
);

ProcessorSchema.pre("validate", autoSlugFrom("name"));

// --- Indexes (PRD §15 / TODO §1.1) ---
// `slug` already has a unique index from the field option above.
ProcessorSchema.index({ categories: 1 });
ProcessorSchema.index({ isPublished: 1 });
ProcessorSchema.index({ isSponsored: 1, sponsorRank: 1 });
ProcessorSchema.index({ listingTier: 1 });
ProcessorSchema.index({ ratingAverage: -1, ratingCount: -1 });
ProcessorSchema.index({ isFeatured: 1 });
// Full-text search across the card-facing fields (PRD §9.5). Weighted so a name
// hit outranks a description hit.
ProcessorSchema.index(
  { name: "text", tagline: "text", shortDescription: "text", bestFor: "text" },
  { weights: { name: 10, tagline: 5, bestFor: 4, shortDescription: 1 }, name: "processor_text" },
);

export const Processor: Model<IProcessor> =
  (models.Processor as Model<IProcessor>) || model<IProcessor>("Processor", ProcessorSchema);

export default Processor;
