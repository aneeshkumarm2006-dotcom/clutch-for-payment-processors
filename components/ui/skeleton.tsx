import { cn } from "@/lib/utils";

// DESIGN §6.14 — ink-150 (dark ink-800) blocks.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-ink-150 dark:bg-ink-800", className)}
      {...props}
    />
  );
}

export { Skeleton };
