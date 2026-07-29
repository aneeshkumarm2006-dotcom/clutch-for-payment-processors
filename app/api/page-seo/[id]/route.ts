import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
import { landingPathSchema, pageSeoUpdate, RESERVED_LANDING_PATHS } from "@/lib/validators";
import {
  ApiError,
  buildUpdateDoc,
  diffSetUnset,
  handleApiError,
  json,
  requireAdmin,
  requireAdminRole,
  PRESERVE_ON_OMIT,
} from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { sanitizeBlocks } from "@/lib/sanitize-html";

/**
 * /api/page-seo/[id] (PRD §13).
 *   GET    single (admin).
 *   PUT    admin edit — `$unset`s cleared optionals.
 *   DELETE landing pages only.
 *
 * What is editable depends on the record's `kind` (see `models/PageSeo.ts`):
 *
 *   route   — `pageKey`/`path` are seed-time identity and are dropped from the
 *             body. Repointing `/compare`'s record at another URL would not move
 *             the page (its route is in code); it would just detach the record
 *             and silently blank the page's meta.
 *   landing — the record IS the page, so `path`, `heading`, `subheading` and
 *             `isPublished` are all editable, and deleting the record deletes
 *             the page. `kind` itself is never writable in either direction:
 *             turning a landing page into a route record would orphan its URL.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Page not found.");

    const doc = await PageSeo.findById(params.id).lean();
    if (!doc) throw new ApiError(404, "Page not found.");
    return json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Page not found.");

    const existing = await PageSeo.findById(params.id).select("kind path").lean();
    if (!existing) throw new ApiError(404, "Page not found.");
    const isLanding = existing.kind === "landing";

    const {
      pageKey: _pk,
      path: rawPath,
      kind: _kind,
      blocks,
      ...rest
    } = pageSeoUpdate.parse(await req.json());
    void _pk;
    void _kind;

    // `blocks` stays a tri-state: `undefined` means "this form doesn't manage
    // blocks" and is preserved below, `[]` means the editor deleted their last
    // one. Sanitizing passes both through untouched.
    const editable: Record<string, unknown> = { ...rest, blocks: sanitizeBlocks(blocks) };

    if (!isLanding) {
      // A route record owns none of the page-shaped fields — its page renders
      // them from code — so accepting them would store copy nothing displays.
      delete editable.heading;
      delete editable.subheading;
      delete editable.isPublished;
    } else if (rawPath !== undefined) {
      const path = landingPathSchema.parse(rawPath);
      if (path !== existing.path) {
        if (RESERVED_LANDING_PATHS.includes(path)) {
          throw new ApiError(400, "That path is already used by a built-in page.", {
            path: ["That path is already used by a built-in page."],
          });
        }
        const clash = await PageSeo.findOne({ path, _id: { $ne: params.id } })
          .select("_id")
          .lean();
        if (clash) {
          throw new ApiError(409, "A page already uses that path.", {
            path: ["A page already uses that path."],
          });
        }
        editable.path = path;
        // `pageKey` is derived from the path at creation; letting the two drift
        // would leave the record findable by a key that names its old URL.
        editable.pageKey = path.slice(1);
      }
    }

    const parts = diffSetUnset(editable, { preserve: PRESERVE_ON_OMIT });

    const updated = await PageSeo.findByIdAndUpdate(params.id, buildUpdateDoc(parts), {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) throw new ApiError(404, "Page not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "settings",
      entityId: params.id,
      entityLabel: `Page SEO: ${updated.title}`,
    });

    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminRole();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Page not found.");

    const doc = await PageSeo.findById(params.id).lean();
    if (!doc) throw new ApiError(404, "Page not found.");

    // Deleting a route record would not remove its page, only strip the meta,
    // FAQs and blocks off a page that stays live — a destructive no-op dressed
    // up as a delete. Unpublish a landing page instead if the URL should stay.
    if (doc.kind !== "landing") {
      throw new ApiError(
        400,
        "This record belongs to a built-in page and can't be deleted. Clear its fields instead.",
      );
    }

    await PageSeo.findByIdAndDelete(params.id);

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "settings",
      entityId: params.id,
      entityLabel: `Landing page: ${doc.title}`,
      before: doc,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
