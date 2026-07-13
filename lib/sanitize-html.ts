import "server-only";
import { parse } from "node-html-parser";

/**
 * Server-side sanitizer for blog body HTML. Content is authored by the (trusted)
 * SEO team and rendered UNSANITIZED via `dangerouslySetInnerHTML`, so once we let
 * authors paste raw HTML (the editor's `<>` Show-HTML view) we must scrub the
 * dangerous bits on save — the same way Shopify's editor strips `<script>` from
 * pasted markup. This is defense-in-depth, not a full allowlist: `<iframe>` embeds
 * (YouTube/Vimeo) are intentionally preserved.
 *
 * Applied in the /seoteam write routes (POST create + PUT update) before persist.
 */

/** Tags removed entirely (element + contents). */
const DANGEROUS_TAGS = new Set(["script", "style", "noscript", "object", "embed", "form"]);

/** Attributes whose value is a URL and must be scheme-checked. */
const URL_ATTRS = new Set(["href", "src", "xlink:href", "action", "formaction", "srcdoc"]);

/** Reject `javascript:` / `vbscript:` / `data:text/html` URLs. */
function isDangerousUrl(value: string): boolean {
  // Strip whitespace + C0 control chars (\x00-\x20), a common scheme obfuscation.
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\x00-\x20]+/g, "").toLowerCase();
  return (
    v.startsWith("javascript:") || v.startsWith("vbscript:") || v.startsWith("data:text/html")
  );
}

/** Strip scripts, event handlers, and dangerous URL schemes from author HTML. */
export function sanitizeBlogHtml(html: string): string {
  if (!html || !html.trim()) return html;

  const root = parse(html);

  for (const el of root.querySelectorAll("*")) {
    const tag = el.rawTagName?.toLowerCase();
    if (tag && DANGEROUS_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    for (const name of Object.keys(el.attributes)) {
      const lower = name.toLowerCase();
      if (lower.startsWith("on")) {
        el.removeAttribute(name);
      } else if (URL_ATTRS.has(lower) && isDangerousUrl(el.attributes[name] ?? "")) {
        el.removeAttribute(name);
      }
    }
  }

  return root.toString();
}

/**
 * Sanitize the HTML-bearing content blocks (`richtext`, `htmlEmbed`) on save.
 *
 * Blocks are rendered with `dangerouslySetInnerHTML` by
 * `components/public/Blocks.tsx`, exactly as the blog body is — so they get the
 * same treatment, at the same point in the lifecycle: scrubbed on the way IN, not
 * on the way out. Sanitizing at render would mean the database still holds the
 * hostile markup, one careless `dangerouslySetInnerHTML` away from executing.
 *
 * Returns a NEW array; never mutates the caller's blocks.
 */
export function sanitizeBlocks<T extends { type: string; data?: Record<string, unknown> }>(
  blocks: T[] | undefined,
): T[] | undefined {
  if (!blocks?.length) return blocks;

  return blocks.map((block) => {
    if (block.type !== "richtext" && block.type !== "htmlEmbed") return block;
    const html = block.data?.html;
    if (typeof html !== "string") return block;
    return { ...block, data: { ...block.data, html: sanitizeBlogHtml(html) } };
  });
}
