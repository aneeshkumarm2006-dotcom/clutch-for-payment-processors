import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading skeletons (DESIGN §6.14) that mirror the real components' layout so
 * the page doesn't jump on hydration. Used by route `loading.tsx` files.
 */

/** Mirrors ProcessorCard (§6.2). */
export function ProcessorCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-5", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors BlogCard (§9.9). */
export function BlogCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-16 rounded-sm" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
