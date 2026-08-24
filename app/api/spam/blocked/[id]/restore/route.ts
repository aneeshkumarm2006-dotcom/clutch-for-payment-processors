import { connectToDatabase } from "@/lib/db";
import { BlockedSubmission, Lead, OfferSignup, Review, Submission } from "@/models";
import { leadInput, offerSignupInput, reviewInput, submissionInput } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdmin } from "@/lib/api";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/spam/blocked/[id]/restore — "This was real."
 *
 * Replays a binned payload into its proper collection, pre-cleared so nothing
 * re-flags it. This is the whole justification for allowing hard rejection at
 * all: without a restore path, a false positive is unrecoverable and the filter
 * is only ever one bad rule away from destroying a customer.
 *
 * The payload still goes through the same validator the public route uses. A
 * bin row can hold anything that arrived, including malformed junk, and it must
 * not be able to write a document the schema would have refused.
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "Not found.");

    await connectToDatabase();
    const row = await BlockedSubmission.findById(params.id).lean();
    if (!row) throw new ApiError(404, "Not found.");
    if (row.restoredAt) throw new ApiError(409, "That submission has already been restored.");

    const payload = (row.payload ?? {}) as Record<string, unknown>;
    // A human vouched for it, so it lands cleared: `clearedAt` also stops the
    // backfill from ever re-classifying it.
    const spam = {
      verdict: "allow" as const,
      score: 0,
      category: "clean",
      reasons: [],
      codes: [],
      classifiedAt: new Date(),
      clearedAt: new Date(),
      clearedBy: session.user.email ?? session.user.id,
    };

    let entityLabel = "restored from spam";
    if (row.form === "lead") {
      const data = leadInput.parse(payload);
      const created = await Lead.create({ ...data, status: "new", spam });
      entityLabel = created.name;
    } else if (row.form === "offer") {
      const data = offerSignupInput.parse(payload);
      const { offer, email, ...rest } = data;
      // Upsert, not create: the address may have signed up legitimately in the
      // meantime, and the unique (offer, email) index would reject a plain
      // insert — turning "this was real" into a 500 the operator can't act on.
      await OfferSignup.updateOne(
        { offer, email },
        // `offer`/`email` are seeded from the filter on insert — repeating them in
        // $setOnInsert is a path conflict, not a belt-and-braces.
        { $set: { ...rest, spam }, $setOnInsert: { status: "new", delivered: false, submissions: 1 } },
        { upsert: true },
      );
      entityLabel = email;
    } else if (row.form === "submission") {
      const data = submissionInput.parse(payload);
      const created = await Submission.create({ ...data, status: "new", spam });
      entityLabel = created.processorName;
    } else {
      const data = reviewInput.parse(payload);
      const created = await Review.create({
        ...data,
        status: "pending",
        source: "web-form",
        isVerified: false,
        spam,
      });
      entityLabel = created.title;
    }

    // Keep the bin row as the audit trail rather than deleting it; the TTL will
    // clear it in its own time.
    await BlockedSubmission.findByIdAndUpdate(params.id, { $set: { restoredAt: new Date() } });

    void logAudit({
      actor: session.user.id,
      action: "create",
      entity: row.form,
      entityId: params.id,
      entityLabel,
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
