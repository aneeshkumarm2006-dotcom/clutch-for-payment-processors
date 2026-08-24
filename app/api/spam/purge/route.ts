import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { BlockedSubmission } from "@/models";
import { handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { MODEL_BY_FORM } from "@/lib/spam/admin";

/**
 * POST /api/spam/purge — empty a spam view.
 *
 *   scope: "quarantine" → delete every held-back submission
 *   scope: "blocked"    → empty the blocked bin early (it self-empties at 30d)
 *
 * Rows a human has cleared are excluded from the quarantine purge by the
 * `spam.clearedAt` guard — they are back in the normal inbox and are not spam
 * to be swept up. This is a destructive action behind an explicit confirmation
 * in the UI; nothing calls it automatically.
 */
export const dynamic = "force-dynamic";

const body = z.object({ scope: z.enum(["quarantine", "blocked"]) });

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const { scope } = body.parse(await req.json());

    await connectToDatabase();

    let deleted = 0;
    if (scope === "blocked") {
      const res = await BlockedSubmission.deleteMany({ restoredAt: { $exists: false } });
      deleted = res.deletedCount ?? 0;
    } else {
      for (const Model of Object.values(MODEL_BY_FORM)) {
        const res = await Model.deleteMany({
          "spam.verdict": "quarantine",
          "spam.clearedAt": { $exists: false },
        });
        deleted += res.deletedCount ?? 0;
      }
    }

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "settings",
      entityId: `spam-purge-${scope}`,
      entityLabel: `purged ${deleted} ${scope} row(s)`,
    });

    return json({ ok: true, deleted });
  } catch (err) {
    return handleApiError(err);
  }
}
