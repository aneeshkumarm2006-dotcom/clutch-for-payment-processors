import type { Metadata } from "next";
import { HubApp } from "@/components/analyticshub/HubApp";

/**
 * app/analyticshub/layout.tsx — the hub's root. Server component so it can set
 * metadata (noindex — the hub must never be crawlable) and a brand-colored inline
 * favicon (no 404 in the console). The actual app is the client <HubApp> gate,
 * which decides between the wizard, login, or the authenticated shell.
 */
const FAVICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#6D28D9'/><rect x='7' y='17' width='4' height='8' rx='1' fill='#fff'/><rect x='14' y='12' width='4' height='13' rx='1' fill='#fff'/><rect x='21' y='7' width='4' height='18' rx='1' fill='#fff'/></svg>`;

export const metadata: Metadata = {
  title: "Analytics Hub",
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}` },
};

export const dynamic = "force-dynamic";

export default function AnalyticsHubLayout({ children }: { children: React.ReactNode }) {
  return <HubApp>{children}</HubApp>;
}
