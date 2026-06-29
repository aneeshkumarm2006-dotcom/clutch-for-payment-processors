import { handleApiError, json } from "@/lib/api";
import { searchAll } from "@/lib/search";

/**
 * GET /api/search?q= (PRD §9.5 / §12) — public cross-collection search across
 * Processor + Category + BlogPost, grouped. Backed by `lib/search.ts`, the same
 * helper the `/search` page renders server-side, so the two never disagree.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(24, Math.max(1, Number(searchParams.get("limit")) || 12));
    const results = await searchAll(q, limit);
    return json(results);
  } catch (err) {
    return handleApiError(err);
  }
}
