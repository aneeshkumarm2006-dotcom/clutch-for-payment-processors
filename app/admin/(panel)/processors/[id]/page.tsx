import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, Processor } from "@/models";
import { SUB_RATING_KEYS } from "@/lib/enums";
import { ProcessorForm, type ProcessorRatings } from "@/components/admin/processors/ProcessorForm";
import { toProcessorFormValues } from "@/components/admin/processors/serialize";
import type { CategoryOption } from "@/components/admin/fields/CategoryMultiSelect";

/** Edit an existing processor (PRD §10.3). */
export const dynamic = "force-dynamic";

export default async function EditProcessorPage({ params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) notFound();

  await connectToDatabase();
  const [doc, categories] = await Promise.all([
    Processor.findById(params.id).lean(),
    Category.find().sort({ name: 1 }).select("name").lean(),
  ]);

  if (!doc) notFound();

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: String(c._id),
    name: c.name,
  }));

  const defaultValues = toProcessorFormValues(doc);

  const subRatings = SUB_RATING_KEYS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = doc.subRatings?.[key] ?? 0;
    return acc;
  }, {});

  const ratings: ProcessorRatings = {
    ratingAverage: doc.ratingAverage ?? 0,
    ratingCount: doc.ratingCount ?? 0,
    subRatings,
  };

  return (
    <div className="mx-auto max-w-content">
      <ProcessorForm
        processorId={String(doc._id)}
        defaultValues={defaultValues}
        categories={categoryOptions}
        ratings={ratings}
      />
    </div>
  );
}
