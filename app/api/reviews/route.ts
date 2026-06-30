import { connectToDatabase } from "@/lib/db";
import { Processor, Review } from "@/models";
import { reviewInput, reviewAdminInput } from "@/lib/validators";
import { ApiError, getAdminSession, handleApiError, json } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getApprovedReviews, type ReviewSort } from "@/lib/public-data";
import { clientIp, isBot, rateLimit } from "@/lib/rate-limit";
import { recomputeProcessorRatings } from "@/lib/ratings";

/**
 * /api/reviews (PRD §9.6 / §10.5 / TODO §4.1–4.3).
 *
 *   GET   PUBLIC approved-only list for a processor — filter/sort/paginate. This
 *         is what the profile's reviews section calls as the user interacts.
 *         Always email-free (PRD §8.3); status is forced to "approved".
 *   POST  PUBLIC submission (honeypot + IP rate-limited) → status `pending`,
 *         source `web-form`; NEVER shown immediately. Admins instead create an
 *         `admin-entry` review that is approved on the spot (seeding/import) and
 *         triggers a ratings recompute.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const SORTS: ReviewSort[] = ["newest", "highest", "most-helpful"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const processorId = searchParams.get("processor") ?? "";
    if (!OBJECT_ID.test(processorId)) {
      throw new ApiError(400, "A valid processor id is required.");
    }

    const sortParam = searchParams.get("sort");
    const sort: ReviewSort = SORTS.includes(sortParam as ReviewSort)
      ? (sortParam as ReviewSort)
      : "newest";

    const result = await getApprovedReviews({
      processorId,
      sort,
      page: Number(searchParams.get("page")) || 1,
      industry: searchParams.get("industry") || undefined,
      verifiedOnly: searchParams.get("verifiedOnly") === "true",
      minRating: Number(searchParams.get("minRating")) || undefined,
      mention: searchParams.get("mention") || undefined,
    });

    return json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as Record<string, unknown>;

    // Honeypot: accept silently (don't reveal the trap) but never persist.
    if (isBot(raw)) {
      return json({ ok: true, status: "pending" }, 201);
    }

    const session = await getAdminSession();
    const isAdmin = !!session?.user;

    // Public submitters are rate-limited per IP (PRD §11). Admins are trusted.
    if (!isAdmin) {
      const limit = rateLimit(`reviews:${clientIp(req)}`, 5, 60_000);
      if (!limit.ok) {
        throw new ApiError(429, "You're submitting too fast. Please try again in a minute.");
      }
    }

    await connectToDatabase();

    if (isAdmin) {
      // Admin "Add review" (PRD §10.5) — trusted, approved immediately so it
      // feeds the aggregate without a second moderation step.
      const data = reviewAdminInput.parse(raw);
      await ensureProcessorExists(data.processor);
      const created = await Review.create({ ...data, status: "approved" });
      await recomputeProcessorRatings(data.processor);

      void logAudit({
        actor: session!.user.id,
        action: "create",
        entity: "review",
        entityId: String(created._id),
        entityLabel: created.title,
      });

      return json(created.toObject(), 201);
    }

    // Public submission — forced pending + web-form; not shown until approved.
    const data = reviewInput.parse(raw);
    await ensureProcessorExists(data.processor);
    const created = await Review.create({
      ...data,
      status: "pending",
      source: "web-form",
      isVerified: false,
    });

    return json({ ok: true, id: String(created._id), status: "pending" }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Reject reviews aimed at a non-existent processor with a clean 404. */
async function ensureProcessorExists(id: string) {
  const exists = await Processor.exists({ _id: id });
  if (!exists) throw new ApiError(404, "That processor could not be found.");
}
