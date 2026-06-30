import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * AuditLog (Phase 2 — PRD §11 / §10.10; TODO_Phase2 §7.1c).
 *
 * An append-only record of every admin mutation: who (`actor`) did what
 * (`action`) to which entity (`entity` + `entityId`), with optional `before` /
 * `after` snapshots. Written best-effort by `lib/audit.ts#logAudit` from the
 * mutation handlers; surfaced read-only at `/admin/audit`.
 *
 * NOT in the PRD §8 data model — this collection is a Phase 2 addition, logged
 * in NOTES.md. Snapshots are stored as loose `Mixed` (a lean doc, sanitized of
 * secrets like `passwordHash` by the caller).
 */
export type AuditAction = "create" | "update" | "delete" | "moderate";

/** The admin resources we audit. */
export type AuditEntity =
  | "processor"
  | "category"
  | "review"
  | "user"
  | "settings"
  | "blog"
  | "lead"
  | "submission";

export interface IAuditLog {
  actor: Types.ObjectId;
  /** Denormalized so the log reads cleanly even if the actor is later deleted. */
  actorName?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Short human label for the affected record (e.g. a processor name). */
  entityLabel?: string;
  before?: unknown;
  after?: unknown;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, trim: true },
    action: {
      type: String,
      enum: ["create", "update", "delete", "moderate"],
      required: true,
    },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    entityLabel: { type: String, trim: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  // Only a creation timestamp — entries are immutable.
  { timestamps: { createdAt: true, updatedAt: false } },
);

// --- Indexes ---
// Primary access pattern: the full log, newest first (the /admin/audit table).
AuditLogSchema.index({ createdAt: -1 });
// Secondary: every change to one record (entity history).
AuditLogSchema.index({ entity: 1, entityId: 1 });

export const AuditLog: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) || model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
