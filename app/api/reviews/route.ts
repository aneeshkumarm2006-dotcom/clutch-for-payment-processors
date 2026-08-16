import { connectToDatabase } from "@/lib/db";
import { Processor, Review } from "@/models";
import { reviewInput, reviewAdminInput } from "@/lib/validators";
import { ApiError, getAdminSession, handleApiError, json } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getApprovedReviews, type ReviewSort } from "@/lib/public-data";
import { clientIp, isBot, rateLimit } from "@/lib/rate-limit";
import { recomputeProcessorRatings } from "@/lib/ratings";
import { notifyRecipients, sendNotification } from "@/lib/email";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * /api/reviews (PRD §9.6 / §10.5 / TODO §4.1–4.3).
 *
 *   GET   PUBLIC approved-only list for a processor — filter/sort/paginate. This
 *         is what the profile's reviews section calls as the user interacts.
 *         Always email-free (PRD §8.3); status is forced to "approved".
 *   POST  PUBLIC submission (honeypot + IP rate-limited) → status `pending`,
 *         source `web-form`; NEVER shown immediately. Admins instead create an
 *         `admin-entry` review that is approved on the spot (seeding/import) and
 *         triggers a ratings recompute. A public submission emails the owners
 *         (best-effort) so it doesn't sit in the moderation queue unnoticed; an
 *         admin's own entry doesn't, since they're already looking at it.
 */
export const dynamic = "force-dynamic";
/** Room for the SMTP round-trip on the public-submission path. */
export const maxDuration = 30;

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
    const processorName = await ensureProcessorExists(data.processor);
    const created = await Review.create({
      ...data,
      status: "pending",
      source: "web-form",
      isVerified: false,
    });

    await notifyNewReview({
      processorName,
      reviewerName: data.reviewerName,
      reviewerEmail: data.reviewerEmail,
      overallRating: data.overallRating,
      title: data.title,
      body: data.body,
      companyName: data.companyName,
    });

    return json({ ok: true, id: String(created._id), status: "pending" }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Reject reviews aimed at a non-existent processor with a clean 404; returns its name. */
async function ensureProcessorExists(id: string): Promise<string> {
  const proc = await Processor.findById(id).select("name").lean();
  if (!proc) throw new ApiError(404, "That processor could not be found.");
  return proc.name;
}

/**
 * Admin notification for a public review. It lands in /admin/reviews as
 * `pending` and stays invisible on the site until someone approves it, so
 * without a nudge a review can sit unmoderated for days. Same best-effort
 * contract as leads: awaited (a frozen lambda drops an unawaited send) but it
 * swallows its own errors, so it can never fail the submission.
 */
async function notifyNewReview(review: {
  processorName: string;
  reviewerName: string;
  reviewerEmail: string;
  overallRating: number;
  title: string;
  body: string;
  companyName?: string;
}) {
  try {
    let to = notifyRecipients();
    if (to.length === 0) to = notifyRecipients((await getOrCreateSiteSettings()).contactEmail);
    if (to.length === 0) return;

    const lines = [
      `New ${review.overallRating}-star review of ${review.processorName}, awaiting moderation.`,
      `From: ${review.reviewerName} (${review.reviewerEmail})`,
      review.companyName ? `Company: ${review.companyName}` : "",
      `\n${review.title}\n${review.body}`,
      `\nApprove or reject it in /admin/reviews.`,
    ].filter(Boolean);

    await sendNotification({
      to,
      subject: `New review pending: ${review.processorName} (${review.overallRating}★)`,
      text: lines.join("\n"),
      replyTo: review.reviewerEmail,
    });
  } catch {
    /* swallow — notification is best-effort */
  }
}
