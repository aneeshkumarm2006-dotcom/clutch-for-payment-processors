import { z } from "zod";
import { LEAD_STATUSES, MONTHLY_VOLUMES } from "@/lib/enums";
import { objectIdString } from "./common";

/** Public lead / quote capture (PRD §8.4 / §9.10). Also backs the contact form (source: 'contact'). */
export const leadInput = z.object({
  processor: objectIdString.optional(),
  name: z.string().trim().min(1, "Your name is required"),
  email: z.string().trim().email("Enter a valid email"),
  businessName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  monthlyVolume: z.enum(MONTHLY_VOLUMES).optional(),
  businessType: z.string().trim().optional(),
  message: z.string().trim().optional(),
  source: z.string().trim().min(1).default("website"),
});

/** Admin status update (PRD §10.6). */
export const leadUpdate = z.object({
  status: z.enum(LEAD_STATUSES),
});

export type LeadInput = z.infer<typeof leadInput>;
export type LeadUpdateInput = z.infer<typeof leadUpdate>;
