"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Images, Loader2, Search } from "lucide-react";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { MediaRow } from "@/lib/media";

/**
 * Reusable "Choose from library" picker. Lists gallery images and returns the
 * selected one via `onSelect({ url, alt })`. Mounted by the seoteam cover / OG
 * image fields and the rich-text insert-image dialog so authors reuse an existing
 * image instead of re-uploading.
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (img: { url: string; alt: string }) => void;
}) {
  const [items, setItems] = React.useState<MediaRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    let active = true;
    setLoading(true);
    apiClient
      .get<{ items: MediaRow[] }>("/api/seoteam/media")
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch((err) => {
        if (active) toast.error(err instanceof ApiClientError ? err.message : "Failed to load library.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const view = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      [r.filename, r.title, r.alt, r.url, ...r.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose from library</DialogTitle>
          <DialogDescription>Pick an existing image to reuse.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : view.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Images className="size-7" />
              <p className="text-small">
                {items.length === 0
                  ? "No images in the library yet. Upload or Sync from the Gallery."
                  : "No images match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {view.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect({ url: m.url, alt: m.alt ?? "" });
                    onOpenChange(false);
                  }}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted transition-shadow hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={m.filename || m.url}
                >
                  <Image
                    src={m.url}
                    alt={m.alt ?? ""}
                    fill
                    sizes="180px"
                    className="object-cover"
                    unoptimized
                  />
                  {m.usageCount > 0 && (
                    <span className="pointer-events-none absolute bottom-1 left-1">
                      <Badge variant="success">×{m.usageCount}</Badge>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MediaPickerDialog;
