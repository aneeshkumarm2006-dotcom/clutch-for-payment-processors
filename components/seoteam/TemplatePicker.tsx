"use client";

import { Check } from "lucide-react";
import type { BlogTemplate } from "@/lib/enums";
import { SEO_TEMPLATES } from "@/lib/seo-templates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Template picker for the SEO editor. Choosing a template sets the post's
 * `template` and (for a fresh post) pre-fills the editor with a payment-tailored
 * heading skeleton. The "Insert outline" button explicitly (re)applies the
 * outline to the editor.
 */
export function TemplatePicker({
  value,
  onSelect,
  onInsertOutline,
}: {
  value: BlogTemplate;
  /** Called with the chosen template id and whether the editor is currently empty. */
  onSelect: (id: BlogTemplate) => void;
  onInsertOutline: (id: BlogTemplate) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {SEO_TEMPLATES.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-pressed={active}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-accent bg-accent-subtle/40 ring-1 ring-accent"
                  : "border-border bg-card hover:border-border-strong",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-small font-semibold text-foreground">{t.label}</span>
                {active && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
              </div>
              <p className="mt-1 text-micro text-muted-foreground">{t.description}</p>
            </button>
          );
        })}
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => onInsertOutline(value)}>
        Insert outline into the editor
      </Button>
    </div>
  );
}

export default TemplatePicker;
