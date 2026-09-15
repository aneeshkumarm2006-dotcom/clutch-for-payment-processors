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
import { pingIndexNow } from "@/lib/indexnow";
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

    // The publish/robots/redirect fields are selected for the IndexNow ping
    // below: a page going dark is only visible by comparing the state before the
    // write with the state after.
    const existing = await PageSeo.findById(params.id)
      .select("kind path isPublished seo.robotsIndex seo.redirectTo")
      .lean();
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

    /**
     * Submit the page whose meta just changed, and the URL it moved off when an
     * editor repointed a landing page (the old one now 404s, which is exactly
     * what the engines need to be told).
     *
     * The test is "indexable before OR indexable after", which is deliberately
     * both directions:
     *
     *   - a draft edited into another draft, or a page that has been noindexed
     *     all along, has nothing an engine should be asked to look at
     *   - unpublishing, noindexing or redirecting a page that WAS live is the
     *     most valuable ping of all: it is how the engines learn to drop it,
     *     instead of serving a stale title for the next few weeks
     *
     * `isPublished` is meaningless on a `route` record (its page is in code and
     * always live), and it defaults to `true` on those documents, so the same
     * expression reads correctly for both kinds.
     */
    const indexable = (p: {
      isPublished?: boolean;
      seo?: { robotsIndex?: boolean; redirectTo?: string };
    }) => p.isPublished !== false && p.seo?.robotsIndex !== false && !p.seo?.redirectTo;

    if (indexable(existing) || indexable(updated)) {
      const pingPaths = [updated.path];
      if (existing.path !== updated.path) pingPaths.push(existing.path);
      pingIndexNow(pingPaths);
    }

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

    // Deleting a landing page deletes the page. Submitting the dead URL is how
    // the engines find the 404 and drop it, instead of serving a stale title
    // from their index for the next few weeks. Only a page that was actually
    // indexable had a URL worth retiring — same test as the PUT above.
    if (doc.isPublished && doc.seo?.robotsIndex !== false && !doc.seo?.redirectTo) {
      pingIndexNow(doc.path);
    }

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
