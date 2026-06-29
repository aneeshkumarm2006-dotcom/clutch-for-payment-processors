"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { CategoryType } from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
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

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  displayOrder: number;
  isPublished: boolean;
}

export function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const togglePublished = async (row: CategoryRow) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/categories/${row.id}`, { isPublished: !row.isPublished });
      toast.success(row.isPublished ? "Unpublished." : "Published.");
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
      await apiClient.delete(`/api/categories/${deleteTarget.id}`);
      toast.success(`Deleted “${deleteTarget.name}”.`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      key: "name",
      header: "Name",
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/admin/categories/${r.id}`}
            className="font-medium text-foreground hover:text-accent"
          >
            {r.name}
          </Link>
          <p className="truncate text-micro text-muted-foreground">/{r.slug}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortAccessor: (r) => r.type,
      cell: (r) => <span className="text-small">{humanizeEnum(r.type)}</span>,
    },
    {
      key: "displayOrder",
      header: "Order",
      sortAccessor: (r) => r.displayOrder,
      cell: (r) => <span className="tabular-nums text-small">{r.displayOrder}</span>,
    },
    {
      key: "isPublished",
      header: "Status",
      sortAccessor: (r) => (r.isPublished ? 1 : 0),
      cell: (r) => (
        <Badge variant={r.isPublished ? "success" : "warning"}>
          {r.isPublished ? "Published" : "Draft"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) => `${r.name} ${r.slug}`}
        searchPlaceholder="Search categories…"
        initialSort={{ key: "displayOrder", dir: "asc" }}
        emptyState="No categories yet. Create your first one."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.name}`}
                disabled={busyId === r.id}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/admin/categories/${r.id}`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/category/${r.slug}`} target="_blank" rel="noopener">
                  <ExternalLink className="size-4" />
                  View public
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void togglePublished(r)}>
                {r.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {r.isPublished ? "Unpublish" : "Publish"}
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
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              This deletes “{deleteTarget?.name}” and removes it from any processor that uses it.
              This can’t be undone.
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

export default CategoriesTable;
