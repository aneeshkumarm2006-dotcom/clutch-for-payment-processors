import "server-only";
import { parse, NodeType, type HTMLElement } from "node-html-parser";
import { SITE_URL } from "@/lib/seo";

/**
 * Server-side extraction of SEO signals from a post's HTML body, using the same
 * `node-html-parser` as the keyword engine. Pairs with `lib/seo-checks.ts`'s pure
 * `evaluateSeo` to power the dashboard "SEO-ready" badge. (The live editor panel
 * extracts the equivalent signals in the browser via DOMParser.)
 */

export interface HtmlSeoStats {
  plainText: string;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  imagesTotal: number;
  imagesMissingAlt: number;
}

function siteHost(): string {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "";
  }
}

function isInternalHref(href: string | undefined, host: string): boolean {
  if (!href) return false;
  const h = href.trim();
  if (h.startsWith("#") || h.startsWith("/")) return true;
  if (h.startsWith("mailto:") || h.startsWith("tel:")) return false;
  try {
    return new URL(h, SITE_URL).host === host;
  } catch {
    return false;
  }
}

export function analyzeHtmlForSeo(html: string): HtmlSeoStats {
  const stats: HtmlSeoStats = {
    plainText: "",
    wordCount: 0,
    internalLinks: 0,
    externalLinks: 0,
    imagesTotal: 0,
    imagesMissingAlt: 0,
  };
  if (!html) return stats;

  const host = siteHost();
  const root = parse(html);
  const textParts: string[] = [];

  const visit = (node: HTMLElement): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === NodeType.TEXT_NODE) {
        textParts.push((child as unknown as { text: string }).text);
      } else if (child.nodeType === NodeType.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.rawTagName?.toLowerCase();
        if (tag === "a") {
          if (isInternalHref(el.getAttribute("href"), host)) stats.internalLinks += 1;
          else stats.externalLinks += 1;
        } else if (tag === "img") {
          stats.imagesTotal += 1;
          if (!el.getAttribute("alt")?.trim()) stats.imagesMissingAlt += 1;
        }
        visit(el);
      }
    }
  };
  visit(root);

  stats.plainText = textParts.join(" ").replace(/\s+/g, " ").trim();
  stats.wordCount = stats.plainText ? stats.plainText.split(/\s+/).length : 0;
  return stats;
}
