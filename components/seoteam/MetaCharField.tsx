"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * A meta title / description field with a live character counter that turns
 * amber when the value is outside the ideal SEO range (and green when in range).
 * Non-technical authors get instant feedback without touching code.
 */
export function MetaCharField({
  name,
  label,
  placeholder,
  description,
  min,
  max,
  multiline = false,
  rows = 3,
}: {
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  min: number;
  max: number;
  multiline?: boolean;
  rows?: number;
}) {
  const { control } = useFormContext();
  const value = useWatch({ control, name }) as string | undefined;
  const len = (value ?? "").length;
  const tone =
    len === 0
      ? "text-muted-foreground"
      : len < min || len > max
        ? "text-warning"
        : "text-success";

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>{label}</FormLabel>
            <span className={cn("text-micro tabular-nums", tone)}>
              {len} · ideal {min}–{max}
            </span>
          </div>
          <FormControl>
            {multiline ? (
              <Textarea
                rows={rows}
                placeholder={placeholder}
                {...field}
                value={field.value ?? ""}
              />
            ) : (
              <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default MetaCharField;
