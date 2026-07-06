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
