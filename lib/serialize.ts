import type {
  BlogContentWidth,
  BlogCoverLayout,
  BlogStatus,
  BlogTemplate,
  CompanySize,
  ContractType,
  Feature,
  Integration,
  KeywordRel,
  LeadStatus,
  ListingTier,
  MonthlyVolume,
  SubmissionStatus,
  PaymentMethod,
  PayoutTime,
  PciLevel,
  PricingModel,
  ReviewCompanySize,
  ReviewSource,
  ReviewStatus,
  UserRole,
} from "@/lib/enums";
import type { AuditAction, AuditEntity } from "@/models/AuditLog";

/**
 * Server → client serialization for public components (Stage 3 / M3).
 *
 * Mongo `.lean()` / aggregation docs carry ObjectIds + Dates that can't cross the
 * Server → Client Component boundary. `toProcessorCardData` flattens a processor
 * into the plain, card-facing shape `ProcessorCard` (a client component) consumes.
 */

/** The minimal, fully-serializable processor shape a ProcessorCard needs (DESIGN §6.2). */
export interface ProcessorCardData {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  website: string;
  affiliateUrl?: string;
  tagline?: string;
  shortDescription?: string;
  ratingAverage: number;
  ratingCount: number;
  onlineCardRate?: string;
  monthlyFee?: string;
  payoutTime?: string;
  bestFor: string[];
  paymentMethods: PaymentMethod[];
  isVerified: boolean;
  isSponsored: boolean;
  listingTier: ListingTier;
}

type Lean = Record<string, unknown>;

const str = (v: unknown): string | undefined => (v == null || v === "" ? undefined : String(v));
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/** Flatten a lean Processor document into serializable card props. */
export function toProcessorCardData(doc: Lean): ProcessorCardData {
  const fees = (doc.fees ?? {}) as Record<string, unknown>;
  return {
    id: String(doc._id),
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
    logo: str(doc.logo),
    website: String(doc.website ?? ""),
    affiliateUrl: str(doc.affiliateUrl),
    tagline: str(doc.tagline),
    shortDescription: str(doc.shortDescription),
    ratingAverage: Number(doc.ratingAverage ?? 0),
    ratingCount: Number(doc.ratingCount ?? 0),
    onlineCardRate: str(fees.onlineCardRate),
    monthlyFee: str(fees.monthlyFee),
    payoutTime: str(doc.payoutTime),
    bestFor: strArr(doc.bestFor),
    paymentMethods: strArr(doc.paymentMethods) as PaymentMethod[],
    isVerified: Boolean(doc.isVerified),
    isSponsored: Boolean(doc.isSponsored),
    listingTier: (doc.listingTier as ListingTier) ?? "free",
  };
}

// ---------------------------------------------------------------------------
// Full profile shape (PRD §9.3). Everything the processor profile page renders,
// fully serializable, with populated categories flattened to {id,name,slug}.
// ---------------------------------------------------------------------------

export interface FeesData {
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

export interface SubRatingsData {
  easeOfUse: number;
  pricing: number;
  support: number;
  features: number;
  reliability: number;
}

/** Auto-derived neutral keyword chip with its mention count (PRD §8.1 / §9.3). */
export interface TopMentionData {
  keyword: string;
  count: number;
}

export interface CategoryRefData {
  id: string;
  name: string;
  slug: string;
}

export interface ProcessorDetailData extends ProcessorCardData {
  longDescription?: string;
  foundedYear?: number;
  headquarters?: string;
  companySize?: CompanySize;
  supportedRegions: string[];
  pricingModel: PricingModel[];
  pricingSummary?: string;
  fees: FeesData;
  contractType?: ContractType;
  freeTrial?: boolean;
  integrations: Integration[];
  currencies?: string;
  features: Feature[];
  pciLevel?: PciLevel;
  highRiskFriendly: boolean;
  categories: CategoryRefData[];
  industries: string[];
  pros: string[];
  cons: string[];
  screenshots: string[];
  demoVideoUrl?: string;
  subRatings: SubRatingsData;
  topMentions: TopMentionData[];
  editorScore?: number;
  seo: { metaTitle?: string; metaDescription?: string; ogImage?: string; keywords?: string[] };
  faqs?: { question: string; answer: string }[];
}

const FEE_KEYS: (keyof FeesData)[] = [
  "onlineCardRate",
  "inPersonCardRate",
  "keyedInRate",
  "internationalRate",
  "achRate",
  "monthlyFee",
  "setupFee",
  "chargebackFee",
  "monthlyMinimum",
  "pciFee",
  "earlyTerminationFee",
  "refundPolicy",
];

const num = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Flatten a lean Processor (categories populated) into the full profile shape. */
export function toProcessorDetailData(doc: Lean): ProcessorDetailData {
  const rawFees = (doc.fees ?? {}) as Record<string, unknown>;
  const fees: FeesData = {};
  for (const k of FEE_KEYS) {
    const v = str(rawFees[k]);
    if (v) fees[k] = v;
  }

  const rawSub = (doc.subRatings ?? {}) as Record<string, unknown>;
  const subRatings: SubRatingsData = {
    easeOfUse: Number(rawSub.easeOfUse ?? 0),
    pricing: Number(rawSub.pricing ?? 0),
    support: Number(rawSub.support ?? 0),
    features: Number(rawSub.features ?? 0),
    reliability: Number(rawSub.reliability ?? 0),
  };

  const topMentions: TopMentionData[] = Array.isArray(doc.topMentions)
    ? doc.topMentions
        .map((m) => m as Record<string, unknown>)
        .filter((m) => m && typeof m === "object" && m.keyword)
        .map((m) => ({ keyword: String(m.keyword), count: Number(m.count ?? 0) }))
    : [];

  const categories: CategoryRefData[] = Array.isArray(doc.categories)
    ? doc.categories
        .map((c) => c as Record<string, unknown>)
        .filter((c) => c && typeof c === "object" && "name" in c)
        .map((c) => ({ id: String(c._id), name: String(c.name), slug: String(c.slug) }))
    : [];

  const rawSeo = (doc.seo ?? {}) as Record<string, unknown>;

  return {
    ...toProcessorCardData(doc),
    longDescription: str(doc.longDescription),
    foundedYear: num(doc.foundedYear),
    headquarters: str(doc.headquarters),
    companySize: doc.companySize as CompanySize | undefined,
    supportedRegions: strArr(doc.supportedRegions),
    pricingModel: strArr(doc.pricingModel) as PricingModel[],
    pricingSummary: str(doc.pricingSummary),
    fees,
    contractType: doc.contractType as ContractType | undefined,
    freeTrial: typeof doc.freeTrial === "boolean" ? doc.freeTrial : undefined,
    integrations: strArr(doc.integrations) as Integration[],
    currencies: str(doc.currencies),
    features: strArr(doc.features) as Feature[],
    pciLevel: doc.pciLevel as PciLevel | undefined,
    highRiskFriendly: Boolean(doc.highRiskFriendly),
    categories,
    industries: strArr(doc.industries),
    pros: strArr(doc.pros),
    cons: strArr(doc.cons),
    screenshots: strArr(doc.screenshots),
    demoVideoUrl: str(doc.demoVideoUrl),
    subRatings,
    topMentions,
    editorScore: num(doc.editorScore),
    seo: {
      metaTitle: str(rawSeo.metaTitle),
      metaDescription: str(rawSeo.metaDescription),
      ogImage: str(rawSeo.ogImage),
      keywords: strArr(rawSeo.keywords),
    },
    faqs: Array.isArray(doc.faqs)
      ? (doc.faqs as Record<string, unknown>[])
          .map((f) => ({ question: str(f.question) ?? "", answer: str(f.answer) ?? "" }))
          .filter((f) => f.question !== "" && f.answer !== "")
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Review shapes (PRD §8.3 / §9.3 / §10.5).
//
// `toReviewCardData` is the PUBLIC projection — it deliberately OMITS
// `reviewerEmail` (private, never leaves the server, PRD §8.3). The processor
// profile and the public GET /api/reviews use it. `toAdminReviewData` adds the
// email + moderation fields for the admin queue.
// ---------------------------------------------------------------------------

export interface ReviewCardData {
  id: string;
  reviewerName: string;
  reviewerTitle?: string;
  companyName?: string;
  companySize?: ReviewCompanySize;
  industry?: string;
  overallRating: number;
  subRatings: SubRatingsData;
  title: string;
  body: string;
  pros?: string;
  cons?: string;
  useCase?: string;
  monthlyVolume?: MonthlyVolume;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
}

export interface AdminReviewData extends ReviewCardData {
  processorId: string;
  processorName?: string;
  reviewerEmail: string;
  status: ReviewStatus;
  rejectionReason?: string;
  source: ReviewSource;
}

function toSubRatings(raw: unknown): SubRatingsData {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    easeOfUse: Number(s.easeOfUse ?? 0),
    pricing: Number(s.pricing ?? 0),
    support: Number(s.support ?? 0),
    features: Number(s.features ?? 0),
    reliability: Number(s.reliability ?? 0),
  };
}

const iso = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
};

/** Public, email-free review projection (for the profile + public API). */
export function toReviewCardData(doc: Lean): ReviewCardData {
  return {
    id: String(doc._id),
    reviewerName: String(doc.reviewerName ?? ""),
    reviewerTitle: str(doc.reviewerTitle),
    companyName: str(doc.companyName),
    companySize: doc.companySize as ReviewCompanySize | undefined,
    industry: str(doc.industry),
    overallRating: Number(doc.overallRating ?? 0),
    subRatings: toSubRatings(doc.subRatings),
    title: String(doc.title ?? ""),
    body: String(doc.body ?? ""),
    pros: str(doc.pros),
    cons: str(doc.cons),
    useCase: str(doc.useCase),
    monthlyVolume: doc.monthlyVolume as MonthlyVolume | undefined,
    isVerified: Boolean(doc.isVerified),
    helpfulCount: Number(doc.helpfulCount ?? 0),
    createdAt: iso(doc.createdAt),
  };
}

/** Full review for the admin moderation queue (includes private email). */
export function toAdminReviewData(doc: Lean): AdminReviewData {
  const processor = doc.processor as Record<string, unknown> | string | null;
  const processorId =
    processor && typeof processor === "object" ? String(processor._id) : String(processor ?? "");
  const processorName =
    processor && typeof processor === "object" ? str(processor.name) : undefined;

  return {
    ...toReviewCardData(doc),
    processorId,
    processorName,
    reviewerEmail: String(doc.reviewerEmail ?? ""),
    status: (doc.status as ReviewStatus) ?? "pending",
    rejectionReason: str(doc.rejectionReason),
    source: (doc.source as ReviewSource) ?? "web-form",
  };
}

// ---------------------------------------------------------------------------
// Lead + Submission admin shapes (PRD §8.4 / §8.5 / §10.6 / §10.7).
// These are admin-only inboxes — there's no public projection.
// ---------------------------------------------------------------------------

export interface AdminLeadData {
  id: string;
  name: string;
  email: string;
  businessName?: string;
  phone?: string;
  monthlyVolume?: MonthlyVolume;
  businessType?: string;
  message?: string;
  status: LeadStatus;
  source: string;
  processorId?: string;
  processorName?: string;
  createdAt: string;
}

export function toAdminLeadData(doc: Lean): AdminLeadData {
  const processor = doc.processor as Record<string, unknown> | string | null | undefined;
  const processorId =
    processor && typeof processor === "object" ? String(processor._id) : str(processor);
  const processorName =
    processor && typeof processor === "object" ? str(processor.name) : undefined;

  return {
    id: String(doc._id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    businessName: str(doc.businessName),
    phone: str(doc.phone),
    monthlyVolume: doc.monthlyVolume as MonthlyVolume | undefined,
    businessType: str(doc.businessType),
    message: str(doc.message),
    status: (doc.status as LeadStatus) ?? "new",
    source: String(doc.source ?? "website"),
    processorId,
    processorName,
    createdAt: iso(doc.createdAt),
  };
}

export interface AdminSubmissionData {
  id: string;
  processorName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  description?: string;
  requestedTier?: ListingTier;
  status: SubmissionStatus;
  notes?: string;
  createdAt: string;
}

export function toAdminSubmissionData(doc: Lean): AdminSubmissionData {
  return {
    id: String(doc._id),
    processorName: String(doc.processorName ?? ""),
    website: String(doc.website ?? ""),
    contactName: String(doc.contactName ?? ""),
    contactEmail: String(doc.contactEmail ?? ""),
    description: str(doc.description),
    requestedTier: doc.requestedTier as ListingTier | undefined,
    status: (doc.status as SubmissionStatus) ?? "new",
    notes: str(doc.notes),
    createdAt: iso(doc.createdAt),
  };
}

/** Plain serializable category (for CategoryCard / mega-menu / footer). */
export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  type: string;
  shortDescription?: string;
  icon?: string;
}

export function toCategoryData(doc: Lean): CategoryData {
  return {
    id: String(doc._id),
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
    type: String(doc.type ?? "use-case"),
    shortDescription: str(doc.shortDescription),
    icon: str(doc.icon),
  };
}

// ---------------------------------------------------------------------------
// Blog shapes (PRD §8.6 / §9.9 / §10.8).
//
// `toBlogCardData` is the index/grid + "related posts" projection (no body).
// `toBlogPostData` adds the rendered HTML `content` + `seo` for the post page.
// `toAdminBlogData` is the admin list row (status + updatedAt, no body).
// ---------------------------------------------------------------------------

/** ISO string, or undefined when the date is missing (optional `publishedAt`). */
const isoOrUndef = (v: unknown): string | undefined => {
  if (v == null || v === "") return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export interface BlogCardData {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  author: string;
  tags: string[];
  publishedAt?: string;
  /** Estimated minutes to read — shown on cards when present (optional). */
  readingTimeMinutes?: number;
}

/** A keyword backlink as it crosses to the client (plain, serializable). */
export interface KeywordLinkData {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

export interface BlogPostData extends BlogCardData {
  content: string;
  /** Author-supplied alt text for the cover image (falls back to a title-based default). */
  coverImageAlt?: string;
  /** Reading-column width for the body (author layout control). */
  contentWidth: BlogContentWidth;
  /** Cover-image presentation (author layout control). */
  coverLayout: BlogCoverLayout;
  seo: { metaTitle?: string; metaDescription?: string; ogImage?: string };
  /** Keyword backlinks injected into the body on the public page. */
  keywords: KeywordLinkData[];
  /** Link only the first occurrence of each keyword vs every occurrence. */
  linkFirstOccurrenceOnly: boolean;
  views: number;
  /** Last-modified timestamp — feeds `dateModified` in the Article JSON-LD. */
  updatedAt: string;
}

export interface AdminBlogData {
  id: string;
  title: string;
  slug: string;
  author: string;
  status: BlogStatus;
  tags: string[];
  publishedAt?: string;
  updatedAt: string;
}

/** Dashboard table row for /seoteam (display + monitoring fields; no body). */
export interface SeoPostRow {
  id: string;
  title: string;
  slug: string;
  status: BlogStatus;
  template: BlogTemplate;
  tags: string[];
  views: number;
  readingTimeMinutes?: number;
  publishedAt?: string;
  updatedAt: string;
}

/** Coalesce a stored keyword array (lean docs skip schema defaults) to plain rows. */
function toKeywordLinks(v: unknown): KeywordLinkData[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((k) => k as Record<string, unknown>)
    .filter((k) => k && typeof k === "object" && k.keyword && k.url)
    .map((k) => ({
      keyword: String(k.keyword),
      url: String(k.url),
      rel: (k.rel as KeywordRel) ?? "dofollow",
    }));
}

/** Index/grid + related-post projection (omits the body). */
export function toBlogCardData(doc: Lean): BlogCardData {
  return {
    id: String(doc._id),
    title: String(doc.title ?? ""),
    slug: String(doc.slug ?? ""),
    excerpt: str(doc.excerpt),
    coverImage: str(doc.coverImage),
    author: String(doc.author ?? ""),
    tags: strArr(doc.tags),
    publishedAt: isoOrUndef(doc.publishedAt) ?? isoOrUndef(doc.createdAt),
    readingTimeMinutes: num(doc.readingTimeMinutes),
  };
}

/** Full post (adds rendered HTML content + SEO block + keyword backlinks) for the post page. */
export function toBlogPostData(doc: Lean): BlogPostData {
  const rawSeo = (doc.seo ?? {}) as Record<string, unknown>;
  return {
    ...toBlogCardData(doc),
    content: String(doc.content ?? ""),
    coverImageAlt: str(doc.coverImageAlt),
    // Lean reads skip schema defaults on pre-existing rows — default missing → "standard".
    contentWidth: doc.contentWidth === "wide" ? "wide" : "standard",
    coverLayout: doc.coverLayout === "wide" ? "wide" : "standard",
    seo: {
      metaTitle: str(rawSeo.metaTitle),
      metaDescription: str(rawSeo.metaDescription),
      ogImage: str(rawSeo.ogImage),
    },
    keywords: toKeywordLinks(doc.keywords),
    // Lean reads skip schema defaults on pre-existing rows — default missing → true.
    linkFirstOccurrenceOnly: doc.linkFirstOccurrenceOnly !== false,
    views: Number(doc.views ?? 0),
    updatedAt: iso(doc.updatedAt),
  };
}

/** Admin list row (status + updatedAt; no body). */
export function toAdminBlogData(doc: Lean): AdminBlogData {
  return {
    id: String(doc._id),
    title: String(doc.title ?? ""),
    slug: String(doc.slug ?? ""),
    author: String(doc.author ?? ""),
    status: (doc.status as BlogStatus) ?? "draft",
    tags: strArr(doc.tags),
    publishedAt: isoOrUndef(doc.publishedAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/** /seoteam dashboard row (display + monitoring; no body). */
export function toSeoPostRow(doc: Lean): SeoPostRow {
  return {
    id: String(doc._id),
    title: String(doc.title ?? ""),
    slug: String(doc.slug ?? ""),
    status: (doc.status as BlogStatus) ?? "draft",
    template: (doc.template as BlogTemplate) ?? "generic",
    tags: strArr(doc.tags),
    views: Number(doc.views ?? 0),
    readingTimeMinutes: num(doc.readingTimeMinutes),
    publishedAt: isoOrUndef(doc.publishedAt),
    updatedAt: iso(doc.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// User shapes (PRD §8.7 / §10.10 — Phase 2 Users admin).
//
// `toAdminUserData` is the management-table row. It DELIBERATELY omits
// `passwordHash` (a secret that must never cross to the client). `redactUser`
// produces the same secret-free snapshot for audit `before`/`after` capture.
// ---------------------------------------------------------------------------

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export function toAdminUserData(doc: Lean): AdminUserData {
  return {
    id: String(doc._id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    role: (doc.role as UserRole) ?? "admin",
    // Older seeded users may predate the field; treat missing as active.
    isActive: doc.isActive !== false,
    lastLoginAt: isoOrUndef(doc.lastLoginAt),
    createdAt: iso(doc.createdAt),
  };
}

/** Secret-free user snapshot for audit logs (drops `passwordHash`). */
export function redactUser(doc: Lean): Record<string, unknown> {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    isActive: doc.isActive !== false,
  };
}

// ---------------------------------------------------------------------------
// Audit log shape (Phase 2 — PRD §11 / §10.10; read-only /admin/audit table).
// ---------------------------------------------------------------------------

export interface AuditLogData {
  id: string;
  actorName: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel?: string;
  createdAt: string;
}

export function toAuditLogData(doc: Lean): AuditLogData {
  const actor = doc.actor as Record<string, unknown> | string | null | undefined;
  const populatedName =
    actor && typeof actor === "object" ? str(actor.name) ?? str(actor.email) : undefined;

  return {
    id: String(doc._id),
    actorName: populatedName ?? str(doc.actorName) ?? "Unknown",
    action: (doc.action as AuditAction) ?? "update",
    entity: (doc.entity as AuditEntity) ?? "processor",
    entityId: String(doc.entityId ?? ""),
    entityLabel: str(doc.entityLabel),
    createdAt: iso(doc.createdAt),
  };
}
