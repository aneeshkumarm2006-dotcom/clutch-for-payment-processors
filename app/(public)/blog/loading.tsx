import { Skeleton } from "@/components/ui/skeleton";
import { BlogCardSkeleton } from "@/components/public/Skeletons";

/** Blog index loading state (DESIGN §6.14). */
export default function BlogLoading() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <div className="max-w-prose space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <BlogCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
