"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { ConnectionCard, HowTo, FormMessage } from "./ConnectionCard";
import type { HubStatus } from "../context";

/**
 * Google Ads card (advanced, optional — the most involved connector). Six fields;
 * validated with a 1-row searchStream probe before saving. Must never block
 * anything else, so it lives at the bottom of Settings.
 */
const label = "text-small font-medium text-foreground";
const input =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");

type Fields = {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string;
};

const EMPTY: Fields = {
  developerToken: "",
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  customerId: "",
  loginCustomerId: "",
};

export function GoogleAdsCard({ status, onChange }: { status: HubStatus; onChange: () => void | Promise<void> }) {
  const state = status.sources.gads;
  const [f, setF] = React.useState<Fields>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/analyticshub/gads/save", {
        developerToken: f.developerToken,
        clientId: f.clientId,
        clientSecret: f.clientSecret,
        refreshToken: f.refreshToken,
        customerId: f.customerId,
        loginCustomerId: f.loginCustomerId || undefined,
      });
      await onChange();
      setF(EMPTY);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiClient.post("/api/analyticshub/gads/disconnect");
      await onChange();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = f.developerToken && f.clientId && f.clientSecret && f.refreshToken && f.customerId;

  return (
    <ConnectionCard title="Google Ads" description="Advanced — cost, clicks, and conversions. Optional." state={state}>
      {state === "connected" ? (
        <div className="space-y-3">
          <p className="text-small text-muted-foreground">A Google Ads customer is connected.</p>
          <FormMessage error={error} />
          <Button size="sm" variant="ghost" onClick={() => void disconnect()} disabled={busy}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <label className={label}>Developer token</label>
            <input className={input} value={f.developerToken} onChange={set("developerToken")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>OAuth client ID</label>
              <input className={input} value={f.clientId} onChange={set("clientId")} />
            </div>
            <div>
              <label className={label}>OAuth client secret</label>
              <input className={input} value={f.clientSecret} onChange={set("clientSecret")} />
            </div>
          </div>
          <div>
            <label className={label}>Refresh token</label>
            <input className={input} value={f.refreshToken} onChange={set("refreshToken")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Customer ID</label>
              <input className={input} value={f.customerId} onChange={set("customerId")} placeholder="123-456-7890" />
            </div>
            <div>
              <label className={label}>Login customer ID (MCC, optional)</label>
              <input className={input} value={f.loginCustomerId} onChange={set("loginCustomerId")} />
            </div>
          </div>
          <FormMessage error={error} />
          <Button size="sm" onClick={() => void save()} disabled={busy || !ready}>
            {busy ? "Validating…" : "Validate & save"}
          </Button>
          <HowTo>
            <p>Apply for a Google Ads API developer token, create an OAuth client, and generate a refresh token with the AdWords scope.</p>
            <p>Customer ID is the 10-digit account number; add an MCC login-customer-id only if you access it through a manager account.</p>
          </HowTo>
        </div>
      )}
    </ConnectionCard>
  );
}

export default GoogleAdsCard;
