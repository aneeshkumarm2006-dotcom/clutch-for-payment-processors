"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { Loader2 } from "lucide-react";
import { siteSettingsInput } from "@/lib/validators";
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
import { TextField, TextareaField } from "@/components/admin/fields/form-fields";
import { CheckboxGroup } from "@/components/admin/fields/CheckboxGroup";
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import {
  toSettingsPayload,
  type SettingsFormValues,
} from "@/components/admin/settings/serialize";

export interface FeaturedCategoryOption {
  slug: string;
  name: string;
}

export function SettingsForm({
  defaultValues,
  categories,
}: {
  defaultValues: SettingsFormValues;
  categories: FeaturedCategoryOption[];
}) {
  const router = useRouter();
  const form = useForm<SettingsFormValues>({ defaultValues });
  const [saving, setSaving] = React.useState(false);

  const nameBySlug = React.useMemo(
    () => Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      form.setError(issue.path.join(".") as keyof SettingsFormValues, {
        type: "manual",
        message: issue.message,
      });
    }
  };

  const onSubmit = async () => {
    form.clearErrors();
    const payload = toSettingsPayload(form.getValues());
    const parsed = siteSettingsInput.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.put("/api/settings", parsed.data as Record<string, unknown>);
      toast.success("Settings saved.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as keyof SettingsFormValues, { type: "manual", message: msg });
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
        {/* Brand */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">Brand</h2>
          <TextField name="siteName" label="Site name" placeholder="PayCompare" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo</FormLabel>
                  <FormControl>
                    <ImageUploadField
                      value={field.value || undefined}
                      onChange={(url) => field.onChange(url ?? "")}
                      folder="brand"
                      aspect="wide"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TextField
              name="primaryColor"
              label="Primary color"
              placeholder="#6D28D9"
              description="Hex value. The design system defaults to violet."
            />
          </div>
        </section>

        {/* Homepage hero */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">Homepage hero</h2>
          <TextField
            name="homepageHeroTitle"
            label="Hero title"
            placeholder="Find the right payment processor"
          />
          <TextareaField
            name="homepageHeroSubtitle"
            label="Hero subtitle"
            rows={2}
            placeholder="Compare fees, features, and verified merchant reviews."
          />
          <FormField
            control={form.control}
            name="featuredCategorySlugs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Featured categories</FormLabel>
                <FormDescription>Highlighted on the homepage.</FormDescription>
                <FormControl>
                  {categories.length > 0 ? (
                    <CheckboxGroup
                      options={categories.map((c) => c.slug)}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      getLabel={(slug) => nameBySlug[slug] ?? slug}
                      columns={2}
                    />
                  ) : (
                    <p className="text-small text-muted-foreground">
                      No categories yet — create some first.
                    </p>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Contact & social */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">Contact &amp; social</h2>
          <TextField
            name="contactEmail"
            label="Contact email"
            type="email"
            placeholder="hello@paycompare.com"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="socialLinks.twitter" label="Twitter / X" type="url" placeholder="https://x.com/…" />
            <TextField name="socialLinks.linkedin" label="LinkedIn" type="url" placeholder="https://linkedin.com/…" />
            <TextField name="socialLinks.facebook" label="Facebook" type="url" placeholder="https://facebook.com/…" />
            <TextField name="socialLinks.instagram" label="Instagram" type="url" placeholder="https://instagram.com/…" />
          </div>
          <TextareaField
            name="footerText"
            label="Footer text"
            rows={2}
            placeholder="© PayCompare. Sponsored placements are labeled."
          />
        </section>

        {/* Default SEO */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">Default SEO</h2>
          <TextField
            name="defaultSeo.metaTitle"
            label="Default meta title"
            placeholder="Used when a page has no title of its own."
          />
          <TextareaField
            name="defaultSeo.metaDescription"
            label="Default meta description"
            rows={2}
          />
          <FormField
            control={form.control}
            name="defaultSeo.ogImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default OG image</FormLabel>
                <FormControl>
                  <ImageUploadField
                    value={field.value || undefined}
                    onChange={(url) => field.onChange(url ?? "")}
                    folder="og"
                    aspect="wide"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default SettingsForm;
