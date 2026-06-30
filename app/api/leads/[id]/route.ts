import { connectToDatabase } from "@/lib/db";
import { Lead } from "@/models";
import { leadUpdate } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toAdminLeadData } from "@/lib/serialize";

/**
 * /api/leads/[id] (PRD §10.6 / §12) — admin status workflow.
 *   PATCH  update status (new → contacted → closed).
 *   DELETE remove a lead.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Lead not found.");

    const data = leadUpdate.parse(await req.json());
    const updated = await Lead.findByIdAndUpdate(params.id, { $set: data }, {
      new: true,
      runValidators: true,
    })
      .populate("processor", "name slug")
      .lean();
    if (!updated) throw new ApiError(404, "Lead not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "lead",
      entityId: params.id,
      entityLabel: updated.name,
      after: { status: updated.status },
    });

    return json(toAdminLeadData(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Lead not found.");

    const deleted = await Lead.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Lead not found.");

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "lead",
      entityId: params.id,
      entityLabel: deleted.name,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
