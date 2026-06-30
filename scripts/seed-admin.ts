import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { USER_ROLES, type UserRole } from "@/lib/enums";

/**
 * Seed an admin (or editor) user (PRD §11 / §10.10) from ADMIN_SEED_EMAIL /
 * ADMIN_SEED_PASSWORD.
 *
 *   npm run seed:admin                       # role: admin (default)
 *   npm run seed:admin -- --role=editor      # role: editor (Phase 2)
 *   ADMIN_SEED_ROLE=editor npm run seed:admin # same, via env var
 *
 * Idempotent: if a user with that email already exists, the password hash, name,
 * and role are refreshed rather than creating a duplicate.
 */

/** Read a `--role=…` CLI flag, falling back to ADMIN_SEED_ROLE, then "admin". */
function resolveRole(): UserRole {
  const flag = process.argv.find((a) => a.startsWith("--role="))?.split("=")[1];
  const raw = (flag ?? process.env.ADMIN_SEED_ROLE ?? "admin").trim().toLowerCase();
  if (!(USER_ROLES as readonly string[]).includes(raw)) {
    throw new Error(`Invalid role "${raw}". Use one of: ${USER_ROLES.join(", ")}.`);
  }
  return raw as UserRole;
}

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Admin";
  const role = resolveRole();

  if (!email || !password) {
    throw new Error(
      "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env.local before seeding a user.",
    );
  }

  await connectToDatabase();

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await User.findOneAndUpdate(
    { email },
    { $set: { passwordHash, name, role, isActive: true }, $setOnInsert: { email } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // eslint-disable-next-line no-console
  console.log(`✓ User ready: ${result.email} (role: ${result.role})`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Admin seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
