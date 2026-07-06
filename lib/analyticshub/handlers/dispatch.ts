import type { ConfigStore } from "../config-store";
import { verifySession, HUB_COOKIE } from "../session";
import { readCookie, errorResponse } from "./http";
import type { Ctx } from "./context";
import { SOURCE_KEYS, type SourceKey } from "../types";
import {
  statusHandler,
  setupHandler,
  loginHandler,
  logoutHandler,
  projectHandler,
  passwordHandler,
} from "./auth";
import { dataHandler } from "./data";
import {
  googleStartHandler,
  googleCallbackHandler,
  googleOptionsHandler,
  googleSelectHandler,
  googleServiceAccountHandler,
  googleDisconnectHandler,
  metaAccountsHandler,
  metaSelectHandler,
  metaDisconnectHandler,
  gadsSaveHandler,
  gadsDisconnectHandler,
} from "./connect";

/**
 * lib/analyticshub/handlers/dispatch.ts — the ONE catch-all router for the whole
 * hub API (a hard constraint: a single serverless function).
 *
 * The sub-path is parsed from `req.url`'s pathname — NOT from the `[...path]`
 * catch-all param, which deployed non-Next Vercel functions don't reliably
 * surface (that exact bug ships a 401-everything API). Public routes: status,
 * setup, login, logout, and the Google OAuth callback (it arrives as a top-level
 * browser navigation carrying the session cookie). Everything else requires auth.
 */

const PREFIX = /^\/api\/analyticshub\/?/;

export async function handle(req: Request, store: ConfigStore): Promise<Response> {
  const url = new URL(req.url);
  const subpath = url.pathname.replace(PREFIX, "").replace(/\/+$/, "");
  const method = req.method.toUpperCase();
  const authed = verifySession(readCookie(req, HUB_COOKIE));

  let body: Record<string, unknown> = {};
  if (method === "POST" || method === "PUT") {
    try {
      const text = await req.text();
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return errorResponse("Invalid JSON body.", 400);
    }
  }
  const ctx: Ctx = { req, store, url, authed, body };
  const route = `${method} ${subpath}`;

  // ---- Public routes ----
  switch (route) {
    case "GET status":
      return statusHandler(ctx);
    case "POST setup":
      return setupHandler(ctx);
    case "POST login":
      return loginHandler(ctx);
    case "POST logout":
      return logoutHandler();
    // OAuth callback is a browser redirect from Google (carries the Lax cookie).
    case "GET oauth/google/callback":
      return authed ? googleCallbackHandler(ctx) : errorResponse("Sign in to the hub first.", 401);
  }

  // ---- Everything below requires auth ----
  if (!authed) return errorResponse("Unauthorized", 401);

  switch (route) {
    case "POST project":
      return projectHandler(ctx);
    case "POST password":
      return passwordHandler(ctx);
    case "GET data/all":
      return dataHandler(ctx, "all");

    // Google connect
    case "POST oauth/google/start":
      return googleStartHandler(ctx);
    case "POST google/options":
      return googleOptionsHandler(ctx);
    case "POST google/select":
      return googleSelectHandler(ctx);
    case "POST google/service-account":
      return googleServiceAccountHandler(ctx);
    case "POST google/disconnect":
      return googleDisconnectHandler(ctx);

    // Meta connect
    case "POST meta/accounts":
      return metaAccountsHandler(ctx);
    case "POST meta/select":
      return metaSelectHandler(ctx);
    case "POST meta/disconnect":
      return metaDisconnectHandler(ctx);

    // Google Ads connect
    case "POST gads/save":
      return gadsSaveHandler(ctx);
    case "POST gads/disconnect":
      return gadsDisconnectHandler(ctx);
  }

  // Data for a single source: `GET data/<source>` (with `users` alias → leads).
  const dataMatch = /^data\/([a-z0-9]+)$/.exec(subpath);
  if (method === "GET" && dataMatch) {
    const s = dataMatch[1]!;
    const key = s === "users" ? "leads" : s;
    if ((SOURCE_KEYS as readonly string[]).includes(key)) return dataHandler(ctx, key as SourceKey);
  }

  return errorResponse("Not found.", 404);
}
