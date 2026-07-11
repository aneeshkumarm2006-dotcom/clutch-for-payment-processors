import { Schema, model, models, type Model } from "mongoose";
import { SeoSchema, FaqSchema, type ISeo, type IFaqItem } from "./shared";

/**
 * PageSeo — editable SEO for the site's static, non-entity routes (homepage,
 * `/processors`, `/compare`, …) which have no Category/Processor record to hang
 * a `seo` block on. Each doc is keyed by a stable `pageKey`; the public pages
 * look their override up by that key and fall back to hardcoded copy when absent.
 *
 * The known keys are a fixed set (seeded once) — admins edit, not create/delete —
 * so this behaves like a small keyed settings table rather than open CRUD.
 */
export const PAGE_SEO_KEYS = ["home", "processors", "compare"] as const;
export type PageSeoKey = (typeof PAGE_SEO_KEYS)[number];

export interface IPageSeo {
  /** Stable identifier for the route, e.g. "home". Unique. */
  pageKey: string;
  /** Admin-facing label, e.g. "Homepage". */
  title: string;
  /** Canonical path the SEO applies to, e.g. "/processors". */
  path: string;
  seo: ISeo;
  faqs?: IFaqItem[];
  createdAt: Date;
  updatedAt: Date;
}

const PageSeoSchema = new Schema<IPageSeo>(
  {
    pageKey: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    seo: { type: SeoSchema, default: () => ({}) },
    faqs: { type: [FaqSchema], default: undefined },
  },
  { timestamps: true },
);

export const PageSeo: Model<IPageSeo> =
  (models.PageSeo as Model<IPageSeo>) || model<IPageSeo>("PageSeo", PageSeoSchema);

export default PageSeo;
