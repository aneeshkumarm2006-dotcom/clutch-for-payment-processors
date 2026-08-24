import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Review } from "@/models";
import { toAdminReviewData, type AdminReviewData } from "@/lib/serialize";
import { Button } from "@/components/ui/button";
import { ReviewsTable } from "@/components/admin/reviews/ReviewsTable";
import { countQuarantined } from "@/lib/spam/admin";

/** Admin reviews moderation (PRD §10.5). */
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await connectToDatabase();
  // Quarantined reviews are excluded here and shown under /admin/spam, so the
  // "awaiting moderation" count never counts bots.
  const docs = await Review.find({ "spam.verdict": { $ne: "quarantine" } })
    .sort({ createdAt: -1 })
    .populate("processor", "name slug")
    .lean();

  const rows: AdminReviewData[] = docs.map(toAdminReviewData);
  const pending = rows.filter((r) => r.status === "pending").length;
  const heldBack = await countQuarantined("review");

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Reviews</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {rows.length} total · {pending} awaiting moderation. Approving a review updates the
            processor’s rating automatically.
          </p>
          {heldBack > 0 && (
            <p className="mt-1 text-small text-muted-foreground">
              {heldBack} more{" "}
              <Link href="/admin/spam" className="underline underline-offset-4">
                held back as spam
              </Link>
              .
            </p>
          )}
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
