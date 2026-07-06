"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { ConnectionCard, FormMessage } from "./ConnectionCard";

const label = "text-small font-medium text-foreground";
const input =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Change the owner password (verifies the current one server-side). */
export function PasswordCard() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setError(null);
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/api/analyticshub/password", { current, next, confirm });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConnectionCard title="Change password" description="There is no reset flow — keep this safe.">
      <div className="space-y-3">
        <div>
          <label className={label}>Current password</label>
          <input type="password" className={input} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>New password</label>
            <input type="password" className={input} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className={label}>Confirm new</label>
            <input type="password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <FormMessage error={error} />
        <Button size="sm" onClick={() => void save()} disabled={busy || !current || next.length < 8}>
          {busy ? "Saving…" : "Change password"}
        </Button>
      </div>
    </ConnectionCard>
  );
}

export default PasswordCard;
