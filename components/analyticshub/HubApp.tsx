"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { HubProvider, type HubStatus } from "./context";
import { HubShell } from "./HubShell";
import { LoginForm } from "./LoginForm";
import { Wizard } from "./Wizard";

/**
 * components/analyticshub/HubApp.tsx — the client gate. Reads /status once and
 * routes to: a config-error screen (secret/DB problems, each naming its fix), the
 * first-run Wizard, the Login screen, or the authenticated Shell (wrapping the
 * page `children`). This is why the API is the real security boundary — an
 * unauthenticated visitor only ever sees the login chrome; no data ships.
 */
export function HubApp({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<HubStatus | null>(null);
  const [phase, setPhase] = React.useState<"loading" | "ready" | "neterror">("loading");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/analyticshub/status", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json()) as HubStatus;
      setStatus(j);
      setPhase("ready");
    } catch {
      setPhase("neterror");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (phase === "loading") return <FullLoading />;
  if (phase === "neterror") {
    return (
      <ConfigScreen
        title="Can't reach the hub API"
        messages={["The /api/analyticshub endpoint didn't respond. Confirm the app is deployed and running, then reload."]}
      />
    );
  }
  if (!status) return <FullLoading />;

  if (!status.ok) {
    const messages = status.errors.length ? status.errors : ["The hub isn't fully configured yet."];
    return <ConfigScreen title="Configuration needed" messages={messages} status={status} />;
  }
  if (!status.setupComplete) return <Wizard initialStatus={status} onFinish={load} />;
  if (!status.authed) return <LoginForm project={status.project} onDone={load} />;

  return (
    <HubProvider status={status} reloadStatus={load}>
      <HubShell>{children}</HubShell>
    </HubProvider>
  );
}

function FullLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ConfigScreen({ title, messages, status }: { title: string; messages: string[]; status?: HubStatus }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-background">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-5 text-warning" />
          <h1 className="text-h3 text-foreground">{title}</h1>
        </div>
        <ul className="space-y-2">
          {messages.map((m, i) => (
            <li key={i} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-small text-foreground">
              {m}
            </li>
          ))}
        </ul>
        {status?.secret && !status.secret.ok && status.secret.decodedLength != null && (
          <p className="mt-3 text-micro text-muted-foreground">
            (ANALYTICSHUB_SECRET_KEY decoded to {status.secret.decodedLength} bytes; it must be 32.)
          </p>
        )}
        <p className="mt-4 text-micro text-muted-foreground">
          Environment changes only take effect on new deployments — redeploy after editing env vars, then reload.
        </p>
      </div>
    </div>
  );
}

export default HubApp;
