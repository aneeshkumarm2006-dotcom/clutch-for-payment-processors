"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StarRatingInput (DESIGN §6.5) — an accessible 1–5 star picker used by the
 * write-a-review form. Implemented as a radiogroup: arrow keys move the value,
 * hover previews, and the current value is announced. Amber `star` fill matches
 * the read-only `RatingStars` so input and output look identical.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 28,
  label,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  label: string;
  id?: string;
}) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;

  const setFromKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, (value || 0) + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(1, (value || 1) - 1));
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      id={id}
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
      onKeyDown={setFromKey}
      tabIndex={0}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= shown;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            tabIndex={-1}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              size={size}
              className={cn(
                active
                  ? "fill-star text-star"
                  : "fill-ink-150 text-ink-300 dark:fill-ink-800 dark:text-ink-700",
              )}
              aria-hidden
            />
          </button>
        );
      })}
      <span className="ml-2 w-10 text-small tabular-nums text-muted-foreground" aria-hidden>
        {value ? `${value}.0` : "—"}
      </span>
    </div>
  );
}

export default StarRatingInput;
