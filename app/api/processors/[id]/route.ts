import { connectToDatabase } from "@/lib/db";
import { Processor, Review } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { processorInput, processorUpdate } from "@/lib/validators";
import {
  ApiError,
  buildUpdateDoc,
  diffSetUnset,
  getAdminSession,
  handleApiError,
  json,
  requireAdmin,
} from "@/lib/api";
import { logAudit } from "@/lib/audit";

/**
 * /api/processors/[id] (PRD §12 / TODO §2.2).
 *
 *   GET    by ObjectId OR slug (published-only for anonymous callers; admins see
 *          drafts too). Accepting both keeps Stage 3's public "by slug" lookup on
 *          this same route — Next can't host sibling `[id]` + `[slug]` segments.
 *   PUT    admin FULL replace (the tabbed form) — `$unset`s cleared optionals.
 *   PATCH  admin PARTIAL update — the list's quick toggles (e.g. publish on/off).
 *   DELETE admin delete (id only) + cascade-removes the processor's reviews.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Recompute the unique slug only when the name or an explicit slug is in play. */
async function resolveSlug(
  id: string,
  name: string | undefined,
  explicitSlug: string | undefined,
): Promise<string> {
  const existing = await Processor.findById(id).select("name").lean();
  if (!existing) throw new ApiError(404, "Processor not found.");
  return ensureUniqueSlug(Processor, name ?? existing.name, { explicitSlug, excludeId: id });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const session = await getAdminSession();
    const isAdmin = !!session?.user;

    const byId = OBJECT_ID.test(params.id);
    const doc = await Processor.findOne(byId ? { _id: params.id } : { slug: params.id })
      .populate("categories", "name slug")
      .lean();

    if (!doc) throw new ApiError(404, "Processor not found.");
    if (!isAdmin && !doc.isPublished) throw new ApiError(404, "Processor not found.");

    return json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Processor not found.");

    // Full replace: parse the complete record, then $set defined / $unset cleared.
    const { slug, ...rest } = processorInput.parse(await req.json());
    const parts = diffSetUnset(rest);
    parts.$set.slug = await resolveSlug(params.id, rest.name, slug);

    const updated = await Processor.findByIdAndUpdate(params.id, buildUpdateDoc(parts), {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Processor not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "processor",
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
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Processor not found.");

    // Partial update (quick toggles). Only re-derive the slug if name/slug changed.
    const data = processorUpdate.parse(await req.json());
    const patch: Record<string, unknown> = { ...data };
    if (data.slug !== undefined || data.name !== undefined) {
      patch.slug = await resolveSlug(params.id, data.name, data.slug);
    }

    const updated = await Processor.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new ApiError(404, "Processor not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "processor",
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

    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Processor not found.");

    const deleted = await Processor.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Processor not found.");

    // Reviews are meaningless without their processor — clean them up.
    await Review.deleteMany({ processor: params.id });

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "processor",
      entityId: params.id,
      entityLabel: deleted.name,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
