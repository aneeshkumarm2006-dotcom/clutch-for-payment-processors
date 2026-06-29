import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/models";
import { Button } from "@/components/ui/button";
import { CategoriesTable, type CategoryRow } from "@/components/admin/categories/CategoriesTable";

/** Admin categories list (PRD §10.4). */
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await connectToDatabase();
  const categories = await Category.find().sort({ displayOrder: 1, name: 1 }).lean();

  const rows: CategoryRow[] = categories.map((c) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    type: c.type,
    displayOrder: c.displayOrder ?? 0,
    isPublished: Boolean(c.isPublished),
  }));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Categories</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {rows.length} total · organize the directory and navigation.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/admin/categories/new">
            <Plus className="size-4" />
            New category
          </Link>
        </Button>
      </div>

      <CategoriesTable rows={rows} />
    </div>
  );
}
