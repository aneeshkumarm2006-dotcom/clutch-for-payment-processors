import { connectToDatabase } from "@/lib/db";
import { Review } from "@/models";
import { ApiError, handleApiError, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/reviews/[id]/helpful (PRD §9.3 — "Helpful (N)" button).
 *
 * Public, approved-reviews only. One-vote-per-visitor is enforced client-side
 * (localStorage); this endpoint adds a light IP rate-limit as a floor against
 * scripted inflation, then atomically `$inc`s `helpfulCount`.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Review not found.");

    const limit = rateLimit(`helpful:${clientIp(req)}`, 30, 60_000);
    if (!limit.ok) throw new ApiError(429, "Too many votes. Please slow down.");

    await connectToDatabase();
    const updated = await Review.findOneAndUpdate(
      { _id: params.id, status: "approved" },
      { $inc: { helpfulCount: 1 } },
      { new: true },
    )
      .select("helpfulCount")
      .lean();

    if (!updated) throw new ApiError(404, "Review not found.");
    return json({ helpfulCount: Number(updated.helpfulCount ?? 0) });
  } catch (err) {
    return handleApiError(err);
  }
}
