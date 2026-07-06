"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import type { HubProject } from "./context";

/** The logged-out screen. Single owner, single password field. */
export function LoginForm({ project, onDone }: { project: HubProject; onDone: () => void | Promise<void> }) {
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/analyticshub/login", { password });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md" style={{ background: project.primaryColor }}>
            <LineChart className="size-4 text-white" />
          </span>
          <div>
            <div className="text-h4 tracking-tighter2 text-foreground">{project.name}</div>
            <div className="text-micro uppercase tracking-widest text-muted-foreground">Analytics Hub</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-small font-medium text-foreground">Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                className="w-full rounded-md border border-border bg-card px-3 py-2 pr-10 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-small text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || !password}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
