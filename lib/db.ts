import mongoose from "mongoose";
import { getServers, setServers } from "node:dns";
import { setServers as setServersPromise } from "node:dns/promises";

/**
 * Cached Mongoose connection (singleton, hot-reload safe).
 *
 * In development Next.js clears the module cache on every request, which would
 * otherwise open a new DB connection each time and exhaust the pool. We stash
 * the connection promise on `global` so it survives hot reloads.
 */

/**
 * Atlas `mongodb+srv://` URIs require a DNS SRV lookup. Some local resolvers
 * (corporate DNS filters, VPNs, or ad-blockers bound to 127.0.0.1) refuse SRV
 * queries with `querySrv ECONNREFUSED`, so the app can't reach Atlas even though
 * the network is otherwise fine — every DB-backed page silently falls back to its
 * empty state. The CLI scripts already work around this in scripts/loadEnv.ts;
 * the running app needs the same treatment.
 *
 * We only act for `+srv` URIs, and — to stay safe in production (Vercel etc.,
 * where the system resolver works) — only override when the active resolver is a
 * loopback address or an explicit DNS_SERVERS override is provided. Runs once.
 */
let dnsConfigured = false;
function configureSrvDns(uri: string): void {
  if (dnsConfigured) return;
  if (!uri.startsWith("mongodb+srv://")) return;

  const override = (process.env.DNS_SERVERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const servers = override.length ? override : ["8.8.8.8", "1.1.1.1"];

  try {
    // getServers() may return "ip" or "ip:port"; strip the port before testing.
    const raw = getServers();
    const current = raw.map((s) => s.replace(/:\d+$/, "").replace(/^\[|\]$/g, ""));
    const loopbackOnly =
      current.length === 0 || current.every((s) => s === "::1" || s.startsWith("127."));
    if (override.length || loopbackOnly) {
      // Node keeps SEPARATE default resolvers for the callback (`node:dns`) and
      // promise (`node:dns/promises`) APIs. The MongoDB driver resolves SRV via
      // the promise resolver, so we must set BOTH or the override is a no-op for
      // the driver even though `dns.getServers()` looks updated.
      setServers(servers);
      setServersPromise(servers);
      // eslint-disable-next-line no-console
      console.info(`[db] local DNS resolver (${raw.join(",") || "none"}) can't do Atlas SRV lookups; routing DNS via ${servers.join(",")}.`);
    }
    // Only latch on success so a transient failure (e.g. setServers throwing
    // because a query is in flight) is retried on the next connect attempt.
    dnsConfigured = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[db] configureSrvDns failed (will retry):", (err as Error).message);
  }
}

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

  // Make the Atlas SRV lookup resilient to a loopback DNS resolver that refuses
  // SRV queries (see configureSrvDns). Must run before the first connect.
  configureSrvDns(MONGODB_URI);

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
