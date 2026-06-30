import Link from "next/link";
import { Building2, Globe, Layers, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryData } from "@/lib/serialize";

/**
 * CategoryCard (DESIGN §4 category tiles). Icon + name + short description, links
 * to the category directory. lucide has no per-category glyph, so the icon is
 * chosen by the category `type` for a consistent monochrome look.
 */
const TYPE_ICONS: Record<string, LucideIcon> = {
  "use-case": Layers,
  industry: Building2,
  region: Globe,
  feature: Sparkles,
  "business-size": Users,
};

export function CategoryCard({ category, className }: { category: CategoryData; className?: string }) {
  const Icon = TYPE_ICONS[category.type] ?? Layers;
  return (
    <Link
      href={`/category/${category.slug}`}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-lg border bg-card p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded border bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-300">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h3 className="text-h4 text-foreground transition-colors group-hover:text-accent">
          {category.name}
        </h3>
        {category.shortDescription && (
          <p className="mt-1 line-clamp-2 text-small text-muted-foreground">
            {category.shortDescription}
          </p>
        )}
      </div>
    </Link>
  );
}

export default CategoryCard;
