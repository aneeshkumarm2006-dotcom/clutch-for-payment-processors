"use client";

import { GripVertical, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Repeatable single-line list (PRD §10.3 — pros / cons). Each row is an editable
 * text input with a remove button; "Add" appends a blank row. Controlled: keeps
 * empty rows while editing and the parent trims blanks on submit.
 */
export function RepeatableList({
  value,
  onChange,
  placeholder = "Add an item…",
  addLabel = "Add item",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const update = (idx: number, text: string) =>
    onChange(value.map((v, i) => (i === idx ? text : v)));
  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => onChange([...value, ""]);

  return (
    <div className="space-y-2">
      {value.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <GripVertical className="size-4 shrink-0 text-ink-300" aria-hidden />
          <Input
            value={item}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeAt(idx)}
            aria-label="Remove"
            className="size-9 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

export default RepeatableList;
