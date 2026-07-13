import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Create a new category (PRD §10.4). */
export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  const settings = await getOrCreateSiteSettings().catch(() => null);

  return (
    <div className="mx-auto max-w-content">
      <CategoryForm engineCtx={toEngineContext(settings)} />
    </div>
  );
}
