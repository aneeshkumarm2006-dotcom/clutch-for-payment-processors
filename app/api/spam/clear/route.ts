import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { MODEL_BY_FORM } from "@/lib/spam/admin";

/**
 * POST /api/spam/clear — the "Not spam" button.
 *
 * Pulls one quarantined row back into the normal inbox AND clears the machine's
 * reasoning with it: score, category, reasons and codes all go. Leaving the old
 * reasoning attached to a row a human has vindicated is how an operator ends up
 * distrusting the whole view.
 *
 * `clearedAt` is the record that a person decided this, and it is load-bearing:
 * the backfill script refuses to touch any row carrying it, so a later rule
 * change can never silently re-flag something someone already vindicated.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  form: z.enum(["lead", "submission", "review"]),
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
});

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const { form, id } = body.parse(await req.json());

    await connectToDatabase();
    const Model = MODEL_BY_FORM[form];

    const updated = await Model.findByIdAndUpdate(
      id,
      {
        $set: {
          "spam.verdict": "allow",
          "spam.score": 0,
          "spam.category": "clean",
          "spam.reasons": [],
          "spam.codes": [],
          "spam.clearedAt": new Date(),
          "spam.clearedBy": session.user.email ?? session.user.id,
        },
      },
      { new: true },
    ).lean();

    if (!updated) throw new ApiError(404, "That submission no longer exists.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: form,
      entityId: id,
      entityLabel: "marked not spam",
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
