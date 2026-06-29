import { Schema, model, models, type Model, type Types } from "mongoose";
import { LEAD_STATUSES, MONTHLY_VOLUMES, type LeadStatus, type MonthlyVolume } from "@/lib/enums";

/**
 * Lead (PRD §8.4) — "Get a quote / Get matched" capture, plus the contact form
 * (`source: 'contact'`). `processor` is null for generic "get matched" leads.
 * Emails are private and never exposed publicly.
 */
export interface ILead {
  processor?: Types.ObjectId;
  name: string;
  email: string;
  businessName?: string;
  phone?: string;
  monthlyVolume?: MonthlyVolume;
  businessType?: string;
  message?: string;
  status: LeadStatus;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    processor: { type: Schema.Types.ObjectId, ref: "Processor" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    businessName: { type: String, trim: true },
    phone: { type: String, trim: true },
    monthlyVolume: { type: String, enum: MONTHLY_VOLUMES },
    businessType: { type: String, trim: true },
    message: { type: String },
    status: { type: String, enum: LEAD_STATUSES, default: "new" },
    source: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

// --- Indexes ---
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ processor: 1 });

export const Lead: Model<ILead> =
  (models.Lead as Model<ILead>) || model<ILead>("Lead", LeadSchema);

export default Lead;
