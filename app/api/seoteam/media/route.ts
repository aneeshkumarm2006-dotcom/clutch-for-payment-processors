import { connectToDatabase } from "@/lib/db";
import { Media } from "@/models";
import { ApiError, handleApiError, json } from "@/lib/api";
import { requireSeoTeam } from "@/lib/seoteam-guard";
import { assertValidImage, uploadImage } from "@/lib/upload";
import { mediaImportInput } from "@/lib/validators";
import { scanBlogImageUsage, toMediaRow, normalizeUrl, type MediaRow } from "@/lib/media";

/**
 * /api/seoteam/media — the media gallery list + create surface, gated by the
 * shared-password cookie (`requireSeoTeam`).
 *
 * GET  → every Media doc with its computed usage ("where is this attached") +
 *        gallery stats. Supports ?q / ?folder / ?tag / ?usage filters.
 * POST → multipart file upload (single; the client loops for bulk) OR JSON
 *        `{ urls }` to bulk-register externally-hosted images.
 *
 * Uploads also fill the seoteam upload gap: /api/upload is admin(NextAuth)-only,
 * so seoteam users route image uploads here instead.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireSeoTeam();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const folder = searchParams.get("folder")?.trim() ?? "";
    const tag = searchParams.get("tag")?.trim() ?? "";
    const usageFilter = searchParams.get("usage"); // "used" | "unused" | null

    const usageMap = await scanBlogImageUsage();
    const docs = await Media.find().sort({ createdAt: -1 }).lean();

    let rows: MediaRow[] = docs.map((doc) =>
      toMediaRow(doc, usageMap.get(normalizeUrl(doc.url)) ?? []),
    );

    if (folder) rows = rows.filter((r) => r.folder === folder);
    if (tag) rows = rows.filter((r) => r.tags.includes(tag));
    if (q) {
      rows = rows.filter((r) =>
        [r.filename, r.title, r.alt, r.url, ...r.tags]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    if (usageFilter === "used") rows = rows.filter((r) => r.usageCount > 0);
    if (usageFilter === "unused") rows = rows.filter((r) => r.usageCount === 0);

    const stats = {
      total: rows.length,
      unused: rows.filter((r) => r.usageCount === 0).length,
      totalBytes: rows.reduce((sum, r) => sum + (r.bytes ?? 0), 0),
    };
    // All distinct tags/folders across the whole library (for filter menus).
    const allTags = Array.from(new Set(docs.flatMap((d) => d.tags ?? []))).sort();
    const allFolders = Array.from(
      new Set(docs.map((d) => d.folder).filter((f): f is string => Boolean(f))),
    ).sort();

    return json({ items: rows, stats, allTags, allFolders });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireSeoTeam();
    await connectToDatabase();

    const contentType = req.headers.get("content-type") ?? "";

    // --- Bulk URL import (JSON) ---
    if (contentType.includes("application/json")) {
      const { urls, tags } = mediaImportInput.parse(await req.json());
      const cleaned = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));

      const existing = new Set(
        (await Media.find({ url: { $in: cleaned } }).select({ url: 1 }).lean()).map((m) => m.url),
      );
      const toCreate = cleaned
        .filter((u) => !existing.has(u))
        .map((url) => ({
          url,
          provider: /res\.cloudinary\.com/i.test(url)
            ? "cloudinary"
            : url.startsWith("/")
              ? "local"
              : "external",
          source: "import" as const,
          tags: tags ?? [],
        }));

      if (toCreate.length > 0) {
        await Media.insertMany(toCreate, { ordered: false }).catch(() => undefined);
      }
      return json(
        { created: toCreate.length, skipped: cleaned.length - toCreate.length },
        201,
      );
    }

    // --- File upload (multipart) ---
    const formData = await req.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null) ?? "blog";

    if (!(file instanceof File)) {
      throw new ApiError(400, "No file provided.");
    }

    assertValidImage({ type: file.type, size: file.size });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImage(buffer, {
      filename: file.name || "image",
      contentType: file.type,
      folder,
    });

    // Register (or refresh) the Media record. Upsert by URL so a re-upload of the
    // same asset doesn't duplicate the row.
    const doc = await Media.findOneAndUpdate(
      { url: result.url },
      {
        $set: {
          pathname: result.pathname,
          provider: result.provider ?? "external",
          folder,
          filename: file.name || undefined,
          contentType: file.type,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
          source: "upload",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return json({ url: result.url, media: doc && toMediaRow(doc, []) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
