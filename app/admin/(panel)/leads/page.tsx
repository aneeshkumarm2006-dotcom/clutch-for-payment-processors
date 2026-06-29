import { connectToDatabase } from "@/lib/db";
import { Lead } from "@/models";
import { toAdminLeadData, type AdminLeadData } from "@/lib/serialize";
import { LeadsTable } from "@/components/admin/leads/LeadsTable";

/** Admin leads inbox (PRD §10.6). */
export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  await connectToDatabase();
  const docs = await Lead.find().sort({ createdAt: -1 }).populate("processor", "name slug").lean();
  const rows: AdminLeadData[] = docs.map(toAdminLeadData);
  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Leads</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {rows.length} total · {newCount} new. Quote requests and “get matched” enquiries land here.
        </p>
      </div>

      <LeadsTable rows={rows} />
    </div>
  );
}
