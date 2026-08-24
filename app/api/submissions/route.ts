import { connectToDatabase } from "@/lib/db";
import { Submission } from "@/models";
import { submissionInput } from "@/lib/validators";
import { ApiError, getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";
import { decoyId, guardSubmission } from "@/lib/spam/guard";
import { toAdminSubmissionData } from "@/lib/serialize";
import { notifyRecipients, sendNotification } from "@/lib/email";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * /api/submissions (PRD §9.8 / §10.7 / §12).
 *
 *   POST  PUBLIC "get listed" submission. Honeypot + IP rate-limited (PRD §11);
 *         persists as `new`, then best-effort email notify.
 *   GET   ADMIN inbox (newest first).
 */
export const dynamic = "force-dynamic";
/** Room for the SMTP round-trip on top of the Mongo write (Hobby default is 10s). */
export const maxDuration = 30;

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

    // One call covers the honeypot, both rate limits, Turnstile, the duplicate
    // window and the content classifier. Note that the classifier is FORM-AWARE:
    // this page exists so vendors can pitch us, so seller-framed language is the
    // legitimate use here and is not scored (link-building pitches still are).
    const session = await getAdminSession();
    const guard = await guardSubmission({
      form: "submission",
      req,
      raw,
      isAdmin: !!session?.user,
    });

    // Rejected: already copied to the 30-day bin. Same 201 a real submission
    // gets, so the bot sees success and doesn't adapt.
    if (guard.blocked) {
      return json({ ok: true, id: decoyId() }, 201);
    }

    await connectToDatabase();
    const data = submissionInput.parse(raw);
    const created = await Submission.create({
      ...data,
      status: "new",
      ...(guard.meta ? { spam: guard.meta } : {}),
    });

    // Awaited, not fire-and-forget — a serverless function is frozen once the
    // response is returned, which kills an in-flight SMTP handshake.
    // `notifyNewSubmission` swallows its own errors, so this can't fail the POST.
    // Quarantined rows are stored and visible under Spam, but never emailed.
    if (guard.notify) {
      await notifyNewSubmission(data);
    }

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
    // Env list wins; only hit the DB for the fallback when it isn't configured.
    let to = notifyRecipients();
    if (to.length === 0) to = notifyRecipients((await getOrCreateSiteSettings()).contactEmail);
    if (to.length === 0) return;

    const lines = [
      `New "get listed" submission for ${sub.processorName}.`,
      `Website: ${sub.website}`,
      `Contact: ${sub.contactName} (${sub.contactEmail})`,
      sub.requestedTier ? `Requested tier: ${sub.requestedTier}` : "",
      sub.description ? `\nAbout:\n${sub.description}` : "",
    ].filter(Boolean);

    await sendNotification({
      to,
      subject: `New processor submission: ${sub.processorName}`,
      text: lines.join("\n"),
      replyTo: sub.contactEmail,
    });
  } catch {
    /* swallow — best-effort */
  }
}
