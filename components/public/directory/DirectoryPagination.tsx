import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

/**
 * Server-rendered, crawlable directory pagination (DESIGN §6.12 / PRD §13). Real
 * <a href> links that preserve the current filters so paginated URLs are
 * shareable + indexable.
 */
type RawParams = Record<string, string | string[] | undefined>;

function pageHref(basePath: string, searchParams: RawParams, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  if (page <= 1) sp.delete("page");
  else sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Windowed page list with ellipses: 1 … p-1 p p+1 … N. */
function pageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("...");
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push("...");
  out.push(total);
  return out;
}

export function DirectoryPagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: RawParams;
}) {
  if (totalPages <= 1) return null;
  const pages = pageList(page, totalPages);

  return (
    <Pagination className="mt-10 justify-center">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <PaginationPrevious href={pageHref(basePath, searchParams, page - 1)} />
          ) : (
            <PaginationPrevious href="#" aria-disabled className="pointer-events-none opacity-40" />
          )}
        </PaginationItem>

        {pages.map((p, i) =>
          p === "..." ? (
            // eslint-disable-next-line react/no-array-index-key
            <PaginationItem key={`e-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink href={pageHref(basePath, searchParams, p)} isActive={p === page}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          {page < totalPages ? (
            <PaginationNext href={pageHref(basePath, searchParams, page + 1)} />
          ) : (
            <PaginationNext href="#" aria-disabled className="pointer-events-none opacity-40" />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default DirectoryPagination;
