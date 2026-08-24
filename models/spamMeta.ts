import { Schema } from "mongoose";

/**
 * The classifier's verdict, stored alongside anything it let through.
 *
 * Only `allow` and `quarantine` are ever persisted here — a `reject` never
 * reaches the main collection at all, it goes to `BlockedSubmission`.
 *
 * `reasons` is plain English, not rule codes, and it is shown verbatim in the
 * admin: an operator who cannot see WHY something was flagged cannot correct
 * it. `codes` keeps the machine-readable side for auditing a rule change.
 *
 * `clearedAt` records a human pressing "Not spam". The backfill script must
 * never override a row that carries it — a machine does not get to reverse a
 * call a person already made by hand.
 */
export interface ISpamMeta {
  verdict: "allow" | "quarantine";
  score: number;
  category: string;
  reasons: string[];
  codes: string[];
  fingerprint?: string;
  ip?: string;
  network?: string;
  classifiedAt: Date;
  /** Set when an operator marks it "Not spam". */
  clearedAt?: Date;
  clearedBy?: string;
}

export const SpamMetaSchema = new Schema<ISpamMeta>(
  {
    verdict: { type: String, enum: ["allow", "quarantine"], required: true, default: "allow" },
    score: { type: Number, required: true, default: 0 },
    category: { type: String, default: "clean" },
    reasons: { type: [String], default: [] },
    codes: { type: [String], default: [] },
    fingerprint: { type: String, trim: true },
    ip: { type: String, trim: true },
    network: { type: String, trim: true },
    classifiedAt: { type: Date, default: () => new Date() },
    clearedAt: { type: Date },
    clearedBy: { type: String, trim: true },
  },
  { _id: false },
);
