"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { uploadImageFile, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif";
const MEDIA_ENDPOINT = "/api/seoteam/media";

type Item = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

/**
 * Bulk-upload dialog for the media gallery. Pick many files (or drag-drop), upload
 * them sequentially through `POST /api/seoteam/media` (which registers each in the
 * library), with a per-file progress list. Calls `onUploaded` when any succeed.
 */
export function MediaUploadDialog({
  open,
  onOpenChange,
  onUploaded,
  folder = "blog",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
  folder?: string;
}) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setItems([]);
      setBusy(false);
    }
  }, [open]);

  const addFiles = (files: FileList | File[]) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Only image files are supported.");
      return;
    }
    setItems((prev) => [...prev, ...images.map((file) => ({ file, status: "pending" as const }))]);
  };

  const runUpload = async () => {
    setBusy(true);
    let anySuccess = false;
    // Sequential — avoids hammering the provider and keeps the progress list honest.
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item || item.status === "done") continue;
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it)));
      try {
        // eslint-disable-next-line no-await-in-loop
        await uploadImageFile(item.file, folder, MEDIA_ENDPOINT);
        anySuccess = true;
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "done" } : it)));
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Upload failed.";
        setItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "error", error: message } : it)),
        );
      }
    }
    setBusy(false);
    if (anySuccess) {
      onUploaded();
      const done = items.filter((it) => it.status !== "error").length;
      toast.success(`Uploaded ${done} image${done === 1 ? "" : "s"} to the library.`);
    }
  };

  const allDone = items.length > 0 && items.every((it) => it.status === "done");

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk upload images</DialogTitle>
          <DialogDescription>
            Add multiple images to the library at once. Max 5&nbsp;MB each · PNG, JPG, WebP, GIF,
            AVIF, SVG.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              dragOver ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50",
            )}
          >
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-small text-foreground">
              Drag &amp; drop images here, or <span className="text-accent">browse</span>
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="media-upload-folder-note" className="sr-only">
              Upload folder
            </Label>
            <p id="media-upload-folder-note" className="text-micro text-muted-foreground">
              Uploading to folder: <span className="font-medium text-foreground">{folder}</span>
            </p>
          </div>

          {items.length > 0 && (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
              {items.map((it, idx) => (
                <li
                  key={`${it.file.name}-${idx}`}
                  className="flex items-center gap-2 rounded px-2 py-1 text-small"
                >
                  <span className="shrink-0">
                    {it.status === "done" ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : it.status === "error" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : it.status === "uploading" ? (
                      <Loader2 className="size-4 animate-spin text-accent" />
                    ) : (
                      <Upload className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{it.file.name}</span>
                  <span className="shrink-0 text-micro text-muted-foreground">
                    {it.status === "error"
                      ? it.error
                      : `${Math.round(it.file.size / 1024)} KB`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {allDone ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => void runUpload()}
            disabled={busy || items.length === 0 || allDone}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? "Uploading…" : `Upload ${items.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MediaUploadDialog;
