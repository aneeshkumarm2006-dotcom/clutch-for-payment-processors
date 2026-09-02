import Link from "next/link";
import { ArrowDown } from "lucide-react";
import type { IGoogleReviewsOverview, IRedditOverview } from "@/models/sentiment";
import { hasSentimentContent, TONE_LABELS } from "@/lib/sentiment";
import { cn, formatCount, formatRating } from "@/lib/utils";
import { RatingStars } from "@/components/public/RatingStars";
import {
  GOOGLE_SECTION_ID,
  REDDIT_SECTION_ID,
} from "@/components/public/reviews/OffsiteSentiment";

/**
 * The three scores, side by side, at the top of a processor's reviews page.
 *
 * This exists because the page now carries more than one rating, and the failure
 * mode of that is a reader seeing "4.8" somewhere and "4.2" somewhere else and
 * concluding the site cannot count. Naming all of them in one row, with the
 * population each describes underneath, is the fix: the numbers stop competing
 * the moment it is obvious they are measuring different things.
 *
 * It renders ONLY when there is at least one off-site source. With no Google and
 * no Reddit there is exactly one rating on the page, the summary card below says
 * it in more detail, and a strip repeating it would be furniture.
 *
 * The off-site tiles are in-page anchors, not outbound links. A reader clicking
 * "Google 4.8" wants the writeup that explains it, which is a screen further
 * down; the link off to Google itself lives in that section's header, where the
 * reader has the context to use it.
 */

function Tile({
  label,
  href,
  children,
  detail,
}: {
  label: string;
  href?: string;
  children: React.ReactNode;
  detail: string;
}) {
  const body = (
    <>
      <p className="text-label uppercase text-ink-500">{label}</p>
      <div className="mt-2 flex min-h-[1.75rem] items-center gap-2">{children}</div>
      <p className="mt-1.5 flex items-center gap-1 text-small text-muted-foreground">
        {detail}
        {href ? (
          <ArrowDown
            className="size-3 shrink-0 transition-transform group-hover:translate-y-0.5"
            aria-hidden
          />
        ) : null}
      </p>
    </>
  );

  const className = cn(
    "rounded-lg border border-border bg-card p-4",
    href && "group transition-colors hover:border-border-strong",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function RatingSources({
  name,
  ratingAverage,
  ratingCount,
  google,
  reddit,
  className,
}: {
  name: string;
  ratingAverage: number;
  ratingCount: number;
  google?: IGoogleReviewsOverview;
  reddit?: IRedditOverview;
  className?: string;
}) {
  const showGoogle = hasSentimentContent(google) && google?.rating != null;
  const showReddit = hasSentimentContent(reddit);
  if (!showGoogle && !showReddit) return null;

  const redditDetail =
    reddit?.volumeNote?.trim() ||
    (reddit?.threads?.length
      ? `${reddit.threads.length} thread${reddit.threads.length === 1 ? "" : "s"} summarized`
      : "Editor summary of the discussion");

  return (
    <section
      aria-label={`Where ${name} is rated`}
      className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      <Tile
        label="This site"
        detail={
          ratingCount > 0
            ? `${formatCount(ratingCount)} merchant review${ratingCount === 1 ? "" : "s"}`
            : "No merchant reviews yet"
        }
      >
        {ratingCount > 0 ? (
          <>
            <span className="text-h2 leading-none tabular-nums text-foreground">
              {formatRating(ratingAverage)}
            </span>
            <RatingStars value={ratingAverage} size={13} />
          </>
        ) : (
          <span className="text-body-lg font-medium text-muted-foreground">Not rated yet</span>
        )}
      </Tile>

      {showGoogle && google ? (
        <Tile
          label="Google"
          href={`#${GOOGLE_SECTION_ID}`}
          detail={
            google.reviewCount != null
              ? `${formatCount(google.reviewCount)} Google review${google.reviewCount === 1 ? "" : "s"}`
              : "On its Google listing"
          }
        >
          <span className="text-h2 leading-none tabular-nums text-foreground">
            {formatRating(google.rating)}
          </span>
          <RatingStars value={google.rating ?? 0} size={13} />
        </Tile>
      ) : null}

      {showReddit && reddit ? (
        <Tile label="Reddit" href={`#${REDDIT_SECTION_ID}`} detail={redditDetail}>
          <span className="text-h3 leading-none text-foreground">
            {reddit.tone ? TONE_LABELS[reddit.tone] : "Discussed"}
          </span>
        </Tile>
      ) : null}
    </section>
  );
}

export default RatingSources;
