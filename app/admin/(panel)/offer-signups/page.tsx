import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { OfferSignup } from "@/models";
import { toAdminOfferSignupData, type AdminOfferSignupData } from "@/lib/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { countQuarantined } from "@/lib/spam/admin";
import { OfferSignupsTable } from "@/components/admin/offer-signups/OfferSignupsTable";

/** Fee-sheet slide-in signups. */
export const dynamic = "force-dynamic";

export default async function AdminOfferSignupsPage() {
  await connectToDatabase();
  // Quarantined signups are excluded here and shown under /admin/spam instead.
  const [docs, heldBack, settings] = await Promise.all([
    OfferSignup.find({ "spam.verdict": { $ne: "quarantine" } })
      .sort({ createdAt: -1 })
      .lean(),
    countQuarantined("offer"),
    getOrCreateSiteSettings().catch(() => null),
  ]);

  const rows: AdminOfferSignupData[] = docs.map(toAdminOfferSignupData);
  const newCount = rows.filter((r) => r.status === "new").length;
  const undelivered = rows.filter((r) => !r.delivered).length;
  const sheetUrl = settings?.feeSheetUrl?.trim();

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Fee sheet signups</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {rows.length} total · {newCount} new. Captured by the slide-in on comparison pages and
          blog posts.
        </p>
        {heldBack > 0 && (
          <p className="mt-1 text-small text-muted-foreground">
            {heldBack} more{" "}
            <Link href="/admin/spam" className="underline underline-offset-4">
              held back as spam
            </Link>
            .
          </p>
        )}
      </div>

      {/*
        The banner that stops this being a broken promise. Without a sheet URL
        the widget still captures, but nobody receives anything — and that is
        invisible unless it is said here, on the page where the addresses pile
        up. Once the link is set, the only thing worth flagging is a send that
        actually failed.
      */}
      {!sheetUrl ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p className="text-small font-medium text-foreground">
            No fee sheet URL is set, so nothing is being emailed automatically.
          </p>
          <p className="mt-1 text-small text-muted-foreground">
            Everyone below asked for the sheet and is still waiting on a human.{" "}
            <Link href="/admin/settings" className="underline underline-offset-4">
              Add the link in Settings
            </Link>{" "}
            and every signup after that is delivered the moment it comes in.
          </p>
        </div>
      ) : (
        undelivered > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="text-small font-medium text-foreground">
              {undelivered} {undelivered === 1 ? "person has" : "people have"} not received the
              sheet.
            </p>
            <p className="mt-1 text-small text-muted-foreground">
              Either they signed up before the link was set, or the send failed. Open a row to see
              which, and mail it over from there.
            </p>
          </div>
        )
      )}

      <OfferSignupsTable rows={rows} />
    </div>
  );
}
