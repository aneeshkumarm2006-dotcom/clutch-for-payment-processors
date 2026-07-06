"use client";

import * as React from "react";
import type { SourceKey } from "@/lib/analyticshub/types";
import {
  DEFAULT_PRESET,
  resolvePreset,
  type DateRange,
  type PresetKey,
} from "@/lib/analyticshub/dates";

/**
 * components/analyticshub/context.tsx — the shared client state every hub page
 * reads: the selected date range (preset or custom, persisted), a refresh nonce
 * that cache-busts on demand, the "last updated" timestamp, the live /status, and
 * a light/dark flag (charts pick a theme-appropriate palette).
 */

export interface HubProject {
  name: string;
  primaryColor: string;
  accentColor: string;
}

export type ConnState = "connected" | "not_connected" | "reconnect_needed";

export interface HubStatus {
  ok: boolean;
  setupComplete: boolean;
  authed: boolean;
  project: HubProject;
  projectIsDetected: boolean;
  sources: Record<string, ConnState>;
  oauthAvailable: boolean;
  secret: { ok: boolean; reason?: string; message?: string; decodedLength?: number };
  db: { ok: boolean; message?: string };
  errors: string[];
}

interface HubContextValue {
  range: DateRange;
  preset: PresetKey | "custom";
  setPreset: (p: PresetKey) => void;
  setCustomRange: (from: string, to: string) => void;
  refreshNonce: number;
  refresh: () => void;
  lastUpdated: number | null;
  reportUpdated: (ts: number) => void;
  status: HubStatus;
  reloadStatus: () => Promise<void>;
  isDark: boolean;
}

const HubContext = React.createContext<HubContextValue | null>(null);

const PRESET_KEY = "analyticshub:preset";
const RANGE_KEY = "analyticshub:range";

export function useIsDark(): boolean {
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function HubProvider({
  status,
  reloadStatus,
  children,
}: {
  status: HubStatus;
  reloadStatus: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [preset, setPresetState] = React.useState<PresetKey | "custom">(DEFAULT_PRESET);
  const [range, setRange] = React.useState<DateRange>(() => resolvePreset(DEFAULT_PRESET));
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  const isDark = useIsDark();

  // Restore persisted range on mount.
  React.useEffect(() => {
    try {
      const savedPreset = localStorage.getItem(PRESET_KEY) as PresetKey | "custom" | null;
      if (savedPreset === "custom") {
        const raw = localStorage.getItem(RANGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DateRange;
          if (parsed.from && parsed.to) {
            setPresetState("custom");
            setRange(parsed);
            return;
          }
        }
      } else if (savedPreset) {
        setPresetState(savedPreset);
        setRange(resolvePreset(savedPreset));
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const setPreset = React.useCallback((p: PresetKey) => {
    setPresetState(p);
    setRange(resolvePreset(p));
    try {
      localStorage.setItem(PRESET_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const setCustomRange = React.useCallback((from: string, to: string) => {
    const r = { from, to };
    setPresetState("custom");
    setRange(r);
    try {
      localStorage.setItem(PRESET_KEY, "custom");
      localStorage.setItem(RANGE_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = React.useCallback(() => {
    setRefreshNonce((n) => n + 1);
    void reloadStatus();
  }, [reloadStatus]);

  const reportUpdated = React.useCallback((ts: number) => {
    setLastUpdated((prev) => (prev == null || ts > prev ? ts : prev));
  }, []);

  const value: HubContextValue = {
    range,
    preset,
    setPreset,
    setCustomRange,
    refreshNonce,
    refresh,
    lastUpdated,
    reportUpdated,
    status,
    reloadStatus,
    isDark,
  };

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub(): HubContextValue {
  const ctx = React.useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used within <HubProvider>");
  return ctx;
}

export type { SourceKey };
