"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky profile sub-nav with scrollspy (DESIGN §6.8). Highlights the section in
 * view and smooth-scrolls (respecting prefers-reduced-motion) on click. Sits just
 * below the sticky navbar; section ids must match `sections[].id`.
 */
export interface ProfileTabItem {
  id: string;
  label: string;
}

export function ProfileTabs({ sections }: { sections: ProfileTabItem[] }) {
  const [active, setActive] = React.useState(sections[0]?.id ?? "");

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Activate a section once its top passes under the sticky chrome.
      { rootMargin: "-120px 0px -65% 0px", threshold: [0, 1] },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  function handleClick(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const y = el.getBoundingClientRect().top + window.scrollY - 116;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  return (
    <div className="sticky top-16 z-30 border-y bg-card/90 backdrop-blur">
      <nav
        aria-label="Profile sections"
        className="no-scrollbar mx-auto flex max-w-content gap-1 overflow-x-auto px-4 lg:px-6"
      >
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => handleClick(e, s.id)}
            aria-current={active === s.id ? "true" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-small transition-colors",
              active === s.id
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100",
            )}
          >
            {s.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default ProfileTabs;
