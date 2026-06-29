/**
 * Centralized enum option lists (PRD §8 — authoritative).
 *
 * Single source of truth shared by:
 *   - Mongoose model `enum:` constraints (`/models/*`)
 *   - Zod validators (`/lib/validators/*`)
 *   - Admin form multi-selects (Stage 2)
 *
 * Each list is `as const` so a literal union type can be derived from it
 * (`(typeof FOO)[number]`). Keeping the arrays here — rather than re-typing the
 * unions in three places — guarantees the DB, the API, and the UI never drift.
 *
 * NOTE (deviation, logged in NOTES.md): this central file is an implementation
 * detail of the §8 models, not a new data field.
 */

// ---------------------------------------------------------------------------
// Processor (PRD §8.1)
// ---------------------------------------------------------------------------
export const COMPANY_SIZES = ["1-50", "51-250", "251-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const PRICING_MODELS = [
  "flat-rate",
  "interchange-plus",
  "tiered",
  "subscription",
  "custom-quote",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const CONTRACT_TYPES = ["month-to-month", "annual", "long-term", "no-contract"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const PAYOUT_TIMES = [
  "instant",
  "same-day",
  "next-day",
  "2-day",
  "t+2",
  "t+3",
  "varies",
] as const;
export type PayoutTime = (typeof PAYOUT_TIMES)[number];

export const PAYMENT_METHODS = [
  "visa",
  "mastercard",
  "amex",
  "discover",
  "apple-pay",
  "google-pay",
  "paypal",
  "ach",
  "sepa",
  "bnpl",
  "crypto",
  "upi",
  "netbanking",
  "wallets",
  "wire",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INTEGRATIONS = [
  "api",
  "hosted-checkout",
  "drop-in-ui",
  "shopify",
  "woocommerce",
  "magento",
  "bigcommerce",
  "wix",
  "squarespace",
  "mobile-sdk",
  "virtual-terminal",
  "payment-links",
  "invoicing",
  "pos-hardware",
] as const;
export type Integration = (typeof INTEGRATIONS)[number];

export const FEATURES = [
  "recurring-billing",
  "multi-currency",
  "fraud-protection",
  "3d-secure",
  "tokenization",
  "marketplace-split",
  "reporting-dashboard",
  "tap-to-pay",
  "chargeback-protection",
  "no-rolling-reserve",
  "developer-friendly",
  "24-7-support",
] as const;
export type Feature = (typeof FEATURES)[number];

export const PCI_LEVELS = ["Level 1", "Level 2", "Level 3", "Level 4", "N/A"] as const;
export type PciLevel = (typeof PCI_LEVELS)[number];

export const LISTING_TIERS = ["free", "verified", "premier"] as const;
export type ListingTier = (typeof LISTING_TIERS)[number];

/** Region tags used by `supportedRegions` + the directory region facet (PRD §8.1 / §9.2). */
export const REGIONS = ["US", "CA", "EU", "UK", "IN", "Global"] as const;
export type Region = (typeof REGIONS)[number];

/** Sub-rating dimensions, shared by Processor (denormalized) + Review (PRD §8.1 / §8.3). */
export const SUB_RATING_KEYS = [
  "easeOfUse",
  "pricing",
  "support",
  "features",
  "reliability",
] as const;
export type SubRatingKey = (typeof SUB_RATING_KEYS)[number];

// ---------------------------------------------------------------------------
// Category (PRD §8.2)
// ---------------------------------------------------------------------------
export const CATEGORY_TYPES = [
  "use-case",
  "industry",
  "region",
  "feature",
  "business-size",
] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

// ---------------------------------------------------------------------------
// Review (PRD §8.3)
// ---------------------------------------------------------------------------
/** Reviewer company size buckets — distinct from Processor `companySize` (PRD §8.3). */
export const REVIEW_COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type ReviewCompanySize = (typeof REVIEW_COMPANY_SIZES)[number];

/** Monthly processing volume buckets — reused by Review + Lead (PRD §8.3 / §8.4). */
export const MONTHLY_VOLUMES = [
  "<$10k",
  "$10k-$50k",
  "$50k-$250k",
  "$250k-$1M",
  "$1M+",
] as const;
export type MonthlyVolume = (typeof MONTHLY_VOLUMES)[number];

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_SOURCES = ["web-form", "admin-entry", "import"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

// ---------------------------------------------------------------------------
// Lead (PRD §8.4)
// ---------------------------------------------------------------------------
export const LEAD_STATUSES = ["new", "contacted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// ---------------------------------------------------------------------------
// Submission (PRD §8.5)
// ---------------------------------------------------------------------------
export const SUBMISSION_STATUSES = ["new", "reviewing", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// ---------------------------------------------------------------------------
// BlogPost (PRD §8.6)
// ---------------------------------------------------------------------------
export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

// ---------------------------------------------------------------------------
// User (PRD §8.7)
// ---------------------------------------------------------------------------
export const USER_ROLES = ["admin", "editor"] as const;
export type UserRole = (typeof USER_ROLES)[number];
