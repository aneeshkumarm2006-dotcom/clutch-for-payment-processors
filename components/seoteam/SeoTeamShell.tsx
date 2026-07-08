"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Images, LayoutDashboard, LogOut, PlusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasUnsavedChanges } from "@/components/UnsavedChangesGuard";

/**
 * SeoTeamShell — the dashboard frame for the password-protected /seoteam area.
 * Mirrors the AdminShell "Mono Minimal" look but scoped to the SEO team's nav
 * (Dashboard, New post) with a shared-password logout. Deliberately separate from
 * AdminShell, which is NextAuth/role-aware and links to the full admin.
 */
type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/seoteam", icon: LayoutDashboard, exact: true },
  { label: "New post", href: "/seoteam/new", icon: PlusCircle },
  { label: "Gallery", href: "/seoteam/gallery", icon: Images },
];

export function SeoTeamShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const onLogout = async () => {
    // The anchor interceptor can't see this <button>, so check for unsaved edits here.
    if (
      hasUnsavedChanges() &&
      !window.confirm("You have unsaved changes that haven't been saved. Log out and lose them?")
    ) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch("/api/seoteam/logout", { method: "POST" });
    } catch {
      /* ignore — we redirect regardless */
    }
    router.push("/seoteam/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-ink-50 text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 text-ink-300 md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/seoteam" className="text-h4 tracking-tighter2 text-ink-50">
            PayCompare<span className="text-violet-400">.</span>
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
                  active
                    ? "bg-violet-950 font-medium text-violet-300"
                    : "text-ink-400 hover:bg-ink-900 hover:text-ink-100",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-800 px-3 py-3 text-micro text-ink-500">
          SEO team · PayCompare
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-card/90 px-4 backdrop-blur lg:px-6">
          <Link href="/seoteam" className="text-h4 tracking-tighter2 text-foreground md:hidden">
            PayCompare<span className="text-accent">.</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/blog"
              target="_blank"
              rel="noopener"
              className="rounded px-2 py-1.5 text-small text-ink-700 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View blog
            </Link>
            <button
              type="button"
              onClick={() => void onLogout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-small text-ink-700 hover:bg-ink-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export default SeoTeamShell;
