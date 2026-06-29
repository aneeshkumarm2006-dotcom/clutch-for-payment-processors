import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

/**
 * Seed the first admin user (PRD §11) from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD.
 *
 *   npm run seed:admin
 *
 * Idempotent: if a user with that email already exists, the password hash and
 * name are refreshed rather than creating a duplicate.
 */
async function main() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Admin";

  if (!email || !password) {
    throw new Error(
      "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env.local before seeding an admin.",
    );
  }

  await connectToDatabase();

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await User.findOneAndUpdate(
    { email },
    { $set: { passwordHash, name, role: "admin" }, $setOnInsert: { email } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // eslint-disable-next-line no-console
  console.log(`✓ Admin ready: ${result.email} (role: ${result.role})`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Admin seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
