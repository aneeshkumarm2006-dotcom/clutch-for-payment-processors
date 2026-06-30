"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/components/public/compare/CompareContext";

/**
 * Global compare bar (DESIGN §5.4 slide-in). Appears when ≥1 processor is
 * selected; the "Compare" CTA links to `/compare?ids=…` (the full matrix page is
 * built in M5). Rendered once in the public layout but only shown on the
 * `/compare` route so it doesn't overlay content pages (blog, articles, etc.).
 */
export function CompareBar() {
  const { items, remove, clear } = useCompare();
  const pathname = usePathname();

  const onComparePage = pathname === "/compare" || pathname.startsWith("/compare/");
  if (!onComparePage || items.length === 0) return null;

  const ids = items.map((i) => i.slug).join(",");
  const canCompare = items.length >= 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-content flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-pop",
          "duration-250 animate-in slide-in-from-bottom-4",
        )}
      >
        <span className="text-small font-medium text-foreground">
          Compare <span className="tabular-nums">({items.length})</span>
        </span>

        <ul className="flex flex-1 flex-wrap items-center gap-2">
          {items.map((item) => (
            <li
              key={item.slug}
              className="flex items-center gap-1.5 rounded border bg-ink-50 py-1 pl-1.5 pr-1 dark:bg-ink-900"
            >
              {item.logo ? (
                <Image
                  src={item.logo}
                  alt=""
                  width={18}
                  height={18}
                  className="size-[18px] rounded-sm object-contain"
                  unoptimized
                />
              ) : null}
              <span className="text-small text-ink-700 dark:text-ink-300">{item.name}</span>
              <button
                type="button"
                onClick={() => remove(item.slug)}
                aria-label={`Remove ${item.name} from compare`}
                className="rounded-sm p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700 dark:hover:bg-ink-800"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          <Button asChild={canCompare} variant="primary" size="sm" disabled={!canCompare}>
            {canCompare ? (
              <Link href={`/compare?ids=${ids}`}>Compare</Link>
            ) : (
              <span>Add 1 more</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CompareBar;
