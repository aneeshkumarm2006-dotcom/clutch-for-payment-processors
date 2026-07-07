import { z } from "zod";

/**
 * Validators for the /seoteam media gallery (PATCH metadata + bulk URL import).
 * File uploads are validated separately by `assertValidImage` in `lib/upload.ts`.
 */

/** Editable metadata on a media asset (alt / title / tags). Sparse — PATCH. */
export const mediaMetadataInput = z.object({
  alt: z.string().trim().max(300, "Keep under 300 characters").optional(),
  title: z.string().trim().max(200, "Keep under 200 characters").optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30, "Too many tags").optional(),
});

export type MediaMetadataInput = z.infer<typeof mediaMetadataInput>;

/** Bulk-register externally-hosted image URLs into the library. */
export const mediaImportInput = z.object({
  urls: z
    .array(z.string().trim().url("Must be a valid URL"))
    .min(1, "Add at least one URL")
    .max(100, "Import up to 100 URLs at a time"),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

export type MediaImportInput = z.infer<typeof mediaImportInput>;
