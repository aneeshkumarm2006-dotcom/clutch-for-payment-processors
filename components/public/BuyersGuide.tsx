import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { slugify } from "@/lib/utils";
import { RichText } from "@/components/public/RichText";
import { BuyersGuideToc, type TocItem } from "@/components/public/BuyersGuideToc.client";

/**
 * Capterra-style long-form buyers guide: an optional intro + key-takeaways box, a
 * Table of Contents built from the section headings, and the prose sections.
 *
 * A SERVER component — the sections and their `<h2>` headings must be in the initial
 * HTML so crawlers see them (that, plus the Article JSON-LD emitted by the engine,
 * is the SEO objective). Only the TOC's scroll-spy is a client island.
 *
 * HTML in `intro`/`sections[].body` is sanitized ON SAVE (`lib/sanitize-html.ts`),
 * the same trust model as the `richtext` block, then rendered via `RichText`.
 */

export interface BuyersGuideSection {
  heading: string;
  body: string;
}

export interface RelatedCategory {
  name: string;
  href: string;
}

export interface BuyersGuideProps {
  title?: string;
  intro?: string;
  showToc?: boolean;
  keyTakeaways?: string[];
  sections: BuyersGuideSection[];
  /** Drives the "Updated {Month YYYY}" freshness line (from the category's updatedAt). */
  updatedAt?: string | Date;
  related?: RelatedCategory[];
  className?: string;
}

/** Format an updatedAt to "Month YYYY" (e.g. "July 2026"); null when absent/invalid. */
function formatUpdated(value?: string | Date): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}

export function BuyersGuide({
  title,
  intro,
  showToc = true,
  keyTakeaways,
  sections,
  updatedAt,
  related,
  className,
}: BuyersGuideProps) {
  if (!sections.length) return null;

  // Stable, de-duped anchor ids from the headings (two "Pricing" sections must not
  // share `#pricing`, or the second jump link lands on the first).
  const seen = new Map<string, number>();
  const withIds = sections.map((s) => {
    const base = slugify(s.heading) || "section";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...s, id: n === 1 ? base : `${base}-${n}` };
  });
  const tocItems: TocItem[] = withIds.map((s) => ({ id: s.id, heading: s.heading }));
  const updated = formatUpdated(updatedAt);
  const takeaways = (keyTakeaways ?? []).filter((t) => t.trim());

  return (
    <section aria-label={title || "Buyers guide"} className={className}>
      {(title || updated) && (
        <div className="max-w-prose">
          {title && <h2 className="text-h2 tracking-tighter2 text-foreground">{title}</h2>}
          {updated && <p className="mt-1 text-small text-muted-foreground">Updated {updated}</p>}
        </div>
      )}

      {intro && <RichText html={intro} className="mt-4 max-w-prose" />}

      {takeaways.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 text-label font-medium text-foreground">
            <Lightbulb className="size-4 text-accent" aria-hidden />
            Key takeaways
          </h3>
          <ul className="mt-3 space-y-2">
            {takeaways.map((t, i) => (
              <li key={`${t}-${i}`} className="flex gap-2.5 text-body text-foreground">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={showToc ? "mt-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10" : "mt-8"}>
        {showToc && (
          <aside className="lg:self-start">
            <BuyersGuideToc items={tocItems} />
          </aside>
        )}

        <div className="min-w-0 space-y-10">
          {withIds.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-h3 tracking-tighter2 text-foreground">{s.heading}</h2>
              <RichText html={s.body} className="mt-3" />
            </section>
          ))}
        </div>
      </div>

      {related && related.length > 0 && (
        <div className="mt-10 border-t border-border pt-6">
          <h3 className="text-label font-medium text-muted-foreground">Related categories</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="inline-flex rounded-full border border-border bg-card px-3 py-1.5 text-small text-foreground transition-colors hover:border-accent"
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default BuyersGuide;
