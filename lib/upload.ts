import { ApiError } from "@/lib/api";

/**
 * lib/upload.ts — one image-upload interface, provider-agnostic (PRD §6 / §10.3
 * / TODO §2.1). Callers (the `/api/upload` route + admin image fields) only ever
 * touch `uploadImage()`; swapping hosts is a change here and nowhere else.
 *
 * Provider resolution order:
 *   1. Vercel Blob   — when `BLOB_READ_WRITE_TOKEN` is set (the chosen default,
 *                      see NOTES.md). Returns a public CDN URL.
 *   2. Cloudinary    — stub left intentionally simple; wire `CLOUDINARY_URL`
 *                      here if the operator prefers it (drop-in alternative).
 *   3. Local disk    — DEV ONLY fallback (`public/uploads/`) so an operator can
 *                      add content with no cloud creds. Not used in production
 *                      (Vercel's filesystem is read-only at runtime).
 *
 * The admin image fields also accept a pasted URL, so content entry never hard
 * depends on an upload provider.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export interface UploadResult {
  url: string;
  pathname: string;
}

/** Validate an incoming image (type + size). Throws `ApiError(400)` on failure. */
export function assertValidImage(file: { type: string; size: number }) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ApiError(400, "Unsupported image type. Use PNG, JPG, WebP, GIF, AVIF, or SVG.");
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError(400, "Image is too large (max 5 MB).");
  }
}

/** Build a collision-resistant, URL-safe object key from the original filename. */
function buildKey(originalName: string, contentType: string, folder: string): string {
  const dot = originalName.lastIndexOf(".");
  const rawExt = dot > -1 ? originalName.slice(dot + 1).toLowerCase() : "";
  const ext = (rawExt || EXT_BY_TYPE[contentType] || "bin").replace(/[^a-z0-9]/g, "");
  const base = (dot > -1 ? originalName.slice(0, dot) : originalName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
  const unique = crypto.randomUUID().slice(0, 8);
  return `${folder}/${base}-${unique}.${ext}`;
}

/**
 * Persist an image and return its public URL. `data` is the raw file bytes.
 * `folder` namespaces the object (e.g. "logos", "screenshots", "blog").
 */
export async function uploadImage(
  data: Buffer | ArrayBuffer,
  opts: { filename: string; contentType: string; folder?: string },
): Promise<UploadResult> {
  const folder = opts.folder?.replace(/[^a-z0-9/-]/gi, "") || "uploads";
  const key = buildKey(opts.filename, opts.contentType, folder);
  const bytes = data instanceof Buffer ? data : Buffer.from(data);

  // 1. Vercel Blob (preferred when configured).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, bytes, {
      access: "public",
      contentType: opts.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  }

  // 2. Local-disk dev fallback → served from /public/uploads/*.
  if (process.env.NODE_ENV !== "production") {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const publicDir = path.join(process.cwd(), "public", folder);
    await mkdir(publicDir, { recursive: true });
    const fileName = key.slice(folder.length + 1); // strip "folder/" prefix
    await writeFile(path.join(publicDir, fileName), bytes);
    return { url: `/${folder}/${fileName}`, pathname: key };
  }

  // 3. Nothing configured in production.
  throw new ApiError(
    503,
    "Image uploads are not configured. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) or paste an image URL instead.",
  );
}
