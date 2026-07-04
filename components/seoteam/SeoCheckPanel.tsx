"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { SITE_URL } from "@/lib/seo";
import {
  evaluateSeo,
  isSeoReady,
  keywordInText,
  seoWarnCount,
  type SeoSignals,
} from "@/lib/seo-checks";
import { cn } from "@/lib/utils";
import type { KeywordRow } from "@/components/seoteam/serialize";

/**
 * Live on-page SEO checks for the editor. Extracts signals from the current form
 * state in the browser (DOMParser) and runs the shared `evaluateSeo` scoring, so
 * a non-technical author sees pass/warn indicators and whether the post is
 * "SEO-ready" before publishing.
 */
const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "";
  }
})();

function isInternal(href: string | null): boolean {
  if (!href) return false;
  const h = href.trim();
  if (h.startsWith("#") || h.startsWith("/")) return true;
  if (h.startsWith("mailto:") || h.startsWith("tel:")) return false;
  try {
    return new URL(h, SITE_URL).host === SITE_HOST;
  } catch {
    return false;
  }
}

function buildSignals(args: {
  content: string;
  title: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  coverImage: string;
  keywords: KeywordRow[];
}): SeoSignals | null {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return null;

  const doc = new DOMParser().parseFromString(args.content || "", "text/html");
  const plainText = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  const images = Array.from(doc.querySelectorAll("img"));

  let internalLinks = 0;
  let externalLinks = 0;
  for (const a of anchors) {
    if (isInternal(a.getAttribute("href"))) internalLinks += 1;
    else externalLinks += 1;
  }

  const effectiveTitle = args.metaTitle.trim() || args.title;
  const effectiveDesc = args.metaDescription.trim() || args.excerpt;

  return {
    metaTitleLength: effectiveTitle.length,
    metaDescriptionLength: effectiveDesc.length,
    wordCount: plainText ? plainText.split(/\s+/).length : 0,
    hasCoverImage: Boolean(args.coverImage.trim()),
    internalLinks,
    externalLinks,
    imagesTotal: images.length,
    imagesMissingAlt: images.filter((im) => !(im.getAttribute("alt") ?? "").trim()).length,
    keywords: args.keywords
      .filter((k) => k.keyword.trim())
      .map((k) => ({ keyword: k.keyword.trim(), present: keywordInText(plainText, k.keyword) })),
  };
}

export function SeoCheckPanel() {
  const { control } = useFormContext();
  const content = (useWatch({ control, name: "content" }) as string) ?? "";
  const title = (useWatch({ control, name: "title" }) as string) ?? "";
  const excerpt = (useWatch({ control, name: "excerpt" }) as string) ?? "";
  const metaTitle = (useWatch({ control, name: "seo.metaTitle" }) as string) ?? "";
  const metaDescription = (useWatch({ control, name: "seo.metaDescription" }) as string) ?? "";
  const coverImage = (useWatch({ control, name: "coverImage" }) as string) ?? "";
  const keywords = useWatch({ control, name: "keywords" }) as KeywordRow[] | undefined;

  const signals = React.useMemo(
    () =>
      buildSignals({
        content,
        title,
        excerpt,
        metaTitle,
        metaDescription,
        coverImage,
        keywords: keywords ?? [],
      }),
    [content, title, excerpt, metaTitle, metaDescription, coverImage, keywords],
  );

  // `buildSignals` relies on DOMParser (client-only), so the server renders the
  // empty placeholder. Defer signals to after mount so the first client render
  // matches the server and hydration doesn't mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const shown = mounted ? signals : null;

  const checks = shown ? evaluateSeo(shown) : [];
  const ready = shown ? isSeoReady(checks) : false;
  const warns = shown ? seoWarnCount(checks) : 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-h4 text-foreground">SEO checks</h2>
        {shown ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-micro font-medium",
              ready
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning",
            )}
          >
            {ready ? (
              <>
                <CheckCircle2 className="size-3.5" /> SEO-ready
              </>
            ) : (
              <>
                <AlertTriangle className="size-3.5" /> {warns} to review
              </>
            )}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-ink-150 dark:divide-ink-800">
        {!shown ? (
          <li className="px-4 py-3 text-small text-muted-foreground">
            Checks update as you type.
          </li>
        ) : (
          checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 px-4 py-2.5">
              {c.status === "pass" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-small font-medium text-foreground">{c.label}</p>
                <p className="text-micro text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default SeoCheckPanel;
