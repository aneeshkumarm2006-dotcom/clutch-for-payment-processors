import { Skeleton } from "@/components/ui/skeleton";
import { ProcessorCardSkeleton } from "@/components/public/Skeletons";

/** Directory loading state (DESIGN §6.14). */
export default function ProcessorsLoading() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <div className="max-w-prose space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ProcessorCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
