"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * Repeatable Q&A editor bound to a `faqs` array field (react-hook-form
 * `useFieldArray`). Shared by the Category, Processor, and PageSeo forms. Empty
 * rows are dropped by the `faqsSchema` validator, so a trailing blank is fine.
 */
export function FaqField({
  name = "faqs",
  label = "FAQs",
  description = "Shown as a visible FAQ section on the page and emitted as FAQ rich-result schema.",
}: {
  name?: string;
  label?: string;
  description?: string;
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormDescription>{description}</FormDescription>

      <div className="space-y-3">
        {fields.length === 0 && (
          <p className="text-small text-muted-foreground">No FAQs yet.</p>
        )}
        {fields.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-micro font-medium text-muted-foreground">Q{index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                aria-label={`Remove FAQ ${index + 1}`}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <FormField
              control={control}
              name={`${name}.${index}.question`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Question" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${index}.answer`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea rows={3} placeholder="Answer" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => append({ question: "", answer: "" })}
        className="mt-1"
      >
        <Plus className="size-4" />
        Add FAQ
      </Button>
    </FormItem>
  );
}

export default FaqField;
