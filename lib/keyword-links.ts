import "server-only";
import { parse, NodeType, type HTMLElement, type TextNode } from "node-html-parser";

/**
 * Keyword backlink injection (the SEO team's key feature). Turns occurrences of
 * each keyword in the stored Tiptap HTML into anchors pointing at the keyword's
 * target URL. Runs server-side at render time (kept OUT of the stored body, so
 * editing keywords reflects on next render with no re-save).
 *
 * Rules (PRD §SEO):
 *  - Default: link the FIRST occurrence of each keyword only (avoids over-optimization);
 *    `firstOnly: false` links every occurrence.
 *  - Case-insensitive + word-boundary aware; the link text preserves the original casing.
 *  - Never touches text already inside <a>, headings (h1–h6), <code> or <pre>.
 *  - Longest keyword first, so a short keyword can't link inside a longer phrase, and
 *    skipping <a> prevents one keyword nesting inside another's link.
 *  - External links open in a new tab; rel always includes `noopener`, plus
 *    `nofollow`/`sponsored` per the keyword's setting (`dofollow` adds nothing).
 */

export interface KeywordLink {
  keyword: string;
  url: string;
  rel: "dofollow" | "nofollow" | "sponsored";
}

const SKIP_TAGS = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre"]);

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function anchorHtml(link: KeywordLink, text: string): string {
  const rel = ["noopener"];
  if (link.rel === "nofollow") rel.push("nofollow");
  if (link.rel === "sponsored") rel.push("sponsored");
  return `<a href="${escapeAttr(link.url)}" target="_blank" rel="${rel.join(" ")}">${escapeHtml(text)}</a>`;
}

interface Ctx {
  regex: RegExp;
  link: KeywordLink;
  firstOnly: boolean;
  done: boolean;
}

/** Replace keyword occurrences inside one text node; returns # of nodes spliced in (0 = no change). */
function linkTextNode(parent: HTMLElement, index: number, textNode: TextNode, ctx: Ctx): number {
  const text = textNode.text;
  ctx.regex.lastIndex = 0;
  let match = ctx.regex.exec(text);
  if (!match) return 0;

  let result = "";
  let last = 0;
  do {
    const matched = match[1]!;
    result += escapeHtml(text.slice(last, match.index));
    result += anchorHtml(ctx.link, matched);
    last = match.index + matched.length;
    if (ctx.firstOnly) {
      ctx.done = true;
      break;
    }
    match = ctx.regex.exec(text);
  } while (match);
  result += escapeHtml(text.slice(last));

  const newNodes = parse(result).childNodes;
  for (const n of newNodes) (n as { parentNode: HTMLElement }).parentNode = parent;
  parent.childNodes.splice(index, 1, ...newNodes);
  return newNodes.length;
}

function walk(node: HTMLElement, ctx: Ctx): void {
  const children = node.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]!;
    if (child.nodeType === NodeType.ELEMENT_NODE) {
      const tag = (child as HTMLElement).rawTagName?.toLowerCase();
      if (tag && SKIP_TAGS.has(tag)) continue;
      walk(child as HTMLElement, ctx);
    } else if (child.nodeType === NodeType.TEXT_NODE) {
      if (ctx.done) continue;
      const inserted = linkTextNode(node, i, child as TextNode, ctx);
      if (inserted > 0) i += inserted - 1; // skip past the spliced-in nodes
    }
    if (ctx.done) break;
  }
}

/** Inject keyword backlinks into `html`. Returns the transformed HTML (or the input unchanged). */
export function injectKeywordLinks(
  html: string,
  keywords: KeywordLink[] | undefined,
  opts?: { firstOnly?: boolean },
): string {
  if (!html || !keywords || keywords.length === 0) return html;
  const firstOnly = opts?.firstOnly ?? true;

  const cleaned = keywords
    .filter((k) => k.keyword?.trim() && k.url?.trim())
    .map((k) => ({ keyword: k.keyword.trim(), url: k.url.trim(), rel: k.rel }))
    .sort((a, b) => b.keyword.length - a.keyword.length);
  if (cleaned.length === 0) return html;

  const root = parse(html);
  for (const link of cleaned) {
    const regex = new RegExp(
      `(?<![A-Za-z0-9])(${escapeRegExp(link.keyword)})(?![A-Za-z0-9])`,
      firstOnly ? "i" : "gi",
    );
    walk(root, { regex, link, firstOnly, done: false });
  }
  return root.toString();
}
