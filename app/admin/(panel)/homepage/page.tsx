import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Category, PageSeo } from "@/models";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";
import { HomepageForm, type CategoryOption } from "@/components/admin/homepage/HomepageForm";
import { toHomepageFormValues } from "@/components/admin/homepage/serialize";

/**
 * Landing-page editor (/admin/homepage). Admin-only, matching Settings — this
 * writes site-wide configuration, not per-entity content.
 */
export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  // Defense-in-depth: middleware already bounces editors; re-check server-side.
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") redirect("/admin");

  await connectToDatabase();
  const [settings, categories, pageSeo] = await Promise.all([
    getOrCreateSiteSettings(),
    Category.find().sort({ displayOrder: 1, name: 1 }).select("name slug").lean(),
    // Upserted rather than looked up: the SEO tab needs a record id to save to,
    // and this page must work on an install where `npm run seed:seo` never ran.
    // `$setOnInsert` means an existing record — including one edited via
    // /admin/page-seo — is returned untouched.
    PageSeo.findOneAndUpdate(
      { pageKey: "home" },
      { $setOnInsert: { pageKey: "home", title: "Homepage", path: "/" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean(),
  ]);

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-content">
      <HomepageForm
        defaultValues={toHomepageFormValues(settings, pageSeo as Record<string, unknown> | null)}
        categories={categoryOptions}
        pageSeoId={String(pageSeo!._id)}
        engineCtx={toEngineContext(settings)}
      />
    </div>
  );
}
