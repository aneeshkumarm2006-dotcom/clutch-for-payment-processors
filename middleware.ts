import { withAuth } from "next-auth/middleware";

/**
 * Protect the admin panel (PRD §11). Every `/admin/*` route requires a valid
 * NextAuth session EXCEPT `/admin/login`. Unauthenticated requests are
 * redirected to the login page (configured via `pages.signIn`).
 */
export default withAuth(
  // No extra logic needed — the `authorized` callback below gates access.
  function middleware() {},
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
