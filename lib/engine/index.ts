/**
 * Structured-data engine.
 *
 * Pure by contract (see `./types.ts`) — safe to import from a client component,
 * which is what makes the admin's live JSON-LD preview identical to what the page
 * actually renders instead of merely similar to it.
 */
export { buildStructuredData } from "./build";
export {
  defineContentType,
  type Crumb,
  type EngineContext,
  type EngineEntity,
  type EngineResult,
  type EngineWarning,
  type Jsonld,
  type SchemaRule,
} from "./types";
