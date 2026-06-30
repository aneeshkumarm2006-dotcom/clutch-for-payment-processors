import { connectToDatabase } from "@/lib/db";
import { Processor } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { processorInput } from "@/lib/validators";
import { handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { PAGE_SIZE, parseDirectoryParams, queryDirectory } from "@/lib/processors-query";

/**
 * /api/processors (PRD §12 / TODO §3.2).
 *
 *   GET   public faceted list — published only, with the full query-param facet
 *         set and the default ranking sort (sponsored → tier → score). Backed by
 *         the same `lib/processors-query.ts` the directory pages use, so the API
 *         and the SSR pages can never disagree.
 *   POST  admin create.
 *
 * Supported GET params (§3.2): category, sort, page, pricingModel, methods,
 * integrations, features, region, size, rate, fee, minRating, verifiedOnly,
 * highRisk, q. The admin processors list reads the DB directly (see
 * app/admin/(panel)/processors/page.tsx), so it doesn't depend on this route.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params = parseDirectoryParams(searchParams);
    const result = await queryDirectory(params);

    return json({
      items: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    await connectToDatabase();

    const data = processorInput.parse(await req.json());
    const slug = await ensureUniqueSlug(Processor, data.name, { explicitSlug: data.slug });

    const created = await Processor.create({ ...data, slug });

    void logAudit({
      actor: session.user.id,
      action: "create",
      entity: "processor",
      entityId: String(created._id),
      entityLabel: created.name,
    });

    return json(created.toObject(), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
