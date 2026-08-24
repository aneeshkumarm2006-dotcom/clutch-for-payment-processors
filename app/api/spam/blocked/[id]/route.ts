import { connectToDatabase } from "@/lib/db";
import { BlockedSubmission } from "@/models";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";

/**
 * DELETE /api/spam/blocked/[id] — remove one row from the blocked bin.
 *
 * Manual tidying only. The bin already empties itself after 30 days via the TTL
 * index, so this exists for the "I've looked at it, it's junk, get it out of my
 * view" case rather than as the primary cleanup path.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Not found.");

    await connectToDatabase();
    const deleted = await BlockedSubmission.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Not found.");

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
