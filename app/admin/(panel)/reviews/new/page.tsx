import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Processor } from "@/models";
import { ReviewForm } from "@/components/admin/reviews/ReviewForm";

/** Admin "Add review" entry (PRD §10.5) — manual seeding / import. */
export const dynamic = "force-dynamic";

export default async function NewReviewPage() {
  await connectToDatabase();
  const docs = await Processor.find().sort({ name: 1 }).select("name").lean();
  const processors = docs.map((p) => ({ id: String(p._id), name: String(p.name) }));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <Link
        href="/admin/reviews"
        className="inline-flex items-center gap-1.5 text-small text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to reviews
      </Link>

      <ReviewForm processors={processors} />
    </div>
  );
}
