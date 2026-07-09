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

export interface ISiteSettings {
  key: "singleton";
  siteName: string;
  logo?: string;
  primaryColor?: string;
  homepageHeroTitle: string;
  homepageHeroSubtitle: string;
  featuredCategorySlugs: string[];
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

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    // Singleton guard: enforce a single settings document.
    key: { type: String, default: "singleton", unique: true, immutable: true },
    siteName: { type: String, required: true, default: "PayCompare", trim: true },
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
    contactEmail: { type: String, required: true, default: "hello@paycompare.test", trim: true },
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
