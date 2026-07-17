import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
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

const GA_MEASUREMENT_ID = "G-F8RXJT171J";

/**
 * Google Tag Manager container. Replace the placeholder with the real
 * `GTM-XXXXXXX` id from tagmanager.google.com. While it stays a placeholder the
 * GTM scripts below don't render, so nothing broken ships to production.
 * NOTE: keep GA4 (gtag above) as the analytics source — do NOT also add a GA4
 * tag inside this container with the same measurement id, or hits double-count.
 */
const GTM_CONTAINER_ID = "GTM-XXXXXXX";
const GTM_ENABLED = /^GTM-[A-Z0-9]+$/.test(GTM_CONTAINER_ID) && GTM_CONTAINER_ID !== "GTM-XXXXXXX";

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
        {/* Google Tag Manager (noscript) — must be immediately after <body> opens. */}
        {GTM_ENABLED && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <SmoothScroll />
        {children}
        <Toaster />
        {/* Vercel Analytics — receives the custom CTA/affiliate events fired via lib/analytics.ts#trackEvent (window.va). */}
        <Analytics />
        {/* Google Analytics (gtag.js) — also receives trackEvent events via window.gtag. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {/* Google Tag Manager — container for future pixels/tags (Meta, Google Ads, etc.). */}
        {GTM_ENABLED && (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
