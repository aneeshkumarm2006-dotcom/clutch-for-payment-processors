import { connectToDatabase } from "@/lib/db";
import { Lead } from "@/models";
import { toAdminLeadData, type AdminLeadData } from "@/lib/serialize";
import { LeadsTable } from "@/components/admin/leads/LeadsTable";
import { countQuarantined } from "@/lib/spam/admin";
import Link from "next/link";

/** Admin leads inbox (PRD §10.6). */
export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  await connectToDatabase();
  // Quarantined leads are excluded here and shown under /admin/spam instead.
  // A count that includes filtered junk is a count nobody trusts within a week.
  const docs = await Lead.find({ "spam.verdict": { $ne: "quarantine" } })
    .sort({ createdAt: -1 })
    .populate("processor", "name slug")
    .lean();
  const rows: AdminLeadData[] = docs.map(toAdminLeadData);
  const newCount = rows.filter((r) => r.status === "new").length;
  const heldBack = await countQuarantined("lead");

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Leads</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {rows.length} total · {newCount} new. Quote requests and “get matched” enquiries land here.
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

      <LeadsTable rows={rows} />
    </div>
  );
}
