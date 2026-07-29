"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { pageSeoCreate } from "@/lib/validators";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SwitchField, TextField, TextareaField } from "@/components/admin/fields/form-fields";

interface NewLandingValues {
  title: string;
  path: string;
  heading: string;
  subheading: string;
  isPublished: boolean;
}

/**
 * Create a standalone landing page. Deliberately minimal: this only mints the
 * record and its URL, then hands off to the full editor, where SEO, FAQs and
 * content blocks live. Asking for all of that up front would mean a long form
 * that can fail at the very end on a taken path.
 *
 * Defaults to unpublished so a half-built page can't be found while it's being
 * written.
 */
export function NewLandingPageForm() {
  const router = useRouter();
  const form = useForm<NewLandingValues>({
    defaultValues: { title: "", path: "", heading: "", subheading: "", isPublished: false },
  });
  const [saving, setSaving] = React.useState(false);

  const onSubmit = async () => {
    form.clearErrors();
    const values = form.getValues();
    const parsed = pageSeoCreate.safeParse({
      title: values.title,
      path: values.path,
      heading: values.heading.trim() || undefined,
      subheading: values.subheading.trim() || undefined,
      isPublished: values.isPublished,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        form.setError(issue.path.join(".") as keyof NewLandingValues, {
          type: "manual",
          message: issue.message,
        });
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const doc = await apiClient.post<{ _id: string }>("/api/page-seo", parsed.data);
      toast.success("Landing page created. Add its content and SEO below.");
      router.push(`/admin/page-seo/${doc._id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        for (const [key, msgs] of Object.entries(err.fieldErrors ?? {})) {
          const msg = msgs[0];
          if (msg) form.setError(key as keyof NewLandingValues, { type: "manual", message: msg });
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
        <div>
          <h1 className="text-h1 tracking-tighter2">New landing page</h1>
          <p className="mt-1 text-body text-muted-foreground">
            A standalone page served straight from this record. No deploy needed.
          </p>
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <TextField
            name="title"
            label="Internal title"
            placeholder="eCommerce POS Reviews USA"
            description="How this page is labelled in the admin and in its breadcrumb."
          />
          <TextField
            name="path"
            label="URL path"
            placeholder="/ecommerce-pos-reviews-usa"
            description="One lowercase slug segment. This becomes the live URL."
          />
          <TextField
            name="heading"
            label="Page heading (H1)"
            placeholder="eCommerce POS Reviews USA: Best Systems for U.S. Retailers"
            description="Optional. Falls back to the internal title."
          />
          <TextareaField
            name="subheading"
            label="Lede"
            rows={3}
            description="Optional. One short paragraph under the H1."
          />
          <SwitchField
            name="isPublished"
            label="Published"
            description="Leave off until the content is written. Unpublished pages 404 and stay out of the sitemap."
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/page-seo")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default NewLandingPageForm;
