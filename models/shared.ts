import { Schema } from "mongoose";

/** Reusable SEO block embedded on Processor, Category, BlogPost, SiteSettings (PRD §8). */
export interface ISeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  /** `<meta name="keywords">` terms. Ignored by Google, kept for other engines/tools. */
  keywords?: string[];
}

export const SeoSchema = new Schema<ISeo>(
  {
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    keywords: { type: [String], default: undefined },
  },
  { _id: false },
);

/**
 * A single FAQ Q&A pair. Embedded (as an array) on Category, Processor, and
 * PageSeo. Rendered as a visible FAQ section AND emitted as FAQPage JSON-LD.
 */
export interface IFaqItem {
  question: string;
  answer: string;
}

export const FaqSchema = new Schema<IFaqItem>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);
