import { Schema, model, models, type Model } from "mongoose";
import {
  LISTING_TIERS,
  SUBMISSION_STATUSES,
  type ListingTier,
  type SubmissionStatus,
} from "@/lib/enums";

/**
 * Submission (PRD §8.5) — "For Processors / get-listed" requests. On approval an
 * admin converts a submission into a Processor draft (Stage 5).
 */
export interface ISubmission {
  processorName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  description?: string;
  requestedTier?: ListingTier;
  status: SubmissionStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    processorName: { type: String, required: true, trim: true },
    website: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String },
    requestedTier: { type: String, enum: LISTING_TIERS },
    status: { type: String, enum: SUBMISSION_STATUSES, default: "new" },
    notes: { type: String },
  },
  { timestamps: true },
);

// --- Indexes ---
SubmissionSchema.index({ status: 1, createdAt: -1 });

export const Submission: Model<ISubmission> =
  (models.Submission as Model<ISubmission>) ||
  model<ISubmission>("Submission", SubmissionSchema);

export default Submission;
