import mongoose from "mongoose";

/**
 * Cached Mongoose connection (singleton, hot-reload safe).
 *
 * In development Next.js clears the module cache on every request, which would
 * otherwise open a new DB connection each time and exhaust the pool. We stash
 * the connection promise on `global` so it survives hot reloads.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
if (!global._mongooseCache) {
  global._mongooseCache = cache;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Read lazily (not at module load) so CLI scripts can populate process.env
  // — e.g. via scripts/loadEnv.ts — before the first connection is opened.
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        // Fail fast instead of the 30s default so a public page can fall back to
        // an empty state (and `next build` doesn't hang) when Mongo is unreachable.
        serverSelectionTimeoutMS: 5000,
      })
      .then((m) => m);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

export default connectToDatabase;
