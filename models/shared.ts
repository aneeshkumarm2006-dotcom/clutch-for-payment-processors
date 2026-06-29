import { Schema } from "mongoose";

/** Reusable SEO block embedded on Processor, Category, BlogPost, SiteSettings (PRD §8). */
export interface ISeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

export const SeoSchema = new Schema<ISeo>(
  {
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
  },
  { _id: false },
);
