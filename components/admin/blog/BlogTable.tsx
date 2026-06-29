"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { BlogStatus } from "@/lib/enums";
import { formatDate } from "@/lib/utils";
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

export interface BlogRow {
  id: string;
  title: string;
  slug: string;
  author: string;
  status: BlogStatus;
  publishedAt?: string;
  updatedAt: string;
}

export function BlogTable({ rows }: { rows: BlogRow[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = React.useState<BlogRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const togglePublished = async (row: BlogRow) => {
    const next: BlogStatus = row.status === "published" ? "draft" : "published";
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/blog/${row.id}`, { status: next });
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
      await apiClient.delete(`/api/blog/${deleteTarget.id}`);
      toast.success(`Deleted “${deleteTarget.title}”.`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<BlogRow>[] = [
    {
      key: "title",
      header: "Title",
      sortAccessor: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/admin/blog/${r.id}`}
            className="font-medium text-foreground hover:text-accent"
          >
            {r.title}
          </Link>
          <p className="truncate text-micro text-muted-foreground">/{r.slug}</p>
        </div>
      ),
    },
    {
      key: "author",
      header: "Author",
      sortAccessor: (r) => r.author.toLowerCase(),
      cell: (r) => <span className="text-small">{r.author}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortAccessor: (r) => r.status,
      cell: (r) => (
        <Badge variant={r.status === "published" ? "success" : "warning"}>
          {r.status === "published" ? "Published" : "Draft"}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortAccessor: (r) => r.publishedAt ?? r.updatedAt,
      cell: (r) => (
        <span className="text-small text-muted-foreground">
          {r.status === "published" && r.publishedAt
            ? formatDate(r.publishedAt)
            : `Updated ${formatDate(r.updatedAt)}`}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) => `${r.title} ${r.slug} ${r.author}`}
        searchPlaceholder="Search posts…"
        initialSort={{ key: "date", dir: "desc" }}
        emptyState="No posts yet. Write your first one."
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
                <Link href={`/admin/blog/${r.id}`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {r.status === "published" && (
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
                {r.status === "published" ? "Move to draft" : "Publish"}
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

export default BlogTable;
