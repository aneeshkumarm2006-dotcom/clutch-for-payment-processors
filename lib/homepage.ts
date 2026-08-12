import type { IHomepage, ISiteSettings } from "@/models";

/**
 * The landing page's content model: built-in defaults + the merge that lets an
 * admin override any part of them from /admin/homepage.
 *
 * This module is the single source of truth for the homepage's default copy.
 * `app/(public)/page.tsx` renders `resolveHomepage(settings)` and holds no
 * fallback strings of its own; the admin form seeds its inputs from the same
 * call. Put a default anywhere else and the two will drift the first time
 * someone edits one of them.
 *
 * No server-only imports here — the admin form is a client component and needs
 * the same defaults.
 */

export const HOME_SECTION_KEYS = [
  "categories",
  "featured",
  "howItWorks",
  "compare",
  "blog",
  "content",
  "ctaBand",
  "faq",
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/** Admin-facing names for the reorder list. */
export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  categories: "Popular categories",
  featured: "Featured processors",
  howItWorks: "How it works",
  compare: "Compare teaser",
  blog: "From the blog",
  content: "Custom content blocks",
  ctaBand: "Call-to-action band",
  faq: "FAQs",
};

export interface ResolvedStep {
  icon: string;
  title: string;
  body: string;
}

export interface ResolvedCtaCard {
  icon: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}

export interface ResolvedSection {
  enabled: boolean;
  eyebrow: string;
  /** The section's H2. Keep it short — the keyword-carrying prose goes in `description`. */
  title: string;
  /**
   * Standfirst paragraph under the H2. This is the section's SEO body copy: the
   * H2s are deliberately two or three words, so without this the page below the
   * hero is almost entirely card labels and has nothing for a crawler to read.
   * Blank renders no paragraph at all.
   */
  description: string;
  actionLabel: string;
  actionHref: string;
  limit: number;
}

export interface ResolvedHomepage {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
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
  categories: ResolvedSection;
  featured: ResolvedSection;
  howItWorks: ResolvedSection & { steps: ResolvedStep[] };
  compare: ResolvedSection;
  blog: ResolvedSection;
  ctaBand: { enabled: boolean; cards: ResolvedCtaCard[] };
  content: { enabled: boolean; title: string };
  faq: { enabled: boolean; title: string };
  /** Section keys in render order, de-duplicated, every known key present exactly once. */
  sectionOrder: HomeSectionKey[];
}

/**
 * Built-in copy — what the homepage showed before it became editable. Changing a
 * string here changes the page for every site that has not overridden that field.
 */
export const HOMEPAGE_DEFAULTS: ResolvedHomepage = {
  hero: {
    eyebrow: "",
    title: "Payment processing guide: find the right processor",
    subtitle:
      "Compare fees, features, verified merchant reviews, and leading payment processing " +
      "platforms, all in one independent directory to help you choose the right merchant " +
      "services provider for your business.",
    searchEnabled: true,
    searchPlaceholder: "Search by name, e.g. Stripe, ACH, high-risk…",
    primaryCtaEnabled: true,
    primaryCtaLabel: "Get matched",
    secondaryCtaEnabled: true,
    secondaryCtaLabel: "See how it works",
    secondaryCtaHref: "#how-it-works",
    statsEnabled: true,
    statProcessorsLabel: "processors reviewed",
    statReviewsLabel: "verified reviews",
    statCategoriesLabel: "categories",
  },
  categories: {
    enabled: true,
    eyebrow: "Browse by need",
    title: "Popular categories",
    description:
      "Browse payment processing solutions by business type, industry, and payment needs " +
      "to quickly compare the right payment processor for your business.",
    actionLabel: "All categories",
    actionHref: "/processors",
    limit: 8,
  },
  featured: {
    enabled: true,
    eyebrow: "Editor & merchant picks",
    title: "Featured processors",
    description:
      "Compare leading payment processors based on pricing, features, payout speed, " +
      "integrations, and verified merchant reviews.",
    actionLabel: "View all processors",
    actionHref: "/processors",
    limit: 6,
  },
  howItWorks: {
    enabled: true,
    eyebrow: "How it works",
    title: "From shortlist to decision in minutes",
    description: "",
    actionLabel: "",
    actionHref: "",
    limit: 0,
    steps: [
      {
        icon: "search",
        title: "Browse",
        body: "Filter the directory by fees, payment methods, integrations, region, and use case.",
      },
      {
        icon: "compare",
        title: "Compare",
        body:
          "Compare up to four payment processors side by side based on pricing, features, " +
          "integrations, payout speed, and verified merchant reviews.",
      },
      {
        icon: "check",
        title: "Decide",
        body: "Read real reviews, check the methodology, and pick the processor that fits your business.",
      },
    ],
  },
  compare: {
    enabled: true,
    eyebrow: "Side by side",
    title: "Compare popular processors",
    description:
      "Compare popular payment processors based on pricing, features, supported payment " +
      "methods, and merchant reviews to find the right solution for your business.",
    actionLabel: "Open compare",
    actionHref: "/compare",
    // Pairs shown, not processors pulled — the page fetches 2× this many.
    limit: 3,
  },
  blog: {
    enabled: true,
    eyebrow: "Guides & comparisons",
    title: "From the blog",
    description: "",
    actionLabel: "All articles",
    actionHref: "/blog",
    limit: 3,
  },
  ctaBand: {
    enabled: true,
    cards: [
      {
        icon: "pencil",
        title: "Used a processor? Write a review",
        body: "Share your real merchant experience and help other businesses choose.",
        href: "/write-review",
        cta: "Write a review",
      },
      {
        icon: "store",
        title: "Run a payment company? Get listed",
        body: "Add your processor to the directory and reach businesses comparing options.",
        href: "/for-processors",
        cta: "List your processor",
      },
    ],
  },
  content: { enabled: true, title: "" },
  faq: { enabled: true, title: "Frequently asked questions" },
  sectionOrder: [...HOME_SECTION_KEYS],
};

/** Blank/whitespace form values mean "inherit the default", not "render nothing". */
const text = (value: unknown, fallback: string): string => {
  const s = typeof value === "string" ? value.trim() : "";
  return s === "" ? fallback : s;
};

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const count = (value: unknown, fallback: number, max: number): number => {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 0), max);
};

function section(
  stored: Record<string, unknown> | undefined | null,
  fallback: ResolvedSection,
  maxLimit: number,
): ResolvedSection {
  const s = stored ?? {};
  return {
    enabled: bool(s.enabled, fallback.enabled),
    eyebrow: text(s.eyebrow, fallback.eyebrow),
    title: text(s.title, fallback.title),
    description: text(s.description, fallback.description),
    actionLabel: text(s.actionLabel, fallback.actionLabel),
    actionHref: text(s.actionHref, fallback.actionHref),
    limit: count(s.limit, fallback.limit, maxLimit),
  };
}

/**
 * Normalize the saved order: keeps the admin's sequence, drops keys that no
 * longer exist, and appends any section the saved order predates. A section can
 * only ever be hidden by its own `enabled` flag — never by falling out of this
 * list — so adding a section in code can't silently remove it from live pages.
 */
function order(stored: unknown): HomeSectionKey[] {
  const raw = Array.isArray(stored) ? stored : [];
  const seen = new Set<HomeSectionKey>();
  const result: HomeSectionKey[] = [];
  for (const key of raw) {
    if (typeof key !== "string") continue;
    if (!(HOME_SECTION_KEYS as readonly string[]).includes(key)) continue;
    const k = key as HomeSectionKey;
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(k);
  }
  for (const k of HOME_SECTION_KEYS) if (!seen.has(k)) result.push(k);
  return result;
}

type SettingsLike = Partial<
  Pick<ISiteSettings, "homepageHeroTitle" | "homepageHeroSubtitle" | "homepage">
> | null | undefined;

/** Merge the stored landing-page config over `HOMEPAGE_DEFAULTS`. Never throws. */
export function resolveHomepage(settings: SettingsLike): ResolvedHomepage {
  const d = HOMEPAGE_DEFAULTS;
  const h: IHomepage = settings?.homepage ?? {};
  const hero = (h.hero ?? {}) as Record<string, unknown>;

  const storedSteps = Array.isArray(h.howItWorks?.steps) ? h.howItWorks!.steps! : null;
  const storedCards = Array.isArray(h.ctaBand?.cards) ? h.ctaBand!.cards! : null;

  return {
    hero: {
      eyebrow: text(hero.eyebrow, d.hero.eyebrow),
      // Hero headline/sub-headline live on the top-level settings fields — see the
      // note on IHomepage. They are required in the schema, so they're normally set.
      title: text(settings?.homepageHeroTitle, d.hero.title),
      subtitle: text(settings?.homepageHeroSubtitle, d.hero.subtitle),
      searchEnabled: bool(hero.searchEnabled, d.hero.searchEnabled),
      searchPlaceholder: text(hero.searchPlaceholder, d.hero.searchPlaceholder),
      primaryCtaEnabled: bool(hero.primaryCtaEnabled, d.hero.primaryCtaEnabled),
      primaryCtaLabel: text(hero.primaryCtaLabel, d.hero.primaryCtaLabel),
      secondaryCtaEnabled: bool(hero.secondaryCtaEnabled, d.hero.secondaryCtaEnabled),
      secondaryCtaLabel: text(hero.secondaryCtaLabel, d.hero.secondaryCtaLabel),
      secondaryCtaHref: text(hero.secondaryCtaHref, d.hero.secondaryCtaHref),
      statsEnabled: bool(hero.statsEnabled, d.hero.statsEnabled),
      statProcessorsLabel: text(hero.statProcessorsLabel, d.hero.statProcessorsLabel),
      statReviewsLabel: text(hero.statReviewsLabel, d.hero.statReviewsLabel),
      statCategoriesLabel: text(hero.statCategoriesLabel, d.hero.statCategoriesLabel),
    },
    categories: section(h.categories as never, d.categories, 24),
    featured: section(h.featured as never, d.featured, 24),
    howItWorks: {
      ...section(h.howItWorks as never, d.howItWorks, 24),
      // An admin who deletes every step gets no steps — that's a deliberate empty
      // list, not "unconfigured", so only a missing array falls back to defaults.
      steps: storedSteps
        ? storedSteps
            .map((s) => ({
              icon: text(s?.icon, ""),
              title: text(s?.title, ""),
              body: text(s?.body, ""),
            }))
            .filter((s) => s.title !== "" || s.body !== "")
        : d.howItWorks.steps,
    },
    compare: section(h.compare as never, d.compare, 12),
    blog: section(h.blog as never, d.blog, 12),
    ctaBand: {
      enabled: bool(h.ctaBand?.enabled, d.ctaBand.enabled),
      cards: storedCards
        ? storedCards
            .map((c) => ({
              icon: text(c?.icon, ""),
              title: text(c?.title, ""),
              body: text(c?.body, ""),
              href: text(c?.href, ""),
              cta: text(c?.cta, ""),
            }))
            .filter((c) => c.title !== "" && c.href !== "")
        : d.ctaBand.cards,
    },
    content: {
      enabled: bool(h.content?.enabled, d.content.enabled),
      title: text(h.content?.title, d.content.title),
    },
    faq: {
      enabled: bool(h.faq?.enabled, d.faq.enabled),
      title: text(h.faq?.title, d.faq.title),
    },
    sectionOrder: order(h.sectionOrder),
  };
}
