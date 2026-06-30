"use client";

import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { KEYWORD_RELS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Keyword backlinks manager. Each row is a keyword, the URL it should link to,
 * and a `rel` (dofollow / nofollow / sponsored). On the published post, the SEO
 * engine turns occurrences of each keyword in the body into a link to its URL.
 * This shows the whole list in one place so the team manages a post's backlinks
 * together. Rows missing a keyword or URL are skipped on save.
 */
export function KeywordLinksField() {
  const { control, register, formState } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: "keywords" });
  const errors = (formState.errors.keywords ?? []) as Array<
    { keyword?: { message?: string }; url?: { message?: string } } | undefined
  >;

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-small text-muted-foreground">
          No keywords yet. Add a keyword and the URL it should link to.
        </p>
      )}

      {fields.map((f, i) => {
        const rowError = errors[i];
        return (
          <div
            key={f.id}
            className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-start"
          >
            <div>
              <Input
                placeholder="Keyword (e.g. payment gateway)"
                aria-label="Keyword"
                className={cn(rowError?.keyword && "border-destructive")}
                {...register(`keywords.${i}.keyword`)}
              />
              {rowError?.keyword?.message && (
                <p className="mt-1 text-micro text-destructive">{rowError.keyword.message}</p>
              )}
            </div>
            <div>
              <Input
                placeholder="https://target-url.com"
                inputMode="url"
                aria-label="Target URL"
                className={cn(rowError?.url && "border-destructive")}
                {...register(`keywords.${i}.url`)}
              />
              {rowError?.url?.message && (
                <p className="mt-1 text-micro text-destructive">{rowError.url.message}</p>
              )}
            </div>
            <Controller
              control={control}
              name={`keywords.${i}.rel`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Link rel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYWORD_RELS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label="Remove keyword"
              className="justify-self-end"
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => append({ keyword: "", url: "", rel: "dofollow" })}
      >
        <Plus className="size-4" />
        Add keyword
      </Button>
    </div>
  );
}

export default KeywordLinksField;
