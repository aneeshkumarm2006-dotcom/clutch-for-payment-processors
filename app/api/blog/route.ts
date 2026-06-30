import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { blogPostInput } from "@/lib/validators";
import { getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toAdminBlogData, toBlogCardData } from "@/lib/serialize";

/**
 * /api/blog (PRD §12 / TODO §6.1).
 *   GET   published list (public, card projection) / all (admin, list projection),
 *         newest first.
 *   POST  admin create. When publishing without an explicit date, stamps
 *         `publishedAt` to now so the post sorts correctly.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const session = await getAdminSession();

    if (session?.user) {
      const items = await BlogPost.find().sort({ updatedAt: -1 }).lean();
      return json({ items: items.map(toAdminBlogData) });
    }

    const items = await BlogPost.find({ status: "published" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .select("title slug excerpt coverImage author tags publishedAt createdAt readingTimeMinutes")
      .lean();
    return json({ items: items.map(toBlogCardData) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();

    const data = blogPostInput.parse(await req.json());
    const slug = await ensureUniqueSlug(BlogPost, data.title, { explicitSlug: data.slug });

    // A post that goes live without an explicit date gets stamped now.
    const publishedAt =
      data.status === "published" && !data.publishedAt ? new Date() : data.publishedAt;

    const created = await BlogPost.create({ ...data, slug, publishedAt });

    void logAudit({
      actor: session.user.id,
      action: "create",
      entity: "blog",
      entityId: String(created._id),
      entityLabel: created.title,
    });

    return json(created.toObject(), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
