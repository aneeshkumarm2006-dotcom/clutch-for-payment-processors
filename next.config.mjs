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
};

export default nextConfig;
