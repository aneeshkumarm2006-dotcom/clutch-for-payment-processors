import { connectToDatabase } from "@/lib/db";
import { Lead, Processor } from "@/models";
import { leadInput } from "@/lib/validators";
import { ApiError, getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";
import { clientIp, isBot, rateLimit } from "@/lib/rate-limit";
import { toAdminLeadData } from "@/lib/serialize";
import { sendNotification } from "@/lib/email";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { humanizeEnum } from "@/lib/labels";

/**
 * /api/leads (PRD §9.10 / §10.6 / §12).
 *
 *   POST  PUBLIC quote / get-matched / contact capture. Honeypot + IP
 *         rate-limited (PRD §11). Persists first, then best-effort email notify
 *         (no-op without RESEND_API_KEY). Never displayed publicly.
 *   GET   ADMIN inbox (newest first), with the processor name populated.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const docs = await Lead.find().sort({ createdAt: -1 }).populate("processor", "name slug").lean();
    return json({ items: docs.map(toAdminLeadData) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as Record<string, unknown>;

    // Honeypot: accept silently (don't reveal the trap), never persist.
    if (isBot(raw)) {
      return json({ ok: true }, 201);
    }

    // Public submitters are rate-limited per IP; admins are trusted.
    const session = await getAdminSession();
    if (!session?.user) {
      const limit = rateLimit(`leads:${clientIp(req)}`, 5, 60_000);
      if (!limit.ok) {
        throw new ApiError(429, "You're sending requests too fast. Please try again in a minute.");
      }
    }

    await connectToDatabase();
    const data = leadInput.parse(raw);

    // Resolve the processor (if any) for a clean 404 + the notification subject.
    let processorName: string | undefined;
    if (data.processor) {
      const proc = await Processor.findById(data.processor).select("name").lean();
      if (!proc) throw new ApiError(404, "That processor could not be found.");
      processorName = proc.name;
    }

    const created = await Lead.create({ ...data, status: "new" });

    // Best-effort notification — failures must not break the submission.
    void notifyNewLead({
      name: data.name,
      email: data.email,
      businessName: data.businessName,
      monthlyVolume: data.monthlyVolume,
      message: data.message,
      source: data.source,
      processorName,
    });

    return json({ ok: true, id: String(created._id) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Fire-and-forget admin notification for a new lead. */
async function notifyNewLead(lead: {
  name: string;
  email: string;
  businessName?: string;
  monthlyVolume?: string;
  message?: string;
  source: string;
  processorName?: string;
}) {
  try {
    const to = process.env.LEADS_NOTIFY_EMAIL || (await getOrCreateSiteSettings()).contactEmail;
    if (!to) return;

    const lines = [
      `New lead from ${lead.name} (${lead.email}).`,
      lead.processorName ? `Processor: ${lead.processorName}` : "Type: Get matched (no specific processor)",
      lead.businessName ? `Business: ${lead.businessName}` : "",
      lead.monthlyVolume ? `Monthly volume: ${lead.monthlyVolume}` : "",
      `Source: ${humanizeEnum(lead.source)}`,
      lead.message ? `\nMessage:\n${lead.message}` : "",
    ].filter(Boolean);

    await sendNotification({
      to,
      subject: lead.processorName
        ? `New quote request — ${lead.processorName}`
        : "New “get matched” lead",
      text: lines.join("\n"),
      replyTo: lead.email,
    });
  } catch {
    /* swallow — notification is best-effort */
  }
}
