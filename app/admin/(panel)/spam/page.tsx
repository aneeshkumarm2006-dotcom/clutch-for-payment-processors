import { connectToDatabase } from "@/lib/db";
import { listBlocked, listQuarantined } from "@/lib/spam/admin";
import { turnstileEnforced } from "@/lib/spam/turnstile";
import { SpamTables } from "@/components/admin/spam/SpamTables";

/**
 * Admin spam review. Two views:
 *
 *   Spam    — submissions held back from the inbox and never emailed, but
 *             stored in full. One click returns them.
 *   Blocked — the 30-day bin behind every hard rejection.
 *
 * The inboxes themselves (Leads, Submissions, Reviews) show only what the
 * filter allowed, so nothing here inflates the counts an operator reads there.
 */
export const dynamic = "force-dynamic";

export default async function AdminSpamPage() {
  await connectToDatabase();
  const [quarantined, blocked] = await Promise.all([listQuarantined(), listBlocked()]);

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Spam</h1>
        <p className="mt-1 max-w-prose text-body text-muted-foreground">
          {quarantined.length} held back · {blocked.length} blocked. Held-back submissions are
          stored but never emailed; blocked ones were refused outright and clear themselves after 30
          days. Every row shows the reasons behind its verdict. If one looks wrong, the rule is
          what needs changing.
        </p>
        {!turnstileEnforced() && (
          <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-small text-muted-foreground">
            Cloudflare Turnstile is not configured. Set <code>TURNSTILE_SITE_KEY</code> and{" "}
            <code>TURNSTILE_SECRET_KEY</code> to switch it on. No code change is needed.
          </p>
        )}
      </div>

      <SpamTables quarantined={quarantined} blocked={blocked} />
    </div>
  );
}
