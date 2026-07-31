import { handleApiError, json } from "@/lib/api";
import { searchSuggest } from "@/lib/search";

/**
 * GET /api/search/suggest?q= — typeahead feed for the site search box.
 *
 * Same matching rules as `/api/search`, slim projection: label, sublabel, href
 * (and a processor logo), so the request that fires while someone is still
 * typing stays small. Cached at the edge for a minute — suggestions are public
 * and identical for everyone, and repeat prefixes are the common case.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(8, Math.max(1, Number(searchParams.get("limit")) || 5));
    const results = await searchSuggest(q, limit);

    const res = json(results);
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
