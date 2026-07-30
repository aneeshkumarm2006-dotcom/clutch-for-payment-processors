import { buildSeoRedirects } from "./lib/build-redirects.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Mongoose/bcrypt pull in optional native deps they don't need bundled in the Next runtime.
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "bcrypt"],
  },
  /**
   * Turn every `seo.redirectTo` into a true 308 in the routing layer.
   *
   * The page-level `applySeoRedirect` can only manage a meta refresh, because a
   * route that declares `revalidate` serves its cached render as a 200 — see
   * `lib/build-redirects.mjs` for the full reasoning. This resolves the redirect
   * before rendering is involved at all. Reads the DB at build time and fails
   * open, so an unreachable Mongo costs a weaker redirect, not the build.
   */
  async redirects() {
    return buildSeoRedirects();
  },
  // Belt-and-suspenders noindex for the analytics hub (also set via robots.txt +
  // per-page metadata): stamp X-Robots-Tag on every hub page and API response.
  async headers() {
    return [
      {
        source: "/analyticshub/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/analyticshub/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
