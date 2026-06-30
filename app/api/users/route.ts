import bcrypt from "bcrypt";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { userInput } from "@/lib/validators";
import { handleApiError, json, requireAdminRole } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { redactUser, toAdminUserData } from "@/lib/serialize";

/**
 * /api/users (PRD §10.10 / §11 — Phase 2). **Admin-only** (editors get 403 via
 * `requireAdminRole`).
 *   GET   list every account (newest first), secret-free.
 *   POST  create an account from an email + temp password + role; the password
 *         is bcrypt-hashed before persisting (the plaintext never touches the DB).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminRole();
    await connectToDatabase();
    const docs = await User.find().sort({ createdAt: -1 }).lean();
    return json({ items: docs.map(toAdminUserData) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminRole();
    await connectToDatabase();

    const data = userInput.parse(await req.json());
    const passwordHash = await bcrypt.hash(data.password, 12);

    const created = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      role: data.role,
      passwordHash,
      isActive: true,
    });
    const createdObj = created.toObject() as unknown as Record<string, unknown>;

    void logAudit({
      actor: session.user.id,
      action: "create",
      entity: "user",
      entityId: String(created._id),
      entityLabel: created.email,
      after: redactUser(createdObj),
    });

    return json(toAdminUserData(createdObj), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
