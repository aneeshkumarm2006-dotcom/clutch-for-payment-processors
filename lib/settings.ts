import { cache } from "react";
import { connectToDatabase } from "@/lib/db";
import { SiteSettings, type ISiteSettings } from "@/models";

/**
 * Read the SiteSettings singleton (PRD §8.8), creating it from schema defaults
 * the first time. Shared by the admin settings page/API and the public
 * layout/homepage. The `key: "singleton"` unique index guarantees one row.
 *
 * `cache()` dedupes the read within a single request. The public layout emits the
 * site-wide Organization/WebSite schema from it while the page body reads it too,
 * so without this every public render would issue the same query twice.
 */
export const getOrCreateSiteSettings = cache(async (): Promise<ISiteSettings> => {
  await connectToDatabase();
  const existing = await SiteSettings.findOne({ key: "singleton" }).lean();
  if (existing) return existing;

  const created = await SiteSettings.create({ key: "singleton" });
  return created.toObject();
});
