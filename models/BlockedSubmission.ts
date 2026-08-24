import { Schema, model, models, type Model } from "mongoose";

/**
 * BlockedSubmission — the bin behind every hard rejection.
 *
 * Nothing is ever rejected without a copy landing here. That is the only reason
 * rejecting is allowed at all: a hard filter with no bin turns one false
 * positive into a destroyed customer that nobody ever finds out about. The bin
 * is what earns the right to reject anything.
 *
 * Rows self-destruct after 30 days via a TTL index on `createdAt`, so the bin
 * cannot grow without bound and old junk does not need manual purging.
 *
 * `payload` is the raw submitted body, stored loose (`Schema.Types.Mixed`) — the
 * whole point is to keep exactly what arrived, including the fields that failed
 * validation, so an operator can see what was really sent.
 */

/** Which public form produced it. Mirrors `SpamFormKind`. */
export const BLOCKED_FORMS = ["lead", "offer", "submission", "review"] as const;
export type BlockedForm = (typeof BLOCKED_FORMS)[number];

export interface IBlockedSubmission {
  form: BlockedForm;
  payload: Record<string, unknown>;
  score: number;
  category: string;
  /** Plain-English reasons, in the operator's words, not rule codes. */
  reasons: string[];
  /** Machine codes, kept alongside for auditing a rule change. */
  codes: string[];
  ip?: string;
  /** /24 (IPv4) or /48 (IPv6) neighbourhood — what the rotation limit keys on. */
  network?: string;
  userAgent?: string;
  /** Duplicate-detection hash of the human-written fields (email excluded). */
  fingerprint?: string;
  /** Set when an operator pulls it back out as a false positive. */
  restoredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlockedSubmissionSchema = new Schema<IBlockedSubmission>(
  {
    form: { type: String, enum: BLOCKED_FORMS, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    score: { type: Number, required: true, default: 0 },
    category: { type: String, required: true, default: "unknown" },
    reasons: { type: [String], default: [] },
    codes: { type: [String], default: [] },
    ip: { type: String, trim: true },
    network: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    fingerprint: { type: String, trim: true, index: true },
    restoredAt: { type: Date },
  },
  { timestamps: true },
);

// --- Indexes ---
BlockedSubmissionSchema.index({ createdAt: -1 });
BlockedSubmissionSchema.index({ form: 1, createdAt: -1 });
/**
 * 30-day TTL. Mongo's background reaper reads this from the index options, so
 * changing the number here does NOT update an index that already exists —
 * `collMod` or a drop/recreate is needed for that. Noted so a future change to
 * the retention window isn't silently a no-op.
 */
BlockedSubmissionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const BlockedSubmission: Model<IBlockedSubmission> =
  (models.BlockedSubmission as Model<IBlockedSubmission>) ||
  model<IBlockedSubmission>("BlockedSubmission", BlockedSubmissionSchema);

export default BlockedSubmission;
