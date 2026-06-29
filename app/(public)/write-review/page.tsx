import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { ReviewProcessorPicker } from "@/components/public/reviews/ReviewProcessorPicker";
import { getPublishedProcessorOptions } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

/**
 * Write-a-review entry point (PRD §9.6). The Navbar/homepage CTA lands here
 * without a processor; pick one to continue to `/write-review/[slug]`. A utility
 * page — `noindex, follow` like the per-processor form.
 */
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...buildMetadata({
      title: "Write a review",
      description: "Choose a payment processor to review and share your merchant experience.",
      path: "/write-review",
    }),
    robots: { index: false, follow: true },
  };
}

export default async function WriteReviewIndexPage() {
  const options = await getPublishedProcessorOptions();

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Write a review" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Write a review</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Share your experience with a payment processor to help other businesses choose. First, pick
          the processor you used.
        </p>
      </header>

      <div className="mt-8 max-w-prose">
        {options.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-body text-muted-foreground">
              No processors are available to review yet. Please{" "}
              <Link href="/processors" className="text-accent hover:underline">
                browse the directory
              </Link>{" "}
              and check back soon.
            </p>
          </div>
        ) : (
          <ReviewProcessorPicker options={options} />
        )}
      </div>
    </div>
  );
}
