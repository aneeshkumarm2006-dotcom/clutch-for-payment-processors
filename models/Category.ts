import { Schema, model, models, type Model, type Types } from "mongoose";
import { CATEGORY_TYPES, type CategoryType } from "@/lib/enums";
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
import { autoSlugFrom } from "./slug";

/** Category — directory grouping (PRD §8.2). `parent` nesting is wired now but Phase 2 in the UI. */
export interface ICategory {
  name: string;
  slug: string;
  type: CategoryType;
  shortDescription?: string;
  introContent?: string;
  icon?: string;
  parent?: Types.ObjectId;
  displayOrder: number;
  isPublished: boolean;
  seo: ISeo;
  faqs?: IFaqItem[];
  /** Ordered content blocks. When non-empty these render INSTEAD of `introContent`. */
  blocks?: IBlock[];
  structuredData?: IStructuredData;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: CATEGORY_TYPES, required: true },
    shortDescription: { type: String, trim: true },
    introContent: { type: String },
    icon: { type: String, trim: true },
    parent: { type: Schema.Types.ObjectId, ref: "Category" },
    displayOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    seo: { type: SeoSchema, default: () => ({}) },
    faqs: { type: [FaqSchema], default: undefined },
    blocks: { type: [BlockSchema], default: undefined },
    structuredData: { type: StructuredDataSchema, default: undefined },
  },
  { timestamps: true },
);

CategorySchema.pre("validate", autoSlugFrom("name"));

// --- Indexes ---
CategorySchema.index({ type: 1 });
CategorySchema.index({ isPublished: 1, displayOrder: 1 });
CategorySchema.index(
  { name: "text", shortDescription: "text" },
  { weights: { name: 10, shortDescription: 2 }, name: "category_text" },
);

export const Category: Model<ICategory> =
  (models.Category as Model<ICategory>) || model<ICategory>("Category", CategorySchema);

export default Category;
