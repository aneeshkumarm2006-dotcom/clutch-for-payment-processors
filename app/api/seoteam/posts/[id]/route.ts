import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { seoBlogPostInput, seoBlogPostUpdate } from "@/lib/validators";
import {
  ApiError,
  buildUpdateDoc,
  diffSetUnset,
  handleApiError,
  json,
  PRESERVE_ON_OMIT,
} from "@/lib/api";
import { requireSeoTeam } from "@/lib/seoteam-guard";
import { computeReadingTime, pingBlogPaths, revalidateBlogPaths } from "@/lib/seoteam-posts";
import { sanitizeBlogHtml, sanitizeBlocks } from "@/lib/sanitize-html";

/**
 * /api/seoteam/posts/[id] — read one (edit form), full replace (PUT), quick
 * publish/unpublish toggle (PATCH), delete. Same patterns as /api/blog/[id] but
 * cookie-gated, using the SEO validators (keyword backlinks / templates), and
 * revalidating the public blog so changes appear instantly.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * IndexNow for an edit to an existing post, shared by PUT and PATCH.
 *
 * Nothing is submitted for a draft edited into another draft: that URL has never
 * been live, so there is nothing for an engine to learn. Everything else pings
 * the post URL, plus the old URL when the slug moved, plus `/blog` when the
 * published list changed (published, unpublished, or moved to a new URL).
 */
function pingPostChange(opts: {
  slug: string;
  prevSlug?: string;
  wasPublished: boolean;
  isPublished: boolean;
}): void {
  if (!opts.wasPublished && !opts.isPublished) return;
  const slugChanged = Boolean(opts.prevSlug && opts.prevSlug !== opts.slug);
  pingBlogPaths(opts.slug, opts.prevSlug, {
    index: slugChanged || opts.wasPublished !== opts.isPublished,
  });
}

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

    // `status` is selected for the IndexNow ping below: an unpublish is only
    // recognisable by comparing the state before the write with the state after.
    const existing = await BlogPost.findById(params.id).select("publishedAt slug status").lean();
    if (!existing) throw new ApiError(404, "Post not found.");

    const { slug, ...rest } = seoBlogPostInput.parse(await req.json());
    rest.content = sanitizeBlogHtml(rest.content);
    rest.blocks = sanitizeBlocks(rest.blocks);
    // The other writer for this same document is /api/blog/[id]. See PRESERVE_ON_OMIT.
    const parts = diffSetUnset(rest, { preserve: PRESERVE_ON_OMIT });
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

    const prevSlug = existing.slug ? String(existing.slug) : undefined;
    revalidateBlogPaths(String(updated.slug), prevSlug);
    pingPostChange({
      slug: String(updated.slug),
      prevSlug,
      wasPublished: existing.status === "published",
      isPublished: updated.status === "published",
    });
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

    // Read once, up front. This is the publish/unpublish toggle, so the previous
    // status and slug are what tell IndexNow whether a URL just appeared or just
    // went away — and the `publishedAt` fallback below needs the same document.
    const existing = await BlogPost.findById(params.id).select("publishedAt slug status").lean();
    if (!existing) throw new ApiError(404, "Post not found.");

    const patch: Record<string, unknown> = { ...data };
    if (data.slug !== undefined || data.title !== undefined) {
      patch.slug = await resolveSlug(params.id, data.title, data.slug);
    }
    if (data.status === "published" && data.publishedAt === undefined) {
      patch.publishedAt = existing.publishedAt ?? new Date();
    }

    const updated = await BlogPost.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new ApiError(404, "Post not found.");

    revalidateBlogPaths(String(updated.slug));
    pingPostChange({
      slug: String(updated.slug),
      prevSlug: existing.slug ? String(existing.slug) : undefined,
      wasPublished: existing.status === "published",
      isPublished: updated.status === "published",
    });
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

    const deletedSlug = deleted.slug ? String(deleted.slug) : undefined;
    revalidateBlogPaths(undefined, deletedSlug);
    // A removal is submitted like any other change: IndexNow has no "delete"
    // verb, the engines learn the page is gone by recrawling it and finding a
    // 404. A post that was never published has no URL to retire, so it is
    // skipped rather than sent as a 404 nobody had indexed.
    if (deleted.status === "published" && deletedSlug) {
      pingBlogPaths(undefined, deletedSlug, { index: true });
    }
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
