"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CategoryData } from "@/lib/serialize";

/**
 * Categories mega-menu (DESIGN §6.7). Multi-column popover grouped by category
 * `type` (use case · industry · region · …). Links go violet on hover.
 */
const TYPE_GROUPS: { type: string; label: string }[] = [
  { type: "use-case", label: "By use case" },
  { type: "industry", label: "By industry" },
  { type: "region", label: "By region" },
  { type: "feature", label: "By feature" },
  { type: "business-size", label: "By business size" },
];

export function MegaMenu({ categories }: { categories: CategoryData[] }) {
  const [open, setOpen] = React.useState(false);

  const groups = TYPE_GROUPS.map((g) => ({
    ...g,
    items: categories.filter((c) => c.type === g.type),
  })).filter((g) => g.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-small text-ink-700 transition-colors hover:text-foreground dark:text-ink-300"
        >
          Categories
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={12} className="w-[min(92vw,640px)] p-6">
        {groups.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.type}>
                <p className="text-label uppercase text-ink-500">{g.label}</p>
                <ul className="mt-2.5 space-y-1.5">
                  {g.items.slice(0, 6).map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/category/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="block text-small text-ink-700 transition-colors hover:text-accent dark:text-ink-300"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-muted-foreground">No categories published yet.</p>
        )}
        <div className="mt-5 border-t pt-4">
          <Link
            href="/processors"
            onClick={() => setOpen(false)}
            className="text-small font-medium text-accent hover:underline"
          >
            Browse all processors →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MegaMenu;
