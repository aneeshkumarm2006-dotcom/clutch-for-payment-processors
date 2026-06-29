import { z } from "zod";
import {
  MONTHLY_VOLUMES,
  REVIEW_COMPANY_SIZES,
  REVIEW_SOURCES,
  REVIEW_STATUSES,
} from "@/lib/enums";
import { objectIdString } from "./common";

const star = z.coerce.number().min(1, "Rate 1–5").max(5, "Rate 1–5");

export const reviewSubRatingsSchema = z.object({
  easeOfUse: star,
  pricing: star,
  support: star,
  features: star,
  reliability: star,
});

/**
 * Public review submission (PRD §8.3 / §9.6). The API forces
 * `status: 'pending'` + `source: 'web-form'` — those are not accepted from the
 * client. Honeypot + rate limiting are applied at the route (Stage 4).
 */
export const reviewInput = z.object({
  processor: objectIdString,
  reviewerName: z.string().trim().min(1, "Your name is required"),
  reviewerTitle: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  companySize: z.enum(REVIEW_COMPANY_SIZES).optional(),
  industry: z.string().trim().optional(),
  reviewerEmail: z.string().trim().email("Enter a valid email"),
  overallRating: star,
  subRatings: reviewSubRatingsSchema,
  title: z.string().trim().min(1, "A title is required").max(140),
  body: z.string().trim().min(1, "Write a few words about your experience"),
  pros: z.string().trim().optional(),
  cons: z.string().trim().optional(),
  useCase: z.string().trim().optional(),
  monthlyVolume: z.enum(MONTHLY_VOLUMES).optional(),
});

/** Admin "Add review" entry (PRD §10.5) — may set verified + source. */
export const reviewAdminInput = reviewInput.extend({
  isVerified: z.boolean().default(false),
  source: z.enum(REVIEW_SOURCES).default("admin-entry"),
});

/** Moderation PATCH (PRD §10.5) — approve / reject / toggle verified. */
export const reviewModeration = z
  .object({
    status: z.enum(REVIEW_STATUSES),
    isVerified: z.boolean(),
    rejectionReason: z.string().trim().optional(),
  })
  .partial();

export type ReviewInput = z.infer<typeof reviewInput>;
export type ReviewAdminInput = z.infer<typeof reviewAdminInput>;
export type ReviewModerationInput = z.infer<typeof reviewModeration>;
