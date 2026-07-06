"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { ConnectionCard, FormMessage } from "./ConnectionCard";
import type { HubStatus } from "../context";

const label = "text-small font-medium text-foreground";
const input =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");

/** Project identity: name + primary/accent colors (auto-detected on first run). */
export function ProjectCard({ status, onChange }: { status: HubStatus; onChange: () => void | Promise<void> }) {
  const [name, setName] = React.useState(status.project.name);
  const [primary, setPrimary] = React.useState(status.project.primaryColor);
  const [accent, setAccent] = React.useState(status.project.accentColor);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/analyticshub/project", { name, primaryColor: primary, accentColor: accent });
      await onChange();
      toast.success("Project saved.");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConnectionCard title="Project" description="How the hub identifies your site.">
      <div className="space-y-3">
        <div>
          <label className={label}>Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Primary color" value={primary} onChange={setPrimary} />
          <ColorField label="Accent color" value={accent} onChange={setAccent} />
        </div>
        <FormMessage error={error} />
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save project"}
        </Button>
      </div>
    </ConnectionCard>
  );
}

function ColorField({ label: lbl, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={label}>{lbl}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6D28D9"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-card"
        />
        <input
          className={input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={lbl}
        />
      </div>
    </div>
  );
}

export default ProjectCard;
