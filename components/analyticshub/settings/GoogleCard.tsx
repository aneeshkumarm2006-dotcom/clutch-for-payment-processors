"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { ConnectionCard, HowTo, FormMessage } from "./ConnectionCard";
import type { ConnState, HubStatus } from "../context";

/**
 * Google card (one card for GA4 + Search Console). Two paths:
 *  A — "Sign in with Google" via the shared OAuth app, then pick a GA4 property +
 *      GSC site (validated with 1-row probes server-side before saving).
 *  B — paste a service-account key JSON + property ID + site URL.
 * The provider's error is surfaced verbatim; nothing is stored until it validates.
 */
const label = "text-small font-medium text-foreground";
const input =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function msg(e: unknown): string {
  return e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.";
}

interface Options {
  properties: Array<{ propertyId: string; label: string }>;
  sites: string[];
  selected?: { propertyId?: string; siteUrl?: string };
  propertiesError?: string;
  sitesError?: string;
}

export function GoogleCard({ status, onChange }: { status: HubStatus; onChange: () => void | Promise<void> }) {
  const ga4 = status.sources.ga4;
  const gsc = status.sources.gsc;
  const connected = ga4 === "connected" || gsc === "connected";
  const reconnect = ga4 === "reconnect_needed" || gsc === "reconnect_needed";
  const overall: ConnState = reconnect ? "reconnect_needed" : connected ? "connected" : "not_connected";

  const [phase, setPhase] = React.useState<"idle" | "picking">("idle");
  const [opts, setOpts] = React.useState<Options | null>(null);
  const [selProp, setSelProp] = React.useState("");
  const [selSite, setSelSite] = React.useState("");
  const [showSA, setShowSA] = React.useState(!status.oauthAvailable);
  const [saJson, setSaJson] = React.useState("");
  const [saProp, setSaProp] = React.useState("");
  const [saSite, setSaSite] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openPicker = React.useCallback(async () => {
    setPhase("picking");
    setBusy(true);
    setError(null);
    try {
      const o = await apiClient.post<Options>("/api/analyticshub/google/options");
      setOpts(o);
      setSelProp(o.selected?.propertyId ?? "");
      setSelSite(o.selected?.siteUrl ?? "");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "connected") {
      window.history.replaceState({}, "", "/analyticshub/settings");
      void openPicker();
    } else if (g === "error") {
      setError(decodeURIComponent(params.get("reason") ?? "Google sign-in failed."));
      window.history.replaceState({}, "", "/analyticshub/settings");
    }
  }, [openPicker]);

  async function startOAuth() {
    setError(null);
    try {
      const { url } = await apiClient.post<{ url: string }>("/api/analyticshub/oauth/google/start");
      window.location.href = url;
    } catch (e) {
      setError(msg(e));
    }
  }

  async function saveSelection() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/analyticshub/google/select", {
        propertyId: selProp || undefined,
        propertyLabel: opts?.properties.find((p) => p.propertyId === selProp)?.label,
        siteUrl: selSite || undefined,
      });
      await onChange();
      setPhase("idle");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveServiceAccount() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/analyticshub/google/service-account", {
        serviceAccountKey: saJson,
        propertyId: saProp || undefined,
        siteUrl: saSite || undefined,
      });
      await onChange();
      setShowSA(false);
      setSaJson("");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiClient.post("/api/analyticshub/google/disconnect");
      await onChange();
      setPhase("idle");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConnectionCard
      title="Google — Analytics & Search Console"
      description="GA4 traffic + Search Console rankings, from one Google connection."
      state={overall}
    >
      {phase === "picking" ? (
        <div className="space-y-3">
          <div>
            <label className={label}>GA4 property</label>
            <select className={input} value={selProp} onChange={(e) => setSelProp(e.target.value)}>
              <option value="">— none —</option>
              {opts?.properties.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.label} ({p.propertyId})
                </option>
              ))}
            </select>
            {opts?.propertiesError && <FormMessage error={opts.propertiesError} />}
          </div>
          <div>
            <label className={label}>Search Console site</label>
            <select className={input} value={selSite} onChange={(e) => setSelSite(e.target.value)}>
              <option value="">— none —</option>
              {opts?.sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {opts?.sitesError && <FormMessage error={opts.sitesError} />}
          </div>
          <FormMessage error={error} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void saveSelection()} disabled={busy || (!selProp && !selSite)}>
              {busy ? "Validating…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPhase("idle")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : connected ? (
        <div className="space-y-3">
          <ul className="space-y-1 text-small text-muted-foreground">
            <li>GA4: {ga4 === "connected" ? "connected" : ga4 === "reconnect_needed" ? "reconnect needed" : "not selected"}</li>
            <li>Search Console: {gsc === "connected" ? "connected" : gsc === "reconnect_needed" ? "reconnect needed" : "not selected"}</li>
          </ul>
          <FormMessage error={error} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void openPicker()} disabled={busy}>
              Change property / site
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void disconnect()} disabled={busy}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {status.oauthAvailable && (
            <Button variant="accent" size="sm" onClick={() => void startOAuth()}>
              Sign in with Google
            </Button>
          )}
          {status.oauthAvailable && (
            <button type="button" className="block text-small text-accent hover:underline" onClick={() => setShowSA((s) => !s)}>
              {showSA ? "Hide service-account option" : "Use a service account instead"}
            </button>
          )}
          {!status.oauthAvailable && (
            <p className="text-small text-muted-foreground">
              Google sign-in isn&apos;t configured (no OAuth env vars). Paste a service-account key below.
            </p>
          )}
          {showSA && (
            <div className="space-y-2.5 rounded-md border border-border p-3">
              <div>
                <label className={label}>Service-account key JSON</label>
                <textarea
                  className={`${input} font-mono text-small`}
                  rows={4}
                  value={saJson}
                  onChange={(e) => setSaJson(e.target.value)}
                  placeholder='{"type":"service_account", ...}'
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>GA4 property ID</label>
                  <input className={input} value={saProp} onChange={(e) => setSaProp(e.target.value)} placeholder="123456789" />
                </div>
                <div>
                  <label className={label}>Search Console site</label>
                  <input className={input} value={saSite} onChange={(e) => setSaSite(e.target.value)} placeholder="https://example.com/" />
                </div>
              </div>
              <Button size="sm" onClick={() => void saveServiceAccount()} disabled={busy || !saJson || (!saProp && !saSite)}>
                {busy ? "Validating…" : "Validate & save"}
              </Button>
              <HowTo>
                <p>Create a service account in Google Cloud, enable the GA4 Data + Admin and Search Console APIs, and download its JSON key.</p>
                <p>Add the service-account email as a Viewer on the GA4 property and as a user on the Search Console property.</p>
              </HowTo>
            </div>
          )}
          <FormMessage error={error} />
        </div>
      )}
    </ConnectionCard>
  );
}

export default GoogleCard;
