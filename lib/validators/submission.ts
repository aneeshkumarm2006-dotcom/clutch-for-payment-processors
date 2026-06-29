import { z } from "zod";
import { LISTING_TIERS, SUBMISSION_STATUSES } from "@/lib/enums";

/** Public "get listed" submission (PRD §8.5 / §9.8). */
export const submissionInput = z.object({
  processorName: z.string().trim().min(1, "Processor name is required"),
  website: z.string().trim().url("Enter a valid website URL"),
  contactName: z.string().trim().min(1, "Contact name is required"),
  contactEmail: z.string().trim().email("Enter a valid email"),
  description: z.string().trim().optional(),
  requestedTier: z.enum(LISTING_TIERS).optional(),
});

/** Admin status / notes update (PRD §10.7). */
export const submissionUpdate = z
  .object({
    status: z.enum(SUBMISSION_STATUSES),
    notes: z.string().trim().optional(),
  })
  .partial();

export type SubmissionInput = z.infer<typeof submissionInput>;
export type SubmissionUpdateInput = z.infer<typeof submissionUpdate>;
