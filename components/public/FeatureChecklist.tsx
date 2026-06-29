import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grouped capability checklist (DESIGN §6.x / PRD §9.3 Features). A titled list
 * of supported items, each with a violet check (✓ = supported). Renders nothing
 * when empty so profile sections collapse gracefully.
 */
export function FeatureChecklist({
  title,
  items,
  className,
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={className}>
      <h3 className="text-label uppercase text-ink-500">{title}</h3>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map((label) => (
          <li
            key={label}
            className={cn(
              "flex items-start gap-2 text-body text-ink-800 dark:text-ink-200",
            )}
          >
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FeatureChecklist;
