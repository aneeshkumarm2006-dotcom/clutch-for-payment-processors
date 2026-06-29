import { SUB_RATING_KEYS, type SubRatingKey } from "@/lib/enums";
import { cn, formatCount, formatRating } from "@/lib/utils";
import type { SubRatingsData } from "@/lib/serialize";
import { RatingStars } from "@/components/public/RatingStars";

/**
 * Rating summary + sub-rating breakdown bars (DESIGN §6.4). Big average block on
 * the left, neutral (ink, not violet) track bars per dimension on the right.
 * Reused by the profile reviews summary (M4); in M3 it previews the denormalized
 * aggregate.
 */

const SUB_RATING_LABELS: Record<SubRatingKey, string> = {
  easeOfUse: "Ease of use",
  pricing: "Pricing",
  support: "Support",
  features: "Features",
  reliability: "Reliability",
};

export function RatingBreakdown({
  average,
  count,
  subRatings,
  className,
}: {
  average: number;
  count: number;
  subRatings: SubRatingsData;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center", className)}>
      {/* Average block */}
      <div className="text-center sm:text-left">
        <div className="flex items-baseline justify-center gap-1.5 sm:justify-start">
          <span className="text-[2.5rem] font-semibold leading-none tabular-nums text-foreground">
            {formatRating(average)}
          </span>
          <span className="text-small text-muted-foreground">out of 5</span>
        </div>
        <div className="mt-2 flex flex-col items-center gap-1 sm:items-start">
          <RatingStars value={average} size={16} />
          <span className="text-small text-muted-foreground">
            {count > 0 ? `${formatCount(count)} review${count === 1 ? "" : "s"}` : "No reviews yet"}
          </span>
        </div>
      </div>

      {/* Sub-rating bars */}
      <dl className="space-y-2">
        {SUB_RATING_KEYS.map((key) => {
          const val = subRatings[key] ?? 0;
          const pct = Math.max(0, Math.min(100, (val / 5) * 100));
          return (
            <div key={key} className="flex items-center gap-3">
              <dt className="w-24 shrink-0 text-small text-muted-foreground">
                {SUB_RATING_LABELS[key]}
              </dt>
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-150 dark:bg-ink-800"
                role="img"
                aria-label={`${SUB_RATING_LABELS[key]}: ${formatRating(val)} out of 5`}
              >
                <div className="h-full rounded-full bg-ink-900 dark:bg-ink-100" style={{ width: `${pct}%` }} />
              </div>
              <dd className="w-8 shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums text-foreground">
                {formatRating(val)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export default RatingBreakdown;
