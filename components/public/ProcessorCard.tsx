import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { cn, formatRating, orDash } from "@/lib/utils";
import { humanizeEnum } from "@/lib/labels";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProcessorCardData } from "@/lib/serialize";
import { RatingStars } from "@/components/public/RatingStars";
import { MethodIcons } from "@/components/public/MethodIcons";
import { AddToCompare } from "@/components/public/AddToCompare";
import { VisitWebsiteButton } from "@/components/public/VisitWebsiteButton";

/**
 * ProcessorCard — the signature directory component (DESIGN §6.2 / PRD §9.2).
 *
 * Server component: the card itself is static (great for SEO); only the
 * "Add to compare" toggle and "Visit website" affiliate link are client islands.
 * Whole-card click uses the stretched-link pattern (the name's `before:` overlay)
 * so the rest of the card is clickable while inner controls (`relative z-10`)
 * stay independently interactive — no nested anchors.
 */
export function ProcessorCard({
  processor,
  className,
}: {
  processor: ProcessorCardData;
  className?: string;
}) {
  const {
    name,
    slug,
    logo,
    tagline,
    shortDescription,
    ratingAverage,
    ratingCount,
    onlineCardRate,
    monthlyFee,
    payoutTime,
    bestFor,
    paymentMethods,
    isVerified,
    isSponsored,
    website,
    affiliateUrl,
  } = processor;

  const profileHref = `/processor/${slug}`;
  const chips = bestFor.slice(0, 3);
  const extraChips = bestFor.length - chips.length;

  const stats: { value: string; label: string }[] = [
    { value: orDash(onlineCardRate), label: "online rate" },
    { value: orDash(monthlyFee), label: "monthly fee" },
    { value: payoutTime ? humanizeEnum(payoutTime) : "—", label: "payout" },
  ];

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {/* Top row: logo · name/verified/sponsored · rating */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded border bg-ink-0">
          {logo ? (
            <Image
              src={logo}
              alt={`${name} logo`}
              width={44}
              height={44}
              className="size-11 object-contain p-1.5"
              unoptimized
            />
          ) : (
            <span className="text-h4 font-semibold text-ink-400">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-h3 text-foreground">
              <Link
                href={profileHref}
                className="rounded-sm outline-none transition-colors before:absolute before:inset-0 before:content-[''] hover:text-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                {name}
              </Link>
            </h3>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-accent" title="Verified">
                <CheckCircle2 className="size-4" aria-hidden />
                <span className="sr-only">Verified</span>
              </span>
            )}
            {isSponsored && <Badge variant="sponsored">Sponsored</Badge>}
          </div>
        </div>

        <div className="ml-auto shrink-0">
          <RatingStars
            value={ratingAverage}
            count={ratingCount}
            showValue
            showCount
            emptyLabel="No reviews"
            size={15}
          />
        </div>
      </div>

      {/* Tagline / short description */}
      {(tagline || shortDescription) && (
        <p className="mt-3 line-clamp-2 text-small text-muted-foreground">
          {tagline || shortDescription}
        </p>
      )}

      {/* Stat row */}
      <div className="mt-4 grid grid-cols-3 divide-x divide-ink-150 dark:divide-ink-800">
        {stats.map((s, i) => (
          <div key={s.label} className={cn("px-3", i === 0 && "pl-0")}>
            <p className="text-[0.875rem] font-semibold tabular-nums text-foreground">{s.value}</p>
            <p className="text-micro uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Best-for chips + method icons */}
      {(chips.length > 0 || paymentMethods.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Badge key={chip} variant="neutral">
              {chip}
            </Badge>
          ))}
          {extraChips > 0 && <span className="text-micro text-muted-foreground">+{extraChips}</span>}
          {paymentMethods.length > 0 && (
            <MethodIcons methods={paymentMethods} className="ml-auto" />
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <div className="relative z-10">
          <AddToCompare item={{ slug, name, logo }} />
        </div>
        <div className="relative z-10 ml-auto flex items-center gap-2">
          <VisitWebsiteButton
            website={website}
            affiliateUrl={affiliateUrl}
            slug={slug}
            variant="secondary"
            size="sm"
          />
          <Link href={profileHref} className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
            View profile
          </Link>
        </div>
      </div>

      {/* Screen-reader hint for the aggregate when present */}
      {ratingCount > 0 && (
        <span className="sr-only">
          Rated {formatRating(ratingAverage)} out of 5 from {ratingCount} reviews.
        </span>
      )}
    </article>
  );
}

export default ProcessorCard;
