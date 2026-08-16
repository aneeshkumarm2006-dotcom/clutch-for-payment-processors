import { connectToDatabase } from "@/lib/db";
import { Lead, Processor } from "@/models";
import { leadInput } from "@/lib/validators";
import { ApiError, getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";
import { clientIp, isBot, rateLimit } from "@/lib/rate-limit";
import { toAdminLeadData } from "@/lib/serialize";
import { notifyRecipients, sendNotification } from "@/lib/email";
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
/** Room for the SMTP round-trip on top of the Mongo write (Hobby default is 10s). */
export const maxDuration = 30;

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

    // Awaited, not fire-and-forget: on Vercel the function is frozen as soon as
    // the response is returned, which killed the SMTP handshake mid-flight and
    // lost the mail. `notifyNewLead` swallows its own errors, so awaiting it
    // still cannot fail the submission — only add a second or two.
    await notifyNewLead({
      name: data.name,
      email: data.email,
      businessName: data.businessName,
      phone: data.phone,
      monthlyVolume: data.monthlyVolume,
      businessType: data.businessType,
      message: data.message,
      source: data.source,
      processorName,
    });

    return json({ ok: true, id: String(created._id) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Admin notification for a new lead — every source, not just the contact form.
 * `POST /api/leads` is the only place a Lead is created (the contact page, the
 * profile "get a quote" dialog and "get matched" all post here), so notifying
 * from this one call site covers everything that reaches /admin/leads. Mirrors
 * whatever was captured, since the optional fields differ per source.
 */
async function notifyNewLead(lead: {
  name: string;
  email: string;
  businessName?: string;
  phone?: string;
  monthlyVolume?: string;
  businessType?: string;
  message?: string;
  source: string;
  processorName?: string;
}) {
  try {
    // Env list wins; only hit the DB for the fallback when it isn't configured.
    let to = notifyRecipients();
    if (to.length === 0) to = notifyRecipients((await getOrCreateSiteSettings()).contactEmail);
    if (to.length === 0) return;

    const isContact = lead.source === "contact";

    const lines = [
      `New lead from ${lead.name} (${lead.email}).`,
      lead.processorName
        ? `Processor: ${lead.processorName}`
        : isContact
          ? "Type: Contact form enquiry"
          : "Type: Get matched (no specific processor)",
      lead.businessName ? `Business: ${lead.businessName}` : "",
      lead.phone ? `Phone: ${lead.phone}` : "",
      // MONTHLY_VOLUMES are already display strings ("$10k-$50k") — humanizing
      // one would split it on the hyphen and mangle it.
      lead.monthlyVolume ? `Monthly volume: ${lead.monthlyVolume}` : "",
      lead.businessType ? `Business type: ${lead.businessType}` : "",
      `Source: ${humanizeEnum(lead.source)}`,
      lead.message ? `\nMessage:\n${lead.message}` : "",
    ].filter(Boolean);

    await sendNotification({
      to,
      subject: lead.processorName
        ? `New quote request: ${lead.processorName}`
        : isContact
          ? `New contact enquiry from ${lead.name}`
          : "New “get matched” lead",
      text: lines.join("\n"),
      replyTo: lead.email,
    });
  } catch {
    /* swallow — notification is best-effort */
  }
}
