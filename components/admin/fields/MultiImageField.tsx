"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImageFile, ApiClientError } from "@/components/admin/api-client";

/**
 * Multiple image field (PRD §10.3 — processor screenshots). Upload one or more
 * files, or paste a URL. Thumbnails with per-item remove. Controlled string[].
 */
export function MultiImageField({
  value,
  onChange,
  folder = "screenshots",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  folder?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [urlDraft, setUrlDraft] = React.useState("");

  const add = (url: string) => {
    const u = url.trim();
    if (u && !value.includes(u)) onChange([...value, u]);
  };
  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        // eslint-disable-next-line no-await-in-loop
        urls.push(await uploadImageFile(file, folder));
      }
      onChange([...value, ...urls.filter((u) => !value.includes(u))]);
      toast.success(`Uploaded ${urls.length} image${urls.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted"
            >
              <Image src={url} alt="" fill sizes="200px" className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label="Remove image"
                className="absolute right-1.5 top-1.5 rounded-full bg-ink-950/80 p-1 text-ink-50 opacity-0 transition-opacity hover:bg-ink-950 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
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
          {uploading ? "Uploading…" : "Upload images"}
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <Input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(urlDraft);
                setUrlDraft("");
              }
            }}
            placeholder="…or paste an image URL"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              add(urlDraft);
              setUrlDraft("");
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MultiImageField;
