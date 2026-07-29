import { Schema, model, models, type Model } from "mongoose";
import {
  SeoSchema,
  FaqSchema,
  BlockSchema,
  StructuredDataSchema,
  type ISeo,
  type IFaqItem,
  type IBlock,
  type IStructuredData,
} from "./shared";

/**
 * PageSeo — the DB record behind every page that has no Category/Processor of
 * its own. It serves two `kind`s:
 *
 *   - `route`   — a page that already exists in code (`/`, `/processors`,
 *                 `/compare`, `/glossary`, `/payment-processors/ach`, …). The
 *                 route renders itself; this record supplies its meta, FAQs and
 *                 an editorial block slot. `pageKey`/`path` are fixed at seed
 *                 time and the admin can edit but not create or delete these.
 *   - `landing` — a standalone SEO landing page with NO code behind it. It is
 *                 created in the admin, lives at a root-level `path`, and is
 *                 rendered entirely from `heading` + `blocks` by
 *                 `app/(public)/[landing]/page.tsx`. Admins create and delete
 *                 these freely, which is the whole point: a new landing page is
 *                 content, not a deploy.
 *
 * `path` is unique as well as `pageKey` — two records claiming one URL would
 * make which of them renders depend on Mongo's natural order.
 */

/**
 * The `route` records the code expects to exist. Seeded by `npm run seed:seo`;
 * a page falls back to its own hardcoded copy when its record is missing, so
 * this list is a convenience for the seed, never a runtime requirement.
 */
export const PAGE_SEO_KEYS = [
  "home",
  "processors",
  "compare",
  "glossary",
  "payment-processors-ach",
] as const;
export type PageSeoKey = (typeof PAGE_SEO_KEYS)[number];

export const PAGE_SEO_KINDS = ["route", "landing"] as const;
export type PageSeoKind = (typeof PAGE_SEO_KINDS)[number];

export interface IPageSeo {
  /** Stable identifier for the route, e.g. "home". Unique. */
  pageKey: string;
  /** Admin-facing label, e.g. "Homepage". */
  title: string;
  /** Canonical path the SEO applies to, e.g. "/processors". Unique. */
  path: string;
  /** `route` = SEO for a coded page; `landing` = a page that is only this record. */
  kind: PageSeoKind;
  /**
   * Landing pages only: the visible `<h1>`. Deliberately separate from `title`,
   * which is the admin-facing label, and from `seo.metaTitle`, which is the SERP
   * headline — an H1 that reads well on the page rarely reads well in a SERP.
   */
  heading?: string;
  /** Landing pages only: the lede paragraph under the H1. Plain text. */
  subheading?: string;
  /**
   * Landing pages only: unpublished pages 404 and stay out of the sitemap.
   * `route` records ignore this — their page exists either way.
   */
  isPublished: boolean;
  seo: ISeo;
  faqs?: IFaqItem[];
  /** Ordered content blocks, rendered in the page's editorial slot. */
  blocks?: IBlock[];
  structuredData?: IStructuredData;
  createdAt: Date;
  updatedAt: Date;
}

const PageSeoSchema = new Schema<IPageSeo>(
  {
    pageKey: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    path: { type: String, required: true, unique: true, trim: true },
    kind: { type: String, enum: PAGE_SEO_KINDS, default: "route", index: true },
    heading: { type: String, trim: true },
    subheading: { type: String, trim: true },
    isPublished: { type: Boolean, default: true, index: true },
    seo: { type: SeoSchema, default: () => ({}) },
    faqs: { type: [FaqSchema], default: undefined },
    blocks: { type: [BlockSchema], default: undefined },
    structuredData: { type: StructuredDataSchema, default: undefined },
  },
  { timestamps: true },
);

export const PageSeo: Model<IPageSeo> =
  (models.PageSeo as Model<IPageSeo>) || model<IPageSeo>("PageSeo", PageSeoSchema);

export default PageSeo;
