import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { seoBlogPostInput } from "@/lib/validators";
import { handleApiError, json } from "@/lib/api";
import { requireSeoTeam } from "@/lib/seoteam-guard";
import { computeReadingTime, revalidateBlogPaths } from "@/lib/seoteam-posts";
import { toSeoPostRow } from "@/lib/serialize";

/**
 * /api/seoteam/posts — list + create, gated by the shared-password cookie
 * (`requireSeoTeam`). Writes to the SAME `BlogPost` collection as /admin/blog, so
 * published posts flow straight onto the public /blog. Separate from /api/blog
 * because the auth model + validators (keyword backlinks / templates) differ.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSeoTeam();
    await connectToDatabase();
    const items = await BlogPost.find().sort({ updatedAt: -1 }).lean();
    return json({ items: items.map(toSeoPostRow) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireSeoTeam();
    await connectToDatabase();

    const data = seoBlogPostInput.parse(await req.json());
    const slug = await ensureUniqueSlug(BlogPost, data.title, { explicitSlug: data.slug });
    const publishedAt =
      data.status === "published" && !data.publishedAt ? new Date() : data.publishedAt;

    const created = await BlogPost.create({
      ...data,
      slug,
      publishedAt,
      readingTimeMinutes: computeReadingTime(data.content),
    });

    if (created.status === "published") revalidateBlogPaths(created.slug);
    return json(created.toObject(), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
