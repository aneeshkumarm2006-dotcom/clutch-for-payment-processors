import { cn } from "@/lib/utils";

/**
 * Renders admin-authored rich HTML (Tiptap output: h2/h3/p/ul/ol/blockquote/
 * strong/em/a) with the Mono Minimal type system. We don't ship the Tailwind
 * typography plugin, so styles are applied via descendant selectors. Content is
 * authored in the admin by trusted staff (PRD §15 sanitization note).
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  if (!html?.trim()) return null;
  return (
    <div
      className={cn(
        "text-body-lg leading-relaxed text-ink-700 dark:text-ink-300",
        "[&>*+*]:mt-4",
        "[&_h2]:mt-8 [&_h2]:text-h2 [&_h2]:text-foreground",
        "[&_h3]:mt-6 [&_h3]:text-h3 [&_h3]:text-foreground",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1",
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_u]:underline [&_u]:underline-offset-2",
        // Section divider (horizontal rule) from the editor.
        "[&_hr]:my-8 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border",
        // Inline code + fenced code blocks.
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground",
        "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-4",
        "[&_pre]:font-mono [&_pre]:text-small [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
        // Inline images + embeds inserted from the editor / HTML view.
        "[&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border",
        "[&_figure]:my-6 [&_figcaption]:mt-2 [&_figcaption]:text-small [&_figcaption]:text-muted-foreground",
        "[&_iframe]:my-6 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-lg [&_iframe]:border [&_iframe]:border-border",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichText;
