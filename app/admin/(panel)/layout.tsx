import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Layout for every authenticated admin page (the `(panel)` route group — the
 * group name does not appear in the URL, so this wraps `/admin`, `/admin/*`
 * but NOT `/admin/login`). `middleware.ts` already gates access; this server
 * check is defense-in-depth and supplies the session user to the shell.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  return (
    <AdminShell
      user={{
        name: session.user?.name,
        email: session.user?.email,
        role: session.user?.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
