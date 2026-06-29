import { z } from "zod";
import { optionalUrl, seoSchema } from "./common";

/** SiteSettings singleton editor (PRD §8.8 / §10.9). */
export const siteSettingsInput = z.object({
  siteName: z.string().trim().min(1, "Site name is required"),
  logo: optionalUrl,
  primaryColor: z.string().trim().optional(),
  homepageHeroTitle: z.string().trim().min(1, "Hero title is required"),
  homepageHeroSubtitle: z.string().trim().min(1, "Hero subtitle is required"),
  featuredCategorySlugs: z.array(z.string().trim()).default([]),
  contactEmail: z.string().trim().email("Enter a valid email"),
  socialLinks: z
    .object({
      twitter: optionalUrl,
      linkedin: optionalUrl,
      facebook: optionalUrl,
      instagram: optionalUrl,
    })
    .default({}),
  footerText: z.string().trim().optional(),
  defaultSeo: seoSchema,
});

export type SiteSettingsInput = z.infer<typeof siteSettingsInput>;
