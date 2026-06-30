import { connectToDatabase } from "@/lib/db";
import { AuditLog, type AuditAction, type AuditEntity } from "@/models/AuditLog";

/**
 * Audit logging (Phase 2 — PRD §11 / §10.10; TODO_Phase2 §7.1c).
 *
 * `logAudit` records one admin mutation. It is **best-effort**: it never throws
 * and is meant to be fire-and-forgotten (`void logAudit(...)`) right after a
 * successful write, so a logging hiccup can't break the mutation itself. The DB
 * is usually already connected by the calling handler; we connect defensively.
 *
 * Snapshots (`before` / `after`) are optional and should be lean docs the caller
 * already has in hand — captured "where cheap" (PRD §7.1c). Callers are
 * responsible for stripping secrets (e.g. `passwordHash`) before passing them in
 * (see `lib/serialize.ts#redactUser`).
 */
export interface LogAuditInput {
  /** ObjectId string of the acting admin/editor (from the session). */
  actor: string;
  actorName?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel?: string;
  before?: unknown;
  after?: unknown;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await connectToDatabase();
    await AuditLog.create({
      actor: input.actor,
      actorName: input.actorName,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      before: input.before,
      after: input.after,
    });
  } catch (err) {
    // Never let auditing break a mutation — just note it server-side.
    // eslint-disable-next-line no-console
    console.error("[audit] Failed to write audit log:", err);
  }
}
