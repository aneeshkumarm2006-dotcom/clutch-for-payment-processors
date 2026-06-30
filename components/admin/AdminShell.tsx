"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CreditCard,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Newspaper,
  ScrollText,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/enums";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * AdminShell (PRD §10 / DESIGN §9) — dark sidebar nav + topbar with user menu.
 * Wraps every authenticated `/admin` page. Active item = violet text on a
 * `violet-950` chip; content area sits on `ink-50`.
 */
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  /** When true, the item is hidden from editors (admin-only sections, PRD §10.10). */
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Processors", href: "/admin/processors", icon: CreditCard },
  { label: "Categories", href: "/admin/categories", icon: FolderTree },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Leads", href: "/admin/leads", icon: Inbox },
  { label: "Submissions", href: "/admin/submissions", icon: FileText },
  { label: "Blog", href: "/admin/blog", icon: Newspaper },
  { label: "Users", href: "/admin/users", icon: Users, adminOnly: true },
  { label: "Audit log", href: "/admin/audit", icon: ScrollText, adminOnly: true },
  { label: "Settings", href: "/admin/settings", icon: Settings, adminOnly: true },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role?: UserRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const initial = (user.name || user.email || "A").charAt(0).toUpperCase();
  // Editors don't see Users / Audit / Settings (also enforced in middleware + API).
  const nav = NAV.filter((item) => !item.adminOnly || user.role === "admin");

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="flex min-h-screen bg-ink-50 text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 text-ink-300 md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/admin" className="text-h4 tracking-tighter2 text-ink-50">
            PayCompare<span className="text-violet-400">.</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map((item) => {
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
          Admin · PayCompare
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-card/90 px-4 backdrop-blur lg:px-6">
          {/* Mobile brand (sidebar hidden < md) */}
          <Link href="/admin" className="text-h4 tracking-tighter2 text-foreground md:hidden">
            PayCompare<span className="text-accent">.</span>
          </Link>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 rounded px-2 py-1.5 text-small hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-ink-900 text-micro font-semibold text-ink-50">
                  {initial}
                </span>
                <span className="hidden max-w-[12rem] truncate text-ink-700 sm:inline">
                  {user.name || user.email}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" target="_blank" rel="noopener">
                    View public site
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void signOut({ callbackUrl: "/admin/login" });
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
