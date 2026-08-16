import { handleApiError, json, requireAdmin } from "@/lib/api";
import { emailConfigured, notifyRecipients, sendNotification, verifyTransport } from "@/lib/email";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * Email diagnostics (admin-only). Lead/submission notifications are
 * deliberately best-effort — `lib/email.ts` swallows every SMTP failure so a
 * broken mailbox can never cost us a lead — which means a misconfigured deploy
 * looks exactly like a working one from the outside. This route is where you
 * find out which.
 *
 *   GET   which env vars landed + connect and authenticate. Sends nothing.
 *   POST  send a real test message to the configured recipients.
 *
 * Sign in to /admin first, then open /api/admin/email-test in the same browser.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function recipients(): Promise<string[]> {
  const configured = notifyRecipients();
  if (configured.length > 0) return configured;
  return notifyRecipients((await getOrCreateSiteSettings()).contactEmail);
}

export async function GET() {
  try {
    await requireAdmin();

    return json({
      configured: emailConfigured(),
      host: process.env.SMTP_HOST || "smtp.gmail.com (default)",
      port: process.env.SMTP_PORT || "465 (default)",
      user: process.env.SMTP_USER || null,
      // Never echo the password — only whether it arrived and how long it is,
      // which is enough to catch a pasted-with-quotes or truncated value.
      passLength: process.env.SMTP_PASS?.length ?? 0,
      from: process.env.EMAIL_FROM || null,
      to: await recipients(),
      connection: await verifyTransport(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  try {
    await requireAdmin();
    const to = await recipients();

    const result = await sendNotification({
      to,
      subject: "Test — Payment Processor Guide notifications",
      text: [
        "This is a test from /api/admin/email-test.",
        "If you are reading it, lead and submission notifications will arrive here too.",
      ].join("\n"),
    });

    return json({ to, result });
  } catch (err) {
    return handleApiError(err);
  }
}
