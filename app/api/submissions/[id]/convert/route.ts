import { connectToDatabase } from "@/lib/db";
import { Processor, Submission } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/submissions/[id]/convert (PRD §10.7) — "Convert to processor".
 *
 * Creates a Processor DRAFT pre-filled from the submission fields (name,
 * website, short description, requested tier) and marks the submission
 * `approved`. Returns the new processor id so the admin UI can jump straight to
 * its edit form to finish the listing. Idempotency note: a submission that's
 * already `approved` can still be converted again (creates another draft) — the
 * admin chooses; we don't silently block.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Submission not found.");

    const submission = await Submission.findById(params.id).lean();
    if (!submission) throw new ApiError(404, "Submission not found.");

    const slug = await ensureUniqueSlug(Processor, submission.processorName);
    const created = await Processor.create({
      name: submission.processorName,
      slug,
      website: submission.website,
      shortDescription: submission.description,
      listingTier: submission.requestedTier ?? "free",
      isPublished: false, // always a draft — admin completes + publishes
    });

    await Submission.findByIdAndUpdate(params.id, { $set: { status: "approved" } });

    // Audit the meaningful outcome: a new processor draft created via conversion
    // (the submission's flip to `approved` is a side effect of this same action).
    void logAudit({
      actor: session.user.id,
      action: "create",
      entity: "processor",
      entityId: String(created._id),
      entityLabel: created.name,
    });

    return json({ ok: true, processorId: String(created._id) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
