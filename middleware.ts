import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { withAuth } from "next-auth/middleware";
import { SEO_COOKIE, verifySession } from "@/lib/seoteam-auth";

/**
 * Two independent auth schemes on disjoint path prefixes, merged in one file:
 *
 *  - `/admin/*`   → existing NextAuth session (PRD §11), via `withAuth` (unchanged).
 *                   `editor` reaches processors/categories/reviews/blog; Users /
 *                   Settings / Audit are admin-only.
 *  - `/seoteam/*` + `/api/seoteam/*` → the shared-password cookie scheme for the
 *                   non-technical SEO team (signed via SESSION_SECRET). Verified at
 *                   the Edge with Web Crypto; unauthenticated UI → login, API → 401.
 *
 * The default middleware branches by pathname so `/seoteam` traffic never reaches
 * NextAuth (which would wrongly demand a NextAuth token) and vice versa.
 */
const ADMIN_ONLY = ["/admin/users", "/admin/settings", "/admin/audit", "/admin/page-seo"];

const adminMiddleware = withAuth(
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

/** Paths under the /seoteam matcher that must stay reachable while signed out. */
const SEO_PUBLIC_PATHS = new Set([
  "/seoteam/login",
  "/api/seoteam/login",
  "/api/seoteam/logout",
]);

async function seoteamGuard(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (SEO_PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const ok = await verifySession(req.cookies.get(SEO_COOKIE)?.value);
  if (ok) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/seoteam/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

type NextAuthMiddleware = (
  req: NextRequest,
  event: NextFetchEvent,
) => Promise<NextResponse> | NextResponse;

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  if (
    pathname === "/seoteam" ||
    pathname.startsWith("/seoteam/") ||
    pathname.startsWith("/api/seoteam")
  ) {
    return seoteamGuard(req);
  }
  // Delegate everything else (i.e. /admin/*) to NextAuth, untouched.
  return (adminMiddleware as unknown as NextAuthMiddleware)(req, event);
}

export const config = {
  matcher: ["/admin/:path*", "/seoteam/:path*", "/api/seoteam/:path*"],
};
