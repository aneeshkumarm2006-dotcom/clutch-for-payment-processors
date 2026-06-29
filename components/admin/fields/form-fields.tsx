"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { CheckboxGroup } from "@/components/admin/fields/CheckboxGroup";

/**
 * Generic react-hook-form field helpers shared by every admin form
 * (ProcessorForm, CategoryForm, SettingsForm). They read `control` from the
 * surrounding `<Form>` context, so callers only pass `name` + presentation.
 * Untyped field names keep them reusable across differently-shaped forms.
 */
const NONE = "__none__";

export function TextField({
  name,
  label,
  placeholder,
  description,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  type?: string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
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

export function TextareaField({
  name,
  label,
  placeholder,
  description,
  rows,
}: {
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  rows?: number;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea rows={rows} placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function EnumSelectField({
  name,
  label,
  options,
  placeholder = "Select…",
  allowNone = true,
  description,
  getLabel = humanizeEnum,
}: {
  name: string;
  label: string;
  options: readonly string[];
  placeholder?: string;
  allowNone?: boolean;
  description?: string;
  getLabel?: (v: string) => string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={(field.value as string) || undefined}
            onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {allowNone && (
                <SelectItem value={NONE} className="text-muted-foreground">
                  — None —
                </SelectItem>
              )}
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {getLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField({
  name,
  label,
  description,
}: {
  name: string;
  label: string;
  description?: string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <FormLabel className="cursor-pointer">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function MultiSelectField({
  name,
  label,
  options,
  columns,
  description,
}: {
  name: string;
  label: string;
  options: readonly string[];
  columns?: 1 | 2 | 3;
  description?: string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl>
            <CheckboxGroup
              options={options as string[]}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              columns={columns}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Section wrapper inside a form/tab. */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <div>
          <h3 className="text-h4 text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-small text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
