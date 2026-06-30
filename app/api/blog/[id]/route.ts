import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { blogPostInput, blogPostUpdate } from "@/lib/validators";
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
import { toBlogPostData } from "@/lib/serialize";

/**
 * /api/blog/[id] (PRD §12 / TODO §6.1).
 *   GET    single — admin by id (any status) OR public by slug/id (published only,
 *          serving the PRD's `GET /api/blog/[slug]`). Mirrors the processor route,
 *          which also accepts an id OR a slug (see NOTES).
 *   PUT    admin FULL replace (the edit form) — `$unset`s cleared optionals.
 *   PATCH  admin PARTIAL update — the list's quick publish toggle.
 *   DELETE admin delete.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

async function resolveSlug(
  id: string,
  title: string | undefined,
  explicitSlug: string | undefined,
): Promise<string> {
  const existing = await BlogPost.findById(id).select("title").lean();
  if (!existing) throw new ApiError(404, "Post not found.");
  return ensureUniqueSlug(BlogPost, title ?? existing.title, { explicitSlug, excludeId: id });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const session = await getAdminSession();
    const isId = OBJECT_ID.test(params.id);

    // Admin: fetch by id regardless of status (powers the edit form).
    if (session?.user && isId) {
      const doc = await BlogPost.findById(params.id).lean();
      if (!doc) throw new ApiError(404, "Post not found.");
      return json(doc);
    }

    // Public: published only, by slug (or id) → serves GET /api/blog/[slug].
    const doc = await BlogPost.findOne({
      status: "published",
      ...(isId ? { _id: params.id } : { slug: params.id }),
    }).lean();
    if (!doc) throw new ApiError(404, "Post not found.");
    return json(toBlogPostData(doc));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");

    const existing = await BlogPost.findById(params.id).select("publishedAt").lean();
    if (!existing) throw new ApiError(404, "Post not found.");

    const { slug, ...rest } = blogPostInput.parse(await req.json());
    const parts = diffSetUnset(rest);
    parts.$set.slug = await resolveSlug(params.id, rest.title, slug);

    // Keep a sensible publishedAt: stamp now when a post goes live without one,
    // preserving any existing date. A draft clears it back to unset.
    if (rest.status === "published") {
      parts.$set.publishedAt = rest.publishedAt ?? existing.publishedAt ?? new Date();
      delete parts.$unset.publishedAt;
    }

    const updated = await BlogPost.findByIdAndUpdate(params.id, buildUpdateDoc(parts), {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Post not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "blog",
      entityId: params.id,
      entityLabel: updated.title,
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
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");

    const data = blogPostUpdate.parse(await req.json());
    const patch: Record<string, unknown> = { ...data };
    if (data.slug !== undefined || data.title !== undefined) {
      patch.slug = await resolveSlug(params.id, data.title, data.slug);
    }
    // Stamp publishedAt when the quick toggle flips a post live without a date.
    if (data.status === "published" && data.publishedAt === undefined) {
      const existing = await BlogPost.findById(params.id).select("publishedAt").lean();
      patch.publishedAt = existing?.publishedAt ?? new Date();
    }

    const updated = await BlogPost.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new ApiError(404, "Post not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "blog",
      entityId: params.id,
      entityLabel: updated.title,
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
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");

    const deleted = await BlogPost.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Post not found.");

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "blog",
      entityId: params.id,
      entityLabel: deleted.title,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
