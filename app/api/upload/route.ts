import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { assertValidImage, uploadImage } from "@/lib/upload";

/**
 * POST /api/upload (admin) — image upload → returns `{ url }` (PRD §12, TODO §2.1).
 *
 * Accepts `multipart/form-data` with a `file` field and an optional `folder`
 * field ("logos" | "screenshots" | "blog" | …). Session-guarded; validates type
 * + size before handing off to the provider-agnostic `uploadImage()`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null) ?? "uploads";

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

    return json(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
