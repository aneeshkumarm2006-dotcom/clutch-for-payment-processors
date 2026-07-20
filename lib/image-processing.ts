import sharp from "sharp";

/**
 * lib/image-processing.ts — the single place uploaded images are optimized for
 * SEO / page-speed before they hit storage. Every byte from both upload routes
 * (`/api/upload` and `/api/seoteam/media`) flows through `uploadImage()`, which
 * calls `processImageForUpload()` here, so this is the one choke point.
 *
 * Two guarantees for raster images (PNG/JPEG/GIF/AVIF/WebP):
 *   1. Format is converted to WebP.
 *   2. Output is compressed to at most `TARGET_BYTES` (~300 KB); already-small
 *      images are left near-lossless.
 *
 * SVG is passed through untouched — it is vector, usually tiny, and rasterizing
 * it to WebP would make it *worse*. Animated GIFs become animated WebP.
 */

/** Compress every raster image below this. 300 KB per the SEO/perf requirement. */
const TARGET_BYTES = 300 * 1024;
/** Cap the longest edge — no upload needs to be wider than this on the site. */
const MAX_DIMENSION = 2400;
/** Don't shrink an image below this width while chasing the size target. */
const MIN_DIMENSION = 480;

export interface ProcessedImage {
  buffer: Buffer;
  /** MIME type of `buffer` (image/webp for anything we converted). */
  contentType: string;
  /** File extension for `buffer`, no dot. */
  ext: string;
  /** False when the input was passed through unchanged (e.g. SVG). */
  converted: boolean;
}

function passthrough(buffer: Buffer, contentType: string, ext: string): ProcessedImage {
  return { buffer, contentType, ext, converted: false };
}

/**
 * Convert `input` to a WebP buffer at most `TARGET_BYTES` in size. Strategy:
 * ratchet WebP quality down; if the smallest quality still overshoots, scale the
 * image down and try again, until under target or `MIN_DIMENSION` is reached.
 * Always returns the smallest buffer produced (best effort) even if the target
 * proves unreachable, so an upload never fails purely on size.
 */
async function encodeWebpUnderTarget(input: Buffer, animated: boolean): Promise<Buffer> {
  const meta = await sharp(input, { animated }).metadata().catch(() => null);
  const originalWidth = meta?.width ?? MAX_DIMENSION;
  // Static photos tolerate aggressive quality; animation artifacts show more, so
  // start gentler and take fewer steps.
  const qualitySteps = animated ? [70, 55, 45] : [82, 72, 62, 52, 42, 32];

  let width = Math.min(originalWidth, MAX_DIMENSION);
  let smallest: Buffer | null = null;

  // A handful of shrink passes is plenty: 0.8^5 ≈ 0.33× linear scale.
  for (let pass = 0; pass < 6; pass++) {
    for (const quality of qualitySteps) {
      const pipeline = sharp(input, { animated, failOn: "none" });
      // Auto-apply EXIF orientation for still images (GIF/animated carry none).
      if (!animated) pipeline.rotate();
      if (width < originalWidth) {
        pipeline.resize({ width, withoutEnlargement: true });
      }
      const out = await pipeline.webp({ quality, effort: 4 }).toBuffer();
      if (!smallest || out.length < smallest.length) smallest = out;
      if (out.length <= TARGET_BYTES) return out;
    }
    // Every quality overshot at this size — shrink and retry.
    const next = Math.round(width * 0.8);
    if (next < MIN_DIMENSION) break;
    width = next;
  }

  return smallest as Buffer;
}

/**
 * Optimize an uploaded image for storage: WebP conversion + sub-300 KB
 * compression. Never throws for a decode failure — an image sharp can't read is
 * passed through unchanged so the upload still succeeds. `contentType` is the
 * MIME reported for the original bytes.
 */
export async function processImageForUpload(
  input: Buffer,
  contentType: string,
): Promise<ProcessedImage> {
  // Vector — leave it alone (rasterizing to WebP would be larger and blurry).
  if (contentType === "image/svg+xml") {
    return passthrough(input, contentType, "svg");
  }

  let animated = false;
  try {
    const meta = await sharp(input, { animated: true }).metadata();
    animated = (meta.pages ?? 1) > 1;
  } catch {
    // sharp can't decode this — don't gamble, store the original.
    return passthrough(input, contentType, contentType === "image/gif" ? "gif" : "img");
  }

  try {
    const buffer = await encodeWebpUnderTarget(input, animated);
    return { buffer, contentType: "image/webp", ext: "webp", converted: true };
  } catch {
    // Encoding blew up unexpectedly — fall back to the untouched original.
    return passthrough(input, contentType, "img");
  }
}
