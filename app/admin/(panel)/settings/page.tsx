import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { toSettingsFormValues } from "@/components/admin/settings/serialize";

/** Site settings singleton editor (PRD §10.9). Admin-only (PRD §10.10). */
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Defense-in-depth: middleware already bounces editors; re-check server-side.
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") redirect("/admin");

  await connectToDatabase();
  const settings = await getOrCreateSiteSettings();

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Settings</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Site-wide brand, contact, and default SEO. Homepage content lives on the Landing page.
        </p>
      </div>
      <SettingsForm defaultValues={toSettingsFormValues(settings)} />
    </div>
  );
}
