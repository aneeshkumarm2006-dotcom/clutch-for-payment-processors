import { connectToDatabase } from "@/lib/db";
import { Category, Processor } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { categoryInput, categoryUpdate } from "@/lib/validators";
import {
  ApiError,
  buildUpdateDoc,
  diffSetUnset,
  handleApiError,
  json,
  requireAdmin,
} from "@/lib/api";
import { logAudit } from "@/lib/audit";

/**
 * /api/categories/[id] (PRD §12 / TODO §2.3).
 *   GET    single (admin).
 *   PUT    admin FULL replace (the edit form) — `$unset`s cleared optionals.
 *   PATCH  admin PARTIAL update — the list's quick toggles.
 *   DELETE admin delete + pull the category from any processor that references it.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

async function resolveSlug(
  id: string,
  name: string | undefined,
  explicitSlug: string | undefined,
): Promise<string> {
  const existing = await Category.findById(id).select("name").lean();
  if (!existing) throw new ApiError(404, "Category not found.");
  return ensureUniqueSlug(Category, name ?? existing.name, { explicitSlug, excludeId: id });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Category not found.");

    const doc = await Category.findById(params.id).lean();
    if (!doc) throw new ApiError(404, "Category not found.");
    return json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Category not found.");

    const { slug, ...rest } = categoryInput.parse(await req.json());
    const parts = diffSetUnset(rest);
    parts.$set.slug = await resolveSlug(params.id, rest.name, slug);

    const updated = await Category.findByIdAndUpdate(params.id, buildUpdateDoc(parts), {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Category not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "category",
      entityId: params.id,
      entityLabel: updated.name,
    });

    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Category not found.");

    const data = categoryUpdate.parse(await req.json());
    const patch: Record<string, unknown> = { ...data };
    if (data.slug !== undefined || data.name !== undefined) {
      patch.slug = await resolveSlug(params.id, data.name, data.slug);
    }

    const updated = await Category.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new ApiError(404, "Category not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "category",
      entityId: params.id,
      entityLabel: updated.name,
    });

    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Category not found.");

    const deleted = await Category.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Category not found.");

    // Keep processors consistent: drop the deleted category from their arrays.
    await Processor.updateMany({ categories: params.id }, { $pull: { categories: params.id } });

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "category",
      entityId: params.id,
      entityLabel: deleted.name,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
