import { Skeleton } from "@/components/ui/skeleton";

/** Blog post loading state (DESIGN §6.14). */
export default function BlogPostLoading() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <Skeleton className="h-4 w-48" />
      <div className="mx-auto mt-6 max-w-prose space-y-4">
        <Skeleton className="h-5 w-24 rounded-sm" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <Skeleton className="mx-auto mt-8 aspect-[1200/630] w-full max-w-content rounded-lg" />
      <div className="mx-auto mt-10 max-w-prose space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-1/2" : "h-4 w-full"} />
        ))}
      </div>
    </div>
  );
}
