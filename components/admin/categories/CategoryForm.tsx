"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { Loader2 } from "lucide-react";
import { CATEGORY_TYPES } from "@/lib/enums";
import { categoryInput } from "@/lib/validators";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  EnumSelectField,
  SwitchField,
  TextField,
  TextareaField,
} from "@/components/admin/fields/form-fields";
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import { FaqField } from "@/components/admin/fields/FaqField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { BlockEditor } from "@/components/content/BlockEditor";
import { SeoPanel } from "@/components/content/SeoPanel";
import { StructuredDataPanel } from "@/components/content/StructuredDataPanel";
import type { EngineContext } from "@/lib/engine";
import {
  blankCategoryValues,
  toCategoryEnginePreview,
  toCategoryPayload,
  type CategoryFormValues,
} from "@/components/admin/categories/serialize";

export function CategoryForm({
  categoryId,
  defaultValues,
  engineCtx,
  savedSlug,
}: {
  categoryId?: string;
  defaultValues?: CategoryFormValues;
  /** Site identity for the schema preview — read from SiteSettings by the page. */
  engineCtx: EngineContext;
  savedSlug?: string;
}) {
  const router = useRouter();
  const form = useForm<CategoryFormValues>({
    defaultValues: defaultValues ?? blankCategoryValues(),
  });
  const [saving, setSaving] = React.useState(false);
  const watchedSlug = form.watch("slug") || savedSlug || "";

  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      form.setError(issue.path.join(".") as keyof CategoryFormValues, {
        type: "manual",
        message: issue.message,
      });
    }
  };

  const onSubmit = async () => {
    form.clearErrors();
    const payload = toCategoryPayload(form.getValues());
    const parsed = categoryInput.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      if (categoryId) {
        await apiClient.put(`/api/categories/${categoryId}`, parsed.data as Record<string, unknown>);
        toast.success("Category saved.");
      } else {
        await apiClient.post("/api/categories", parsed.data as Record<string, unknown>);
        toast.success("Category created.");
      }
      router.push("/admin/categories");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as keyof CategoryFormValues, { type: "manual", message: msg });
          }
        }
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <h1 className="text-h1 tracking-tighter2">
          {categoryId ? "Edit category" : "New category"}
        </h1>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <TextField name="name" label="Name" placeholder="E-commerce Payment Processors" />
          <TextField
            name="slug"
            label="Slug"
            placeholder="auto-generated from name"
            description="URL path: /category/your-slug. Leave blank to generate from the name."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <EnumSelectField
              name="type"
              label="Type"
              options={CATEGORY_TYPES}
              allowNone={false}
              description="Groups categories in the navigation mega-menu."
            />
            <TextField
              name="displayOrder"
              label="Display order"
              type="number"
              placeholder="0"
              description="Lower numbers appear first."
            />
          </div>
          <TextField
            name="icon"
            label="Icon"
            placeholder="lucide icon name (e.g. ShoppingCart) or image URL"
          />
          <TextareaField
            name="shortDescription"
            label="Short description"
            rows={2}
            placeholder="Card / hero subtitle."
          />
          <FormField
            control={form.control}
            name="introContent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Intro content</FormLabel>
                <FormDescription>SEO copy shown at the top of the category page.</FormDescription>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Write the category intro…"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SwitchField
            name="isPublished"
            label="Published"
            description="Visible in the directory and navigation when on."
          />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-h4">Page content</h2>
            <p className="mt-0.5 text-small text-muted-foreground">
              Compose this page from reusable blocks. While it&rsquo;s empty the category keeps
              showing its existing intro content — adding a block replaces it.
            </p>
          </div>
          <BlockEditor />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <SeoPanel
            titleField="name"
            descriptionField="shortDescription"
            path={`/category/${watchedSlug || "…"}`}
          />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">FAQs</h2>
          <FaqField />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <StructuredDataPanel
            contentType="category"
            ctx={engineCtx}
            toEntity={(values) =>
              toCategoryEnginePreview(values as unknown as CategoryFormValues, savedSlug)
            }
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/categories")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {categoryId ? "Save category" : "Create category"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default CategoryForm;
