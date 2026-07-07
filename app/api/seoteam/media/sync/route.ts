import { handleApiError, json } from "@/lib/api";
import { requireSeoTeam } from "@/lib/seoteam-guard";
import { discoverMediaFromPosts } from "@/lib/media";

/**
 * POST /api/seoteam/media/sync — backfill the media library from images already
 * used in blog posts (and the Cloudinary "blog" folder when reachable). Idempotent:
 * only registers URLs not already in the library. Returns how many were added.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireSeoTeam();
    const result = await discoverMediaFromPosts();
    return json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
