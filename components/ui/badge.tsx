import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// DESIGN §6.11 — verified (violet), premier (filled violet), sponsored/neutral (ink tint).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-micro font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-transparent bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
        verified: "border-transparent bg-accent-subtle text-accent-subtle-foreground",
        premier: "border-transparent bg-accent text-accent-foreground",
        sponsored: "border-transparent bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400",
        outline: "border-border-strong text-ink-700 dark:text-ink-300",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/10 text-warning",
        destructive: "border-transparent bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
