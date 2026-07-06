import type { ConfigStore } from "../config-store";

/** Per-request context threaded through every handler. */
export interface Ctx {
  req: Request;
  store: ConfigStore;
  url: URL;
  /** Whether the request carries a valid hub session cookie. */
  authed: boolean;
  /** Parsed JSON body for POST/PUT (empty object otherwise). */
  body: Record<string, unknown>;
}

export type Handler = (ctx: Ctx) => Promise<Response>;
