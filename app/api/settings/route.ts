import { connectToDatabase } from "@/lib/db";
import { SiteSettings } from "@/models";
import { siteSettingsInput } from "@/lib/validators";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { diffSetUnset, handleApiError, json, requireAdmin } from "@/lib/api";

/**
 * /api/settings (PRD §10.9 / TODO §2.4) — the SiteSettings singleton editor.
 *   GET  admin read (creates defaults on first access).
 *   PUT  admin update (upsert keyed on the singleton).
 *
 * NOTE: not in the PRD §12 route table but required by §10.9; logged in NOTES.md.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getOrCreateSiteSettings();
    return json(settings);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
    await connectToDatabase();

    const data = siteSettingsInput.parse(await req.json());
    const { $set, $unset } = diffSetUnset(data);

    const updated = await SiteSettings.findOneAndUpdate(
      { key: "singleton" },
      {
        $set,
        ...(Object.keys($unset).length ? { $unset } : {}),
        $setOnInsert: { key: "singleton" },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    return json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
