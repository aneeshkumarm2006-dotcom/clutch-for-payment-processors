import { z } from "zod";
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
} from "@/lib/enums";
import {
  emptyToUndefined,
  objectIdString,
  optionalUrl,
  seoSchema,
  slugField,
  faqsSchema,
} from "./common";

/** Structured fee table (PRD §8.1) — every field optional ("Varies"/"—" when blank). */
export const feesSchema = z
  .object({
    onlineCardRate: z.string().trim().optional(),
    inPersonCardRate: z.string().trim().optional(),
    keyedInRate: z.string().trim().optional(),
    internationalRate: z.string().trim().optional(),
    achRate: z.string().trim().optional(),
    monthlyFee: z.string().trim().optional(),
    setupFee: z.string().trim().optional(),
    chargebackFee: z.string().trim().optional(),
    monthlyMinimum: z.string().trim().optional(),
    pciFee: z.string().trim().optional(),
    earlyTerminationFee: z.string().trim().optional(),
    refundPolicy: z.string().trim().optional(),
  })
  .default({});

/**
 * Writable Processor fields (PRD §8.1 / §10.3). Used by the admin tabbed form
 * and the create/update API.
 *
 * Deliberately OMITS the denormalized ratings (`ratingAverage`, `ratingCount`,
 * `subRatings`) — those are computed by `lib/ratings.ts`, never set by hand.
 * `editorScore` is the only rating-adjacent field an editor may set.
 */
export const processorInput = z.object({
  // Basics
  name: z.string().trim().min(1, "Name is required"),
  slug: slugField.optional(),
  logo: optionalUrl,
  website: z.string().trim().url("Enter a valid website URL"),
  affiliateUrl: optionalUrl,
  tagline: z.string().trim().max(160).optional(),
  shortDescription: z.string().trim().max(280).optional(),
  longDescription: z.string().optional(),

  // Company
  foundedYear: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1900).max(2100).optional()),
  headquarters: z.string().trim().optional(),
  companySize: z.enum(COMPANY_SIZES).optional(),
  supportedRegions: z.array(z.string().trim()).default([]),

  // Pricing
  pricingModel: z.array(z.enum(PRICING_MODELS)).default([]),
  pricingSummary: z.string().trim().optional(),
  fees: feesSchema,
  contractType: z.enum(CONTRACT_TYPES).optional(),
  freeTrial: z.boolean().optional(),
  payoutTime: z.enum(PAYOUT_TIMES).optional(),

  // Capabilities
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  integrations: z.array(z.enum(INTEGRATIONS)).default([]),
  currencies: z.string().trim().optional(),
  features: z.array(z.enum(FEATURES)).default([]),
  pciLevel: z.enum(PCI_LEVELS).optional(),
  highRiskFriendly: z.boolean().default(false),

  // Editorial
  categories: z.array(objectIdString).default([]),
  bestFor: z.array(z.string().trim()).default([]),
  industries: z.array(z.string().trim()).default([]),
  pros: z.array(z.string().trim()).default([]),
  cons: z.array(z.string().trim()).default([]),
  screenshots: z.array(z.string().trim().url()).default([]),
  demoVideoUrl: optionalUrl,
  editorScore: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(5).optional()),

  // Merchandising
  listingTier: z.enum(LISTING_TIERS).default("free"),
  isVerified: z.boolean().default(false),
  isSponsored: z.boolean().default(false),
  sponsorRank: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),

  // SEO
  seo: seoSchema,
  faqs: faqsSchema,
});

/** Partial variant for PATCH updates. */
export const processorUpdate = processorInput.partial();

/**
 * Fields a processor must have before it can go live (PRD §10.3 "Save draft vs
 * Publish"). Per NOTES.md, completeness is enforced at PUBLISH time by the admin
 * form (not on every write) so incomplete drafts can still be saved. The API
 * stays permissive (`processorInput`/`processorUpdate`); the form validates with
 * `processorPublishInput` when the editor clicks "Publish".
 */
export const PROCESSOR_PUBLISH_REQUIRED = [
  "logo",
  "tagline",
  "shortDescription",
  "longDescription",
] as const;

export const processorPublishInput = processorInput.superRefine((val, ctx) => {
  for (const field of PROCESSOR_PUBLISH_REQUIRED) {
    if (!val[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "Required before publishing.",
      });
    }
  }
  if (val.categories.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categories"],
      message: "Assign at least one category before publishing.",
    });
  }
});

export type ProcessorInput = z.infer<typeof processorInput>;
export type ProcessorFeesInput = z.infer<typeof feesSchema>;
