import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180×180 PNG) — file-based metadata convention. Generated so
 * we don't ship a binary asset; Apple applies its own rounded mask over the
 * full-bleed violet, matching `app/icon.svg`.
 */
// Edge runtime avoids the Node `fileURLToPath` font-resolution error in
// `@vercel/og` during prerender (see app/opengraph-image.tsx).
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6D28D9",
          color: "#FFFFFF",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        P
      </div>
    ),
    { ...size },
  );
}
