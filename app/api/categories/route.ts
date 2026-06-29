import { connectToDatabase } from "@/lib/db";
import { Category } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { categoryInput } from "@/lib/validators";
import { getAdminSession, handleApiError, json, requireAdmin } from "@/lib/api";

/**
 * /api/categories (PRD §12 / TODO §2.3).
 *   GET   published list (public) / all (admin), ordered by displayOrder.
 *   POST  admin create.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const session = await getAdminSession();
    const filter = session?.user ? {} : { isPublished: true };

    const items = await Category.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
    return json({ items });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();

    const data = categoryInput.parse(await req.json());
    const slug = await ensureUniqueSlug(Category, data.name, { explicitSlug: data.slug });

    const created = await Category.create({ ...data, slug });
    return json(created.toObject(), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
