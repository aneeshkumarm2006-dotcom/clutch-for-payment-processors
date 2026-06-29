import { connectToDatabase } from "@/lib/db";
import { Category } from "@/models";
import { ProcessorForm } from "@/components/admin/processors/ProcessorForm";
import type { CategoryOption } from "@/components/admin/fields/CategoryMultiSelect";

/** Create a new processor (PRD §10.3). */
export const dynamic = "force-dynamic";

export default async function NewProcessorPage() {
  await connectToDatabase();
  const categories = await Category.find().sort({ name: 1 }).select("name").lean();

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: String(c._id),
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-content">
      <ProcessorForm categories={categoryOptions} />
    </div>
  );
}
