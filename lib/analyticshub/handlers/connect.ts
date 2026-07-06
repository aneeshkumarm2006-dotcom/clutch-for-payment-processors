import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Ctx } from "./context";
import { jsonResponse, errorResponse, redirectResponse, requestOrigin } from "./http";
import { KEYS, getJSON, setJSON } from "../config-store";
import { resolvePreset } from "../dates";
import { bustSource } from "../cache";
import {
  buildConsentUrl,
  exchangeCode,
  getGoogleAccessToken,
  googleOAuthConfigured,
  listGa4Properties,
  listGscSites,
  readGoogleConfig,
  type GoogleConfig,
} from "../sources/google-oauth";
import { listMetaAdAccounts, type MetaConfig } from "../sources/meta";
import { validateGads, type GadsConfig } from "../sources/gads";

/**
 * lib/analyticshub/handlers/connect.ts — the connect/disconnect endpoints behind
 * every Settings card. The invariant: NEVER store a credential that fails a live
 * validation call; on failure we return the provider's error verbatim.
 */

const CALLBACK_PATH = "/api/analyticshub/oauth/google/callback";
const STATE_KEY = "auth:oauthstate";

function callbackUrl(req: Request): string {
  return `${requestOrigin(req)}${CALLBACK_PATH}`;
}

// ---------------------------------------------------------------------------
// 1-row validation probes (never save a selection that can't be read)
// ---------------------------------------------------------------------------
async function probeGa4(token: string, propertyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "sessions" }], limit: "1" }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json()) as { error?: { message?: string } };
    return { ok: false, error: body.error?.message || `GA4 property check failed (${res.status}).` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function probeGsc(token: string, siteUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const range = resolvePreset("7d");
  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ startDate: range.from, endDate: range.to, dimensions: [], rowLimit: 1 }),
      },
    );
    if (res.ok) return { ok: true };
    const body = (await res.json()) as { error?: { message?: string } };
    return { ok: false, error: body.error?.message || `Search Console site check failed (${res.status}).` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Google — OAuth
// ---------------------------------------------------------------------------
export async function googleStartHandler(ctx: Ctx): Promise<Response> {
  if (!googleOAuthConfigured()) {
    return errorResponse(
      "Google sign-in isn't configured (GOOGLE_OAUTH_CLIENT_ID/SECRET are unset). Use the service-account option instead.",
      400,
    );
  }
  const state = randomBytes(16).toString("hex");
  await setJSON(ctx.store, STATE_KEY, { state, exp: Date.now() + 10 * 60 * 1000 });
  return jsonResponse({ url: buildConsentUrl(callbackUrl(ctx.req), state) });
}

export async function googleCallbackHandler(ctx: Ctx): Promise<Response> {
  const settings = "/analyticshub/settings";
  const err = ctx.url.searchParams.get("error");
  if (err) return redirectResponse(`${settings}?google=error&reason=${encodeURIComponent(err)}`);

  const code = ctx.url.searchParams.get("code");
  const state = ctx.url.searchParams.get("state");
  const saved = await getJSON<{ state: string; exp: number }>(ctx.store, STATE_KEY);
  if (!code || !state || !saved || saved.state !== state || Date.now() > saved.exp) {
    return redirectResponse(`${settings}?google=error&reason=${encodeURIComponent("Invalid or expired sign-in state.")}`);
  }
  await ctx.store.delete(STATE_KEY);

  const tokens = await exchangeCode(code, callbackUrl(ctx.req));
  if (!tokens.ok) return redirectResponse(`${settings}?google=error&reason=${encodeURIComponent(tokens.error)}`);
  if (!tokens.refreshToken) {
    return redirectResponse(
      `${settings}?google=error&reason=${encodeURIComponent("Google did not return a refresh token. Remove the app's access at myaccount.google.com/permissions and try again.")}`,
    );
  }

  const existing = (await readGoogleConfig(ctx.store)) ?? ({} as Partial<GoogleConfig>);
  const config: GoogleConfig = {
    ...existing,
    mode: "oauth",
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken,
    accessTokenExpiry: Date.now() + tokens.expiresIn * 1000,
    status: "connected",
  };
  await setJSON(ctx.store, KEYS.google, config);
  return redirectResponse(`${settings}?google=connected`);
}

export async function googleOptionsHandler(ctx: Ctx): Promise<Response> {
  const config = await readGoogleConfig(ctx.store);
  if (!config) return errorResponse("Connect Google first.", 400);
  const tok = await getGoogleAccessToken(ctx.store, config);
  if (!tok.ok) return errorResponse(tok.error, tok.reconnect ? 401 : 502);
  const [props, sites] = await Promise.all([listGa4Properties(tok.token), listGscSites(tok.token)]);
  return jsonResponse({
    properties: props.ok ? props.properties : [],
    sites: sites.ok ? sites.sites : [],
    propertiesError: props.ok ? undefined : props.error,
    sitesError: sites.ok ? undefined : sites.error,
    selected: { propertyId: config.propertyId, siteUrl: config.siteUrl },
  });
}

const selectSchema = z.object({
  propertyId: z.string().trim().optional(),
  propertyLabel: z.string().trim().optional(),
  siteUrl: z.string().trim().optional(),
});

export async function googleSelectHandler(ctx: Ctx): Promise<Response> {
  const parsed = selectSchema.safeParse(ctx.body);
  if (!parsed.success) return errorResponse("Please choose a property or site.", 400);
  const { propertyId, siteUrl, propertyLabel } = parsed.data;
  if (!propertyId && !siteUrl) return errorResponse("Choose at least a GA4 property or a Search Console site.", 400);

  const config = await readGoogleConfig(ctx.store);
  if (!config) return errorResponse("Connect Google first.", 400);
  const tok = await getGoogleAccessToken(ctx.store, config);
  if (!tok.ok) return errorResponse(tok.error, tok.reconnect ? 401 : 502);

  if (propertyId) {
    const probe = await probeGa4(tok.token, propertyId);
    if (!probe.ok) return errorResponse(probe.error, 400);
  }
  if (siteUrl) {
    const probe = await probeGsc(tok.token, siteUrl);
    if (!probe.ok) return errorResponse(probe.error, 400);
  }

  await setJSON(ctx.store, KEYS.google, { ...config, propertyId, propertyLabel, siteUrl, status: "connected" });
  await Promise.all([bustSource(ctx.store, "ga4"), bustSource(ctx.store, "gsc")]);
  return jsonResponse({ ok: true });
}

const saSchema = z.object({
  serviceAccountKey: z.string().min(10, "Paste the service-account key JSON."),
  propertyId: z.string().trim().optional(),
  siteUrl: z.string().trim().optional(),
});

export async function googleServiceAccountHandler(ctx: Ctx): Promise<Response> {
  const parsed = saSchema.safeParse(ctx.body);
  if (!parsed.success) return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  const { serviceAccountKey, propertyId, siteUrl } = parsed.data;
  if (!propertyId && !siteUrl) return errorResponse("Enter a GA4 property ID and/or a Search Console site URL.", 400);

  // JSON sanity check before we try to sign with it.
  try {
    const k = JSON.parse(serviceAccountKey) as { client_email?: string; private_key?: string };
    if (!k.client_email || !k.private_key) throw new Error("missing fields");
  } catch {
    return errorResponse("That doesn't look like a service-account key JSON (needs client_email and private_key).", 400, {
      serviceAccountKey: ["Invalid service-account key JSON."],
    });
  }

  const config: GoogleConfig = { mode: "service_account", serviceAccountKey, propertyId, siteUrl, status: "connected" };
  const tok = await getGoogleAccessToken(ctx.store, config);
  if (!tok.ok) return errorResponse(tok.error, 400);

  if (propertyId) {
    const probe = await probeGa4(tok.token, propertyId);
    if (!probe.ok) return errorResponse(probe.error, 400);
  }
  if (siteUrl) {
    const probe = await probeGsc(tok.token, siteUrl);
    if (!probe.ok) return errorResponse(probe.error, 400);
  }

  await setJSON(ctx.store, KEYS.google, config);
  await Promise.all([bustSource(ctx.store, "ga4"), bustSource(ctx.store, "gsc")]);
  return jsonResponse({ ok: true });
}

export async function googleDisconnectHandler(ctx: Ctx): Promise<Response> {
  await ctx.store.delete(KEYS.google);
  await Promise.all([bustSource(ctx.store, "ga4"), bustSource(ctx.store, "gsc")]);
  return jsonResponse({ ok: true });
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------
const metaAccountsSchema = z.object({ token: z.string().min(10, "Paste a Meta access token.") });

export async function metaAccountsHandler(ctx: Ctx): Promise<Response> {
  const parsed = metaAccountsSchema.safeParse(ctx.body);
  if (!parsed.success) return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  const res = await listMetaAdAccounts(parsed.data.token);
  if (!res.ok) return errorResponse(res.error, 400);
  if (res.accounts.length === 0) return errorResponse("This token has no ad accounts (needs ads_read).", 400);
  return jsonResponse({ accounts: res.accounts });
}

const metaSelectSchema = z.object({
  token: z.string().min(10),
  accountId: z.string().min(1),
  accountLabel: z.string().optional(),
  currency: z.string().optional(),
});

export async function metaSelectHandler(ctx: Ctx): Promise<Response> {
  const parsed = metaSelectSchema.safeParse(ctx.body);
  if (!parsed.success) return errorResponse("Please pick an ad account.", 400);
  // Re-validate the token + that the account belongs to it (never trust the client).
  const res = await listMetaAdAccounts(parsed.data.token);
  if (!res.ok) return errorResponse(res.error, 400);
  const match = res.accounts.find((a) => a.accountId === parsed.data.accountId);
  if (!match) return errorResponse("That ad account isn't accessible with this token.", 400);

  const config: MetaConfig & { currency?: string } = {
    token: parsed.data.token,
    accountId: match.accountId,
    accountLabel: match.name,
    currency: match.currency ?? parsed.data.currency,
    status: "connected",
  };
  await setJSON(ctx.store, KEYS.meta, config);
  await bustSource(ctx.store, "meta");
  return jsonResponse({ ok: true, account: match });
}

export async function metaDisconnectHandler(ctx: Ctx): Promise<Response> {
  await ctx.store.delete(KEYS.meta);
  await bustSource(ctx.store, "meta");
  return jsonResponse({ ok: true });
}

// ---------------------------------------------------------------------------
// Google Ads
// ---------------------------------------------------------------------------
const gadsSchema = z.object({
  developerToken: z.string().min(1, "Developer token is required."),
  clientId: z.string().min(1, "OAuth client ID is required."),
  clientSecret: z.string().min(1, "OAuth client secret is required."),
  refreshToken: z.string().min(1, "Refresh token is required."),
  customerId: z.string().min(1, "Customer ID is required."),
  loginCustomerId: z.string().optional(),
});

export async function gadsSaveHandler(ctx: Ctx): Promise<Response> {
  const parsed = gadsSchema.safeParse(ctx.body);
  if (!parsed.success) return errorResponse("Please fix the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
  const config: GadsConfig = { ...parsed.data, status: "connected" };
  const check = await validateGads(config);
  if (!check.ok) return errorResponse(check.error, 400);
  await setJSON(ctx.store, KEYS.gads, config);
  await bustSource(ctx.store, "gads");
  return jsonResponse({ ok: true });
}

export async function gadsDisconnectHandler(ctx: Ctx): Promise<Response> {
  await ctx.store.delete(KEYS.gads);
  await bustSource(ctx.store, "gads");
  return jsonResponse({ ok: true });
}
