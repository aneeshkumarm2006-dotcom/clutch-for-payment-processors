import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email notifications (PRD §9.10 / §12 — "→ email notify (optional)").
 *
 * Sent straight from our own mailbox over SMTP (Gmail / Google Workspace by
 * default) using an app password — no third-party sending service. Configure
 * `SMTP_USER` + `SMTP_PASS`; when either is missing every send is a no-op that
 * resolves cleanly, which is the default in dev and on any deploy that hasn't
 * set them. Callers must never let a notification failure break the request that
 * triggered it — leads/submissions are persisted first, then we notify
 * best-effort.
 *
 * Gmail rewrites the From header to the authenticated account unless the address
 * is a verified "send mail as" alias, so keep `EMAIL_FROM` on `SMTP_USER`.
 */

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

const FROM = process.env.EMAIL_FROM || (SMTP_USER ? `Payment Processor Guide <${SMTP_USER}>` : "");

/** Reused across invocations so a warm lambda doesn't reconnect per send. */
let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Bounded so a blocked egress port fails fast instead of hanging the
      // request until the serverless function times out.
      connectionTimeout: 10_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

/** True when notifications are configured (SMTP credentials present). */
export function emailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

/**
 * Who gets lead/submission notifications. `LEADS_NOTIFY_EMAIL` takes a
 * comma-separated list so several owners can be copied on one send; when it is
 * unset we fall back to the single `SiteSettings.contactEmail`.
 */
export function notifyRecipients(fallback?: string): string[] {
  const raw = process.env.LEADS_NOTIFY_EMAIL?.trim() || fallback || "";
  return [...new Set(raw.split(",").map((addr) => addr.trim()).filter(Boolean))];
}

interface NotifyArgs {
  /** One address or several. */
  to: string | string[];
  subject: string;
  /** Plain-text body; rendered as a simple paragraph block. */
  text: string;
  replyTo?: string;
}

export interface EmailResult {
  ok: boolean;
  /** Why nothing was attempted (missing credentials / no recipients). */
  skipped?: string;
  /** SMTP failure, surfaced for the admin diagnostic route. */
  error?: string;
}

/**
 * Best-effort notification. Never throws — failures are logged and returned.
 *
 * Callers MUST await this. On a serverless host the function is frozen the
 * moment the response is returned, so a fire-and-forget `void send(...)` is
 * killed mid-handshake and the mail silently never leaves.
 */
export async function sendNotification({ to, subject, text, replyTo }: NotifyArgs): Promise<EmailResult> {
  const transport = getTransport();
  const recipients = (Array.isArray(to) ? to : [to]).map((a) => a.trim()).filter(Boolean);
  if (!transport) return { ok: false, skipped: "SMTP_USER / SMTP_PASS not set" };
  if (!FROM) return { ok: false, skipped: "EMAIL_FROM not set" };
  if (recipients.length === 0) return { ok: false, skipped: "no recipients configured" };

  try {
    const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">${text
      .split("\n")
      .map((line) => (line.trim() ? `<p style="margin:0 0 8px">${escapeHtml(line)}</p>` : "<br/>"))
      .join("")}</div>`;

    await transport.sendMail({
      from: FROM,
      to: recipients,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendNotification failed (non-fatal):", err);
    return { ok: false, error: describeError(err) };
  }
}

/**
 * Open the SMTP connection and authenticate without sending anything. The
 * fastest way to tell a credential problem from blocked egress on a host.
 */
export async function verifyTransport(): Promise<EmailResult> {
  const transport = getTransport();
  if (!transport) return { ok: false, skipped: "SMTP_USER / SMTP_PASS not set" };
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

/** SMTP errors carry the useful part in `code`/`responseCode`, not the message. */
function describeError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  return [e?.code, e?.responseCode, e?.message ?? String(err)].filter(Boolean).join(" · ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
