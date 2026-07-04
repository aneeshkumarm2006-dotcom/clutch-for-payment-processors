"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { BlogStatus } from "@/lib/enums";
import { formatCount, formatDate } from "@/lib/utils";
import type { SeoPostRow } from "@/lib/serialize";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SeoTableRow extends SeoPostRow {
  seoReady: boolean;
  /** Published but with a future publish date — hidden until then. */
  scheduled: boolean;
}

type StatusFilter = "all" | "published" | "scheduled" | "draft";

export function SeoPostTable({ rows }: { rows: SeoTableRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = React.useState<SeoTableRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "scheduled") return rows.filter((r) => r.scheduled);
    if (statusFilter === "published")
      return rows.filter((r) => r.status === "published" && !r.scheduled);
    return rows.filter((r) => r.status === "draft");
  }, [rows, statusFilter]);

  const togglePublished = async (row: SeoTableRow) => {
    const next: BlogStatus = row.status === "published" ? "draft" : "published";
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/seoteam/posts/${row.id}`, { status: next });
      toast.success(next === "published" ? "Published." : "Moved to draft.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiClient.delete(`/api/seoteam/posts/${deleteTarget.id}`);
      toast.success(`Deleted “${deleteTarget.title}”.`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<SeoTableRow>[] = [
    {
      key: "title",
      header: "Title",
      sortAccessor: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/seoteam/${r.id}`} className="font-medium text-foreground hover:text-accent">
            {r.title}
          </Link>
          <p className="truncate text-micro text-muted-foreground">/{r.slug}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortAccessor: (r) => (r.scheduled ? "scheduled" : r.status),
      cell: (r) =>
        r.scheduled ? (
          <Badge variant="warning">Scheduled</Badge>
        ) : r.status === "published" ? (
          <Badge variant="success">Published</Badge>
        ) : (
          <Badge variant="neutral">Draft</Badge>
        ),
    },
    {
      key: "seo",
      header: "SEO",
      sortAccessor: (r) => (r.seoReady ? 1 : 0),
      cell: (r) =>
        r.seoReady ? (
          <span className="inline-flex items-center gap-1 text-small text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-small text-warning">
            <AlertTriangle className="size-3.5" aria-hidden /> Review
          </span>
        ),
    },
    {
      key: "views",
      header: "Views",
      sortAccessor: (r) => r.views,
      cell: (r) => <span className="text-small tabular-nums">{formatCount(r.views)}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortAccessor: (r) => r.publishedAt ?? r.updatedAt,
      cell: (r) => (
        <span className="text-small text-muted-foreground">
          {r.scheduled && r.publishedAt
            ? `Scheduled ${formatDate(r.publishedAt)}`
            : r.status === "published" && r.publishedAt
              ? formatDate(r.publishedAt)
              : `Updated ${formatDate(r.updatedAt)}`}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) => `${r.title} ${r.slug}`}
        searchPlaceholder="Search posts…"
        initialSort={{ key: "date", dir: "desc" }}
        emptyState="No posts yet. Write your first one."
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        }
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.title}`}
                disabled={busyId === r.id}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/seoteam/${r.id}`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/seoteam/preview/${r.id}`} target="_blank" rel="noopener">
                  <Eye className="size-4" />
                  Preview
                </Link>
              </DropdownMenuItem>
              {r.status === "published" && !r.scheduled && (
                <DropdownMenuItem asChild>
                  <Link href={`/blog/${r.slug}`} target="_blank" rel="noopener">
                    <ExternalLink className="size-4" />
                    View public
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => void togglePublished(r)}>
                {r.status === "published" ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
                {r.status === "published" ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteTarget(r);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post?</DialogTitle>
            <DialogDescription>
              This permanently deletes “{deleteTarget?.title}”. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={!!busyId}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SeoPostTable;
