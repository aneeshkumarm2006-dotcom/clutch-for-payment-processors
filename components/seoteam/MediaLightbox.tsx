"use client";

import * as React from "react";
import { Copy, ExternalLink, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { filenameFromUrl, formatBytes, formatFromUrl } from "@/lib/utils";
import type { MediaRow } from "@/lib/media";
import { copyText } from "./media-clipboard";

/**
 * Full-size preview for a single media asset — opened by clicking a thumbnail in
 * the gallery table. Read-only (metadata editing lives in MediaDetailDialog);
 * this is the "lightbox" the brief asks for, focused on seeing the image large.
 */
export function MediaLightbox({
  media,
  open,
  onOpenChange,
}: {
  media: MediaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [broken, setBroken] = React.useState(false);

  // Reset the broken-image flag whenever a different asset is shown.
  React.useEffect(() => {
    setBroken(false);
  }, [media?.id]);

  if (!media) return null;

  const name = media.filename || filenameFromUrl(media.url);
  const format = (media.format || formatFromUrl(media.url) || "").toUpperCase();
  const meta = [
    media.width && media.height ? `${media.width}×${media.height}` : null,
    formatBytes(media.bytes) !== "—" ? formatBytes(media.bytes) : null,
    format || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
          <DialogDescription>{meta || "Image preview"}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(theme(colors.ink.100)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] dark:bg-muted">
          {broken ? (
            <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
              <ImageOff className="size-8" aria-hidden />
              <p className="text-small">This image couldn’t be loaded.</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.url}
              alt={media.alt ?? ""}
              className="max-h-[70vh] w-auto object-contain"
              onError={() => setBroken(true)}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void copyText(media.url, "URL copied")}>
            <Copy className="size-4" />
            Copy URL
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href={media.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Open original
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MediaLightbox;
