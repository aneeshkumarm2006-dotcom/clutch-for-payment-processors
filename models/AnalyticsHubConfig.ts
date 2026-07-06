import { Schema, model, models, type Model } from "mongoose";

/**
 * AnalyticsHubConfig — the single key/value store that backs the entire
 * /analyticshub dashboard (see ANALYTICSHUB_SETUP.md).
 *
 * This project has no Postgres, so the spec's `analyticshub_config` table maps to
 * a Mongo collection: `key` is the primary key, `value` is an **AES-256-GCM
 * ciphertext string** (never plaintext — tokens, service-account keys, and the
 * scrypt password hash are all encrypted at rest by `lib/analyticshub/crypto.ts`).
 * The collection is created lazily on the first write; there is nothing to migrate.
 *
 * Well-known keys (all namespaced so a single collection stays legible):
 *   - `auth:password`            → encrypted scrypt hash of the owner password
 *   - `auth:ratelimit:<ip>`      → login-attempt window (JSON), durable across instances
 *   - `project`                  → { name, primaryColor, accentColor }
 *   - `source:google`            → OAuth tokens + selected GA4 property + GSC site
 *   - `source:meta`              → long-lived token + selected ad account
 *   - `source:gads`              → Google Ads credentials
 *   - `cache:<source>:<from>:<to>` → a cached successful fetch (6h TTL)
 */
export interface IAnalyticsHubConfig {
  key: string;
  /** AES-256-GCM ciphertext (base64 `iv.tag.ct`); decrypt via lib/analyticshub/crypto. */
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsHubConfigSchema = new Schema<IAnalyticsHubConfig>(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    value: { type: String, required: true },
  },
  { timestamps: true, collection: "analyticshub_config" },
);

// `key` already carries a unique index from the field option above.

export const AnalyticsHubConfig: Model<IAnalyticsHubConfig> =
  (models.AnalyticsHubConfig as Model<IAnalyticsHubConfig>) ||
  model<IAnalyticsHubConfig>("AnalyticsHubConfig", AnalyticsHubConfigSchema);

export default AnalyticsHubConfig;
