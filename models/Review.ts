import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  MONTHLY_VOLUMES,
  REVIEW_COMPANY_SIZES,
  REVIEW_SOURCES,
  REVIEW_STATUSES,
  type MonthlyVolume,
  type ReviewCompanySize,
  type ReviewSource,
  type ReviewStatus,
} from "@/lib/enums";

/**
 * Review (PRD §8.3). Submitted via the public form as `pending`; only `approved`
 * reviews are displayed and feed the denormalized Processor ratings (Stage 2/M4).
 * `reviewerEmail` is private — never returned on public endpoints.
 */
export interface IReviewSubRatings {
  easeOfUse: number;
  pricing: number;
  support: number;
  features: number;
  reliability: number;
}

export interface IReview {
  processor: Types.ObjectId;
  reviewerName: string;
  reviewerTitle?: string;
  companyName?: string;
  companySize?: ReviewCompanySize;
  industry?: string;
  reviewerEmail: string;
  overallRating: number;
  subRatings: IReviewSubRatings;
  title: string;
  body: string;
  pros?: string;
  cons?: string;
  useCase?: string;
  monthlyVolume?: MonthlyVolume;
  status: ReviewStatus;
  isVerified: boolean;
  rejectionReason?: string;
  helpfulCount: number;
  source: ReviewSource;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSubRatingsSchema = new Schema<IReviewSubRatings>(
  {
    easeOfUse: { type: Number, required: true, min: 1, max: 5 },
    pricing: { type: Number, required: true, min: 1, max: 5 },
    support: { type: Number, required: true, min: 1, max: 5 },
    features: { type: Number, required: true, min: 1, max: 5 },
    reliability: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false },
);

const ReviewSchema = new Schema<IReview>(
  {
    processor: { type: Schema.Types.ObjectId, ref: "Processor", required: true },
    reviewerName: { type: String, required: true, trim: true },
    reviewerTitle: { type: String, trim: true },
    companyName: { type: String, trim: true },
    companySize: { type: String, enum: REVIEW_COMPANY_SIZES },
    industry: { type: String, trim: true },
    reviewerEmail: { type: String, required: true, trim: true, lowercase: true },
    overallRating: { type: Number, required: true, min: 1, max: 5 },
    subRatings: { type: ReviewSubRatingsSchema, required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    pros: { type: String },
    cons: { type: String },
    useCase: { type: String },
    monthlyVolume: { type: String, enum: MONTHLY_VOLUMES },
    status: { type: String, enum: REVIEW_STATUSES, default: "pending" },
    isVerified: { type: Boolean, default: false },
    rejectionReason: { type: String, trim: true },
    helpfulCount: { type: Number, default: 0, min: 0 },
    source: { type: String, enum: REVIEW_SOURCES, default: "web-form" },
  },
  { timestamps: true },
);

// --- Indexes ---
// Primary access pattern: approved reviews for a processor, newest first.
ReviewSchema.index({ processor: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 });

export const Review: Model<IReview> =
  (models.Review as Model<IReview>) || model<IReview>("Review", ReviewSchema);

export default Review;
