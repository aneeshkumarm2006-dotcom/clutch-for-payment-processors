import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

/**
 * Web app manifest (file-based convention → auto-linked as `<link rel="manifest">`).
 * Pairs with `app/icon.svg` + `app/apple-icon.tsx` and the `themeColor` viewport
 * in the root layout to give the site an installable, branded identity.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Compare payment processors`,
    short_name: SITE_NAME,
    description:
      "Compare payment processors and gateways on fees, payment methods, integrations, and verified merchant reviews.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#6D28D9",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
