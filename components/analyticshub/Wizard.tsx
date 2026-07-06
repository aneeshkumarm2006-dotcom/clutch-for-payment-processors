"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Loader2, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import type { HubStatus } from "./context";
import { ProjectCard } from "./settings/ProjectCard";
import { GoogleCard } from "./settings/GoogleCard";
import { MetaCard } from "./settings/MetaCard";
import { GoogleAdsCard } from "./settings/GoogleAdsCard";

/**
 * components/analyticshub/Wizard.tsx — first-run setup: create password → confirm
 * project identity → connect sources (all skippable) → Overview. The setup POST
 * sets the session cookie, so the connection cards work inside the wizard. We keep
 * a LOCAL status copy so refetching (after a connect) doesn't flip the app gate
 * out of the wizard before the owner clicks Finish.
 */
const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Wizard({ initialStatus, onFinish }: { initialStatus: HubStatus; onFinish: () => void | Promise<void> }) {
  const [status, setStatus] = React.useState(initialStatus);
  const [step, setStep] = React.useState(1);

  const refetch = React.useCallback(async () => {
    try {
      const res = await fetch("/api/analyticshub/status", { credentials: "same-origin" });
      const j = (await res.json()) as HubStatus;
      setStatus(j);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-10 dark:bg-background">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md" style={{ background: status.project.primaryColor }}>
            <LineChart className="size-4 text-white" />
          </span>
          <div>
            <div className="text-h4 tracking-tighter2 text-foreground">{status.project.name} · Analytics Hub</div>
            <div className="text-micro uppercase tracking-widest text-muted-foreground">First-run setup · step {step} of 3</div>
          </div>
        </div>

        {step === 1 && <PasswordStep onNext={async () => { await refetch(); setStep(2); }} />}

        {step === 2 && (
          <div className="space-y-4">
            <ProjectCard status={status} onChange={refetch} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button onClick={() => setStep(3)}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-body text-muted-foreground">
              Connect your sources now, or skip and do it later in Settings. Leads work out of the box.
            </p>
            <GoogleCard status={status} onChange={refetch} />
            <MetaCard status={status} onChange={refetch} />
            <GoogleAdsCard status={status} onChange={refetch} />
            <div className="flex justify-end">
              <Button onClick={() => void onFinish()}>
                Go to dashboard <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordStep({ onNext }: { onNext: () => void | Promise<void> }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await apiClient.post("/api/analyticshub/setup", { password, confirm });
      await onNext();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-h3 text-foreground">Create your password</h2>
        <p className="mt-1 text-small text-muted-foreground">This claims the dashboard. You&apos;ll use it to sign in from now on.</p>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-small text-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>There is no password-reset flow. Store this somewhere safe.</span>
      </div>
      <div>
        <label className="text-small font-medium text-foreground">Password</label>
        <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <div>
        <label className="text-small font-medium text-foreground">Confirm password</label>
        <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !password || !confirm}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Create & continue"}
      </Button>
    </form>
  );
}

export default Wizard;
