"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
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
 * Insert-image dialog for the rich text editor (Shopify-style "Insert image").
 * Upload a file (→ `/api/upload` → Vercel Blob / dev disk) OR paste a URL, plus a
 * required-ish alt text field so inline images satisfy the image-alt SEO check.
 */
export function EditorImageDialog({
  open,
  onOpenChange,
  onInsert,
  folder = "blog",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (img: { src: string; alt: string }) => void;
  folder?: string;
}) {
  const [src, setSrc] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset each time the dialog is opened.
  React.useEffect(() => {
    if (open) {
      setSrc("");
      setAlt("");
    }
  }, [open]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file, folder);
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
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>
            Upload a file or paste an image URL, then add alt text.
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
            Insert image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditorImageDialog;
