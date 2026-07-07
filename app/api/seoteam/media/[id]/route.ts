import { connectToDatabase } from "@/lib/db";
import { Media } from "@/models";
import { ApiError, handleApiError, json, notFound } from "@/lib/api";
import { requireSeoTeam } from "@/lib/seoteam-guard";
import { deleteCloudinaryAsset } from "@/lib/upload";
import { mediaMetadataInput, objectIdString } from "@/lib/validators";
import { scanBlogImageUsage, toMediaRow, normalizeUrl } from "@/lib/media";

/**
 * /api/seoteam/media/[id] — read / edit metadata / safe-delete a single asset.
 * DELETE refuses when the image is still used in a post (409 with the list); for
 * unused Cloudinary uploads it also destroys the underlying file.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadWithUsage(id: string) {
  await connectToDatabase();
  const doc = await Media.findById(id).lean();
  if (!doc) notFound("Image not found.");
  const usage = (await scanBlogImageUsage()).get(normalizeUrl(doc!.url)) ?? [];
  return { doc: doc!, usage };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSeoTeam();
    const id = objectIdString.parse(params.id);
    const { doc, usage } = await loadWithUsage(id);
    return json(toMediaRow(doc, usage));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSeoTeam();
    await connectToDatabase();
    const id = objectIdString.parse(params.id);
    const data = mediaMetadataInput.parse(await req.json());

    const doc = await Media.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    if (!doc) notFound("Image not found.");

    const usage = (await scanBlogImageUsage()).get(normalizeUrl(doc!.url)) ?? [];
    return json(toMediaRow(doc!, usage));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSeoTeam();
    const id = objectIdString.parse(params.id);
    const { doc, usage } = await loadWithUsage(id);

    // Safe-delete: never remove an image a post still points at.
    if (usage.length > 0) {
      const where = usage.map((u) => `"${u.title}" (${u.field})`).join(", ");
      throw new ApiError(
        409,
        `Still used in ${usage.length} place${usage.length === 1 ? "" : "s"}: ${where}. Remove it from those posts first.`,
      );
    }

    // Unused → drop the record, and destroy the Cloudinary original when we own it.
    if (doc.provider === "cloudinary" && doc.pathname) {
      await deleteCloudinaryAsset(doc.pathname).catch(() => undefined);
    }
    await Media.findByIdAndDelete(id);

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
