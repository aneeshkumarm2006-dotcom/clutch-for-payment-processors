import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
import { handleApiError, json, requireAdmin } from "@/lib/api";

/**
 * /api/page-seo — admin list of the static-page SEO records (PRD §13).
 * The set is fixed/seeded, so there's no POST here; admins edit via `[id]`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const docs = await PageSeo.find().sort({ title: 1 }).lean();
    return json(docs);
  } catch (err) {
    return handleApiError(err);
  }
}
