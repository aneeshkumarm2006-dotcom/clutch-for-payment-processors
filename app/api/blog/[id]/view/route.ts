import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/blog/[id]/view — best-effort read counter (monitoring). Pinged by a
 * client beacon on the public post page, so it MUST stay public (it lives under
 * /api/blog, NOT /api/seoteam, which the edge guard would 401). Accepts an id or
 * slug. `timestamps:false` keeps view counting from bumping `updatedAt` (which
 * would corrupt sitemap freshness). Always returns 204.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = rateLimit(`blogview:${clientIp(req)}:${params.id}`, 30, 60_000);
    if (rl.ok) {
      await connectToDatabase();
      await BlogPost.updateOne(
        {
          status: "published",
          ...(OBJECT_ID.test(params.id) ? { _id: params.id } : { slug: params.id }),
        },
        { $inc: { views: 1 } },
        { timestamps: false },
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[blog/view] failed:", err);
  }
  return new Response(null, { status: 204 });
}
