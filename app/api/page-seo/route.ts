import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
import { pageSeoCreate } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdmin, requireAdminRole } from "@/lib/api";
import { logAudit } from "@/lib/audit";

/**
 * /api/page-seo (PRD §13).
 *   GET  admin list of every page record.
 *   POST create a `landing` page — a standalone SEO page that exists only as
 *        this record (see `models/PageSeo.ts`). `route` records are seeded, not
 *        created here: their page has to exist in code first.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await connectToDatabase();
    const docs = await PageSeo.find().sort({ kind: 1, title: 1 }).lean();
    return json(docs);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminRole();
    await connectToDatabase();

    const input = pageSeoCreate.parse(await req.json());

    // `path` and `pageKey` are both unique, and the duplicate-key error names
    // whichever index Mongo hit first — which is not the field the editor typed
    // into. Check up front so the message points at the box they can fix.
    const clash = await PageSeo.findOne({
      $or: [{ path: input.path }, { pageKey: input.pageKey }],
    })
      .select("path")
      .lean();
    if (clash) {
      throw new ApiError(409, "A page already uses that path.", {
        path: ["A page already uses that path."],
      });
    }

    const doc = await PageSeo.create(input);

    void logAudit({
      actor: session.user.id,
      action: "create",
      entity: "settings",
      entityId: String(doc._id),
      entityLabel: `Landing page: ${doc.title}`,
    });

    return json(doc.toObject(), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
