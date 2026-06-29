import { Resend } from "resend";

/**
 * Email notifications (PRD §9.10 / §12 — "→ email notify (optional)").
 *
 * Resend is OPTIONAL: when `RESEND_API_KEY` is unset (the default in dev and any
 * deploy that hasn't configured it), every send is a no-op that resolves cleanly.
 * Callers must never let a notification failure break the request that triggered
 * it — leads/submissions are persisted first, then we notify best-effort.
 */

const FROM = process.env.EMAIL_FROM || "PayCompare <onboarding@resend.dev>";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** True when notifications are configured (a key + a destination address). */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

interface NotifyArgs {
  to: string;
  subject: string;
  /** Plain-text body; rendered as a simple paragraph block. */
  text: string;
  replyTo?: string;
}

/**
 * Best-effort notification. Returns `true` if sent, `false` if skipped/failed.
 * Never throws — failures are logged and swallowed.
 */
export async function sendNotification({ to, subject, text, replyTo }: NotifyArgs): Promise<boolean> {
  const client = getClient();
  if (!client || !to) return false;

  try {
    const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">${text
      .split("\n")
      .map((line) => (line.trim() ? `<p style="margin:0 0 8px">${escapeHtml(line)}</p>` : "<br/>"))
      .join("")}</div>`;

    await client.emails.send({
      from: FROM,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendNotification failed (non-fatal):", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
