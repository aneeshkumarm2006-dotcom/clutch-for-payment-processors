import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Review } from "@/models";
import { toAdminReviewData, type AdminReviewData } from "@/lib/serialize";
import { Button } from "@/components/ui/button";
import { ReviewsTable } from "@/components/admin/reviews/ReviewsTable";

/** Admin reviews moderation (PRD §10.5). */
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await connectToDatabase();
  const docs = await Review.find()
    .sort({ createdAt: -1 })
    .populate("processor", "name slug")
    .lean();

  const rows: AdminReviewData[] = docs.map(toAdminReviewData);
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Reviews</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {rows.length} total · {pending} awaiting moderation. Approving a review updates the
            processor’s rating automatically.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/admin/reviews/new">
            <Plus className="size-4" />
            Add review
          </Link>
        </Button>
      </div>

      <ReviewsTable rows={rows} />
    </div>
  );
}
