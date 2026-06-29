import { connectToDatabase } from "@/lib/db";
import { Submission } from "@/models";
import { submissionInput } from "@/lib/validators";
import { ApiError, getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";
import { clientIp, isBot, rateLimit } from "@/lib/rate-limit";
import { toAdminSubmissionData } from "@/lib/serialize";
import { sendNotification } from "@/lib/email";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * /api/submissions (PRD §9.8 / §10.7 / §12).
 *
 *   POST  PUBLIC "get listed" submission. Honeypot + IP rate-limited (PRD §11);
 *         persists as `new`, then best-effort email notify.
 *   GET   ADMIN inbox (newest first).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const docs = await Submission.find().sort({ createdAt: -1 }).lean();
    return json({ items: docs.map(toAdminSubmissionData) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as Record<string, unknown>;

    // Honeypot: accept silently, never persist.
    if (isBot(raw)) {
      return json({ ok: true }, 201);
    }

    const session = await getAdminSession();
    if (!session?.user) {
      const limit = rateLimit(`submissions:${clientIp(req)}`, 5, 60_000);
      if (!limit.ok) {
        throw new ApiError(429, "You're sending requests too fast. Please try again in a minute.");
      }
    }

    await connectToDatabase();
    const data = submissionInput.parse(raw);
    const created = await Submission.create({ ...data, status: "new" });

    // Best-effort notification — never block the submission.
    void notifyNewSubmission(data);

    return json({ ok: true, id: String(created._id) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

async function notifyNewSubmission(sub: {
  processorName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  requestedTier?: string;
  description?: string;
}) {
  try {
    const to = process.env.LEADS_NOTIFY_EMAIL || (await getOrCreateSiteSettings()).contactEmail;
    if (!to) return;

    const lines = [
      `New "get listed" submission for ${sub.processorName}.`,
      `Website: ${sub.website}`,
      `Contact: ${sub.contactName} (${sub.contactEmail})`,
      sub.requestedTier ? `Requested tier: ${sub.requestedTier}` : "",
      sub.description ? `\nAbout:\n${sub.description}` : "",
    ].filter(Boolean);

    await sendNotification({
      to,
      subject: `New processor submission — ${sub.processorName}`,
      text: lines.join("\n"),
      replyTo: sub.contactEmail,
    });
  } catch {
    /* swallow — best-effort */
  }
}
