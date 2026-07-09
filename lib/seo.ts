import type { Metadata } from "next";
import type { ISeo } from "@/models";

/**
 * SEO helpers (TODO §3.1 / PRD §13).
 *
 * `buildMetadata` produces a Next `Metadata` object from a page's title/description
 * plus an entity's optional `seo` block (overrides win, with sensible fallbacks).
 * The JSON-LD builders return plain objects rendered by `components/public/JsonLd`.
 *
 * The root layout (`app/layout.tsx`) already sets `metadataBase` + a
 * `"%s · PayCompare"` title template, so per-page titles here are the bare page
 * name (the suffix is appended automatically) unless `absoluteTitle` is set.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "PayCompare";

/** Resolve a path (or pass through an absolute URL) to an absolute URL string. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

interface BuildMetadataArgs {
  /** Page title — the brand suffix is appended via the layout template unless `absoluteTitle`. */
  title: string;
  description: string;
  /** Canonical path, e.g. `/processor/stripe`. */
  path: string;
  /** OG image (absolute URL or site-relative path). */
  image?: string;
  /** Entity `seo` block — its values override the title/description/image above. */
  seo?: Partial<ISeo> | null;
  /** Use the title verbatim (no `· PayCompare` suffix) — for the homepage. */
  absoluteTitle?: boolean;
  /** OpenGraph type (default "website"; "article" for blog posts). */
  ogType?: "website" | "article" | "profile";
  /** Optional `<meta name="keywords">` terms. */
  keywords?: string[];
}

/** Build per-page `Metadata` from page defaults + an optional entity `seo` override. */
export function buildMetadata({
  title,
  description,
  path,
  image,
  seo,
  absoluteTitle,
  ogType = "website",
  keywords,
}: BuildMetadataArgs): Metadata {
  const metaTitle = seo?.metaTitle?.trim() || title;
  const metaDescription = seo?.metaDescription?.trim() || description;
  const ogImage = seo?.ogImage?.trim() || image;
  const canonical = absoluteUrl(path);

  return {
    title: absoluteTitle ? { absolute: metaTitle } : metaTitle,
    description: metaDescription,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: canonical,
      siteName: SITE_NAME,
      type: ogType,
      ...(ogImage ? { images: [{ url: absoluteUrl(ogImage) }] } : {}),
    },
    twitter: {
      // A site-wide default OG image (`app/opengraph-image.tsx`) always exists,
      // so every card can use the large variant even when the page sets no image.
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      ...(ogImage ? { images: [absoluteUrl(ogImage)] } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// JSON-LD builders (PRD §13). Each returns a plain object; render with <JsonLd>.
// ---------------------------------------------------------------------------

type Jsonld = Record<string, unknown>;

/**
 * Organization + WebSite(SearchAction) for the homepage (PRD §13). `sameAs`
 * carries the social profiles and `email` a support `contactPoint`, so the node
 * is richer than a bare name+logo when SiteSettings provides them.
 */
export function organizationJsonLd(opts: {
  name?: string;
  logo?: string;
  sameAs?: string[];
  email?: string;
}): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: opts.name || SITE_NAME,
    url: SITE_URL,
    ...(opts.logo ? { logo: absoluteUrl(opts.logo) } : {}),
    ...(opts.sameAs && opts.sameAs.length ? { sameAs: opts.sameAs } : {}),
    ...(opts.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: opts.email,
          },
        }
      : {}),
  };
}

/** WebSite node with a SearchAction pointing at the directory search (PRD §13). */
export function webSiteJsonLd(opts: { name?: string } = {}): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: opts.name || SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** BreadcrumbList from an ordered list of crumbs (PRD §13). */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** ItemList for directory / category pages (PRD §13). */
export function itemListJsonLd(items: { name: string; path: string }[]): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  };
}

/**
 * ItemList for a pretty compare page (`/compare/a-vs-b`, PRD §13/§9.4). Lists the
 * compared processors in column order, each pointing at its profile, with the
 * comparison's name so the list reads as a head-to-head (e.g. "Stripe vs PayPal").
 */
export function comparePairJsonLd(opts: {
  name: string;
  processors: { name: string; slug: string }[];
}): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    itemListElement: opts.processors.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: absoluteUrl(`/processor/${p.slug}`),
    })),
  };
}

export interface ProcessorJsonLdReview {
  author: string;
  rating: number;
  title?: string;
  body?: string;
  datePublished?: string;
}

/**
 * Product + aggregateRating (+ optional Review[]) for a processor profile (PRD §13/§9.3).
 * Reviews are passed in by the profile page in M4; in M3 only the aggregate is present.
 */
export function processorJsonLd(opts: {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  ratingAverage?: number;
  ratingCount?: number;
  reviews?: ProcessorJsonLdReview[];
}): Jsonld {
  const hasRatings = (opts.ratingCount ?? 0) > 0 && (opts.ratingAverage ?? 0) > 0;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.logo ? { image: absoluteUrl(opts.logo) } : {}),
    brand: { "@type": "Brand", name: opts.name },
    url: absoluteUrl(`/processor/${opts.slug}`),
    ...(hasRatings
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.ratingAverage,
            reviewCount: opts.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(opts.reviews && opts.reviews.length
      ? {
          review: opts.reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            ...(r.title ? { name: r.title } : {}),
            ...(r.body ? { reviewBody: r.body } : {}),
            ...(r.datePublished ? { datePublished: r.datePublished } : {}),
          })),
        }
      : {}),
  };
}

/** Article (BlogPosting) for a blog post (PRD §13). */
export function articleJsonLd(opts: {
  title: string;
  slug: string;
  description?: string;
  image?: string;
  author: string;
  datePublished?: string;
  dateModified?: string;
}): Jsonld {
  const url = absoluteUrl(`/blog/${opts.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: absoluteUrl(opts.image) } : {}),
    author: { "@type": "Person", name: opts.author },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };
}

/**
 * FAQPage from Q&A pairs (PRD §13). Wired into the facet, alternatives, glossary,
 * and "for-processors" pages so their answer blocks are eligible for the FAQ rich
 * result. Skip rendering when the list is empty (Google rejects an empty FAQPage).
 */
export function faqJsonLd(items: { question: string; answer: string }[]): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

/**
 * Service (+ listing-tier Offers) for the "List your processor" page (PRD §13).
 * Describes the directory-listing service the site sells to processors, with each
 * pricing tier as an Offer in a hasOfferCatalog.
 */
export function serviceJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  offers?: { name: string; price?: string; description?: string }[];
}): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(opts.offers && opts.offers.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `${opts.name} plans`,
            itemListElement: opts.offers.map((o) => ({
              "@type": "Offer",
              name: o.name,
              ...(o.price !== undefined ? { price: o.price, priceCurrency: "USD" } : {}),
              ...(o.description ? { description: o.description } : {}),
            })),
          },
        }
      : {}),
  };
}

/**
 * DefinedTerm for a single glossary entry (`/glossary/<slug>`, PRD §13). Links
 * back to the site-wide DefinedTermSet so the term reads as part of the glossary.
 */
export function definedTermJsonLd(opts: {
  term: string;
  slug: string;
  definition: string;
  aka?: string[];
}): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: opts.term,
    description: opts.definition,
    ...(opts.aka && opts.aka.length ? { alternateName: opts.aka } : {}),
    url: absoluteUrl(`/glossary/${opts.slug}`),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: `${SITE_NAME} payments glossary`,
      url: absoluteUrl("/glossary"),
    },
  };
}

/** DefinedTermSet listing every glossary term (the `/glossary` hub, PRD §13). */
export function definedTermSetJsonLd(terms: { term: string; slug: string }[]): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: `${SITE_NAME} payments glossary`,
    url: absoluteUrl("/glossary"),
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      url: absoluteUrl(`/glossary/${t.slug}`),
    })),
  };
}
