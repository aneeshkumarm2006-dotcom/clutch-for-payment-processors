import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/models";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import { toCategoryFormValues } from "@/components/admin/categories/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Edit an existing category (PRD §10.4). */
export const dynamic = "force-dynamic";

export default async function EditCategoryPage({ params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) notFound();

  await connectToDatabase();
  const [doc, settings] = await Promise.all([
    Category.findById(params.id).lean(),
    getOrCreateSiteSettings().catch(() => null),
  ]);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-content">
      <CategoryForm
        categoryId={String(doc._id)}
        defaultValues={toCategoryFormValues(doc)}
        savedSlug={doc.slug}
        engineCtx={toEngineContext(settings)}
      />
    </div>
  );
}
