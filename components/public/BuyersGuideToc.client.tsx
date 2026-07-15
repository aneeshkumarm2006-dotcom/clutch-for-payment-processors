"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  heading: string;
}

/**
 * Table of contents for a buyers guide.
 *
 * Jump links (`#id`) work with ZERO JavaScript — this renders as `<a href>`s on the
 * server. Hydration only *adds* scroll-spy: `aria-current` follows the section in
 * view via IntersectionObserver. Kept a client island so `<BuyersGuide>` stays a
 * server component and the guide prose ships in the initial HTML for crawlers.
 */
export function BuyersGuideToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (items.length === 0) return;
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section currently crossing the reading line wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Anchor the "active" line near the top of the viewport, below the header.
      { rootMargin: "-96px 0px -66% 0px", threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const list = (
    <ul className="space-y-1.5 text-small">
      {items.map((it) => (
        <li key={it.id}>
          <a
            href={`#${it.id}`}
            aria-current={activeId === it.id ? "true" : undefined}
            className={cn(
              "block border-l-2 border-transparent pl-3 text-muted-foreground transition-colors hover:text-foreground",
              activeId === it.id && "border-accent font-medium text-foreground",
            )}
          >
            {it.heading}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <nav aria-label="On this page">
      {/* Mobile: collapsible box. */}
      <details className="rounded-lg border border-border p-3 lg:hidden" open>
        <summary className="cursor-pointer text-label font-medium text-foreground">
          On this page
        </summary>
        <div className="mt-3">{list}</div>
      </details>
      {/* Desktop: sticky sidebar. */}
      <div className="hidden lg:sticky lg:top-24 lg:block">
        <p className="mb-3 text-label font-medium text-muted-foreground">On this page</p>
        {list}
      </div>
    </nav>
  );
}

export default BuyersGuideToc;
