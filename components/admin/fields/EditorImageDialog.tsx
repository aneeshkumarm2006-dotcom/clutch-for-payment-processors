"use client";

import * as React from "react";
import { toast } from "sonner";
import { Images, Loader2, Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Insert/edit-image dialog for the rich text editor (Shopify-style "Insert image").
 * Upload a file (→ `/api/upload` → Cloudinary / dev disk) OR paste a URL, plus a
 * required-ish alt text field so inline images satisfy the image-alt SEO check.
 *
 * Pass `initial` to reopen the dialog on an already-inserted image (click-to-edit):
 * the fields prefill with its current src/alt so authors can add or fix alt text
 * after upload. Omit it (or pass null) for the insert-a-new-image flow.
 */
export function EditorImageDialog({
  open,
  onOpenChange,
  onInsert,
  folder = "blog",
  initial = null,
  uploadEndpoint,
  onPickFromLibrary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (img: { src: string; alt: string }) => void;
  folder?: string;
  initial?: { src: string; alt: string } | null;
  /** Override the upload route (e.g. "/api/seoteam/media"). Defaults to /api/upload. */
  uploadEndpoint?: string;
  /** When provided, shows a "Library" button; `apply` fills the src/alt fields. */
  onPickFromLibrary?: (apply: (img: { url: string; alt: string }) => void) => void;
}) {
  const [src, setSrc] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const editing = initial != null;

  // Seed the fields each time the dialog opens — from `initial` when editing an
  // existing image, otherwise blank for a fresh insert.
  React.useEffect(() => {
    if (open) {
      setSrc(initial?.src ?? "");
      setAlt(initial?.alt ?? "");
    }
    // Only re-seed on open (not on every keystroke as `initial` identity changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file, folder, uploadEndpoint);
      setSrc(url);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const insert = () => {
    const trimmed = src.trim();
    if (!trimmed) {
      toast.error("Add an image URL or upload a file first.");
      return;
    }
    onInsert({ src: trimmed, alt: alt.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit image" : "Insert image"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the image or its alt text for SEO & accessibility."
              : "Upload a file or paste an image URL, then add alt text."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {src && (
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className="max-h-48 w-full object-contain" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="editor-img-url">Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="editor-img-url"
                type="url"
                inputMode="url"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                placeholder="https://… or upload"
              />
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </Button>
              {onPickFromLibrary && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onPickFromLibrary((img) => {
                      setSrc(img.url);
                      if (img.alt) setAlt(img.alt);
                    })
                  }
                  disabled={uploading}
                >
                  <Images className="size-4" />
                  Library
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editor-img-alt">Alt text</Label>
            <Input
              id="editor-img-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for SEO & accessibility"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="accent" onClick={insert} disabled={uploading || !src.trim()}>
            {editing ? "Save image" : "Insert image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditorImageDialog;
