"use client";

import * as React from "react";
import { useHub } from "./context";
import { GoogleCard } from "./settings/GoogleCard";
import { MetaCard } from "./settings/MetaCard";
import { GoogleAdsCard } from "./settings/GoogleAdsCard";
import { ProjectCard } from "./settings/ProjectCard";
import { PasswordCard } from "./settings/PasswordCard";

/** The Settings page body: one card per source + Project + Change password. */
export function SettingsView() {
  const { status, reloadStatus } = useHub();
  return (
    <div className="mx-auto max-w-content space-y-6">
      <header>
        <h1 className="text-h1 tracking-tighter2 text-foreground">Settings</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Connect your data sources. Every save is validated live — a credential that doesn&apos;t work is never stored.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="lg:col-span-2">
          <GoogleCard status={status} onChange={reloadStatus} />
        </div>
        <MetaCard status={status} onChange={reloadStatus} />
        <GoogleAdsCard status={status} onChange={reloadStatus} />
        <ProjectCard status={status} onChange={reloadStatus} />
        <PasswordCard />
      </div>
    </div>
  );
}

export default SettingsView;
