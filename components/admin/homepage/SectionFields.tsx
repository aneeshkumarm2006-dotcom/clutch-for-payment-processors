"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOMEPAGE_DEFAULTS, HOME_SECTION_LABELS, type HomeSectionKey } from "@/lib/homepage";
import { HOME_ICON_KEYS, HOME_ICON_LABELS, homeIcon } from "@/lib/home-icons";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * Field groups shared by the landing-page editor's section cards.
 *
 * Every text input here is *optional*: its placeholder is the built-in default
 * from `HOMEPAGE_DEFAULTS`, and clearing the input restores that default rather
 * than blanking the page. `PlaceholderField` exists so that contract is written
 * once instead of at 30 call sites.
 */
export function PlaceholderField({
  name,
  label,
  placeholder,
  description,
  type = "text",
  className,
}: {
  name: string;
  label: string;
  /** The built-in default. Shown greyed so an editor can see what they'd inherit. */
  placeholder?: string;
  description?: string;
  type?: string;
  className?: string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Icon picker bound to a `HOME_ICONS` key, with the glyph rendered in each row. */
export function IconField({ name, label = "Icon" }: { name: string; label?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const Current = homeIcon(field.value as string | undefined);
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <span className="flex items-center gap-2">
                    <Current className="size-4 shrink-0 text-ink-500" aria-hidden />
                    <SelectValue placeholder="Choose an icon" />
                  </span>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {HOME_ICON_KEYS.map((key) => {
                  const Icon = homeIcon(key);
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {HOME_ICON_LABELS[key]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * A collapsible section card with a visibility switch in its header. The body
 * dims (but stays editable) when the section is switched off, so an editor can
 * still prepare copy for a section they haven't turned on yet.
 */
export function SectionCard({
  name,
  title,
  description,
  children,
}: {
  /** Path of the section's `enabled` boolean, e.g. "featured.enabled". */
  name: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { control } = useFormContext();
  const enabled = useWatch({ control, name }) as boolean | undefined;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 className="text-h4">{title}</h2>
          {description && <p className="mt-0.5 text-small text-muted-foreground">{description}</p>}
        </div>
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem className="flex shrink-0 items-center gap-2">
              <FormLabel className="cursor-pointer text-small text-muted-foreground">
                {field.value ? "Visible" : "Hidden"}
              </FormLabel>
              <FormControl>
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  aria-label={`Show the ${title} section`}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </header>
      <div className={cn("space-y-5 p-5", enabled === false && "opacity-60")}>{children}</div>
    </section>
  );
}

/** Eyebrow / heading / "see all" link / item count — the shape most sections share. */
export function SectionHeadingFields({
  name,
  defaults,
  limitLabel,
  limitDescription,
}: {
  name: HomeSectionKey;
  defaults: { eyebrow: string; title: string; actionLabel: string; actionHref: string; limit: number };
  /** Omit to hide the count input (sections with a fixed item set). */
  limitLabel?: string;
  limitDescription?: string;
}) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <PlaceholderField name={`${name}.eyebrow`} label="Eyebrow" placeholder={defaults.eyebrow} />
        <PlaceholderField name={`${name}.title`} label="Heading" placeholder={defaults.title} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <PlaceholderField
          name={`${name}.actionLabel`}
          label="Link label"
          placeholder={defaults.actionLabel || "No link"}
          description="Leave blank to hide the link beside the heading."
        />
        <PlaceholderField
          name={`${name}.actionHref`}
          label="Link target"
          placeholder={defaults.actionHref || "/processors"}
        />
      </div>
      {limitLabel && (
        <PlaceholderField
          name={`${name}.limit`}
          label={limitLabel}
          type="number"
          placeholder={String(defaults.limit)}
          description={limitDescription}
          className="max-w-[16rem]"
        />
      )}
    </>
  );
}

/** Move-up / move-down / remove controls shared by the repeatable row editors. */
export function RowControls({
  index,
  total,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label={`Move ${label} up`}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label={`Move ${label} down`}
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        onClick={() => onRemove(index)}
        aria-label={`Remove ${label}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick}>
      <Plus className="size-4" />
      {label}
    </Button>
  );
}

/**
 * Reorder list for the sections below the hero. Ordering and visibility are
 * separate concerns on purpose: hiding a section here would make its copy
 * unreachable, so the switch stays on the section's own card and this list only
 * moves things. The eye-off marker mirrors each section's current state.
 */
export function SectionOrderList({
  value,
  onChange,
  hidden,
}: {
  value: HomeSectionKey[];
  onChange: (next: HomeSectionKey[]) => void;
  hidden: Set<HomeSectionKey>;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <ol className="space-y-2">
      {value.map((key, i) => (
        <li
          key={key}
          className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
        >
          <GripVertical className="size-4 shrink-0 text-ink-300" aria-hidden />
          <span className="w-6 shrink-0 text-small tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="flex-1 text-small text-foreground">
            {HOME_SECTION_LABELS[key]}
            {hidden.has(key) && (
              <span className="ml-2 text-micro uppercase tracking-wide text-muted-foreground">
                hidden
              </span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              aria-label={`Move ${HOME_SECTION_LABELS[key]} up`}
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={i === value.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label={`Move ${HOME_SECTION_LABELS[key]} down`}
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export { HOMEPAGE_DEFAULTS };
