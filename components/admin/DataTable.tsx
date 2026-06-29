"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * DataTable (DESIGN §6.9 / TODO §2.1) — the reusable admin list table.
 *
 * Owns: text search, column sort, and client-side pagination over the rows it's
 * handed. Facet filters (tier/published/category, …) stay with the parent, which
 * passes the already-filtered rows and slots its controls into `toolbar` — so
 * the parent does faceting, the table does search/sort/paginate.
 *
 * Admin datasets are small (operator-managed), so client-side is the simplest
 * thing that fully satisfies §6.9.
 */
export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Falls back to `String(row[key])`. */
  cell?: (row: T) => React.ReactNode;
  /** Make the header clickable to sort; provide a comparable value. */
  sortAccessor?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Provide to enable the search box; return the haystack text for a row. */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter controls rendered in the toolbar next to search. */
  toolbar?: React.ReactNode;
  /** Trailing right-aligned actions cell per row. */
  rowActions?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  pageSize?: number;
  /** Initial sort column key + direction. */
  initialSort?: { key: string; dir: "asc" | "desc" };
}

function pageWindow(current: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  searchAccessor,
  searchPlaceholder = "Search…",
  toolbar,
  rowActions,
  emptyState,
  pageSize = 12,
  initialSort,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = React.useState(1);

  const colByKey = React.useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );

  // Reset to page 1 whenever the result set changes shape.
  React.useEffect(() => {
    setPage(1);
  }, [query, rows]);

  const filtered = React.useMemo(() => {
    if (!searchAccessor || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchAccessor(r).toLowerCase().includes(q));
  }, [rows, query, searchAccessor]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = colByKey.get(sort.key);
    if (!col?.sortAccessor) return filtered;
    const accessor = col.sortAccessor;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, colByKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: search + parent-supplied facets */}
      {(searchAccessor || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {searchAccessor && (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label="Search"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <TableHead key={col.key} className={col.headerClassName}>
                    {col.sortAccessor ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {col.header}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="size-3.5 text-accent" />
                          ) : (
                            <ArrowDown className="size-3.5 text-accent" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-ink-400" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
              {rowActions && <TableHead className="w-px text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="py-12 text-center text-small text-muted-foreground"
                >
                  {emptyState ?? "Nothing here yet."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={getRowKey(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end">{rowActions(row)}</div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: count + pager */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-small text-muted-foreground tabular-nums">
          {sorted.length} {sorted.length === 1 ? "row" : "rows"}
        </p>
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Prev
            </Button>
            {pageWindow(safePage, totalPages).map((p) => (
              <Button
                key={p}
                variant={p === safePage ? "primary" : "ghost"}
                size="sm"
                className="min-w-9 tabular-nums"
                onClick={() => setPage(p)}
                aria-current={p === safePage ? "page" : undefined}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}

export default DataTable;
