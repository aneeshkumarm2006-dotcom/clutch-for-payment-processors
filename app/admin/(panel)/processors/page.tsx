import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Category, Processor } from "@/models";
import { Button } from "@/components/ui/button";
import { ProcessorsTable, type ProcessorRow } from "@/components/admin/processors/ProcessorsTable";
import type { CategoryOption } from "@/components/admin/fields/CategoryMultiSelect";

/** Admin processors list (PRD §10.3). DataTable with tier/status/category filters + row actions. */
export const dynamic = "force-dynamic";

export default async function AdminProcessorsPage() {
  await connectToDatabase();

  const [processors, categories] = await Promise.all([
    Processor.find().sort({ updatedAt: -1 }).lean(),
    Category.find().sort({ name: 1 }).select("name").lean(),
  ]);

  const rows: ProcessorRow[] = processors.map((p) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    logo: p.logo,
    ratingAverage: p.ratingAverage ?? 0,
    ratingCount: p.ratingCount ?? 0,
    listingTier: p.listingTier,
    isVerified: Boolean(p.isVerified),
    isSponsored: Boolean(p.isSponsored),
    isFeatured: Boolean(p.isFeatured),
    isPublished: Boolean(p.isPublished),
    categories: Array.isArray(p.categories) ? p.categories.map((c) => String(c)) : [],
    updatedAt: new Date(p.updatedAt).toISOString(),
  }));

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: String(c._id),
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Processors</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {rows.length} total · manage listings, pricing, and merchandising.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/admin/processors/new">
            <Plus className="size-4" />
            New processor
          </Link>
        </Button>
      </div>

      <ProcessorsTable rows={rows} categories={categoryOptions} />
    </div>
  );
}
