import bcrypt from "bcrypt";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { userUpdate } from "@/lib/validators";
import { ApiError, handleApiError, json, requireAdminRole } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { redactUser, toAdminUserData } from "@/lib/serialize";

/**
 * /api/users/[id] (PRD §10.10 / §11 — Phase 2). **Admin-only.**
 *   PATCH  set role, (de)activate, rename, or reset password.
 *   DELETE remove an account.
 *
 * Guard: the site must always retain at least one **active admin**. You can't
 * demote, deactivate, or delete the last one (this also blocks self-demotion /
 * self-deletion when you're the only admin).
 */
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** An account that can actually sign in and administer: admin role + active. */
const isEffectiveAdmin = (u: { role?: unknown; isActive?: unknown }) =>
  u.role === "admin" && u.isActive !== false;

const LAST_ADMIN_MSG =
  "This is the last active admin — promote or activate another admin first.";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminRole();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "User not found.");

    const existing = await User.findById(params.id).lean();
    if (!existing) throw new ApiError(404, "User not found.");

    const data = userUpdate.parse(await req.json());

    // What the record looks like after this change.
    const next = {
      role: data.role ?? existing.role,
      isActive: data.isActive ?? existing.isActive,
    };

    // If this change strips the last effective admin, refuse it.
    if (isEffectiveAdmin(existing) && !isEffectiveAdmin(next)) {
      const otherAdmins = await User.countDocuments({
        _id: { $ne: params.id },
        role: "admin",
        isActive: { $ne: false },
      });
      if (otherAdmins === 0) throw new ApiError(400, LAST_ADMIN_MSG);
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.role !== undefined) patch.role = data.role;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.password !== undefined) patch.passwordHash = await bcrypt.hash(data.password, 12);

    const updated = await User.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new ApiError(404, "User not found.");

    void logAudit({
      actor: session.user.id,
      action: "update",
      entity: "user",
      entityId: params.id,
      entityLabel: updated.email,
      before: redactUser(existing),
      after: redactUser(updated),
    });

    return json(toAdminUserData(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminRole();
    await connectToDatabase();
    if (!OBJECT_ID.test(params.id)) throw new ApiError(404, "User not found.");

    const existing = await User.findById(params.id).lean();
    if (!existing) throw new ApiError(404, "User not found.");

    // Don't let the last active admin be deleted (incl. self-delete).
    if (isEffectiveAdmin(existing)) {
      const otherAdmins = await User.countDocuments({
        _id: { $ne: params.id },
        role: "admin",
        isActive: { $ne: false },
      });
      if (otherAdmins === 0) throw new ApiError(400, LAST_ADMIN_MSG);
    }

    await User.findByIdAndDelete(params.id);

    void logAudit({
      actor: session.user.id,
      action: "delete",
      entity: "user",
      entityId: params.id,
      entityLabel: existing.email,
      before: redactUser(existing),
    });

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
