import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models";
import { toAuditLogData, type AuditLogData } from "@/lib/serialize";
import { AuditTable } from "@/components/admin/audit/AuditTable";

/**
 * Admin audit log (Phase 2 — PRD §11 / §10.10). **Read-only, admin-only.** Every
 * admin mutation (`lib/audit.ts#logAudit`) lands here, newest first. The actor is
 * populated so a deleted account still shows its name (we also denormalize it).
 */
export const dynamic = "force-dynamic";

/** Cap the table at a recent window — the index is on `createdAt: -1`. */
const LIMIT = 500;

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") redirect("/admin");

  await connectToDatabase();
  const docs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(LIMIT)
    .populate("actor", "name email")
    .lean();
  const rows: AuditLogData[] = docs.map(toAuditLogData);

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Audit log</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Every admin change — who did what, and when. Showing the most recent{" "}
          {rows.length === LIMIT ? `${LIMIT}` : rows.length}{" "}
          {rows.length === 1 ? "entry" : "entries"}.
        </p>
      </div>

      <AuditTable rows={rows} />
    </div>
  );
}
