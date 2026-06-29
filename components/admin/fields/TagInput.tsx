"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Free-form tag input (DESIGN §6.11 neutral chips). Used for `bestFor`,
 * `industries`, `tags`, `featuredCategorySlugs`. Enter or comma commits a tag;
 * Backspace on an empty field removes the last one. Controlled.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter…",
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    // Case-insensitive de-dupe.
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      removeAt(value.length - 1);
    }
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              className="inline-flex items-center gap-1 rounded-sm bg-ink-100 py-0.5 pl-2 pr-1 text-small text-ink-700 dark:bg-ink-800 dark:text-ink-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label={`Remove ${tag}`}
                className="rounded-sm p-0.5 text-ink-500 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={placeholder}
        className={cn(value.length === 0 && "")}
      />
    </div>
  );
}

export default TagInput;
