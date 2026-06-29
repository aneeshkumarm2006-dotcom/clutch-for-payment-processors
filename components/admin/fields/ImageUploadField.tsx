"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImageFile, ApiClientError } from "@/components/admin/api-client";

/**
 * Single image field: paste a URL OR upload a file (PRD §10.3). Upload goes
 * through `POST /api/upload` → public URL (Vercel Blob / dev disk). Pasting a
 * URL means content entry never hard-depends on an upload provider.
 */
export function ImageUploadField({
  value,
  onChange,
  folder = "uploads",
  aspect = "square",
  id,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  folder?: string;
  aspect?: "square" | "wide";
  id?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file, folder);
      onChange(url);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
          aspect === "square" ? "size-20" : "h-20 w-36",
        )}
      >
        {value ? (
          <Image src={value} alt="" fill sizes="144px" className="object-contain" unoptimized />
        ) : (
          <ImageIcon className="size-6 text-ink-300" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <Input
          id={id}
          type="url"
          inputMode="url"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="https://… or upload"
        />
        <div className="flex items-center gap-2">
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
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              <X className="size-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageUploadField;
