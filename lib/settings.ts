import { connectToDatabase } from "@/lib/db";
import { SiteSettings, type ISiteSettings } from "@/models";

/**
 * Read the SiteSettings singleton (PRD §8.8), creating it from schema defaults
 * the first time. Shared by the admin settings page/API and (in Stage 3) the
 * public layout/homepage. The `key: "singleton"` unique index guarantees one row.
 */
export async function getOrCreateSiteSettings(): Promise<ISiteSettings> {
  await connectToDatabase();
  const existing = await SiteSettings.findOne({ key: "singleton" }).lean();
  if (existing) return existing;

  const created = await SiteSettings.create({ key: "singleton" });
  return created.toObject();
}
