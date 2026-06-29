import type { LucideIcon } from "lucide-react";
import { methodIcon } from "@/lib/icon-maps";
import { humanizeEnum } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Payment-method glyph row (DESIGN §6.2 — up to ~5 monochrome icons + "+N").
 * Icons are de-duplicated by glyph (Visa/MC/Amex all share the card icon) so the
 * row stays clean; the full method list is exposed via `aria-label`.
 */
export function MethodIcons({
  methods,
  max = 5,
  size = 16,
  className,
}: {
  methods: string[];
  max?: number;
  size?: number;
  className?: string;
}) {
  if (!methods.length) return null;

  const seen = new Set<LucideIcon>();
  const unique: { key: string; Icon: LucideIcon }[] = [];
  for (const m of methods) {
    const Icon = methodIcon(m);
    if (!seen.has(Icon)) {
      seen.add(Icon);
      unique.push({ key: m, Icon });
    }
  }

  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;

  return (
    <div
      className={cn("flex items-center gap-1.5 text-ink-400", className)}
      aria-label={`Accepts ${methods.map(humanizeEnum).join(", ")}`}
    >
      {shown.map(({ key, Icon }) => (
        <Icon key={key} size={size} aria-hidden />
      ))}
      {extra > 0 && <span className="text-micro text-muted-foreground">+{extra}</span>}
    </div>
  );
}

export default MethodIcons;
