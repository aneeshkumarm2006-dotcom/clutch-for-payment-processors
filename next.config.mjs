import { buildSeoRedirects } from "./lib/build-redirects.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Nothing gains from advertising the framework on every response. */
  poweredByHeader: false,
  images: {
    /**
     * Scoped to the hosts this site actually serves images from.
     *
     * `hostname: "**"` turned `/_next/image` into an open image-optimization
     * proxy: anyone could pass any https URL and have this deployment fetch,
     * transform, and cache it on the project's bandwidth. Cloudinary is where
     * every upload goes (see lib/upload.ts), and a sweep of every image URL in
     * the database found res.cloudinary.com to be the only host in use.
     *
     * The admin image fields also accept a PASTED URL, so if an editor ever
     * points one at another host, add that host here. Only `Blocks.tsx` renders
     * through the optimizer (everything else passes `unoptimized`), so that is
     * the one surface where a missing pattern would show up as a broken image.
     */
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    /** AVIF first, WebP fallback. The default is WebP only. */
    formats: ["image/avif", "image/webp"],
    /** Logos and cover images are immutable per URL, so cache them for a year. */
    minimumCacheTTL: 31_536_000,
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
