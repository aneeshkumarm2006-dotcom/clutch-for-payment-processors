import { connectToDatabase } from "@/lib/db";
import { SiteSettings } from "@/models";
import { homepageInput } from "@/lib/validators";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { handleApiError, json, requireAdminRole } from "@/lib/api";
import { logAudit } from "@/lib/audit";

/**
 * /api/settings/homepage — the landing-page content editor (/admin/homepage).
 *
 * Deliberately NOT folded into `PUT /api/settings`: that handler full-replaces
 * the singleton and `$unset`s every key its payload omits, so a landing-page save
 * posted there would wipe siteName / contactEmail / socialLinks / defaultSeo. This
 * route touches only the four landing-page keys and leaves the rest alone.
 *
 * Admin-only, matching `/api/settings` (PRD §11 Phase 2 — editors can't change
 * site-wide configuration).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminRole();
    const settings = await getOrCreateSiteSettings();
    return json({
      homepageHeroTitle: settings.homepageHeroTitle,
      homepageHeroSubtitle: settings.homepageHeroSubtitle,
      featuredCategorySlugs: settings.featuredCategorySlugs ?? [],
      homepage: settings.homepage ?? {},
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdminRole();
    await connectToDatabase();

    const data = homepageInput.parse(await req.json());

    // A whole-object `$set` on `homepage`, not per-field: the payload always
    // carries the complete config, so replacing it is what makes "clear this
    // field back to the default" work — a per-key merge would leave the old
    // value in place. Optional keys arrive as `undefined` and Mongoose drops
    // them, which is exactly the state `resolveHomepage()` reads as "default".
    const updated = await SiteSettings.findOneAndUpdate(
      { key: "singleton" },
      {
        $set: {
          homepageHeroTitle: data.homepageHeroTitle,
          homepageHeroSubtitle: data.homepageHeroSubtitle,
          featuredCategorySlugs: data.featuredCategorySlugs,
          homepage: data.homepage,
        },
        $setOnInsert: { key: "singleton" },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "settings",
      entityId: "singleton",
      entityLabel: "Landing page",
      after: updated?.homepage,
    });

    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
