"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { MediaRow } from "@/lib/media";

const FIELD_LABEL: Record<string, string> = {
  cover: "Cover image",
  og: "Social / OG image",
  inline: "In body",
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detail view for one media asset: large preview, metadata, editable alt/title/tags,
 * the "used in" list with links to each post, copy-URL, and safe-delete.
 */
export function MediaDetailDialog({
  media,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  media: MediaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (updated: MediaRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [alt, setAlt] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (media) {
      setAlt(media.alt ?? "");
      setTitle(media.title ?? "");
      setTagsText((media.tags ?? []).join(", "));
    }
  }, [media]);

  if (!media) return null;

  const tags = tagsText
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.patch<MediaRow>(`/api/seoteam/media/${media.id}`, {
        alt,
        title,
        tags,
      });
      toast.success("Saved.");
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this image from the library? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/seoteam/media/${media.id}`);
      toast.success("Image deleted.");
      onDeleted(media.id);
      onOpenChange(false);
    } catch (err) {
      // 409 = still in use — surface the descriptive server message.
      toast.error(err instanceof ApiClientError ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(media.url);
      toast.success("URL copied.");
    } catch {
      toast.error("Couldn't copy URL.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving || deleting ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{media.filename || media.title || "Image"}</DialogTitle>
          <DialogDescription>
            {media.width && media.height ? `${media.width}×${media.height} · ` : ""}
            {formatBytes(media.bytes)} · {(media.format || media.contentType || "").toUpperCase()} ·{" "}
            {media.source}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(theme(colors.ink.100)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] dark:bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt={media.alt ?? ""} className="mx-auto max-h-64 object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyUrl()}>
                <Copy className="size-4" />
                Copy URL
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <a href={media.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Open
                </a>
              </Button>
            </div>

            <div>
              <p className="mb-1.5 text-label uppercase text-muted-foreground">
                Used in {media.usageCount} place{media.usageCount === 1 ? "" : "s"}
              </p>
              {media.usage.length === 0 ? (
                <p className="text-small text-muted-foreground">
                  Not attached to any post yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {media.usage.map((u, i) => (
                    <li key={`${u.postId}-${u.field}-${i}`} className="flex items-center gap-2 text-small">
                      <Badge variant="neutral">{FIELD_LABEL[u.field] ?? u.field}</Badge>
                      <Link
                        href={`/seoteam/${u.postId}`}
                        className="min-w-0 flex-1 truncate text-accent hover:underline"
                      >
                        {u.title}
                      </Link>
                      <Badge variant={u.status === "published" ? "success" : "warning"}>
                        {u.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="media-alt">Alt text</Label>
              <Input
                id="media-alt"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Describe the image for SEO & accessibility"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="media-title">Title</Label>
              <Input
                id="media-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional internal title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="media-tags">Tags</Label>
              <Input
                id="media-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="comma, separated, tags"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="button" variant="accent" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void remove()}
                disabled={deleting}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            </div>
            {media.usageCount > 0 && (
              <p className="text-micro text-muted-foreground">
                In use — remove it from the {media.usageCount} post
                {media.usageCount === 1 ? "" : "s"} above before it can be deleted.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MediaDetailDialog;
