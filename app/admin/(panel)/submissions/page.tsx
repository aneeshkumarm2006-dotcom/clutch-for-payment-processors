import { connectToDatabase } from "@/lib/db";
import { Submission } from "@/models";
import { toAdminSubmissionData, type AdminSubmissionData } from "@/lib/serialize";
import { SubmissionsTable } from "@/components/admin/submissions/SubmissionsTable";
import { countQuarantined } from "@/lib/spam/admin";
import Link from "next/link";

/** Admin submissions inbox (PRD §10.7). */
export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  await connectToDatabase();
  // Quarantined submissions are excluded here and shown under /admin/spam.
  const docs = await Submission.find({ "spam.verdict": { $ne: "quarantine" } })
    .sort({ createdAt: -1 })
    .lean();
  const rows: AdminSubmissionData[] = docs.map(toAdminSubmissionData);
  const newCount = rows.filter((r) => r.status === "new").length;
  const heldBack = await countQuarantined("submission");

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Submissions</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {rows.length} total · {newCount} new. “Get listed” requests. Review, then convert to a
          processor draft.
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

      <SubmissionsTable rows={rows} />
    </div>
  );
}
