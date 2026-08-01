import mongoose from "mongoose";

/**
 * Mongo connection for one-shot CLI scripts.
 *
 * NOT `lib/db.ts`. That one sets `serverSelectionTimeoutMS: 5000` on purpose, so
 * a public page renders an empty state instead of hanging when Atlas is slow —
 * correct for a request, wrong for a migration, which would rather wait half a
 * minute than abort halfway through a batch of writes. Call `loadEnv()` first;
 * it points the resolver at public DNS for the Atlas SRV lookup.
 */
export async function connectForScript(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
  }
  return mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 30_000,
  });
}
