"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import type { ListingTier } from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { cn, formatRating, formatDate } from "@/lib/utils";
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
import type { CategoryOption } from "@/components/admin/fields/CategoryMultiSelect";

export interface ProcessorRow {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  ratingAverage: number;
  ratingCount: number;
  listingTier: ListingTier;
  isVerified: boolean;
  isSponsored: boolean;
  isFeatured: boolean;
  isPublished: boolean;
  categories: string[];
  updatedAt: string;
}

export function ProcessorsTable({
  rows,
  categories,
}: {
  rows: ProcessorRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [tier, setTier] = React.useState<string>("all");
  const [published, setPublished] = React.useState<string>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [deleteTarget, setDeleteTarget] = React.useState<ProcessorRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (tier !== "all" && r.listingTier !== tier) return false;
        if (published === "published" && !r.isPublished) return false;
        if (published === "draft" && r.isPublished) return false;
        if (category !== "all" && !r.categories.includes(category)) return false;
        return true;
      }),
    [rows, tier, published, category],
  );

  const togglePublished = async (row: ProcessorRow) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/processors/${row.id}`, { isPublished: !row.isPublished });
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
      await apiClient.delete(`/api/processors/${deleteTarget.id}`);
      toast.success(`Deleted “${deleteTarget.name}”.`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<ProcessorRow>[] = [
    {
      key: "name",
      header: "Processor",
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-card">
            {r.logo ? (
              <Image
                src={r.logo}
                alt=""
                width={36}
                height={36}
                className="size-9 object-contain p-1"
                unoptimized
              />
            ) : (
              <span className="text-micro font-semibold text-ink-400">
                {r.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/processors/${r.id}`}
              className="font-medium text-foreground hover:text-accent"
            >
              {r.name}
            </Link>
            <p className="truncate text-micro text-muted-foreground">/{r.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortAccessor: (r) => r.ratingAverage,
      cell: (r) =>
        r.ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star className="size-3.5 fill-star text-star" aria-hidden />
            <span className="font-medium">{formatRating(r.ratingAverage)}</span>
            <span className="text-small text-muted-foreground">({r.ratingCount})</span>
          </span>
        ) : (
          <span className="text-small text-muted-foreground">—</span>
        ),
    },
    {
      key: "tier",
      header: "Tier",
      sortAccessor: (r) => r.listingTier,
      cell: (r) => <span className="text-small">{humanizeEnum(r.listingTier)}</span>,
    },
    {
      key: "badges",
      header: "Flags",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={r.isPublished ? "success" : "warning"}>
            {r.isPublished ? "Published" : "Draft"}
          </Badge>
          {r.isVerified && <Badge variant="verified">Verified</Badge>}
          {r.isSponsored && <Badge variant="sponsored">Sponsored</Badge>}
          {r.isFeatured && <Badge variant="neutral">Featured</Badge>}
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortAccessor: (r) => r.updatedAt,
      cell: (r) => <span className="text-small text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ];

  const filterSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[8rem] gap-1.5" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) => `${r.name} ${r.slug}`}
        searchPlaceholder="Search processors…"
        initialSort={{ key: "updatedAt", dir: "desc" }}
        emptyState="No processors match. Add one or widen the filters."
        toolbar={
          <>
            {filterSelect(tier, setTier, "Filter by tier", [
              { value: "all", label: "All tiers" },
              { value: "free", label: "Free" },
              { value: "verified", label: "Verified" },
              { value: "premier", label: "Premier" },
            ])}
            {filterSelect(published, setPublished, "Filter by status", [
              { value: "all", label: "All statuses" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Draft" },
            ])}
            {categories.length > 0 &&
              filterSelect(category, setCategory, "Filter by category", [
                { value: "all", label: "All categories" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ])}
          </>
        }
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
                <Link href={`/admin/processors/${r.id}`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/processor/${r.slug}`} target="_blank" rel="noopener">
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
            <DialogTitle>Delete processor?</DialogTitle>
            <DialogDescription>
              This permanently deletes “{deleteTarget?.name}” and its reviews. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={!!busyId}
              className={cn(busyId && "opacity-80")}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProcessorsTable;
