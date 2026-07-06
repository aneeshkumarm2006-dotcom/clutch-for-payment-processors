import { createSign } from "node:crypto";
import type { ConfigStore } from "../config-store";
import { KEYS, getJSON, setJSON } from "../config-store";

/**
 * lib/analyticshub/sources/google-oauth.ts — Google token layer for GA4 + GSC,
 * over raw `fetch` (no googleapis SDK, per the hard constraint).
 *
 * Two connection modes share one stored config:
 *   - **oauth**: "Sign in with Google" via the shared OAuth app
 *     (GOOGLE_OAUTH_CLIENT_ID/SECRET). We keep the refresh token and mint access
 *     tokens on demand, caching them until ~1 min before expiry.
 *   - **service_account**: a pasted SA key JSON; we sign a JWT with `node:crypto`
 *     and exchange it via the JWT-bearer grant.
 *
 * A revoked grant (`invalid_grant`) flips the stored status to `reconnect_needed`
 * so /status, the dashboard, and Settings all show "Reconnect needed".
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export interface GoogleConfig {
  mode: "oauth" | "service_account";
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiry?: number; // epoch ms
  serviceAccountKey?: string; // raw JSON string
  propertyId?: string; // GA4 numeric property id
  propertyLabel?: string;
  siteUrl?: string; // GSC property, e.g. "https://paycompare.com/"
  status?: "connected" | "reconnect_needed";
}

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function buildConsentUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // force a refresh token even on re-grant
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reconnect: boolean; error: string };

interface TokenBody {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Exchange an OAuth authorization code for tokens (callback step). */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ ok: true; refreshToken?: string; accessToken: string; expiresIn: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const body = (await res.json()) as TokenBody;
    if (!res.ok || !body.access_token) {
      return { ok: false, error: body.error_description || body.error || `Token exchange failed (${res.status}).` };
    }
    return {
      ok: true,
      refreshToken: body.refresh_token,
      accessToken: body.access_token,
      expiresIn: body.expires_in ?? 3600,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mint an access token from a service-account key via the JWT-bearer grant. */
async function serviceAccountToken(saJson: string): Promise<TokenResult> {
  let key: { client_email?: string; private_key?: string };
  try {
    key = JSON.parse(saJson);
  } catch {
    return { ok: false, reconnect: true, error: "Service-account key is not valid JSON." };
  }
  if (!key.client_email || !key.private_key) {
    return { ok: false, reconnect: true, error: "Service-account key is missing client_email or private_key." };
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: GOOGLE_SCOPES.join(" "),
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  let assertion: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    assertion = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;
  } catch (err) {
    return { ok: false, reconnect: true, error: `Could not sign with the service-account key: ${(err as Error).message}` };
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const body = (await res.json()) as TokenBody;
    if (!res.ok || !body.access_token) {
      return {
        ok: false,
        reconnect: true,
        error: body.error_description || body.error || `Service-account token request failed (${res.status}).`,
      };
    }
    return { ok: true, token: body.access_token };
  } catch (err) {
    return { ok: false, reconnect: false, error: (err as Error).message };
  }
}

async function refreshOAuthToken(refreshToken: string): Promise<TokenResult & { expiresIn?: number }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      }),
    });
    const body = (await res.json()) as TokenBody;
    if (!res.ok || !body.access_token) {
      // A revoked/expired refresh token comes back as invalid_grant.
      const revoked = body.error === "invalid_grant";
      return {
        ok: false,
        reconnect: revoked,
        error: body.error_description || body.error || `Token refresh failed (${res.status}).`,
      };
    }
    return { ok: true, token: body.access_token, expiresIn: body.expires_in ?? 3600 };
  } catch (err) {
    return { ok: false, reconnect: false, error: (err as Error).message };
  }
}

/** Mark the stored Google config as needing reconnection (persisted). */
async function markReconnect(store: ConfigStore, config: GoogleConfig): Promise<void> {
  await setJSON(store, KEYS.google, { ...config, status: "reconnect_needed" });
}

/**
 * Get a usable Google access token for the stored connection, refreshing +
 * caching as needed. Persists the fresh access token (oauth) and flips to
 * reconnect on a revoked grant.
 */
export async function getGoogleAccessToken(
  store: ConfigStore,
  config: GoogleConfig,
  now: number = Date.now(),
): Promise<TokenResult> {
  if (config.mode === "service_account") {
    if (!config.serviceAccountKey) return { ok: false, reconnect: true, error: "No service-account key stored." };
    const res = await serviceAccountToken(config.serviceAccountKey);
    if (!res.ok && res.reconnect) await markReconnect(store, config);
    return res;
  }

  // oauth
  if (config.accessToken && config.accessTokenExpiry && now < config.accessTokenExpiry - 60_000) {
    return { ok: true, token: config.accessToken };
  }
  if (!config.refreshToken) return { ok: false, reconnect: true, error: "No Google refresh token stored." };
  const res = await refreshOAuthToken(config.refreshToken);
  if (!res.ok) {
    if (res.reconnect) await markReconnect(store, config);
    return res;
  }
  await setJSON(store, KEYS.google, {
    ...config,
    accessToken: res.token,
    accessTokenExpiry: now + (res.expiresIn ?? 3600) * 1000,
    status: "connected",
  });
  return { ok: true, token: res.token };
}

// ---------------------------------------------------------------------------
// Discovery: GA4 properties (Admin API) + GSC sites
// ---------------------------------------------------------------------------

export interface Ga4Property {
  propertyId: string; // numeric
  label: string; // "Account › Property"
}

export async function listGa4Properties(token: string): Promise<{ ok: true; properties: Ga4Property[] } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      accountSummaries?: Array<{
        displayName?: string;
        propertySummaries?: Array<{ property?: string; displayName?: string }>;
      }>;
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: body.error?.message || `GA4 property lookup failed (${res.status}).` };
    const properties: Ga4Property[] = [];
    for (const acc of body.accountSummaries ?? []) {
      for (const p of acc.propertySummaries ?? []) {
        const id = (p.property ?? "").replace("properties/", "");
        if (id) properties.push({ propertyId: id, label: `${acc.displayName ?? "Account"} › ${p.displayName ?? id}` });
      }
    }
    return { ok: true, properties };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function listGscSites(token: string): Promise<{ ok: true; sites: string[] } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: body.error?.message || `Search Console site lookup failed (${res.status}).` };
    const sites = (body.siteEntry ?? [])
      .filter((s) => s.permissionLevel !== "siteUnverifiedUser" && s.siteUrl)
      .map((s) => s.siteUrl!);
    return { ok: true, sites };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Read the stored Google config (or null). */
export async function readGoogleConfig(store: ConfigStore): Promise<GoogleConfig | null> {
  return getJSON<GoogleConfig>(store, KEYS.google);
}
