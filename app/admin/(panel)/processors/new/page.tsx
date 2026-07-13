import { connectToDatabase } from "@/lib/db";
import { Category } from "@/models";
import { ProcessorForm } from "@/components/admin/processors/ProcessorForm";
import type { CategoryOption } from "@/components/admin/fields/CategoryMultiSelect";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Create a new processor (PRD §10.3). */
export const dynamic = "force-dynamic";

export default async function NewProcessorPage() {
  await connectToDatabase();
  const [categories, settings] = await Promise.all([
    Category.find().sort({ name: 1 }).select("name slug").lean(),
    getOrCreateSiteSettings().catch(() => null),
  ]);

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
  }));

  return (
    <div className="mx-auto max-w-content">
      <ProcessorForm categories={categoryOptions} engineCtx={toEngineContext(settings)} />
    </div>
  );
}
