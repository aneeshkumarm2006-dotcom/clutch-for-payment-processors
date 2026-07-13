import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
import { pageSeoUpdate } from "@/lib/validators";
import {
  ApiError,
  buildUpdateDoc,
  diffSetUnset,
  handleApiError,
  json,
  requireAdmin,
  PRESERVE_ON_OMIT,
} from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { sanitizeBlocks } from "@/lib/sanitize-html";

/**
 * /api/page-seo/[id] (PRD §13).
 *   GET single (admin).
 *   PUT  admin edit of `title` / `seo` / `faqs` — `$unset`s cleared optionals.
 * `pageKey` and `path` are immutable (set at seed time) and never written here.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Page not found.");

    const doc = await PageSeo.findById(params.id).lean();
    if (!doc) throw new ApiError(404, "Page not found.");
    return json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Page not found.");

    // Only editable fields; identity fields (pageKey/path) are dropped.
    const { pageKey: _pk, path: _path, ...editable } = pageSeoUpdate.parse(await req.json());
    void _pk;
    void _path;
    editable.blocks = sanitizeBlocks(editable.blocks);
    const parts = diffSetUnset(editable, { preserve: PRESERVE_ON_OMIT });

    const updated = await PageSeo.findByIdAndUpdate(params.id, buildUpdateDoc(parts), {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Page not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "settings",
      entityId: params.id,
      entityLabel: `Page SEO — ${updated.title}`,
    });

    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
