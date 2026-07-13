import type { IBlock, IFaqItem, ISeo, IStructuredData } from "@/models";

/**
 * Structured-data engine — types.
 *
 * PURITY CONTRACT: nothing under `lib/engine/` may import `mongoose`,
 * `next/headers`, the DB, or any model *value*. Type-only imports are fine (they
 * erase at build). This is load-bearing, not stylistic: the admin's live JSON-LD
 * preview imports the engine **directly into the browser** so that what an editor
 * sees is produced by the exact same code path that renders the page. The moment
 * something server-only leaks in here, that preview breaks — and it breaks by
 * silently diverging from production, which is the worst way for it to break.
 */

/** A JSON-LD node. Deliberately loose — schema.org is open-world. */
export type Jsonld = Record<string, unknown>;

/** Breadcrumb trail entry. */
export interface Crumb {
  name: string;
  path: string;
}

/**
 * The normalized shape the engine consumes. Public pages never hand it a Mongo
 * document — `lib/serialize.ts` adapts each content type into one of these first,
 * because the three entity routes genuinely disagree on what they hold (a
 * Processor DTO, a raw lean Category doc, a BlogPost DTO). `data` carries the
 * site's own fields; only `config/content-engine.ts` ever reads inside it.
 */
export interface EngineEntity<T = Record<string, unknown>> {
  contentType: string;
  /** Canonical site-relative path, e.g. `/processor/stripe`. */
  path: string;
  seo?: Partial<ISeo> | null;
  faqs?: IFaqItem[];
  blocks?: IBlock[];
  structuredData?: IStructuredData | null;
  /** The site-specific payload. Engine code treats this as opaque. */
  data: T;
}

/** Site identity, read from SiteSettings at request time — never hardcoded. */
export interface EngineContext {
  siteName: string;
  siteUrl: string;
  logo?: string;
  sameAs?: string[];
  email?: string;
}

/**
 * One schema.org node a content type can emit.
 *
 * `required` lists the JSON-LD keys the node is invalid without. A node missing
 * any of them is DROPPED with a warning rather than emitted half-built — Google
 * treats a malformed node worse than an absent one.
 *
 * `overridable` whitelists which keys an admin may override from the Schema panel.
 * Without this an override could target a key the builder never expected and 500
 * the page at render; unknown keys are dropped with a warning instead.
 */
export interface SchemaRule<T> {
  type: string;
  label?: string;
  required?: readonly string[];
  overridable?: readonly string[];
  build: (entity: EngineEntity<T>, ctx: EngineContext) => Jsonld | null;
}

export interface ContentTypeDef<T> {
  label: string;
  /** Which block types this content type may use. Omit to allow all enabled blocks. */
  blocks?: readonly string[];
  schema: readonly SchemaRule<T>[];
}

/**
 * Identity helper — preserves `T` inside a definition while the registry itself
 * stays heterogeneous. Without it, every `build(entity)` in the config would see
 * `entity.data` as `unknown`.
 */
export function defineContentType<T>(def: ContentTypeDef<T>): ContentTypeDef<T> {
  return def;
}

export interface EngineWarning {
  /** The @type the warning concerns, or "custom" / "block". */
  scope: string;
  message: string;
  severity: "warn" | "error";
}

export interface EngineResult {
  nodes: Jsonld[];
  warnings: EngineWarning[];
}
