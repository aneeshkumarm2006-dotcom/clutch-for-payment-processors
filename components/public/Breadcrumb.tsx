import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  href?: string;
}

/** Breadcrumb trail (PRD §13 / DESIGN §9). Last crumb is the current page. */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-small text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.name}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.name}
                </Link>
              ) : (
                <span className={cn(last && "text-foreground")} aria-current={last ? "page" : undefined}>
                  {item.name}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 text-ink-400" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
