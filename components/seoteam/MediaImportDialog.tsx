"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, LinkIcon } from "lucide-react";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
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

/**
 * Bulk-import dialog: paste externally-hosted image URLs (one per line) to register
 * them in the library without re-hosting. Posts JSON to `/api/seoteam/media`.
 */
export function MediaImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setText("");
  }, [open]);

  const urls = React.useMemo(
    () =>
      Array.from(
        new Set(
          text
            .split(/[\n,\s]+/)
            .map((u) => u.trim())
            .filter((u) => /^https?:\/\//i.test(u)),
        ),
      ),
    [text],
  );

  const submit = async () => {
    if (urls.length === 0) {
      toast.error("Add at least one valid image URL.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.post<{ created: number; skipped: number }>(
        "/api/seoteam/media",
        { urls },
      );
      toast.success(
        `Imported ${res.created} image${res.created === 1 ? "" : "s"}` +
          (res.skipped ? ` · ${res.skipped} already in library` : ""),
      );
      onImported();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import image URLs</DialogTitle>
          <DialogDescription>
            Register externally-hosted images (Pixabay, Unsplash, CDN links, …) into the library.
            One URL per line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="media-import-urls">Image URLs</Label>
          <textarea
            id="media-import-urls"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"https://images.example.com/one.jpg\nhttps://cdn.example.com/two.png"}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-small text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-micro text-muted-foreground">
            {urls.length} valid URL{urls.length === 1 ? "" : "s"} detected.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => void submit()}
            disabled={busy || urls.length === 0}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
            Import {urls.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MediaImportDialog;
