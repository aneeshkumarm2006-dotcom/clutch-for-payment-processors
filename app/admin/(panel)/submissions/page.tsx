import { connectToDatabase } from "@/lib/db";
import { Submission } from "@/models";
import { toAdminSubmissionData, type AdminSubmissionData } from "@/lib/serialize";
import { SubmissionsTable } from "@/components/admin/submissions/SubmissionsTable";

/** Admin submissions inbox (PRD §10.7). */
export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  await connectToDatabase();
  const docs = await Submission.find().sort({ createdAt: -1 }).lean();
  const rows: AdminSubmissionData[] = docs.map(toAdminSubmissionData);
  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Submissions</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {rows.length} total · {newCount} new. “Get listed” requests — review, then convert to a
          processor draft.
        </p>
      </div>

      <SubmissionsTable rows={rows} />
    </div>
  );
}
