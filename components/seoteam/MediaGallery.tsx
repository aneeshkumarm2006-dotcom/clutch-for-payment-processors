"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ImageOff,
  Images,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MediaRow } from "@/lib/media";
import { MediaDetailDialog } from "./MediaDetailDialog";
import { MediaUploadDialog } from "./MediaUploadDialog";
import { MediaImportDialog } from "./MediaImportDialog";

type Stats = { total: number; unused: number; totalBytes: number };
type ListResponse = {
  items: MediaRow[];
  stats: Stats;
  allTags: string[];
  allFolders: string[];
};

type UsageFilter = "all" | "used" | "unused";
type SortKey = "newest" | "oldest" | "most-used" | "largest";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaGallery() {
  const [items, setItems] = React.useState<MediaRow[]>([]);
  const [stats, setStats] = React.useState<Stats>({ total: 0, unused: 0, totalBytes: 0 });
  const [allTags, setAllTags] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [usageFilter, setUsageFilter] = React.useState<UsageFilter>("all");
  const [tagFilter, setTagFilter] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("newest");

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [detail, setDetail] = React.useState<MediaRow | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<ListResponse>("/api/seoteam/media");
      setItems(data.items);
      setStats(data.stats);
      setAllTags(data.allTags);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load the gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post<{ created: number; total: number }>(
        "/api/seoteam/media/sync",
      );
      toast.success(
        res.created > 0
          ? `Discovered ${res.created} new image${res.created === 1 ? "" : "s"} from your posts.`
          : "Library is already up to date.",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  // --- Derived view (client-side filter + sort over the loaded set) ---
  const view = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items.filter((r) => {
      if (usageFilter === "used" && r.usageCount === 0) return false;
      if (usageFilter === "unused" && r.usageCount > 0) return false;
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (q) {
        const hay = [r.filename, r.title, r.alt, r.url, ...r.tags].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "most-used":
          return b.usageCount - a.usageCount;
        case "largest":
          return (b.bytes ?? 0) - (a.bytes ?? 0);
        case "newest":
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return rows;
  }, [items, query, usageFilter, tagFilter, sortKey]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected image(s)? In-use images will be skipped.`))
      return;
    setBulkDeleting(true);
    let deleted = 0;
    let skipped = 0;
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await apiClient.delete(`/api/seoteam/media/${id}`);
        deleted += 1;
      } catch {
        skipped += 1;
      }
    }
    setBulkDeleting(false);
    clearSelection();
    await load();
    toast.success(
      `Deleted ${deleted} image${deleted === 1 ? "" : "s"}` +
        (skipped ? ` · ${skipped} skipped (in use)` : ""),
    );
  };

  const onDetailChanged = (updated: MediaRow) => {
    setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetail(updated);
  };
  const onDetailDeleted = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
    setStats((s) => ({ ...s, total: Math.max(0, s.total - 1) }));
  };

  const statCards = [
    { label: "Total images", value: String(stats.total), icon: Images },
    { label: "Unused", value: String(stats.unused), icon: ImageOff },
    { label: "Storage", value: formatBytes(stats.totalBytes), icon: Upload },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Media gallery</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Manage every blog image, see where each is used, and reuse them across posts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void sync()} disabled={syncing}>
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync
          </Button>
          <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
            <LinkIcon className="size-4" />
            Import URLs
          </Button>
          <Button type="button" variant="accent" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Stats */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-label uppercase text-muted-foreground">
                  <Icon className="size-3.5" />
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-h2 tabular-nums text-foreground">{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search filename, alt, tags, URL…"
            className="pl-9"
          />
        </div>

        <select
          value={usageFilter}
          onChange={(e) => setUsageFilter(e.target.value as UsageFilter)}
          className="h-10 rounded-md border border-border bg-background px-3 text-small text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter by usage"
        >
          <option value="all">All images</option>
          <option value="used">Used only</option>
          <option value="unused">Unused only</option>
        </select>

        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-small text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="h-10 rounded-md border border-border bg-background px-3 text-small text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Sort"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most-used">Most used</option>
          <option value="largest">Largest</option>
        </select>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-small font-medium text-foreground">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void bulkDelete()}
              disabled={bulkDeleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {bulkDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              <X className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : view.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <Images className="size-8 text-muted-foreground" />
          <p className="text-body text-foreground">
            {items.length === 0 ? "No images yet." : "No images match your filters."}
          </p>
          {items.length === 0 && (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void sync()}>
                <RefreshCw className="size-4" />
                Sync from posts
              </Button>
              <Button type="button" variant="accent" size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" />
                Upload images
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {view.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <div
                key={m.id}
                className={cn(
                  "group relative overflow-hidden rounded-lg border bg-muted transition-shadow hover:shadow-pop",
                  isSelected ? "border-accent ring-2 ring-accent" : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => setDetail(m)}
                  className="block aspect-video w-full focus-visible:outline-none"
                  aria-label={`Open ${m.filename || "image"}`}
                >
                  <Image
                    src={m.url}
                    alt={m.alt ?? ""}
                    fill
                    sizes="220px"
                    className="object-cover"
                    unoptimized
                  />
                </button>

                {/* Select checkbox */}
                <label
                  className={cn(
                    "absolute left-1.5 top-1.5 flex size-5 cursor-pointer items-center justify-center rounded border bg-card/90 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(m.id)}
                    className="size-3.5 accent-[hsl(var(--accent))]"
                    aria-label="Select image"
                  />
                </label>

                {/* Usage badge */}
                <div className="pointer-events-none absolute bottom-1.5 left-1.5">
                  {m.usageCount > 0 ? (
                    <Badge variant="success">Used ×{m.usageCount}</Badge>
                  ) : (
                    <Badge variant="neutral">Unused</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <MediaDetailDialog
        media={detail}
        open={detail != null}
        onOpenChange={(o) => !o && setDetail(null)}
        onChanged={onDetailChanged}
        onDeleted={onDetailDeleted}
      />
      <MediaUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => void load()}
      />
      <MediaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void load()}
      />
    </div>
  );
}

export default MediaGallery;
