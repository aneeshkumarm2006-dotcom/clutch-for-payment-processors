import { connectToDatabase } from "@/lib/db";
import { OfferSignup } from "@/models";
import { offerSignupUpdate } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toAdminOfferSignupData } from "@/lib/serialize";

/**
 * /api/offer-signups/[id] — admin workflow on one captured signup.
 *   PATCH  update status (new → contacted → archived).
 *   DELETE remove it. Also the GDPR erasure path, so it is a real delete.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Signup not found.");

    const data = offerSignupUpdate.parse(await req.json());
    const updated = await OfferSignup.findByIdAndUpdate(params.id, { $set: data }, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Signup not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "offer",
      entityId: params.id,
      entityLabel: updated.email,
      after: { status: updated.status },
    });

    return json(toAdminOfferSignupData(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Signup not found.");

    const deleted = await OfferSignup.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Signup not found.");

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "offer",
      entityId: params.id,
      entityLabel: deleted.email,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
