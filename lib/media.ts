import "server-only";
import { parse } from "node-html-parser";
import { connectToDatabase } from "@/lib/db";
import { BlogPost, Media } from "@/models";
import { listCloudinaryAssets } from "@/lib/upload";

/**
 * lib/media.ts — the SEO-team media gallery's read model.
 *
 * Images are referenced across the app only as URL strings (BlogPost.coverImage,
 * BlogPost.seo.ogImage, and inline `<img src>` in the HTML body). There is no
 * join table, so "where is this image used" is computed on demand by scanning
 * every BlogPost once and building a URL → usages map (`scanBlogImageUsage`).
 * `discoverMediaFromPosts` reuses that scan (plus an optional Cloudinary folder
 * listing) to backfill the `Media` registry for images that predate the gallery.
 */

/** One place an image is attached. */
export interface ImageUsage {
  postId: string;
  title: string;
  slug: string;
  field: "cover" | "og" | "inline";
  status: string;
}

/**
 * Client-facing media row (serialized Media doc + computed usage). Safe to
 * `import type` from client components — types are erased, so the `server-only`
 * guard at the top of this module never runs in that path.
 */
export interface MediaRow {
  id: string;
  url: string;
  pathname?: string;
  provider: string;
  folder?: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  alt?: string;
  title?: string;
  tags: string[];
  source: string;
  createdAt: string;
  usage: ImageUsage[];
  usageCount: number;
}

/** Shape of a lean Media doc as returned by Mongoose `.lean()`. */
interface LeanMedia {
  _id: unknown;
  url: string;
  pathname?: string;
  provider?: string;
  folder?: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  alt?: string;
  title?: string;
  tags?: string[];
  source?: string;
  createdAt?: Date;
}

/** Serialize a lean Media doc + its usage list into a client row. */
export function toMediaRow(doc: LeanMedia, usage: ImageUsage[]): MediaRow {
  return {
    id: String(doc._id),
    url: doc.url,
    pathname: doc.pathname,
    provider: doc.provider || "external",
    folder: doc.folder,
    filename: doc.filename,
    contentType: doc.contentType,
    bytes: doc.bytes,
    width: doc.width,
    height: doc.height,
    format: doc.format,
    alt: doc.alt,
    title: doc.title,
    tags: doc.tags ?? [],
    source: doc.source || "upload",
    createdAt: (doc.createdAt ?? new Date(0)).toISOString(),
    usage,
    usageCount: usage.length,
  };
}

/**
 * A URL worth tracking in the library: non-empty and not an inlined `data:` URI
 * (those have no stable identity, aren't reusable, and can be multi-MB blobs).
 */
function isLibraryUrl(url: string | undefined): url is string {
  const u = url?.trim();
  return Boolean(u) && !/^data:/i.test(u!);
}

/** Trim a URL to a stable comparison key (strip a trailing `?query`/`#hash`). */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const q = trimmed.search(/[?#]/);
  return q === -1 ? trimmed : trimmed.slice(0, q);
}

/** Pull every trackable `<img src>` out of a blog body's HTML (skips data URIs). */
function extractInlineSrcs(html: string): string[] {
  if (!html || !html.includes("<img")) return [];
  try {
    const root = parse(html);
    return root
      .querySelectorAll("img")
      .map((el) => el.getAttribute("src"))
      .filter((s): s is string => isLibraryUrl(s));
  } catch {
    return [];
  }
}

interface ScannedPost {
  _id: unknown;
  title?: string;
  slug?: string;
  status?: string;
  coverImage?: string;
  content?: string;
  seo?: { ogImage?: string };
}

/**
 * Scan all blog posts and return a map: normalized image URL → the posts/fields
 * that reference it. One DB pass; reused by both the media listing and Sync.
 */
export async function scanBlogImageUsage(): Promise<Map<string, ImageUsage[]>> {
  await connectToDatabase();
  const posts = (await BlogPost.find()
    .select({ title: 1, slug: 1, status: 1, coverImage: 1, content: 1, "seo.ogImage": 1 })
    .lean()) as unknown as ScannedPost[];

  const map = new Map<string, ImageUsage[]>();
  const add = (rawUrl: string | undefined, post: ScannedPost, field: ImageUsage["field"]) => {
    if (!isLibraryUrl(rawUrl)) return;
    const key = normalizeUrl(rawUrl);
    if (!key) return;
    const usage: ImageUsage = {
      postId: String(post._id),
      title: post.title || "(untitled)",
      slug: post.slug || "",
      field,
      status: post.status || "draft",
    };
    const existing = map.get(key);
    if (existing) existing.push(usage);
    else map.set(key, [usage]);
  };

  for (const post of posts) {
    add(post.coverImage, post, "cover");
    add(post.seo?.ogImage, post, "og");
    for (const src of extractInlineSrcs(post.content ?? "")) add(src, post, "inline");
  }

  return map;
}

/** Infer a storage provider from a URL (best-effort, for discovered images). */
function inferProvider(url: string): "cloudinary" | "local" | "external" {
  if (/res\.cloudinary\.com/i.test(url)) return "cloudinary";
  if (url.startsWith("/")) return "local";
  return "external";
}

/**
 * Backfill the Media registry from images already used in posts (and, when the
 * Cloudinary Admin API is reachable, from the "blog" folder). Upserts one Media
 * doc per distinct URL that isn't registered yet. Returns how many were created.
 */
export async function discoverMediaFromPosts(): Promise<{ created: number; total: number }> {
  await connectToDatabase();
  const usage = await scanBlogImageUsage();

  // Candidate URLs from posts, plus any Cloudinary-hosted blog assets.
  const candidates = new Map<string, { url: string; from: "post" | "cloudinary"; asset?: Awaited<ReturnType<typeof listCloudinaryAssets>>[number] }>();
  for (const url of usage.keys()) candidates.set(url, { url, from: "post" });

  for (const asset of await listCloudinaryAssets("blog")) {
    const key = normalizeUrl(asset.url);
    if (key && !candidates.has(key)) candidates.set(key, { url: asset.url, from: "cloudinary", asset });
  }

  const urls = Array.from(candidates.values()).map((c) => c.url);
  if (urls.length === 0) return { created: 0, total: 0 };

  // Which of these are already registered?
  const existing = new Set(
    (await Media.find({ url: { $in: urls } }).select({ url: 1 }).lean()).map((m) => m.url),
  );

  const toCreate = Array.from(candidates.values())
    .filter((c) => !existing.has(c.url))
    .map((c) => ({
      url: c.url,
      pathname: c.asset?.pathname,
      provider: inferProvider(c.url),
      folder: c.from === "cloudinary" ? "blog" : undefined,
      bytes: c.asset?.bytes,
      width: c.asset?.width,
      height: c.asset?.height,
      format: c.asset?.format,
      source: "discovered" as const,
    }));

  if (toCreate.length > 0) {
    // ordered:false so one duplicate (a race) doesn't abort the whole batch.
    await Media.insertMany(toCreate, { ordered: false }).catch(() => undefined);
  }

  return { created: toCreate.length, total: urls.length };
}

export { normalizeUrl };
