import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

/**
 * Default site-wide Open Graph / Twitter image (1200×630). File-based convention:
 * Next injects this as the fallback `og:image`/`twitter:image` for any route that
 * doesn't set its own (homepage, directory, category, compare, legal, facet,
 * glossary…), so links to those pages get a branded large card instead of none.
 * Entity pages (processor/blog) still override it with their own logo/cover.
 */
// Edge runtime: `@vercel/og` loads its default font without Node's
// `fileURLToPath`, which fails to resolve on some hosts (e.g. Windows paths with
// spaces) and breaks the Node-runtime prerender of this image.
export const runtime = "edge";
export const alt = `${SITE_NAME} — Compare payment processors`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0A",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#6D28D9",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <span style={{ color: "#FFFFFF", fontSize: 34, fontWeight: 700 }}>
            {SITE_NAME}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              color: "#FFFFFF",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 900,
            }}
          >
            Compare payment processors
          </span>
          <span style={{ color: "#A1A1AA", fontSize: 32, maxWidth: 880, lineHeight: 1.3 }}>
            Fees, payment methods, integrations, and verified merchant reviews — in one
            independent directory.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#8B5CF6", fontSize: 26, fontWeight: 600 }}>
            Independent · Verified reviews · Transparent methodology
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
