"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { siteSettingsInput } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TextField, TextareaField } from "@/components/admin/fields/form-fields";
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import {
  toSettingsPayload,
  type SettingsFormValues,
} from "@/components/admin/settings/serialize";

export function SettingsForm({ defaultValues }: { defaultValues: SettingsFormValues }) {
  const router = useRouter();
  const form = useForm<SettingsFormValues>({ defaultValues });
  const [saving, setSaving] = React.useState(false);

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
          <TextField name="siteName" label="Site name" placeholder="Payment Processor Guide" />
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

        {/*
          Homepage hero / featured categories moved to /admin/homepage, which edits
          them alongside the rest of the landing page. The values still round-trip
          through this form's payload (see `toSettingsPayload`) — `siteSettingsInput`
          requires them, and dropping them here would `$unset` the hero on every save.
        */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-h4">Landing page</h2>
            <p className="mt-0.5 text-small text-muted-foreground">
              Hero, sections, featured categories, and homepage meta are edited on their own
              page.
            </p>
          </div>
          <Link
            href="/admin/homepage"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Edit landing page
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        {/* Contact & social */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">Contact &amp; social</h2>
          <TextField
            name="contactEmail"
            label="Contact email"
            type="email"
            placeholder="hello@paymentprocessorguide.com"
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
            placeholder="© Payment Processor Guide. Sponsored placements are labeled."
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
