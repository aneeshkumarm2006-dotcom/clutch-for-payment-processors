import { z } from "zod";
import { CATEGORY_TYPES } from "@/lib/enums";
import { objectIdString, seoSchema, slugField, faqsSchema } from "./common";
import { blocksSchema, structuredDataSchema } from "./blocks";

/** Writable Category fields (PRD §8.2 / §10.4). */
export const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: slugField.optional(),
  type: z.enum(CATEGORY_TYPES),
  shortDescription: z.string().trim().optional(),
  introContent: z.string().optional(),
  icon: z.string().trim().optional(),
  parent: objectIdString.optional(),
  displayOrder: z.coerce.number().int().default(0),
  isPublished: z.boolean().default(false),
  seo: seoSchema,
  faqs: faqsSchema,
  blocks: blocksSchema,
  structuredData: structuredDataSchema,
});

export const categoryUpdate = categoryInput.partial();

export type CategoryInput = z.infer<typeof categoryInput>;
