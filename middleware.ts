import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

/**
 * Protect the admin panel (PRD §11). Every `/admin/*` route requires a valid
 * NextAuth session EXCEPT `/admin/login`. Unauthenticated requests are
 * redirected to the login page (configured via `pages.signIn`).
 *
 * Phase 2 (PRD §11 / §10.10): role-gated sections. An `editor` can reach
 * processors / categories / reviews / blog, but `/admin/users` and
 * `/admin/settings` are admin-only — an editor hitting them is bounced back to
 * the dashboard (the nav also hides those items, and the APIs return 403).
 */
const ADMIN_ONLY = ["/admin/users", "/admin/settings", "/admin/audit"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;
    const isAdminOnly = ADMIN_ONLY.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (isAdminOnly && role !== "admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  },
  {
    pages: {
      signIn: "/admin/login",
    },
    callbacks: {
      authorized({ req, token }) {
        // Always allow the login page through, otherwise we'd redirect-loop.
        if (req.nextUrl.pathname.startsWith("/admin/login")) return true;
        // Everything else under /admin requires a session token.
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: ["/admin/:path*"],
};
