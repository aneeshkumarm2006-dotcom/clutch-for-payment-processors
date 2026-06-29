import { cn } from "@/lib/utils";

/**
 * Prose wrapper for static editorial pages (methodology, about, privacy, terms).
 * Applies the Mono Minimal type system to JSX children via descendant selectors
 * — the same treatment `RichText` gives admin HTML, but for hand-written content
 * (so no `dangerouslySetInnerHTML`). Reading-width is capped by the caller.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-body-lg leading-relaxed text-ink-700 dark:text-ink-300",
        "[&>*+*]:mt-4",
        "[&_h2]:mt-10 [&_h2]:text-h2 [&_h2]:tracking-tighter2 [&_h2]:text-foreground",
        "[&_h3]:mt-8 [&_h3]:text-h3 [&_h3]:text-foreground",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1.5",
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Prose;
