import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Category } from "@/models";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSiteSettings } from "@/lib/settings";
import {
  SettingsForm,
  type FeaturedCategoryOption,
} from "@/components/admin/settings/SettingsForm";
import { toSettingsFormValues } from "@/components/admin/settings/serialize";

/** Site settings singleton editor (PRD §10.9). Admin-only (PRD §10.10). */
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Defense-in-depth: middleware already bounces editors; re-check server-side.
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") redirect("/admin");

  await connectToDatabase();
  const [settings, categories] = await Promise.all([
    getOrCreateSiteSettings(),
    Category.find().sort({ displayOrder: 1, name: 1 }).select("name slug").lean(),
  ]);

  const categoryOptions: FeaturedCategoryOption[] = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Settings</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Site-wide brand, homepage hero, contact, and default SEO.
        </p>
      </div>
      <SettingsForm defaultValues={toSettingsFormValues(settings)} categories={categoryOptions} />
    </div>
  );
}
