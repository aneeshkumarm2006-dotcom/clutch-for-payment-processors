import { SITE_NAME, SITE_URL } from "@/lib/seo";
import type { ISiteSettings } from "@/models";
import type { EngineContext } from "./types";

/**
 * Build the engine's site context from the SiteSettings singleton.
 *
 * Kept out of `build.ts` so the engine itself stays free of model imports (see the
 * purity contract in `./types.ts`) — this file takes a type-only import and is
 * safe on both sides, but the boundary is worth respecting explicitly.
 *
 * Site identity is READ FROM SETTINGS, never hardcoded: that's what lets the same
 * engine emit a correct Organization node on a different dashboard without a code
 * change. `SITE_NAME`/`SITE_URL` are last-resort fallbacks for a cold database.
 */
export function toEngineContext(settings: ISiteSettings | null | undefined): EngineContext {
  const sameAs = Object.values(settings?.socialLinks ?? {}).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  return {
    siteName: settings?.siteName || SITE_NAME,
    siteUrl: SITE_URL,
    logo: settings?.logo,
    sameAs: sameAs.length ? sameAs : undefined,
    email: settings?.contactEmail,
  };
}
