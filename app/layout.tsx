import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PayCompare — Compare payment processors",
    template: "%s · PayCompare",
  },
  description:
    "Compare payment processors and gateways on fees, payment methods, integrations, and verified merchant reviews.",
  verification: {
    google: "IXGaDh1jqTmUq_C_V_uqXqT5V8Rzw6QqsIXLIKA0JS4",
  },
};

/** Browser theme color (violet accent, brighter in dark mode) — PWA/address-bar tint. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6D28D9" },
    { media: "(prefers-color-scheme: dark)", color: "#8B5CF6" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <SmoothScroll />
        {children}
        <Toaster />
        {/* Vercel Analytics — receives the custom CTA/affiliate events fired via lib/analytics.ts#trackEvent (window.va). */}
        <Analytics />
      </body>
    </html>
  );
}
