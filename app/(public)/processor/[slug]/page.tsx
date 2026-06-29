import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Check, CheckCircle2, MapPin, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, orDash } from "@/lib/utils";
import { humanizeEnum } from "@/lib/labels";
import {
  getAlternatives,
  getAllPublishedProcessorSlugs,
  getApprovedReviews,
  getProcessorBySlug,
  getReviewIndustries,
} from "@/lib/public-data";
import { buildMetadata, breadcrumbJsonLd, processorJsonLd } from "@/lib/seo";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RichText } from "@/components/public/RichText";
import { RatingStars } from "@/components/public/RatingStars";
import { ReviewsSection } from "@/components/public/reviews/ReviewsSection";
import { StatStrip } from "@/components/public/StatStrip";
import { FeeTable } from "@/components/public/FeeTable";
import { FeatureChecklist } from "@/components/public/FeatureChecklist";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { VisitWebsiteButton } from "@/components/public/VisitWebsiteButton";
import { LeadDialog } from "@/components/public/LeadDialog";
import { ProfileTabs, type ProfileTabItem } from "@/components/public/profile/ProfileTabs";
import { JsonLd } from "@/components/public/JsonLd";

/** Processor profile (PRD §9.3). SSG/ISR + generateStaticParams. */
export const revalidate = 1800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllPublishedProcessorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const p = await getProcessorBySlug(params.slug);
  if (!p) return { title: "Processor not found" };
  return buildMetadata({
    title: `${p.name} review — pricing, fees & features`,
    description:
      p.shortDescription ||
      p.tagline ||
      `${p.name} pricing, payment methods, integrations, and verified merchant reviews.`,
    path: `/processor/${p.slug}`,
    image: p.logo,
    seo: p.seo,
    ogType: "profile",
  });
}

export default async function ProcessorProfilePage({ params }: { params: { slug: string } }) {
  const p = await getProcessorBySlug(params.slug);
  if (!p) notFound();

  const [alternatives, initialReviews, reviewIndustries] = await Promise.all([
    getAlternatives(p, 4),
    getApprovedReviews({ processorId: p.id, sort: "newest", page: 1 }),
    getReviewIndustries(p.id),
  ]);
  const primaryCategory = p.categories[0];

  // Which sections actually have content (drives the tabs + scrollspy).
  const hasFeatures =
    p.paymentMethods.length > 0 || p.integrations.length > 0 || p.features.length > 0;
  const sections: ProfileTabItem[] = [
    { id: "overview", label: "Overview" },
    { id: "pricing", label: "Pricing" },
    ...(hasFeatures ? [{ id: "features", label: "Features" }] : []),
    { id: "reviews", label: "Reviews" },
    ...(alternatives.length > 0 ? [{ id: "alternatives", label: "Alternatives" }] : []),
  ];

  const regionLabel =
    p.supportedRegions.length > 0
      ? p.supportedRegions.slice(0, 2).join(", ") +
        (p.supportedRegions.length > 2 ? ` +${p.supportedRegions.length - 2}` : "")
      : "—";

  const statItems = [
    { label: "Starting rate", value: orDash(p.fees.onlineCardRate) },
    { label: "Monthly fee", value: orDash(p.fees.monthlyFee) },
    { label: "Payout", value: p.payoutTime ? humanizeEnum(p.payoutTime) : "—" },
    { label: "Contract", value: p.contractType ? humanizeEnum(p.contractType) : "—" },
    { label: "PCI level", value: orDash(p.pciLevel) },
    { label: "Regions", value: regionLabel },
  ];

  const compareIds = [p.slug, ...alternatives.slice(0, 3).map((a) => a.slug)].join(",");

  return (
    <div className="pb-24 lg:pb-0">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Processors", path: "/processors" },
            ...(primaryCategory
              ? [{ name: primaryCategory.name, path: `/category/${primaryCategory.slug}` }]
              : []),
            { name: p.name, path: `/processor/${p.slug}` },
          ]),
          processorJsonLd({
            name: p.name,
            slug: p.slug,
            description: p.shortDescription || p.tagline,
            logo: p.logo,
            ratingAverage: p.ratingAverage,
            ratingCount: p.ratingCount,
            reviews: initialReviews.items.slice(0, 5).map((r) => ({
              author: r.reviewerName,
              rating: r.overallRating,
              title: r.title,
              body: r.body,
              datePublished: r.createdAt,
            })),
          }),
        ]}
      />

      {/* Header */}
      <section className="border-b">
        <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
          <Breadcrumb
            items={[
              { name: "Home", href: "/" },
              { name: "Processors", href: "/processors" },
              ...(primaryCategory
                ? [{ name: primaryCategory.name, href: `/category/${primaryCategory.slug}` }]
                : []),
              { name: p.name },
            ]}
          />

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-ink-0">
                {p.logo ? (
                  <Image
                    src={p.logo}
                    alt={`${p.name} logo`}
                    width={64}
                    height={64}
                    className="size-16 object-contain p-2"
                    unoptimized
                  />
                ) : (
                  <span className="text-h2 font-semibold text-ink-400">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-h1 tracking-tighter2 text-foreground">{p.name}</h1>
                  {p.isVerified && (
                    <span className="inline-flex items-center gap-1 text-accent" title="Verified">
                      <CheckCircle2 className="size-5" aria-hidden />
                      <span className="text-small font-medium">Verified</span>
                    </span>
                  )}
                  {p.isSponsored && <Badge variant="sponsored">Sponsored</Badge>}
                </div>

                {p.tagline && <p className="mt-1 text-body-lg text-muted-foreground">{p.tagline}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <RatingStars
                    value={p.ratingAverage}
                    count={p.ratingCount}
                    showValue
                    showCount
                    emptyLabel="No reviews yet"
                    size={16}
                  />
                  {p.foundedYear && (
                    <span className="inline-flex items-center gap-1 text-small text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden />
                      Founded {p.foundedYear}
                    </span>
                  )}
                  {p.headquarters && (
                    <span className="inline-flex items-center gap-1 text-small text-muted-foreground">
                      <MapPin className="size-4" aria-hidden />
                      {p.headquarters}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
              <VisitWebsiteButton
                website={p.website}
                affiliateUrl={p.affiliateUrl}
                slug={p.slug}
                variant="primary"
                className="flex-1 lg:w-full"
              />
              <LeadDialog
                processorId={p.id}
                processorName={p.name}
                website={p.website}
                affiliateUrl={p.affiliateUrl}
                source="profile-quote"
                triggerClassName="flex-1 lg:w-full"
              />
              <Link
                href={`/write-review/${p.slug}`}
                className={cn(buttonVariants({ variant: "secondary" }), "flex-1 lg:w-full")}
              >
                Write a review
              </Link>
            </div>
          </div>

          <StatStrip items={statItems} className="mt-8" />
        </div>
      </section>

      {/* Sticky sub-nav */}
      <ProfileTabs sections={sections} />

      {/* Sections */}
      <div className="mx-auto max-w-content px-4 lg:px-6">
        {/* Overview */}
        <section id="overview" className="scroll-mt-32 border-b border-border py-10">
          <SectionTitle>Overview</SectionTitle>
          {p.longDescription ? (
            <RichText html={p.longDescription} className="mt-4 max-w-prose" />
          ) : p.shortDescription ? (
            <p className="mt-4 max-w-prose text-body-lg text-muted-foreground">{p.shortDescription}</p>
          ) : (
            <p className="mt-4 text-body text-muted-foreground">No overview provided yet.</p>
          )}

          {(p.bestFor.length > 0 || p.supportedRegions.length > 0 || p.industries.length > 0) && (
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <ChipBlock title="Best for" items={p.bestFor} />
              <ChipBlock title="Regions" items={p.supportedRegions} />
              <ChipBlock title="Industries" items={p.industries} />
            </div>
          )}

          {(p.pros.length > 0 || p.cons.length > 0) && (
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {p.pros.length > 0 && (
                <div>
                  <h3 className="text-h4 text-foreground">Pros</h3>
                  <ul className="mt-3 space-y-2">
                    {p.pros.map((pro) => (
                      <li key={pro} className="flex items-start gap-2 text-body text-ink-800 dark:text-ink-200">
                        <Check className="mt-0.5 size-4 shrink-0 text-ink-900 dark:text-ink-100" aria-hidden />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.cons.length > 0 && (
                <div>
                  <h3 className="text-h4 text-foreground">Cons</h3>
                  <ul className="mt-3 space-y-2">
                    {p.cons.map((con) => (
                      <li key={con} className="flex items-start gap-2 text-body text-ink-600 dark:text-ink-400">
                        <X className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-32 border-b border-border py-10">
          <SectionTitle>Pricing</SectionTitle>

          {p.pricingSummary && (
            <div className="mt-4 rounded-lg border bg-ink-50 p-5 dark:bg-ink-900">
              <p className="text-label uppercase text-ink-500">Pricing at a glance</p>
              <p className="mt-1.5 text-body-lg text-foreground">{p.pricingSummary}</p>
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <FactList
              items={[
                {
                  label: "Pricing model",
                  value:
                    p.pricingModel.length > 0
                      ? p.pricingModel.map(humanizeEnum).join(", ")
                      : "—",
                },
                { label: "Contract", value: p.contractType ? humanizeEnum(p.contractType) : "—" },
                {
                  label: "Free trial",
                  value: p.freeTrial === true ? "Yes" : p.freeTrial === false ? "No" : "—",
                },
                { label: "Monthly minimum", value: orDash(p.fees.monthlyMinimum) },
              ]}
            />
            <div>
              <h3 className="text-label uppercase text-ink-500">Fee breakdown</h3>
              <FeeTable fees={p.fees} className="mt-3" />
            </div>
          </div>
        </section>

        {/* Features */}
        {hasFeatures && (
          <section id="features" className="scroll-mt-32 border-b border-border py-10">
            <SectionTitle>Features</SectionTitle>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <FeatureChecklist
                title="Payment methods"
                items={p.paymentMethods.map(humanizeEnum)}
              />
              <FeatureChecklist
                title="Integrations & deployment"
                items={p.integrations.map(humanizeEnum)}
              />
              <FeatureChecklist title="Capabilities" items={p.features.map(humanizeEnum)} />
              <FactList
                title="At a glance"
                items={[
                  { label: "Currencies", value: orDash(p.currencies) },
                  { label: "Payout", value: p.payoutTime ? humanizeEnum(p.payoutTime) : "—" },
                  { label: "PCI level", value: orDash(p.pciLevel) },
                  { label: "High-risk friendly", value: p.highRiskFriendly ? "Yes" : "No" },
                ]}
              />
            </div>
          </section>
        )}

        {/* Reviews */}
        <section id="reviews" className="scroll-mt-32 border-b border-border py-10">
          <SectionTitle>Reviews</SectionTitle>
          <ReviewsSection
            processorId={p.id}
            processorName={p.name}
            processorSlug={p.slug}
            average={p.ratingAverage}
            count={p.ratingCount}
            subRatings={p.subRatings}
            industries={reviewIndustries}
            initial={initialReviews}
          />
        </section>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <section id="alternatives" className="scroll-mt-32 py-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionTitle>Alternatives to {p.name}</SectionTitle>
              <Link
                href={`/compare?ids=${compareIds}`}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                Compare these
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {alternatives.map((alt) => (
                <ProcessorCard key={alt.id} processor={alt} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card p-3 lg:hidden">
        <VisitWebsiteButton
          website={p.website}
          affiliateUrl={p.affiliateUrl}
          slug={p.slug}
          variant="primary"
          className="flex-1"
        />
        <LeadDialog
          processorId={p.id}
          processorName={p.name}
          website={p.website}
          affiliateUrl={p.affiliateUrl}
          source="profile-quote-mobile"
          triggerClassName="flex-1"
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 tracking-tighter2 text-foreground">{children}</h2>;
}

function ChipBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-label uppercase text-ink-500">{title}</h3>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="neutral">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function FactList({
  title,
  items,
}: {
  title?: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div>
      {title && <h3 className="text-label uppercase text-ink-500">{title}</h3>}
      <dl className={cn("divide-y divide-ink-150 dark:divide-ink-800", title && "mt-3")}>
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-body text-muted-foreground">{it.label}</dt>
            <dd className="text-body font-medium tabular-nums text-foreground">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
