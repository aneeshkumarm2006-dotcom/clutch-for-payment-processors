import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSeoTeamAuthed } from "@/lib/seoteam-guard";
import { SeoTeamShell } from "@/components/seoteam/SeoTeamShell";

export const metadata: Metadata = {
  title: "SEO dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Guarded layout for the SEO dashboard (the `(dash)` route group wraps /seoteam,
 * /seoteam/new, /seoteam/[id] but NOT /seoteam/login). `middleware.ts` already
 * gates these routes via the signed cookie; this server check is defense-in-depth.
 */
export default async function SeoTeamDashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSeoTeamAuthed())) redirect("/seoteam/login");
  return <SeoTeamShell>{children}</SeoTeamShell>;
}
