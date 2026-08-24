import { Schema, model, models, type Model } from "mongoose";

/**
 * SubmissionFingerprint — the 24h duplicate-detection window.
 *
 * One row per public submission of any verdict, holding only the hash of the
 * human-written fields (the email address is deliberately excluded — see
 * `lib/spam/fingerprint.ts`). A TTL index expires rows after 24 hours, so the
 * collection is self-cleaning and the "have I seen this exact message today?"
 * question is a single indexed lookup.
 *
 * Kept as its own collection rather than a field on Lead/Submission/Review so
 * that a REJECTED payload — which never reaches those collections — still
 * counts towards the flood window.
 */
export interface ISubmissionFingerprint {
  fingerprint: string;
  form: string;
  createdAt: Date;
}

const SubmissionFingerprintSchema = new Schema<ISubmissionFingerprint>(
  {
    fingerprint: { type: String, required: true, index: true },
    form: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

/** 24-hour TTL (see the note in BlockedSubmission about changing this later). */
SubmissionFingerprintSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const SubmissionFingerprint: Model<ISubmissionFingerprint> =
  (models.SubmissionFingerprint as Model<ISubmissionFingerprint>) ||
  model<ISubmissionFingerprint>("SubmissionFingerprint", SubmissionFingerprintSchema);

export default SubmissionFingerprint;
