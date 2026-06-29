/** Form ↔ model serialization for the SettingsForm (PRD §8.8 / §10.9). */
export interface SettingsFormValues {
  siteName: string;
  logo: string;
  primaryColor: string;
  homepageHeroTitle: string;
  homepageHeroSubtitle: string;
  featuredCategorySlugs: string[];
  contactEmail: string;
  socialLinks: { twitter: string; linkedin: string; facebook: string; instagram: string };
  footerText: string;
  defaultSeo: { metaTitle: string; metaDescription: string; ogImage: string };
}

/** Structural shape that both a saved `ISiteSettings` and a lean doc satisfy. */
interface LeanSettings {
  siteName?: string;
  logo?: string;
  primaryColor?: string;
  homepageHeroTitle?: string;
  homepageHeroSubtitle?: string;
  featuredCategorySlugs?: string[];
  contactEmail?: string;
  socialLinks?: { twitter?: string; linkedin?: string; facebook?: string; instagram?: string };
  footerText?: string;
  defaultSeo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
}

const str = (v: unknown) => (v == null ? "" : String(v));

export function toSettingsFormValues(doc: LeanSettings): SettingsFormValues {
  return {
    siteName: str(doc.siteName),
    logo: str(doc.logo),
    primaryColor: str(doc.primaryColor),
    homepageHeroTitle: str(doc.homepageHeroTitle),
    homepageHeroSubtitle: str(doc.homepageHeroSubtitle),
    featuredCategorySlugs: Array.isArray(doc.featuredCategorySlugs)
      ? (doc.featuredCategorySlugs as string[])
      : [],
    contactEmail: str(doc.contactEmail),
    socialLinks: {
      twitter: str(doc.socialLinks?.twitter),
      linkedin: str(doc.socialLinks?.linkedin),
      facebook: str(doc.socialLinks?.facebook),
      instagram: str(doc.socialLinks?.instagram),
    },
    footerText: str(doc.footerText),
    defaultSeo: {
      metaTitle: str(doc.defaultSeo?.metaTitle),
      metaDescription: str(doc.defaultSeo?.metaDescription),
      ogImage: str(doc.defaultSeo?.ogImage),
    },
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v);

export function toSettingsPayload(values: SettingsFormValues): Record<string, unknown> {
  return {
    siteName: values.siteName,
    logo: blankToUndef(values.logo),
    primaryColor: blankToUndef(values.primaryColor),
    homepageHeroTitle: values.homepageHeroTitle,
    homepageHeroSubtitle: values.homepageHeroSubtitle,
    featuredCategorySlugs: values.featuredCategorySlugs,
    contactEmail: values.contactEmail,
    socialLinks: {
      twitter: blankToUndef(values.socialLinks.twitter),
      linkedin: blankToUndef(values.socialLinks.linkedin),
      facebook: blankToUndef(values.socialLinks.facebook),
      instagram: blankToUndef(values.socialLinks.instagram),
    },
    footerText: blankToUndef(values.footerText),
    defaultSeo: {
      metaTitle: blankToUndef(values.defaultSeo.metaTitle),
      metaDescription: blankToUndef(values.defaultSeo.metaDescription),
      ogImage: blankToUndef(values.defaultSeo.ogImage),
    },
  };
}
