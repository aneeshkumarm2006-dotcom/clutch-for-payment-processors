"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { Loader2 } from "lucide-react";
import { pageSeoUpdate } from "@/lib/validators";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FaqField } from "@/components/admin/fields/FaqField";
import { BlockEditor } from "@/components/content/BlockEditor";
import { SeoPanel } from "@/components/content/SeoPanel";
import { StructuredDataPanel } from "@/components/content/StructuredDataPanel";
import type { EngineContext } from "@/lib/engine";
import {
  toPageEnginePreview,
  toPageSeoPayload,
  type PageSeoFormValues,
} from "@/components/admin/page-seo/serialize";

/**
 * Editor for a single static-page SEO record. `pageKey`/`path` are identity
 * fields (read-only here); the SEO block, FAQs, blocks and schema overrides are
 * editable and PUT to `/api/page-seo/[id]`.
 */
export function PageSeoForm({
  pageId,
  title,
  path,
  defaultValues,
  engineCtx,
}: {
  pageId: string;
  title: string;
  path: string;
  defaultValues: PageSeoFormValues;
  engineCtx: EngineContext;
}) {
  const router = useRouter();
  const form = useForm<PageSeoFormValues>({ defaultValues });
  const [saving, setSaving] = React.useState(false);

  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      form.setError(issue.path.join(".") as keyof PageSeoFormValues, {
        type: "manual",
        message: issue.message,
      });
    }
  };

  const onSubmit = async () => {
    form.clearErrors();
    const payload = toPageSeoPayload(form.getValues());
    const parsed = pageSeoUpdate.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.put(`/api/page-seo/${pageId}`, parsed.data as Record<string, unknown>);
      toast.success("Page SEO saved.");
      router.push("/admin/page-seo");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as keyof PageSeoFormValues, { type: "manual", message: msg });
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
        <div>
          <h1 className="text-h1 tracking-tighter2">{title}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            SEO for <code className="rounded bg-muted px-1 py-0.5 text-small">{path}</code>
          </p>
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <SeoPanel path={path} fallbackTitle={title} />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">FAQs</h2>
          <FaqField />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-h4">Page content</h2>
            <p className="mt-0.5 text-small text-muted-foreground">
              Optional blocks rendered in this page&rsquo;s editorial slot, below its built-in
              sections.
            </p>
          </div>
          <BlockEditor />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <StructuredDataPanel
            contentType="page"
            ctx={engineCtx}
            toEntity={(values) =>
              toPageEnginePreview(values as unknown as PageSeoFormValues, { title, path })
            }
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
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default PageSeoForm;
