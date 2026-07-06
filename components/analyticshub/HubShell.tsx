"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LineChart as LineChartIcon,
  Search,
  Megaphone,
  Target,
  Users,
  Settings,
  RefreshCw,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHub, type ConnState } from "./context";
import { RangePicker } from "./RangePicker";

/**
 * components/analyticshub/HubShell.tsx — the dashboard frame (mirrors the repo's
 * AdminShell/SeoTeamShell idiom: dark ink sidebar + sticky card top bar). Sidebar
 * items are real URLs; source items carry a live connection dot. Below md the
 * sidebar collapses to a horizontal scroll strip.
 */
type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean; sourceKey?: string };

const NAV: NavItem[] = [
  { label: "Overview", href: "/analyticshub", icon: LayoutDashboard, exact: true },
  { label: "Analytics", href: "/analyticshub/ga4", icon: LineChartIcon, sourceKey: "ga4" },
  { label: "Search Console", href: "/analyticshub/gsc", icon: Search, sourceKey: "gsc" },
  { label: "Meta Ads", href: "/analyticshub/meta", icon: Megaphone, sourceKey: "meta" },
  { label: "Google Ads", href: "/analyticshub/gads", icon: Target, sourceKey: "gads" },
  { label: "Leads", href: "/analyticshub/leads", icon: Users, sourceKey: "leads" },
  { label: "Settings", href: "/analyticshub/settings", icon: Settings },
];

function useRelative(ts: number | null): string {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return "—";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function StatusDot({ state }: { state?: ConnState }) {
  if (!state || state === "not_connected") {
    return <span className="ml-auto size-1.5 rounded-full ring-1 ring-ink-600" aria-label="not connected" />;
  }
  if (state === "reconnect_needed") {
    return <span className="ml-auto size-1.5 rounded-full bg-warning" aria-label="reconnect needed" />;
  }
  return <span className="ml-auto size-1.5 rounded-full bg-violet-400" aria-label="connected" />;
}

export function HubShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, refresh, lastUpdated, reloadStatus } = useHub();
  const [spinning, setSpinning] = React.useState(false);
  const updated = useRelative(lastUpdated);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const onRefresh = () => {
    setSpinning(true);
    refresh();
    setTimeout(() => setSpinning(false), 700);
  };

  const onSignOut = async () => {
    try {
      await fetch("/api/analyticshub/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore — reload reflects logged-out state */
    }
    await reloadStatus();
  };

  return (
    <div className="flex min-h-screen bg-ink-50 text-foreground dark:bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 text-ink-300 md:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="inline-flex size-6 items-center justify-center rounded-md" style={{ background: status.project.primaryColor }}>
            <LineChartIcon className="size-3.5 text-white" />
          </span>
          <Link href="/analyticshub" className="truncate text-h4 tracking-tighter2 text-ink-50">
            {status.project.name}
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded px-3 py-2 text-small transition-colors",
                  active ? "bg-violet-950 font-medium text-violet-300" : "text-ink-400 hover:bg-ink-900 hover:text-ink-100",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.sourceKey && <StatusDot state={status.sources[item.sourceKey]} />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-800 px-4 py-3 text-micro text-ink-500">Analytics Hub</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/90 px-4 backdrop-blur lg:px-6">
          <span className="text-h4 tracking-tighter2 text-foreground md:hidden">{status.project.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-micro text-muted-foreground sm:inline">Updated {updated}</span>
            <RangePicker />
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh (bypass cache)"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              title="Sign out"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Mobile nav strip */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-small",
                  active ? "bg-accent-subtle font-medium text-accent-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export default HubShell;
