import { connectToDatabase } from "@/lib/db";
import { Review } from "@/models";
import { reviewModeration } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { recomputeProcessorRatings } from "@/lib/ratings";
import { toAdminReviewData } from "@/lib/serialize";

/**
 * /api/reviews/[id] (PRD §10.5 / TODO §4.2) — admin moderation.
 *
 *   GET    single review (full, incl. private email) for the detail dialog.
 *   PATCH  approve / reject (+reason) / toggle verified. Any change to the
 *          approved-review set re-runs `lib/ratings.ts` so the processor's
 *          ratingAverage/subRatings/ratingCount stay in lockstep.
 *   DELETE remove + recompute (an approved review leaving the set lowers counts).
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Review not found.");

    const doc = await Review.findById(params.id).populate("processor", "name slug").lean();
    if (!doc) throw new ApiError(404, "Review not found.");
    return json(toAdminReviewData(doc));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Review not found.");

    const data = reviewModeration.parse(await req.json());

    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.isVerified !== undefined) patch.isVerified = data.isVerified;
    // Clear the reason when not rejecting; keep/set it when we are.
    if (data.status !== undefined) {
      patch.rejectionReason = data.status === "rejected" ? data.rejectionReason ?? "" : "";
    } else if (data.rejectionReason !== undefined) {
      patch.rejectionReason = data.rejectionReason;
    }

    const updated = await Review.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true, runValidators: true },
    )
      .populate("processor", "name slug")
      .lean();
    if (!updated) throw new ApiError(404, "Review not found.");

    // The aggregate depends only on the *approved* set, so recompute whenever the
    // status moved (approve / un-approve / reject). A verified-only toggle can't
    // change the average and is skipped.
    if (data.status !== undefined) {
      const processor = updated.processor as unknown as { _id?: unknown };
      await recomputeProcessorRatings(String(processor?._id ?? updated.processor));
    }

    void logAudit({
      actor: session.user.id,
      action: "moderate",
      entity: "review",
      entityId: params.id,
      entityLabel: updated.title,
      after: { status: updated.status, isVerified: updated.isVerified },
    });

    return json(toAdminReviewData(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Review not found.");

    const deleted = await Review.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Review not found.");

    // If it was approved, its removal changes the aggregate.
    if (deleted.status === "approved") {
      await recomputeProcessorRatings(String(deleted.processor));
    }

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "review",
      entityId: params.id,
      entityLabel: deleted.title,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
