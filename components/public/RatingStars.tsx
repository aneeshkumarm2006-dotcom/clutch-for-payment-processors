import { Star } from "lucide-react";
import { cn, formatCount, formatRating } from "@/lib/utils";

/**
 * RatingStars (DESIGN §6.2 / §11). Amber 5-star visual with precise fractional
 * fill, plus optional numeric value + review count. Accessible via `role="img"`
 * and an "x.x out of 5" label so the rating isn't conveyed by color alone.
 */

function StarRow({ size, filled }: { size: number; filled: boolean }) {
  return (
    <span className="flex w-max items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={size}
          aria-hidden
          className={cn(
            filled
              ? "fill-star text-star"
              : "fill-ink-200 text-ink-200 dark:fill-ink-700 dark:text-ink-700",
          )}
        />
      ))}
    </span>
  );
}

export function RatingStars({
  value,
  count,
  size = 15,
  showValue = false,
  showCount = false,
  emptyLabel,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  showCount?: boolean;
  /** Shown (muted) instead of "(0)" when there are no reviews yet. */
  emptyLabel?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(5, value || 0));
  const pct = (v / 5) * 100;
  const hasReviews = (count ?? 0) > 0;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span role="img" aria-label={`${formatRating(v)} out of 5`} className="relative inline-flex">
        <StarRow size={size} filled={false} />
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
          <StarRow size={size} filled />
        </span>
      </span>

      {showValue && hasReviews && (
        <span className="text-[0.875rem] font-semibold tabular-nums text-foreground">
          {formatRating(v)}
        </span>
      )}

      {showCount &&
        (hasReviews ? (
          <span className="text-small text-muted-foreground">({formatCount(count)})</span>
        ) : emptyLabel ? (
          <span className="text-small text-muted-foreground">{emptyLabel}</span>
        ) : null)}
    </span>
  );
}

export default RatingStars;
