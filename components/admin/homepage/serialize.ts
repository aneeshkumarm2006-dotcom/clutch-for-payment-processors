import {
  HOMEPAGE_DEFAULTS,
  HOME_SECTION_KEYS,
  resolveHomepage,
  type HomeSectionKey,
} from "@/lib/homepage";
import type { IHomepage, ISiteSettings } from "@/models";
import {
  toPageSeoFormValues,
  toPageSeoPayload,
  type PageSeoFormValues,
} from "@/components/admin/page-seo/serialize";

/**
 * Form ↔ model serialization for the landing-page editor.
 *
 * The guiding rule: a text input is seeded with the STORED value, never the
 * resolved one, and shows the built-in default as its placeholder. Pre-filling
 * inputs with defaults would bake today's default copy into the document on the
 * first save, and blanking a field would then no longer restore it — the
 * "inherit the default" state would become unreachable through the UI.
 *
 * The `seo`/`faqs`/`blocks`/`structuredData` keys mirror `PageSeoFormValues`
 * exactly so `SeoPanel`, `FaqField`, `BlockEditor` and `StructuredDataPanel`
 * bind to this form unchanged; they save to `/api/page-seo/[id]`, everything
 * else to `/api/settings/homepage`.
 */
export interface HomeSectionFormValues {
  enabled: boolean;
  eyebrow: string;
  title: string;
  actionLabel: string;
  actionHref: string;
  /** Kept as a string — an empty number input yields NaN, which RHF can't round-trip. */
  limit: string;
}

export interface HomeStepFormValues {
  icon: string;
  title: string;
  body: string;
}

export interface HomeCtaCardFormValues {
  icon: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}

export interface HomepageFormValues extends PageSeoFormValues {
  homepageHeroTitle: string;
  homepageHeroSubtitle: string;
  featuredCategorySlugs: string[];
  hero: {
    eyebrow: string;
    searchEnabled: boolean;
    searchPlaceholder: string;
    primaryCtaEnabled: boolean;
    primaryCtaLabel: string;
    secondaryCtaEnabled: boolean;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    statsEnabled: boolean;
    statProcessorsLabel: string;
    statReviewsLabel: string;
    statCategoriesLabel: string;
  };
  categories: HomeSectionFormValues;
  featured: HomeSectionFormValues;
  howItWorks: HomeSectionFormValues & { steps: HomeStepFormValues[] };
  compare: HomeSectionFormValues;
  blog: HomeSectionFormValues;
  ctaBand: { enabled: boolean; cards: HomeCtaCardFormValues[] };
  content: { enabled: boolean; title: string };
  faq: { enabled: boolean; title: string };
  sectionOrder: HomeSectionKey[];
}

const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");

function sectionValues(
  stored: Record<string, unknown> | undefined,
  resolvedEnabled: boolean,
): HomeSectionFormValues {
  const s = stored ?? {};
  return {
    enabled: resolvedEnabled,
    eyebrow: str(s.eyebrow),
    title: str(s.title),
    actionLabel: str(s.actionLabel),
    actionHref: str(s.actionHref),
    limit: num(s.limit),
  };
}

type SettingsLike = Partial<
  Pick<ISiteSettings, "homepageHeroTitle" | "homepageHeroSubtitle" | "featuredCategorySlugs" | "homepage">
>;

export function toHomepageFormValues(
  settings: SettingsLike | null | undefined,
  pageSeoDoc: Record<string, unknown> | null | undefined,
): HomepageFormValues {
  const stored: IHomepage = settings?.homepage ?? {};
  const resolved = resolveHomepage(settings);
  const hero = (stored.hero ?? {}) as Record<string, unknown>;

  return {
    homepageHeroTitle: str(settings?.homepageHeroTitle) || HOMEPAGE_DEFAULTS.hero.title,
    homepageHeroSubtitle: str(settings?.homepageHeroSubtitle) || HOMEPAGE_DEFAULTS.hero.subtitle,
    featuredCategorySlugs: Array.isArray(settings?.featuredCategorySlugs)
      ? [...settings!.featuredCategorySlugs!]
      : [],
    hero: {
      eyebrow: str(hero.eyebrow),
      searchEnabled: resolved.hero.searchEnabled,
      searchPlaceholder: str(hero.searchPlaceholder),
      primaryCtaEnabled: resolved.hero.primaryCtaEnabled,
      primaryCtaLabel: str(hero.primaryCtaLabel),
      secondaryCtaEnabled: resolved.hero.secondaryCtaEnabled,
      secondaryCtaLabel: str(hero.secondaryCtaLabel),
      secondaryCtaHref: str(hero.secondaryCtaHref),
      statsEnabled: resolved.hero.statsEnabled,
      statProcessorsLabel: str(hero.statProcessorsLabel),
      statReviewsLabel: str(hero.statReviewsLabel),
      statCategoriesLabel: str(hero.statCategoriesLabel),
    },
    categories: sectionValues(stored.categories as never, resolved.categories.enabled),
    featured: sectionValues(stored.featured as never, resolved.featured.enabled),
    howItWorks: {
      ...sectionValues(stored.howItWorks as never, resolved.howItWorks.enabled),
      // Repeatable rows are the exception to the "seed from stored" rule: there's
      // no placeholder to hint a default row with, so an unconfigured list starts
      // from the built-in copy and is edited from there.
      steps: resolved.howItWorks.steps.map((s) => ({
        icon: str(s.icon),
        title: str(s.title),
        body: str(s.body),
      })),
    },
    compare: sectionValues(stored.compare as never, resolved.compare.enabled),
    blog: sectionValues(stored.blog as never, resolved.blog.enabled),
    ctaBand: {
      enabled: resolved.ctaBand.enabled,
      cards: resolved.ctaBand.cards.map((c) => ({
        icon: str(c.icon),
        title: str(c.title),
        body: str(c.body),
        href: str(c.href),
        cta: str(c.cta),
      })),
    },
    content: { enabled: resolved.content.enabled, title: str(stored.content?.title) },
    faq: { enabled: resolved.faq.enabled, title: str(stored.faq?.title) },
    sectionOrder: resolved.sectionOrder,
    ...toPageSeoFormValues(pageSeoDoc ?? {}),
  };
}

const sectionPayload = (v: HomeSectionFormValues) => ({
  enabled: v.enabled,
  eyebrow: v.eyebrow,
  title: v.title,
  actionLabel: v.actionLabel,
  actionHref: v.actionHref,
  limit: v.limit,
});

/** Payload for `PUT /api/settings/homepage`. Blank strings are dropped by the validator. */
export function toHomepagePayload(values: HomepageFormValues): Record<string, unknown> {
  const order = values.sectionOrder?.length ? values.sectionOrder : [...HOME_SECTION_KEYS];
  return {
    homepageHeroTitle: values.homepageHeroTitle,
    homepageHeroSubtitle: values.homepageHeroSubtitle,
    featuredCategorySlugs: values.featuredCategorySlugs ?? [],
    homepage: {
      hero: { ...values.hero },
      categories: sectionPayload(values.categories),
      featured: sectionPayload(values.featured),
      howItWorks: { ...sectionPayload(values.howItWorks), steps: values.howItWorks.steps ?? [] },
      compare: sectionPayload(values.compare),
      blog: sectionPayload(values.blog),
      ctaBand: { enabled: values.ctaBand.enabled, cards: values.ctaBand.cards ?? [] },
      content: { enabled: values.content.enabled, title: values.content.title },
      faq: { enabled: values.faq.enabled, title: values.faq.title },
      sectionOrder: order,
    },
  };
}

/** Payload for `PUT /api/page-seo/[id]` — the SEO/FAQ/blocks half of this form. */
export function toHomepageSeoPayload(values: HomepageFormValues): Record<string, unknown> {
  return toPageSeoPayload({
    seo: values.seo,
    faqs: values.faqs,
    blocks: values.blocks,
    structuredData: values.structuredData,
  });
}
