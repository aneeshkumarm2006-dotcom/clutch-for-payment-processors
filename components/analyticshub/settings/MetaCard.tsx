"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { ConnectionCard, HowTo, FormMessage } from "./ConnectionCard";
import type { HubStatus } from "../context";

/**
 * Meta Ads card — paste a long-lived token (ads_read), validate it (lists the
 * token's ad accounts), pick one, and save. Never stores a token that can't read.
 */
const label = "text-small font-medium text-foreground";
const input =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");

interface Account {
  accountId: string;
  name: string;
  currency?: string;
}

export function MetaCard({ status, onChange }: { status: HubStatus; onChange: () => void | Promise<void> }) {
  const state = status.sources.meta;
  const [token, setToken] = React.useState("");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [sel, setSel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function findAccounts() {
    setBusy(true);
    setError(null);
    try {
      const { accounts: list } = await apiClient.post<{ accounts: Account[] }>("/api/analyticshub/meta/accounts", { token });
      setAccounts(list);
      setSel(list[0]?.accountId ?? "");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const acct = accounts.find((a) => a.accountId === sel);
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/analyticshub/meta/select", {
        token,
        accountId: sel,
        accountLabel: acct?.name,
        currency: acct?.currency,
      });
      await onChange();
      setToken("");
      setAccounts([]);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiClient.post("/api/analyticshub/meta/disconnect");
      await onChange();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConnectionCard title="Meta Ads" description="Facebook & Instagram ad spend and performance." state={state}>
      {state === "connected" ? (
        <div className="space-y-3">
          <p className="text-small text-muted-foreground">An ad account is connected.</p>
          <FormMessage error={error} />
          <Button size="sm" variant="ghost" onClick={() => void disconnect()} disabled={busy}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={label}>Long-lived access token</label>
            <input className={input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAB…" />
          </div>
          {accounts.length > 0 && (
            <div>
              <label className={label}>Ad account</label>
              <select className={input} value={sel} onChange={(e) => setSel(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.name} ({a.accountId}){a.currency ? ` · ${a.currency}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <FormMessage error={error} />
          <div className="flex gap-2">
            {accounts.length === 0 ? (
              <Button size="sm" onClick={() => void findAccounts()} disabled={busy || token.length < 10}>
                {busy ? "Validating…" : "Find ad accounts"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => void save()} disabled={busy || !sel}>
                {busy ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
          <HowTo>
            <p>In Meta Business settings, create a system user with the ads_read permission and generate a long-lived token.</p>
            <p>Paste it above; the hub lists the accounts it can read so you can pick one.</p>
          </HowTo>
        </div>
      )}
    </ConnectionCard>
  );
}

export default MetaCard;
