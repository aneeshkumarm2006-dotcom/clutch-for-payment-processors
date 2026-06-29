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
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichText;
