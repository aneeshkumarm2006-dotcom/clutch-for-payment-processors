import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  guideArticleJsonLd,
  itemListJsonLd,
  organizationJsonLd,
  processorJsonLd,
  webSiteJsonLd,
  type ProcessorJsonLdReview,
} from "@/lib/seo";
import { defineContentType, type Crumb, type EngineContext, type Jsonld } from "@/lib/engine/types";
import { BLOCK_TYPES } from "@/lib/validators/blocks";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE CONFIG FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the ONLY file that knows what this particular site is about. Every
 * domain word — "processor", `ratingAverage`, `/compare` — appears here and
 * nowhere in `lib/engine/`. Porting the structured-data + blocks engine to a
 * different dashboard means: run the Phase-0 discovery, then rewrite this file.
 * Engine code is not touched.
 *
 * It holds four things:
 *   1. site identity            → Organization / WebSite nodes
 *   2. global SEO defaults      → fallbacks for buildMetadata
 *   3. the enabled block types  → what editors can compose with
 *   4. contentTypes             → content type ⇒ schema.org types + field mapping
 *
 * A content type's `schema[]` is a list of nodes it emits. Each rule's `build()`
 * is where this site's field names get read; the engine only ever sees the
 * generic `EngineEntity` envelope around them.
 */

// ---------------------------------------------------------------------------
// 1. Site identity
// ---------------------------------------------------------------------------

/**
 * Static identity. Anything an admin can edit (name, logo, socials) is read from
 * SiteSettings at request time and arrives as `EngineContext` — it is deliberately
 * NOT duplicated here.
 */
export const siteConfig = {
  /** Fallback only; SiteSettings.siteName wins when set. */
  name: "PayCompare",
  /** Path to the site-wide default OG image (`app/opengraph-image.tsx` renders it). */
  defaultOgImage: "/opengraph-image",
  /** Drives the WebSite SearchAction (sitelinks search box). */
  searchPath: "/search",
  searchQueryParam: "q",
} as const;

// ---------------------------------------------------------------------------
// 2. Global SEO defaults
// ---------------------------------------------------------------------------

export const seoDefaults = {
  twitterCard: "summary_large_image" as const,
  /**
   * Routes the site force-noindexes. NOTHING an admin sets can override these —
   * `buildMetadata` applies them last. `/search` and `/compare` take arbitrary
   * query strings, so letting them be indexed invites unbounded near-duplicate
   * pages; `/write-review` is a form. A prefix match, so `/write-review/stripe`
   * is covered by `/write-review`.
   */
  noindexRoutes: ["/search", "/write-review", "/compare"] as readonly string[],
  /** Ideal meta lengths. Advisory — surfaced as warnings, never enforced as errors. */
  titleLength: { min: 50, max: 60 },
  descriptionLength: { min: 150, max: 160 },
} as const;

// ---------------------------------------------------------------------------
// 3. Enabled blocks
// ---------------------------------------------------------------------------

/** Drop a type from this list to hide it from every editor. */
export const enabledBlocks = BLOCK_TYPES;

// ---------------------------------------------------------------------------
// 4. Content types → schema.org
// ---------------------------------------------------------------------------

/**
 * The normalized payloads each content type hands the engine. `lib/serialize.ts`
 * is responsible for producing exactly these shapes — see `toEngineEntity`.
 */
export interface ProcessorEngineData {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  ratingAverage?: number;
  ratingCount?: number;
  reviews?: ProcessorJsonLdReview[];
  /** Free-text pricing line, e.g. "2.9% + 30¢". Emitted as an Offer description. */
  pricingSummary?: string;
  /** Sits between "Processors" and the profile in the breadcrumb trail, when set. */
  primaryCategory?: { name: string; slug: string };
}

export interface CategoryEngineData {
  name: string;
  slug: string;
  description?: string;
  /** The processors listed on this category page, in display order. */
  items: Crumb[];
}

export interface BlogPostEngineData {
  title: string;
  slug: string;
  description?: string;
  image?: string;
  author: string;
  datePublished?: string;
  dateModified?: string;
}

export interface PageEngineData {
  title: string;
  path: string;
  description?: string;
}

const home: Crumb = { name: "Home", path: "/" };

/** Product + Offer. `Offer` is only emitted when there's a real price to state. */
const processorProduct = (
  e: { data: ProcessorEngineData },
): Jsonld | null => {
  const d = e.data;
  const node = processorJsonLd({
    name: d.name,
    slug: d.slug,
    description: d.description,
    logo: d.logo,
    ratingAverage: d.ratingAverage,
    ratingCount: d.ratingCount,
    reviews: d.reviews,
  });

  // Offer without a price is noise — schema.org wants `price` + `priceCurrency`,
  // and this site stores pricing as free text ("2.9% + 30¢"), which is not a
  // number. So we describe the offer rather than pretending to price it.
  if (d.pricingSummary) {
    node.offers = {
      "@type": "Offer",
      description: d.pricingSummary,
      ...(d.website ? { url: d.website } : {}),
      availability: "https://schema.org/InStock",
    };
  }
  return node;
};

export const contentTypes = {
  processor: defineContentType<ProcessorEngineData>({
    label: "Processor",
    schema: [
      {
        type: "Product",
        label: "Product (with rating & reviews)",
        required: ["name"],
        overridable: ["name", "description", "image", "brand", "offers"],
        build: processorProduct,
      },
      {
        type: "BreadcrumbList",
        required: ["itemListElement"],
        build: (e) =>
          breadcrumbJsonLd([
            home,
            { name: "Processors", path: "/processors" },
            ...(e.data.primaryCategory
              ? [
                  {
                    name: e.data.primaryCategory.name,
                    path: `/category/${e.data.primaryCategory.slug}`,
                  },
                ]
              : []),
            { name: e.data.name, path: e.path },
          ]),
      },
      {
        type: "FAQPage",
        label: "FAQ",
        required: ["mainEntity"],
        // Superseded by an FAQ block when the page has one — see the engine's
        // one-node-per-type rule.
        build: (e) => (e.faqs?.length ? faqJsonLd(e.faqs) : null),
      },
    ],
  }),

  category: defineContentType<CategoryEngineData>({
    label: "Category",
    schema: [
      {
        type: "ItemList",
        label: "List of processors",
        required: ["itemListElement"],
        overridable: ["name", "description"],
        build: (e) => (e.data.items.length ? itemListJsonLd(e.data.items) : null),
      },
      {
        type: "BreadcrumbList",
        required: ["itemListElement"],
        build: (e) =>
          breadcrumbJsonLd([
            home,
            { name: "Processors", path: "/processors" },
            { name: e.data.name, path: e.path },
          ]),
      },
      {
        type: "FAQPage",
        label: "FAQ",
        required: ["mainEntity"],
        build: (e) => (e.faqs?.length ? faqJsonLd(e.faqs) : null),
      },
      {
        type: "Article",
        label: "Buyers guide",
        required: ["headline"],
        overridable: ["headline", "description"],
        // Emitted only when the page carries a buyers-guide block. Distinct @type
        // from ItemList/FAQPage/BreadcrumbList, so it coexists cleanly; admins can
        // switch it off via `structuredData.disabledTypes`.
        build: (e) => {
          const guide = e.blocks?.find((b) => b.type === "buyersGuide");
          const data = (guide?.data ?? {}) as { title?: unknown; sections?: unknown };
          if (!guide || !Array.isArray(data.sections) || data.sections.length === 0) return null;
          const title = typeof data.title === "string" && data.title.trim() ? data.title : "";
          return guideArticleJsonLd({
            headline: title || `${e.data.name} buyers guide`,
            description: e.data.description,
            path: e.path,
          });
        },
      },
    ],
  }),

  blogPost: defineContentType<BlogPostEngineData>({
    label: "Blog post",
    schema: [
      {
        type: "BlogPosting",
        required: ["headline", "author"],
        overridable: ["headline", "description", "image", "author", "datePublished"],
        build: (e) =>
          articleJsonLd({
            title: e.data.title,
            slug: e.data.slug,
            description: e.data.description,
            image: e.data.image,
            author: e.data.author,
            datePublished: e.data.datePublished,
            dateModified: e.data.dateModified,
          }),
      },
      {
        type: "BreadcrumbList",
        required: ["itemListElement"],
        build: (e) =>
          breadcrumbJsonLd([home, { name: "Blog", path: "/blog" }, { name: e.data.title, path: e.path }]),
      },
      {
        type: "FAQPage",
        label: "FAQ",
        required: ["mainEntity"],
        // BlogPost has no `faqs` field — a blog post gets FAQ schema by adding an
        // FAQ block, which the engine derives. Nothing to build from here.
        build: () => null,
      },
    ],
  }),

  page: defineContentType<PageEngineData>({
    label: "Page",
    schema: [
      {
        type: "BreadcrumbList",
        required: ["itemListElement"],
        build: (e) =>
          e.path === "/"
            ? null
            : breadcrumbJsonLd([home, { name: e.data.title, path: e.path }]),
      },
      {
        type: "FAQPage",
        label: "FAQ",
        required: ["mainEntity"],
        build: (e) => (e.faqs?.length ? faqJsonLd(e.faqs) : null),
      },
    ],
  }),
} as const;

export type ContentTypeKey = keyof typeof contentTypes;

// ---------------------------------------------------------------------------
// Site-wide base schema — emitted on EVERY public page by `(public)/layout.tsx`
// ---------------------------------------------------------------------------

/**
 * Organization + WebSite, as a single `@graph` with absolute `@id`s so that
 * page-level nodes can *reference* the organization instead of each restating it.
 *
 * The `@id`s must be absolute. A bare `"#organization"` resolves against whatever
 * page it appears on, producing a different identifier per URL — which defeats the
 * entire purpose of giving them an id.
 */
export function baseGraph(ctx: EngineContext): Jsonld {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...organizationJsonLd({
          name: ctx.siteName,
          logo: ctx.logo,
          sameAs: ctx.sameAs,
          email: ctx.email,
        }),
        "@id": orgId(ctx),
        "@context": undefined,
      },
      {
        ...webSiteJsonLd({ name: ctx.siteName }),
        "@id": siteId(ctx),
        "@context": undefined,
        publisher: { "@id": orgId(ctx) },
      },
    ].map(pruneContext),
  };
}

export const orgId = (ctx: EngineContext) => `${ctx.siteUrl}/#organization`;
export const siteId = (ctx: EngineContext) => `${ctx.siteUrl}/#website`;

/** Inside an @graph the members share the envelope's @context. */
const pruneContext = (node: Jsonld): Jsonld => {
  const { "@context": _drop, ...rest } = node;
  return rest;
};

export { absoluteUrl };
