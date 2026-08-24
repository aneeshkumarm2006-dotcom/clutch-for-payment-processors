import { connectToDatabase } from "@/lib/db";
import { OfferSignup } from "@/models";
import { offerSignupInput } from "@/lib/validators";
import { getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";
import { decoyId, guardSubmission } from "@/lib/spam/guard";
import { toAdminOfferSignupData } from "@/lib/serialize";
import { sendNotification } from "@/lib/email";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * /api/offer-signups — the fee-sheet slide-in.
 *
 *   POST  PUBLIC email capture. Same guard every other public form runs behind.
 *   GET   ADMIN list, newest first.
 *
 * ONE mail goes out per signup, and only one: DELIVERY, to the visitor,
 * carrying the sheet link. It is the promise the widget made, so it happens only
 * on a clean verdict and only when a link is configured, and its success is
 * recorded on the row.
 *
 * There is deliberately NO operator notification here, unlike /api/leads and
 * /api/submissions. A download is not an enquiry: nobody has to answer it, and
 * at lead-magnet volume a mail per signup would train the team to filter the
 * address that also carries real quote requests. The list is read in
 * /admin/offer-signups, which is where it is actually worked.
 */
export const dynamic = "force-dynamic";
/** Room for the SMTP round-trip on top of the Mongo write (Hobby default is 10s). */
export const maxDuration = 30;

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const docs = await OfferSignup.find().sort({ createdAt: -1 }).lean();
    return json({ items: docs.map(toAdminOfferSignupData) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as Record<string, unknown>;

    const session = await getAdminSession();
    const guard = await guardSubmission({ form: "offer", req, raw, isAdmin: !!session?.user });

    // Rejected and already copied to the 30-day bin. Answer with the SAME 201 a
    // real signup gets so the bot sees success and doesn't adapt.
    if (guard.blocked) {
      return json({ ok: true, id: decoyId(), delivered: false }, 201);
    }

    await connectToDatabase();
    const data = offerSignupInput.parse(raw);
    const { offer, email, utm, ...context } = data;

    const settings = await getOrCreateSiteSettings().catch(() => null);
    const sheetUrl = settings?.feeSheetUrl?.trim() || "";

    // Deliver BEFORE the write, so `delivered` records what actually happened
    // rather than what we intended. Quarantined signups are stored and visible
    // in the admin's Spam view but never mailed — auto-sending a link to
    // whatever the classifier just flagged is how a domain gets a spam
    // reputation.
    let delivered = false;
    let deliveryError: string | undefined;
    if (guard.notify && sheetUrl) {
      const sent = await sendFeeSheet(email, sheetUrl, settings?.siteName);
      delivered = sent.ok;
      deliveryError = sent.ok ? undefined : (sent.error ?? sent.skipped);
    }

    /**
     * Upsert on (offer, email). A second submission from the same address is
     * "send it to me again", not a second subscriber — and the unique index
     * would turn a plain insert into a 500 the visitor cannot act on.
     *
     * `status` is NOT reset here: an operator who already marked a repeat signup
     * contacted should not have it jump back into the New tab because the
     * visitor lost the email and asked again.
     */
    const saved = await OfferSignup.findOneAndUpdate(
      { offer, email },
      {
        $set: {
          ...context,
          ...(utm ? { utm } : {}),
          ...(guard.meta ? { spam: guard.meta } : {}),
          ...(delivered ? { delivered: true, deliveredAt: new Date() } : {}),
          ...(deliveryError ? { deliveryError } : {}),
        },
        $inc: { submissions: 1 },
        $setOnInsert: { status: "new" },
        // A retry that succeeds must clear the stale failure from last time.
        ...(delivered ? { $unset: { deliveryError: "" } } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    // `delivered` drives the confirmation copy: the visitor is told to check
    // their inbox only when something was genuinely sent.
    return json({ ok: true, id: String(saved?._id ?? decoyId()), delivered }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

/** The sheet itself, to the visitor. This is the promise the widget made. */
async function sendFeeSheet(email: string, url: string, siteName?: string) {
  const brand = siteName?.trim() || "Payment Processor Guide";
  return sendNotification({
    to: email,
    subject: "Your processor fee comparison sheet",
    // Plain text on purpose: `sendNotification` escapes the body into simple
    // paragraphs, so a bare URL is the one form that survives intact and stays
    // clickable in every mail client.
    text: [
      "Thanks for grabbing the fee comparison sheet.",
      "Here it is:",
      url,
      "",
      "It covers effective rates for the top 20 providers and is updated monthly, so keep the link: it always points at the current version.",
      "",
      brand,
    ].join("\n"),
  });
}
