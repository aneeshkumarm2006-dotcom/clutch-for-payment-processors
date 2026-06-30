import { connectToDatabase } from "@/lib/db";
import { Submission } from "@/models";
import { submissionUpdate } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toAdminSubmissionData } from "@/lib/serialize";

/**
 * /api/submissions/[id] (PRD §10.7 / §12) — admin status workflow + notes.
 *   PATCH  update status (new → reviewing → approved/rejected) and/or notes.
 *   DELETE remove a submission.
 *
 * "Convert to processor" is its own action — see ./convert/route.ts.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Submission not found.");

    const data = submissionUpdate.parse(await req.json());
    const updated = await Submission.findByIdAndUpdate(params.id, { $set: data }, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Submission not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "submission",
      entityId: params.id,
      entityLabel: updated.processorName,
      after: { status: updated.status },
    });

    return json(toAdminSubmissionData(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Submission not found.");

    const deleted = await Submission.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Submission not found.");

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "submission",
      entityId: params.id,
      entityLabel: deleted.processorName,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
