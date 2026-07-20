import { ApiError } from "@/lib/api";
import { processImageForUpload } from "@/lib/image-processing";

/**
 * lib/upload.ts — one image-upload interface, provider-agnostic (PRD §6 / §10.3
 * / TODO §2.1). Callers (the `/api/upload` route + admin image fields) only ever
 * touch `uploadImage()`; swapping hosts is a change here and nowhere else.
 *
 * Provider resolution order:
 *   1. Cloudinary    — when `CLOUDINARY_URL` (or the discrete
 *                      `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET`) is set.
 *                      The chosen default (see NOTES.md). Signed REST upload — no
 *                      SDK dependency — returning a public CDN URL.
 *   2. Local disk    — DEV ONLY fallback (`public/uploads/`) so an operator can
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
  /** Which provider stored the asset — lets callers (the Media registry) know
   * whether `pathname` is a Cloudinary public_id that can be destroyed. */
  provider?: "cloudinary" | "local";
  /** Cloudinary reports these on upload; undefined on the local-disk fallback. */
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
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

/** Split an original filename into a URL-safe slug base + normalized extension. */
function slugifyName(originalName: string, contentType: string): { base: string; ext: string } {
  const dot = originalName.lastIndexOf(".");
  const rawExt = dot > -1 ? originalName.slice(dot + 1).toLowerCase() : "";
  const ext = (rawExt || EXT_BY_TYPE[contentType] || "bin").replace(/[^a-z0-9]/g, "");
  const base = (dot > -1 ? originalName.slice(0, dot) : originalName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
  return { base, ext };
}

/** Cloudinary credentials, from `CLOUDINARY_URL` or the three discrete env vars. */
function cloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    // Format: cloudinary://<api_key>:<api_secret>@<cloud_name>
    const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) return { apiKey: m[1]!, apiSecret: m[2]!, cloudName: m[3]! };
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

/** Hex SHA-1 via Web Crypto (runtime-agnostic — no `node:crypto` import). */
async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cloudinary signature: SHA-1 of the signed params (sorted, `k=v` joined by `&`,
 * empty values dropped) with the API secret appended. `file`, `api_key`,
 * `resource_type`, and `signature` are never signed.
 */
async function signCloudinary(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return sha1Hex(toSign + apiSecret);
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
  const unique = crypto.randomUUID().slice(0, 8);
  const original = data instanceof Buffer ? data : Buffer.from(data);

  // SEO / page-speed: convert to WebP + compress under ~300 KB before storing.
  // Every uploader in the app (admin + blog panels) reaches storage through
  // here, so optimizing at this one point covers them all. SVGs pass through.
  const processed = await processImageForUpload(original, opts.contentType);
  const bytes = processed.buffer;
  const contentType = processed.contentType;
  const { base } = slugifyName(opts.filename, opts.contentType);
  const ext = processed.ext;

  // 1. Cloudinary (preferred when configured) — signed REST upload.
  const cfg = cloudinaryConfig();
  if (cfg) {
    // Cloudinary derives the format from the bytes, so public_id carries no
    // extension; the folder is a separate (signed) param.
    const publicId = `${base}-${unique}`;
    const timestamp = Math.round(Date.now() / 1000).toString();
    const signature = await signCloudinary(
      { folder, public_id: publicId, timestamp },
      cfg.apiSecret,
    );

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: contentType }));
    form.append("api_key", cfg.apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("public_id", publicId);
    form.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
      { method: "POST", body: form },
    );
    const result = (await res.json().catch(() => null)) as
      | {
          secure_url?: string;
          public_id?: string;
          width?: number;
          height?: number;
          bytes?: number;
          format?: string;
          error?: { message?: string };
        }
      | null;

    if (!res.ok || !result?.secure_url) {
      throw new ApiError(
        502,
        result?.error?.message || `Cloudinary upload failed (HTTP ${res.status}).`,
      );
    }
    return {
      url: result.secure_url,
      pathname: result.public_id ?? publicId,
      provider: "cloudinary",
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    };
  }

  // 2. Local-disk dev fallback → served from /public/uploads/*.
  if (process.env.NODE_ENV !== "production") {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const publicDir = path.join(process.cwd(), "public", folder);
    await mkdir(publicDir, { recursive: true });
    const fileName = `${base}-${unique}.${ext}`;
    await writeFile(path.join(publicDir, fileName), bytes);
    return {
      url: `/${folder}/${fileName}`,
      pathname: `${folder}/${fileName}`,
      provider: "local",
      bytes: bytes.length,
      format: ext,
    };
  }

  // 3. Nothing configured in production.
  throw new ApiError(
    503,
    "Image uploads are not configured. Set CLOUDINARY_URL (Cloudinary) or paste an image URL instead.",
  );
}

/**
 * Delete a Cloudinary asset by `public_id` (signed `image/destroy`). Used by the
 * media library's safe-delete. Returns true when Cloudinary reports `ok`/`not
 * found` (idempotent); throws only on an outright request failure. No-op returning
 * false when Cloudinary isn't configured (nothing to delete there).
 */
export async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  const cfg = cloudinaryConfig();
  if (!cfg || !publicId) return false;

  const timestamp = Math.round(Date.now() / 1000).toString();
  const signature = await signCloudinary({ public_id: publicId, timestamp }, cfg.apiSecret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", cfg.apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`,
    { method: "POST", body: form },
  );
  const result = (await res.json().catch(() => null)) as { result?: string } | null;
  // "ok" (deleted) and "not found" (already gone) are both success for our purpose.
  return res.ok && (result?.result === "ok" || result?.result === "not found");
}

/** One asset as returned by the Cloudinary Admin API list. */
export interface CloudinaryAsset {
  url: string;
  pathname: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  createdAt?: string;
}

/**
 * List images stored under a Cloudinary `folder` via the Admin API (Basic auth
 * with the same key/secret). Best-effort: returns `[]` when Cloudinary isn't
 * configured or the call fails, so callers (media Sync) degrade gracefully.
 * Pulls up to `max` (default 500) newest-first.
 */
export async function listCloudinaryAssets(
  folder = "blog",
  max = 500,
): Promise<CloudinaryAsset[]> {
  const cfg = cloudinaryConfig();
  if (!cfg) return [];

  const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
  const assets: CloudinaryAsset[] = [];
  let nextCursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        type: "upload",
        prefix: folder,
        max_results: String(Math.min(500, max - assets.length)),
      });
      if (nextCursor) params.set("next_cursor", nextCursor);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cfg.cloudName}/resources/image?${params}`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      if (!res.ok) break;
      const data = (await res.json().catch(() => null)) as {
        resources?: Array<{
          secure_url?: string;
          url?: string;
          public_id: string;
          bytes?: number;
          width?: number;
          height?: number;
          format?: string;
          created_at?: string;
        }>;
        next_cursor?: string;
      } | null;
      if (!data?.resources?.length) break;

      for (const r of data.resources) {
        const url = r.secure_url || r.url;
        if (url) {
          assets.push({
            url,
            pathname: r.public_id,
            bytes: r.bytes,
            width: r.width,
            height: r.height,
            format: r.format,
            createdAt: r.created_at,
          });
        }
      }
      nextCursor = data.next_cursor;
    } while (nextCursor && assets.length < max);
  } catch {
    // Admin API disabled / network error — return whatever we have.
  }

  return assets;
}
