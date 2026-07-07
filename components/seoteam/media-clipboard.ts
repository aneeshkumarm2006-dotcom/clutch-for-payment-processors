import { toast } from "sonner";
import type { MediaRow } from "@/lib/media";

/**
 * Clipboard + snippet helpers shared by the media gallery's table cells, row
 * actions, and bulk toolbar. Kept framework-agnostic (no JSX) so both the table
 * and the parent gallery can import them.
 */

/** Copy text and show a brief confirmation toast. Never throws. */
export async function copyText(text: string, successMsg = "Copied"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
  } catch {
    toast.error("Couldn't copy to the clipboard.");
  }
}

/** Markdown image embed: `![alt](url)`. */
export function markdownSnippet(media: Pick<MediaRow, "url" | "alt">): string {
  return `![${media.alt ?? ""}](${media.url})`;
}

/** HTML `<img>` snippet with alt + intrinsic dimensions when known. */
export function imgSnippet(media: Pick<MediaRow, "url" | "alt" | "width" | "height">): string {
  const attrs = [`src="${media.url}"`, `alt="${media.alt ?? ""}"`];
  if (media.width) attrs.push(`width="${media.width}"`);
  if (media.height) attrs.push(`height="${media.height}"`);
  return `<img ${attrs.join(" ")} />`;
}
