import connectToDatabase from "@/lib/db";
import AnalyticsHubConfig from "@/models/AnalyticsHubConfig";
import { encrypt, decrypt } from "./crypto";

/**
 * lib/analyticshub/config-store.ts — the typed façade over the key/value store.
 *
 * The interface deals in PLAINTEXT strings; encryption at rest is an
 * implementation detail of the Mongo-backed store (`mongoStore`). This lets the
 * handler tests inject an in-memory stub (`makeMemoryStore`) that exercises the
 * exact same dispatch/handler code without needing a database or the secret key.
 */

export interface ConfigStore {
  /** Decrypted plaintext for `key`, or null if absent. */
  get(key: string): Promise<string | null>;
  /** Encrypts (real store) and upserts `value` under `key`. */
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Delete every key beginning with `prefix`. Returns the count removed. */
  deleteByPrefix(prefix: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Well-known keys (namespaced so one collection stays legible)
// ---------------------------------------------------------------------------
export const KEYS = {
  password: "auth:password",
  loginRate: (ip: string) => `auth:ratelimit:${ip}`,
  project: "project",
  google: "source:google",
  meta: "source:meta",
  gads: "source:gads",
  cache: (source: string, from: string, to: string) => `cache:${source}:${from}:${to}`,
  cachePrefix: (source: string) => `cache:${source}:`,
} as const;

// ---------------------------------------------------------------------------
// Mongo-backed store (production) — values encrypted with AES-256-GCM
// ---------------------------------------------------------------------------
export const mongoStore: ConfigStore = {
  async get(key) {
    await connectToDatabase();
    const doc = await AnalyticsHubConfig.findOne({ key }).lean();
    if (!doc) return null;
    try {
      return decrypt(doc.value);
    } catch {
      // A decrypt failure almost always means ANALYTICSHUB_SECRET_KEY changed
      // (orphaning old ciphertext). Surface as "absent" so callers fall back to
      // not-connected / re-setup rather than 500-ing.
      return null;
    }
  },
  async set(key, value) {
    await connectToDatabase();
    await AnalyticsHubConfig.findOneAndUpdate(
      { key },
      { $set: { value: encrypt(value) }, $setOnInsert: { key } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },
  async delete(key) {
    await connectToDatabase();
    await AnalyticsHubConfig.deleteOne({ key });
  },
  async deleteByPrefix(prefix) {
    await connectToDatabase();
    // Anchor + escape so `cache:ga4:` can't be read as a regex metacharacter.
    const safe = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const res = await AnalyticsHubConfig.deleteMany({ key: { $regex: `^${safe}` } });
    return res.deletedCount ?? 0;
  },
};

// ---------------------------------------------------------------------------
// In-memory store (tests) — plaintext, no crypto, no DB
// ---------------------------------------------------------------------------
export function makeMemoryStore(seed?: Record<string, string>): ConfigStore & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    async get(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    async deleteByPrefix(prefix) {
      let n = 0;
      for (const k of [...map.keys()]) {
        if (k.startsWith(prefix)) {
          map.delete(k);
          n += 1;
        }
      }
      return n;
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
// A single in-memory store for ANALYTICSHUB_STUB=1 (visual verification only), so
// setup/login persist across requests within one dev process. Stashed on
// globalThis so Next's dev hot-reload doesn't wipe it. Never used in prod.
declare global {
  // eslint-disable-next-line no-var
  var _analyticshubStubStore: ConfigStore | undefined;
}
export function getStubStore(): ConfigStore {
  if (!globalThis._analyticshubStubStore) globalThis._analyticshubStubStore = makeMemoryStore();
  return globalThis._analyticshubStubStore;
}

export async function getJSON<T>(store: ConfigStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON(store: ConfigStore, key: string, value: unknown): Promise<void> {
  await store.set(key, JSON.stringify(value));
}
