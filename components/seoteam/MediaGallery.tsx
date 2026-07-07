"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  ImageOff,
  Images,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Loader2,
  RefreshCw,
  Search,
  Tag,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatBytes } from "@/lib/utils";
import type { MediaRow } from "@/lib/media";
import { MediaDetailDialog } from "./MediaDetailDialog";
import { MediaUploadDialog } from "./MediaUploadDialog";
import { MediaImportDialog } from "./MediaImportDialog";
import { MediaLightbox } from "./MediaLightbox";
import { MediaTable, isMissingAlt } from "./MediaTable";
import { copyText } from "./media-clipboard";

type Stats = { total: number; unused: number; totalBytes: number };
type ListResponse = {
  items: MediaRow[];
  stats: Stats;
  allTags: string[];
  allFolders: string[];
};

type UsageFilter = "all" | "used" | "unused";
type SortKey = "newest" | "oldest" | "most-used" | "largest";
type ViewMode = "grid" | "table";

const VIEW_STORAGE_KEY = "seoteam:gallery:view";

export function MediaGallery() {
  const [items, setItems] = React.useState<MediaRow[]>([]);
  const [stats, setStats] = React.useState<Stats>({ total: 0, unused: 0, totalBytes: 0 });
  const [allTags, setAllTags] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [usageFilter, setUsageFilter] = React.useState<UsageFilter>("all");
  const [missingAltOnly, setMissingAltOnly] = React.useState(false);
  const [tagFilter, setTagFilter] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("newest");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [detail, setDetail] = React.useState<MediaRow | null>(null);
  const [preview, setPreview] = React.useState<MediaRow | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  // Latest items, readable inside async callbacks without re-creating them.
  const itemsRef = React.useRef(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Restore the persisted view preference on mount (avoids a hydration mismatch).
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "table") setViewMode(saved);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const changeView = (v: ViewMode) => {
    setViewMode(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

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

  // --- Filters (search + usage + tag + missing-alt) shared by BOTH views ---
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (usageFilter === "used" && r.usageCount === 0) return false;
      if (usageFilter === "unused" && r.usageCount > 0) return false;
      if (missingAltOnly && !isMissingAlt(r)) return false;
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (q) {
        const hay = [r.filename, r.title, r.alt, r.url, ...r.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, usageFilter, missingAltOnly, tagFilter]);

  // Grid keeps the dropdown sort; the table sorts by clickable column headers.
  const gridView = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
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
  }, [filtered, sortKey]);

  const missingAltCount = React.useMemo(() => items.filter(isMissingAlt).length, [items]);

  // --- Selection ---
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleVisible = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedRows = React.useMemo(
    () => items.filter((r) => selected.has(r.id)),
    [items, selected],
  );
  const tagsInSelection = React.useMemo(
    () => Array.from(new Set(selectedRows.flatMap((r) => r.tags))).sort(),
    [selectedRows],
  );

  // Keep the tag filter + suggestions fresh when new tags are introduced inline,
  // so a just-added tag is immediately filterable without reloading the gallery.
  const mergeTags = React.useCallback((incoming: string[]) => {
    setAllTags((prev) => {
      const set = new Set(prev);
      let changed = false;
      for (const t of incoming) {
        if (!set.has(t)) {
          set.add(t);
          changed = true;
        }
      }
      return changed ? Array.from(set).sort() : prev;
    });
  }, []);

  // --- Metadata edit (optimistic, with rollback) — used by table inline edits ---
  const patchMedia = React.useCallback(
    async (id: string, patch: { alt?: string; tags?: string[] }) => {
      const prev = itemsRef.current.find((r) => r.id === id);
      setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      try {
        const updated = await apiClient.patch<MediaRow>(`/api/seoteam/media/${id}`, patch);
        setItems((rows) => rows.map((r) => (r.id === id ? updated : r)));
        mergeTags(updated.tags);
      } catch (err) {
        if (prev) setItems((rows) => rows.map((r) => (r.id === id ? prev : r)));
        toast.error(err instanceof ApiClientError ? err.message : "Couldn't save that change.");
      }
    },
    [mergeTags],
  );

  // --- Delete a single asset (from the table's row actions) ---
  const deleteOne = async (m: MediaRow) => {
    const confirmMsg =
      m.usageCount > 0
        ? `“${m.filename || "This image"}” is still used in ${m.usageCount} post${m.usageCount === 1 ? "" : "s"}, so deletion will be blocked until it's removed there. Continue anyway?`
        : `Delete “${m.filename || "this image"}”? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await apiClient.delete(`/api/seoteam/media/${m.id}`);
      setItems((prev) => prev.filter((r) => r.id !== m.id));
      setStats((s) => ({
        ...s,
        total: Math.max(0, s.total - 1),
        unused: Math.max(0, s.unused - (m.usageCount === 0 ? 1 : 0)),
      }));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(m.id);
        return next;
      });
      toast.success("Image deleted.");
    } catch (err) {
      // 409 = still in use — surface the descriptive server message.
      toast.error(err instanceof ApiClientError ? err.message : "Delete failed.");
    }
  };

  // --- Bulk actions over the current selection ---
  const runBulkPatch = async (
    mutate: (row: MediaRow) => { tags?: string[]; alt?: string } | null,
    done: (n: number) => string,
  ) => {
    const targets = itemsRef.current.filter((r) => selected.has(r.id));
    if (targets.length === 0) return;
    setBulkBusy(true);
    const updates = new Map<string, MediaRow>();
    for (const row of targets) {
      const patch = mutate(row);
      if (!patch) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        const updated = await apiClient.patch<MediaRow>(`/api/seoteam/media/${row.id}`, patch);
        updates.set(row.id, updated);
      } catch {
        /* skip failures; report the count that succeeded */
      }
    }
    if (updates.size > 0) {
      setItems((prev) => prev.map((r) => updates.get(r.id) ?? r));
      mergeTags(Array.from(updates.values()).flatMap((u) => u.tags));
    }
    setBulkBusy(false);
    toast.success(done(updates.size));
  };

  const bulkAddTag = (tag: string) =>
    runBulkPatch(
      (row) => (row.tags.includes(tag) ? null : { tags: [...row.tags, tag] }),
      (n) => `Added “${tag}” to ${n} image${n === 1 ? "" : "s"}.`,
    );
  const bulkRemoveTag = (tag: string) =>
    runBulkPatch(
      (row) => (row.tags.includes(tag) ? { tags: row.tags.filter((t) => t !== tag) } : null),
      (n) => `Removed “${tag}” from ${n} image${n === 1 ? "" : "s"}.`,
    );
  const bulkCopyUrls = () => {
    const urls = selectedRows.map((r) => r.url).join("\n");
    void copyText(urls, `Copied ${selectedRows.length} URL${selectedRows.length === 1 ? "" : "s"}.`);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected image(s)? In-use images will be skipped.`))
      return;
    setBulkBusy(true);
    let deleted = 0;
    let skipped = 0;
    const deletedIds = new Set<string>();
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await apiClient.delete(`/api/seoteam/media/${id}`);
        deleted += 1;
        deletedIds.add(id);
      } catch {
        skipped += 1;
      }
    }
    setItems((prev) => prev.filter((r) => !deletedIds.has(r.id)));
    setStats((s) => ({ ...s, total: Math.max(0, s.total - deleted) }));
    setBulkBusy(false);
    clearSelection();
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
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const statCards = [
    { label: "Total images", value: String(stats.total), icon: Images },
    { label: "Unused", value: String(stats.unused), icon: ImageOff },
    { label: "Missing alt", value: String(missingAltCount), icon: AlertTriangle },
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
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
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
      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            aria-label="Search images"
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

        <Button
          type="button"
          variant="secondary"
          onClick={() => setMissingAltOnly((v) => !v)}
          aria-pressed={missingAltOnly}
          className={cn("h-10", missingAltOnly && "border-accent text-accent")}
        >
          <AlertTriangle className="size-4" />
          Missing alt
          {missingAltCount > 0 && <span className="tabular-nums">({missingAltCount})</span>}
        </Button>

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

        {viewMode === "grid" && (
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
        )}

        {/* View toggle (persisted to localStorage) */}
        <div
          role="group"
          aria-label="View mode"
          className="ml-auto flex items-center gap-0.5 rounded-md border border-border-strong p-0.5"
        >
          <button
            type="button"
            onClick={() => changeView("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              viewMode === "grid"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => changeView("table")}
            aria-label="Table view"
            aria-pressed={viewMode === "table"}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              viewMode === "table"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-small font-medium text-foreground">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={bulkCopyUrls} disabled={bulkBusy}>
              <Copy className="size-4" />
              Copy URLs
            </Button>
            <BulkAddTagButton suggestions={allTags} disabled={bulkBusy} onAdd={(t) => void bulkAddTag(t)} />
            <BulkRemoveTagButton tags={tagsInSelection} disabled={bulkBusy} onRemove={(t) => void bulkRemoveTag(t)} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void bulkDelete()}
              disabled={bulkBusy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {bulkBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={bulkBusy}>
              <X className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Body: loading skeletons → empty state → grid | table */}
      {loading ? (
        <GallerySkeleton mode={viewMode} />
      ) : filtered.length === 0 ? (
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
      ) : viewMode === "table" ? (
        <MediaTable
          rows={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleVisible={toggleVisible}
          onPreview={setPreview}
          onEdit={setDetail}
          onDelete={(m) => void deleteOne(m)}
          onPatch={patchMedia}
          allTags={allTags}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {gridView.map((m) => {
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
                  onClick={() => setPreview(m)}
                  className="relative block aspect-video w-full focus-visible:outline-none"
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

                {/* Missing-alt flag (SEO gap) */}
                {isMissingAlt(m) && (
                  <div className="pointer-events-none absolute right-1.5 top-1.5">
                    <Badge variant="warning">No alt</Badge>
                  </div>
                )}

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
      <MediaLightbox media={preview} open={preview != null} onOpenChange={(o) => !o && setPreview(null)} />
      <MediaDetailDialog
        media={detail}
        open={detail != null}
        onOpenChange={(o) => !o && setDetail(null)}
        onChanged={onDetailChanged}
        onDeleted={onDetailDeleted}
      />
      <MediaUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={() => void load()} />
      <MediaImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load()} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                            */
/* -------------------------------------------------------------------------- */

function GallerySkeleton({ mode }: { mode: ViewMode }) {
  if (mode === "table") {
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-12 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="aspect-video w-full rounded-lg" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bulk tag popovers                                                           */
/* -------------------------------------------------------------------------- */

function BulkAddTagButton({
  suggestions,
  disabled,
  onAdd,
}: {
  suggestions: string[];
  disabled?: boolean;
  onAdd: (tag: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    onAdd(tag);
    setDraft("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled}>
          <Tag className="size-4" />
          Add tag
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-label uppercase text-muted-foreground">Add tag to selection</p>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            }
          }}
          placeholder="Tag name, press Enter…"
          autoFocus
          aria-label="New tag"
        />
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {suggestions.slice(0, 12).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => commit(t)}
                className="rounded-sm border border-border px-1.5 py-0.5 text-micro text-muted-foreground hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function BulkRemoveTagButton({
  tags,
  disabled,
  onRemove,
}: {
  tags: string[];
  disabled?: boolean;
  onRemove: (tag: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (tags.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled}>
          <Tags className="size-4" />
          Remove tag
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-label uppercase text-muted-foreground">Remove tag from selection</p>
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onRemove(t);
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-sm bg-ink-100 px-1.5 py-0.5 text-micro text-ink-700 hover:bg-destructive/10 hover:text-destructive dark:bg-ink-800 dark:text-ink-200"
            >
              {t}
              <X className="size-2.5" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MediaGallery;
