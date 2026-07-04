import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { FilterRail } from "@/components/public/directory/FilterRail";
import { SortSelect } from "@/components/public/directory/SortSelect";
import { ActiveFilters } from "@/components/public/directory/ActiveFilters";
import { MobileFilters } from "@/components/public/directory/MobileFilters";
import { DirectoryPagination } from "@/components/public/directory/DirectoryPagination";
import type { DirectoryResult } from "@/lib/processors-query";

/**
 * Directory results layout (PRD §9.2 / DESIGN §4): filter rail + single-column
 * card list. Shared by `/processors` and `/category/[slug]`. The filter controls
 * are client islands; the count, list, and pagination are server-rendered.
 */
type RawParams = Record<string, string | string[] | undefined>;

export function DirectoryView({
  result,
  basePath,
  searchParams,
}: {
  result: DirectoryResult;
  basePath: string;
  searchParams: RawParams;
}) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Desktop rail */}
      <aside className="hidden lg:block lg:w-[280px] lg:shrink-0">
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
          <FilterRail />
        </div>
      </aside>

      {/* Results */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{total}</span>{" "}
            {total === 1 ? "processor" : "processors"}
          </p>
          <div className="flex items-center gap-2">
            <MobileFilters />
            <SortSelect />
          </div>
        </div>

        <ActiveFilters className="mt-4" />

        {items.length > 0 ? (
          <>
            <div className="mt-6 space-y-4">
              {items.map((p) => (
                <ProcessorCard key={p.id} processor={p} />
              ))}
            </div>
            <DirectoryPagination
              page={page}
              totalPages={totalPages}
              basePath={basePath}
              searchParams={searchParams}
            />
          </>
        ) : (
          <div className="mt-10 flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-16 text-center">
            <SearchX className="size-8 text-ink-400" aria-hidden />
            <h2 className="mt-4 text-h4 text-ink-800 dark:text-ink-200">
              No processors match these filters yet
            </h2>
            <p className="mt-1 max-w-sm text-body text-muted-foreground">
              Try widening your search: remove a filter or two, or browse the full directory.
            </p>
            <Button asChild variant="secondary" className="mt-5">
              <Link href={basePath}>Clear filters</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DirectoryView;
