import { cn } from "@/lib/utils";

/**
 * Renders admin-authored rich HTML (Tiptap output: h2/h3/p/ul/ol/blockquote/
 * strong/em/a) with the Mono Minimal type system. Content is authored in the
 * admin by trusted staff (PRD §15 sanitization note).
 *
 * Baseline typography lives in the `.richtext` block in app/globals.css (same
 * mechanism as the Tailwind Typography plugin): low, single-class specificity
 * via `:where()` so that CSS an author writes in a hand-coded post — inline
 * styles, class selectors, or a `<style>` block — always wins. Wrap a fully
 * bespoke block in `class="not-prose"` to opt it out of the baseline entirely.
 * (Previously these were high-specificity `[&_h2]` descendant utilities that
 * overrode author CSS.) The base font/colour stay as utilities here; they're
 * inherited, so equally easy to override on descendants.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  if (!html?.trim()) return null;
  return (
    <div
      className={cn(
        "richtext text-body-lg leading-relaxed text-ink-700 dark:text-ink-300",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichText;
