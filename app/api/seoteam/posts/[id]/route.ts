import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { seoBlogPostInput, seoBlogPostUpdate } from "@/lib/validators";
import { ApiError, buildUpdateDoc, diffSetUnset, handleApiError, json } from "@/lib/api";
import { requireSeoTeam } from "@/lib/seoteam-guard";
import { computeReadingTime, revalidateBlogPaths } from "@/lib/seoteam-posts";
import { sanitizeBlogHtml } from "@/lib/sanitize-html";

/**
 * /api/seoteam/posts/[id] — read one (edit form), full replace (PUT), quick
 * publish/unpublish toggle (PATCH), delete. Same patterns as /api/blog/[id] but
 * cookie-gated, using the SEO validators (keyword backlinks / templates), and
 * revalidating the public blog so changes appear instantly.
 */
export const runtime = "nodejs";
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
    await requireSeoTeam();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");
    const doc = await BlogPost.findById(params.id).lean();
    if (!doc) throw new ApiError(404, "Post not found.");
    return json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSeoTeam();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");

    const existing = await BlogPost.findById(params.id).select("publishedAt slug").lean();
    if (!existing) throw new ApiError(404, "Post not found.");

    const { slug, ...rest } = seoBlogPostInput.parse(await req.json());
    rest.content = sanitizeBlogHtml(rest.content);
    const parts = diffSetUnset(rest);
    parts.$set.slug = await resolveSlug(params.id, rest.title, slug);
    parts.$set.readingTimeMinutes = computeReadingTime(rest.content);

    if (rest.status === "published") {
      // Explicit date wins (scheduling / backdating). Otherwise keep the existing
      // date only if it's already live; a future existing date means the author
      // switched Scheduled → Visible, so publish now.
      const existingPub = existing.publishedAt;
      parts.$set.publishedAt = rest.publishedAt
        ? rest.publishedAt
        : existingPub && new Date(existingPub).getTime() <= Date.now()
          ? existingPub
          : new Date();
      delete parts.$unset.publishedAt;
    }

    const updated = await BlogPost.findByIdAndUpdate(params.id, buildUpdateDoc(parts), {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Post not found.");

    revalidateBlogPaths(String(updated.slug), existing.slug ? String(existing.slug) : undefined);
    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSeoTeam();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");

    const data = seoBlogPostUpdate.parse(await req.json());
    const patch: Record<string, unknown> = { ...data };
    if (data.slug !== undefined || data.title !== undefined) {
      patch.slug = await resolveSlug(params.id, data.title, data.slug);
    }
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

    revalidateBlogPaths(String(updated.slug));
    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSeoTeam();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Post not found.");

    const deleted = await BlogPost.findByIdAndDelete(params.id).lean();
    if (!deleted) throw new ApiError(404, "Post not found.");

    revalidateBlogPaths(undefined, deleted.slug ? String(deleted.slug) : undefined);
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
