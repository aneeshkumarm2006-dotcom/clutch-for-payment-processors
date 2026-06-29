import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { getProcessorBySlug } from "@/lib/public-data";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RatingStars } from "@/components/public/RatingStars";
import { WriteReviewForm } from "@/components/public/reviews/WriteReviewForm";

/**
 * Write a Review `/write-review/[slug]` (PRD §9.6). Rendered on demand (the form
 * POSTs to the rate-limited `/api/reviews`); not indexed for ranking but given
 * a clean canonical + noindex so it doesn't dilute the profile.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const p = await getProcessorBySlug(params.slug);
  if (!p) return { title: "Write a review" };
  return {
    ...buildMetadata({
      title: `Write a review of ${p.name}`,
      description: `Share your experience with ${p.name} — pricing, support, reliability, and more.`,
      path: `/write-review/${p.slug}`,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function WriteReviewPage({ params }: { params: { slug: string } }) {
  const p = await getProcessorBySlug(params.slug);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      <Breadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Processors", href: "/processors" },
          { name: p.name, href: `/processor/${p.slug}` },
          { name: "Write a review" },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_minmax(0,640px)] lg:items-start">
        {/* Intro / context */}
        <div className="lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-ink-0">
              {p.logo ? (
                <Image
                  src={p.logo}
                  alt={`${p.name} logo`}
                  width={48}
                  height={48}
                  className="size-12 object-contain p-1.5"
                  unoptimized
                />
              ) : (
                <span className="text-h4 font-semibold text-ink-400">
                  {p.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-label uppercase text-ink-500">Reviewing</p>
              <h1 className="text-h2 tracking-tighter2 text-foreground">{p.name}</h1>
            </div>
          </div>

          <div className="mt-4">
            <RatingStars
              value={p.ratingAverage}
              count={p.ratingCount}
              showValue
              showCount
              emptyLabel="No reviews yet"
            />
          </div>

          <p className="mt-4 max-w-prose text-body text-muted-foreground">
            Your honest, first-hand experience helps other merchants choose the right processor. All
            reviews are moderated before they go live, and your email stays private.
          </p>
        </div>

        {/* Form */}
        <WriteReviewForm processorId={p.id} processorName={p.name} processorSlug={p.slug} />
      </div>
    </div>
  );
}
