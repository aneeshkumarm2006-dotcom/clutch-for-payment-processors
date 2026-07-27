import { Schema, model, models, type Model } from "mongoose";
import { SeoSchema, type ISeo } from "./shared";

/**
 * SiteSettings (PRD §8.8) — a singleton. Convention: there is exactly one
 * document; read with `SiteSettings.findOne()`. The `key` field + unique index
 * enforces the singleton at the DB level (only one doc with `key: 'singleton'`).
 */
export interface ISocialLinks {
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
}

/**
 * Landing-page content (edited at /admin/homepage, rendered by `app/(public)/page.tsx`).
 *
 * EVERY field here is optional and every sub-object defaults to `{}` — a settings
 * document written before this block existed must still render the homepage. The
 * resolved values (config over hardcoded defaults) come from `resolveHomepage()`
 * in `lib/homepage.ts`, which is the ONLY place the fallbacks live. Read the
 * config through it, never off `settings.homepage` directly, or the two copies of
 * the default copy will drift.
 *
 * The hero headline/sub-headline are deliberately NOT here: they stay on the
 * long-standing top-level `homepageHeroTitle`/`homepageHeroSubtitle` fields so
 * there is exactly one source of truth for them. The landing-page editor writes
 * those same two fields.
 */
export interface IHomeStep {
  /** Key into `HOME_ICONS` (lib/home-icons.ts). Unknown keys fall back to a dot. */
  icon?: string;
  title?: string;
  body?: string;
}

export interface IHomeCtaCard {
  icon?: string;
  title?: string;
  body?: string;
  href?: string;
  cta?: string;
}

/** Shared shape for the repeating "eyebrow / heading / see-all link" sections. */
export interface IHomeSection {
  enabled?: boolean;
  eyebrow?: string;
  title?: string;
  actionLabel?: string;
  actionHref?: string;
  /** How many cards the section pulls. Ignored by sections that show a fixed set. */
  limit?: number;
}

export interface IHomeHero {
  eyebrow?: string;
  searchEnabled?: boolean;
  searchPlaceholder?: string;
  primaryCtaEnabled?: boolean;
  primaryCtaLabel?: string;
  secondaryCtaEnabled?: boolean;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  statsEnabled?: boolean;
  statProcessorsLabel?: string;
  statReviewsLabel?: string;
  statCategoriesLabel?: string;
}

export interface IHomeStepsSection extends IHomeSection {
  steps?: IHomeStep[];
}

export interface IHomeCtaBand {
  enabled?: boolean;
  cards?: IHomeCtaCard[];
}

export interface IHomeSimpleSection {
  enabled?: boolean;
  title?: string;
}

export interface IHomepage {
  hero?: IHomeHero;
  categories?: IHomeSection;
  featured?: IHomeSection;
  howItWorks?: IHomeStepsSection;
  compare?: IHomeSection;
  blog?: IHomeSection;
  ctaBand?: IHomeCtaBand;
  /** Renders the "home" PageSeo record's content blocks. */
  content?: IHomeSimpleSection;
  /** Renders the "home" PageSeo record's FAQs (and their FAQPage schema). */
  faq?: IHomeSimpleSection;
  /** Render order of the sections below the hero. Unknown/missing keys are ignored. */
  sectionOrder?: string[];
}

export interface ISiteSettings {
  key: "singleton";
  siteName: string;
  logo?: string;
  primaryColor?: string;
  homepageHeroTitle: string;
  homepageHeroSubtitle: string;
  featuredCategorySlugs: string[];
  homepage?: IHomepage;
  contactEmail: string;
  socialLinks: ISocialLinks;
  footerText?: string;
  defaultSeo: ISeo;
  createdAt: Date;
  updatedAt: Date;
}

const SocialLinksSchema = new Schema<ISocialLinks>(
  {
    twitter: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true },
  },
  { _id: false },
);

const HomeStepSchema = new Schema<IHomeStep>(
  {
    icon: { type: String, trim: true },
    title: { type: String, trim: true },
    body: { type: String, trim: true },
  },
  { _id: false },
);

const HomeCtaCardSchema = new Schema<IHomeCtaCard>(
  {
    icon: { type: String, trim: true },
    title: { type: String, trim: true },
    body: { type: String, trim: true },
    href: { type: String, trim: true },
    cta: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * `enabled` has no `default: true` on purpose. `undefined` must stay
 * distinguishable from `false` so `resolveHomepage()` can read "never configured"
 * as "use the built-in default" — a schema default would rewrite history the
 * first time any unrelated settings field is saved.
 */
const homeSectionFields = {
  enabled: { type: Boolean },
  eyebrow: { type: String, trim: true },
  title: { type: String, trim: true },
  actionLabel: { type: String, trim: true },
  actionHref: { type: String, trim: true },
  limit: { type: Number, min: 0, max: 24 },
} as const;

const HomeSectionSchema = new Schema<IHomeSection>({ ...homeSectionFields }, { _id: false });

const HomeStepsSectionSchema = new Schema<IHomeStepsSection>(
  { ...homeSectionFields, steps: { type: [HomeStepSchema], default: undefined } },
  { _id: false },
);

const HomeHeroSchema = new Schema<IHomeHero>(
  {
    eyebrow: { type: String, trim: true },
    searchEnabled: { type: Boolean },
    searchPlaceholder: { type: String, trim: true },
    primaryCtaEnabled: { type: Boolean },
    primaryCtaLabel: { type: String, trim: true },
    secondaryCtaEnabled: { type: Boolean },
    secondaryCtaLabel: { type: String, trim: true },
    secondaryCtaHref: { type: String, trim: true },
    statsEnabled: { type: Boolean },
    statProcessorsLabel: { type: String, trim: true },
    statReviewsLabel: { type: String, trim: true },
    statCategoriesLabel: { type: String, trim: true },
  },
  { _id: false },
);

const HomeCtaBandSchema = new Schema<IHomeCtaBand>(
  {
    enabled: { type: Boolean },
    cards: { type: [HomeCtaCardSchema], default: undefined },
  },
  { _id: false },
);

const HomeSimpleSectionSchema = new Schema<IHomeSimpleSection>(
  {
    enabled: { type: Boolean },
    title: { type: String, trim: true },
  },
  { _id: false },
);

const HomepageSchema = new Schema<IHomepage>(
  {
    hero: { type: HomeHeroSchema, default: () => ({}) },
    categories: { type: HomeSectionSchema, default: () => ({}) },
    featured: { type: HomeSectionSchema, default: () => ({}) },
    howItWorks: { type: HomeStepsSectionSchema, default: () => ({}) },
    compare: { type: HomeSectionSchema, default: () => ({}) },
    blog: { type: HomeSectionSchema, default: () => ({}) },
    ctaBand: { type: HomeCtaBandSchema, default: () => ({}) },
    content: { type: HomeSimpleSectionSchema, default: () => ({}) },
    faq: { type: HomeSimpleSectionSchema, default: () => ({}) },
    sectionOrder: { type: [String], default: undefined },
  },
  // `minimize: false` — a sub-object whose every field is legitimately unset must
  // still come back as `{}` rather than disappear, so the admin form can bind to it.
  { _id: false, minimize: false },
);

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    // Singleton guard: enforce a single settings document.
    key: { type: String, default: "singleton", unique: true, immutable: true },
    siteName: { type: String, required: true, default: "Payment Processor Guide", trim: true },
    logo: { type: String, trim: true },
    primaryColor: { type: String, trim: true },
    homepageHeroTitle: {
      type: String,
      required: true,
      default: "Payment Processing Guide: Your Trusted Payment Processing Resource",
    },
    homepageHeroSubtitle: {
      type: String,
      required: true,
      default: "Compare fees, features, and verified merchant reviews.",
    },
    featuredCategorySlugs: { type: [String], default: [] },
    homepage: { type: HomepageSchema, default: () => ({}) },
    contactEmail: { type: String, required: true, default: "hello@paymentprocessorguide.test", trim: true },
    socialLinks: { type: SocialLinksSchema, default: () => ({}) },
    footerText: { type: String },
    defaultSeo: { type: SeoSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const SiteSettings: Model<ISiteSettings> =
  (models.SiteSettings as Model<ISiteSettings>) ||
  model<ISiteSettings>("SiteSettings", SiteSettingsSchema);

export default SiteSettings;
