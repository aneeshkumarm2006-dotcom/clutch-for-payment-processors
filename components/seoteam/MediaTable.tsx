"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Code2,
  Copy,
  ExternalLink,
  ImageOff,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn, filenameFromUrl, formatBytes, formatDate, formatFromUrl } from "@/lib/utils";
import type { MediaRow } from "@/lib/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TagInput } from "@/components/admin/fields/TagInput";
import { copyText, imgSnippet, markdownSnippet } from "./media-clipboard";

/** Optimistic metadata patch; resolves once the server round-trip settles. */
export type MediaPatchFn = (id: string, patch: { alt?: string; tags?: string[] }) => Promise<void>;

type SortKey = "filename" | "usage" | "size" | "dimensions" | "uploaded";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const SORT_ACCESSORS: Record<SortKey, (r: MediaRow) => string | number> = {
  filename: (r) => (r.filename || filenameFromUrl(r.url)).toLowerCase(),
  usage: (r) => r.usageCount,
  size: (r) => r.bytes ?? 0,
  dimensions: (r) => (r.width ?? 0) * (r.height ?? 0),
  uploaded: (r) => r.createdAt,
};

const FIELD_LABEL: Record<string, string> = { cover: "Cover", og: "OG", inline: "Body" };

const PAGE_SIZE = 24;

export function isMissingAlt(row: MediaRow): boolean {
  return !row.alt || !row.alt.trim();
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

export function MediaTable({
  rows,
  selected,
  onToggleSelect,
  onToggleVisible,
  onPreview,
  onEdit,
  onDelete,
  onPatch,
  allTags,
}: {
  rows: MediaRow[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleVisible: (ids: string[], checked: boolean) => void;
  onPreview: (row: MediaRow) => void;
  onEdit: (row: MediaRow) => void;
  onDelete: (row: MediaRow) => void;
  onPatch: MediaPatchFn;
  allTags: string[];
}) {
  const [sort, setSort] = React.useState<SortState>({ key: "uploaded", dir: "desc" });
  const [page, setPage] = React.useState(1);

  // Reset to the first page when the result *size* changes (filter/search/delete),
  // but NOT when a row is edited in place — that would yank the user off their page.
  React.useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const accessor = SORT_ACCESSORS[sort.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears back to default order
    });
  };

  const visibleIds = rows.map((r) => r.id);
  const allSelected = rows.length > 0 && visibleIds.every((id) => selected.has(id));

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <Table aria-label="Media library">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => onToggleVisible(visibleIds, v === true)}
                  aria-label={allSelected ? "Deselect all" : "Select all"}
                />
              </TableHead>
              <TableHead className="w-14">Preview</TableHead>
              <SortHead label="Filename" active={sort?.key === "filename"} dir={sort?.dir} onClick={() => toggleSort("filename")} />
              <TableHead className="whitespace-nowrap">Alt text</TableHead>
              <TableHead className="whitespace-nowrap">Tags</TableHead>
              <SortHead label="Used in" active={sort?.key === "usage"} dir={sort?.dir} onClick={() => toggleSort("usage")} />
              <SortHead label="Dimensions" active={sort?.key === "dimensions"} dir={sort?.dir} onClick={() => toggleSort("dimensions")} className="text-right" />
              <SortHead label="Size" active={sort?.key === "size"} dir={sort?.dir} onClick={() => toggleSort("size")} className="text-right" />
              <TableHead className="whitespace-nowrap">Format</TableHead>
              <TableHead className="whitespace-nowrap">URL</TableHead>
              <SortHead label="Uploaded" active={sort?.key === "uploaded"} dir={sort?.dir} onClick={() => toggleSort("uploaded")} />
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => onToggleSelect(row.id)}
                    aria-label={`Select ${row.filename || "image"}`}
                  />
                </TableCell>
                <TableCell>
                  <Thumb row={row} onClick={() => onPreview(row)} />
                </TableCell>
                <TableCell>
                  <FilenameCell row={row} />
                </TableCell>
                <TableCell>
                  <AltCell row={row} onPatch={onPatch} />
                </TableCell>
                <TableCell>
                  <TagsCell row={row} onPatch={onPatch} allTags={allTags} />
                </TableCell>
                <TableCell>
                  <UsedInCell row={row} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-small tabular-nums text-muted-foreground">
                  {row.width && row.height ? `${row.width}×${row.height}` : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-small tabular-nums text-muted-foreground">
                  {formatBytes(row.bytes)}
                </TableCell>
                <TableCell>
                  <FormatCell row={row} />
                </TableCell>
                <TableCell>
                  <UrlCell url={row.url} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-small text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <RowActions row={row} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer: count + pager (mirrors the admin DataTable) */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-small tabular-nums text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "image" : "images"}
        </p>
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
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
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
              Next
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function SortHead({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir?: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead
      className={cn("whitespace-nowrap", className)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className?.includes("text-right") && "flex-row-reverse",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5 text-accent" />
          ) : (
            <ArrowDown className="size-3.5 text-accent" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 text-ink-400" />
        )}
      </button>
    </TableHead>
  );
}

/* -------------------------------------------------------------------------- */
/* Cells                                                                       */
/* -------------------------------------------------------------------------- */

function Thumb({ row, onClick }: { row: MediaRow; onClick: () => void }) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [row.url]);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block size-12 shrink-0 overflow-hidden rounded border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Preview ${row.filename || "image"}`}
    >
      {broken ? (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-4" aria-hidden />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.url}
          alt={row.alt ?? ""}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
    </button>
  );
}

function FilenameCell({ row }: { row: MediaRow }) {
  const name = row.filename || filenameFromUrl(row.url);
  return (
    <div className="min-w-0 max-w-[14rem]">
      <p className="truncate text-small font-medium text-foreground" title={name}>
        {name}
      </p>
      {row.pathname && (
        <p className="truncate font-mono text-micro text-muted-foreground" title={row.pathname}>
          {row.pathname}
        </p>
      )}
    </div>
  );
}

function AltCell({ row, onPatch }: { row: MediaRow; onPatch: MediaPatchFn }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(row.alt ?? "");
  const missing = isMissingAlt(row);

  const start = () => {
    setValue(row.alt ?? "");
    setEditing(true);
  };
  const submit = () => {
    setEditing(false);
    const next = value.trim();
    if (next === (row.alt ?? "").trim()) return; // no-op
    void onPatch(row.id, { alt: next });
  };
  const cancel = () => {
    setEditing(false);
    setValue(row.alt ?? "");
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder="Describe this image…"
        className="h-8 min-w-[13rem] text-small"
        aria-label="Edit alt text"
      />
    );
  }

  if (missing) {
    return (
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1 rounded-sm text-small text-warning hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Add missing alt text"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        Missing alt
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className="block max-w-[16rem] truncate text-left text-small text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={row.alt}
      aria-label="Edit alt text"
    >
      {row.alt}
    </button>
  );
}

function TagsCell({ row, onPatch, allTags }: { row: MediaRow; onPatch: MediaPatchFn; allTags: string[] }) {
  const [open, setOpen] = React.useState(false);
  const tags = row.tags ?? [];
  const setTags = (next: string[]) => void onPatch(row.id, { tags: next });
  const remove = (t: string) => setTags(tags.filter((x) => x !== t));
  const suggestions = allTags.filter((t) => !tags.includes(t)).slice(0, 12);

  return (
    <div className="flex max-w-[16rem] flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-0.5 rounded-sm bg-ink-100 py-0.5 pl-1.5 pr-0.5 text-micro text-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            aria-label={`Remove tag ${t}`}
            className="rounded-sm p-0.5 text-ink-500 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Edit tags"
            className="inline-flex items-center gap-0.5 rounded-sm border border-dashed border-border-strong px-1.5 py-0.5 text-micro text-muted-foreground hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3" />
            {tags.length === 0 && "Add"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <p className="mb-2 text-label uppercase text-muted-foreground">Tags</p>
          <TagInput value={tags} onChange={setTags} placeholder="Add a tag, press Enter…" />
          {suggestions.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1.5 text-micro text-muted-foreground">Suggested</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTags([...tags, t])}
                    className="rounded-sm border border-border px-1.5 py-0.5 text-micro text-muted-foreground hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function UsedInCell({ row }: { row: MediaRow }) {
  if (row.usage.length === 0) {
    return <Badge variant="neutral">Unused</Badge>;
  }
  return (
    <div className="flex max-w-[16rem] flex-col gap-1">
      {row.usage.map((u, i) => (
        <Link
          key={`${u.postId}-${u.field}-${i}`}
          href={`/seoteam/${u.postId}`}
          className="group flex items-center gap-1.5 text-small"
          title={`${u.title} — ${FIELD_LABEL[u.field] ?? u.field} · ${u.status}`}
        >
          <Badge variant="outline" className="shrink-0">
            {FIELD_LABEL[u.field] ?? u.field}
          </Badge>
          <span className="truncate text-accent group-hover:underline">{u.title}</span>
        </Link>
      ))}
    </div>
  );
}

function FormatCell({ row }: { row: MediaRow }) {
  const format = row.format || formatFromUrl(row.url) || row.contentType?.split("/")[1];
  if (!format) return <span className="text-small text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className="uppercase">
      {format}
    </Badge>
  );
}

function UrlCell({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="max-w-[11rem] truncate font-mono text-micro text-muted-foreground" title={url}>
        {url}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => void copyText(url, "URL copied")}
        aria-label="Copy URL"
      >
        <Copy className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open image in a new tab">
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

function RowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: MediaRow;
  onEdit: (row: MediaRow) => void;
  onDelete: (row: MediaRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${row.filename || "image"}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => void copyText(row.url, "URL copied")}>
          <LinkIcon className="size-4" />
          Copy URL
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyText(markdownSnippet(row), "Markdown copied")}>
          <Copy className="size-4" />
          Copy markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyText(imgSnippet(row), "&lt;img&gt; snippet copied")}>
          <Code2 className="size-4" />
          Copy &lt;img&gt; tag
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onEdit(row)}>
          <Pencil className="size-4" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onDelete(row);
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MediaTable;
