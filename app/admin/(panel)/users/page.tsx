import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { toAdminUserData, type AdminUserData } from "@/lib/serialize";
import { UsersTable } from "@/components/admin/users/UsersTable";

/**
 * Admin users management (PRD §10.10 — Phase 2). Admin-only: `middleware.ts`
 * already bounces editors back to the dashboard; this server check is
 * defense-in-depth and supplies the current user id (so the table can flag
 * "you").
 */
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") redirect("/admin");

  await connectToDatabase();
  const docs = await User.find().sort({ createdAt: -1 }).lean();
  const rows: AdminUserData[] = docs.map(toAdminUserData);
  const admins = rows.filter((r) => r.role === "admin" && r.isActive).length;

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Users</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {rows.length} {rows.length === 1 ? "account" : "accounts"} · {admins} active{" "}
          {admins === 1 ? "admin" : "admins"}. Admins manage everything; editors can’t reach
          Users or Settings.
        </p>
      </div>

      <UsersTable rows={rows} currentUserId={session.user.id} />
    </div>
  );
}
