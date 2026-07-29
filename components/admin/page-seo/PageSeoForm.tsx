"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { ExternalLink, Loader2 } from "lucide-react";
import { pageSeoUpdate } from "@/lib/validators";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FaqField } from "@/components/admin/fields/FaqField";
import { SwitchField, TextField, TextareaField } from "@/components/admin/fields/form-fields";
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
 * Editor for a single PageSeo record. What it shows depends on `kind`:
 *
 *   route   — the page exists in code, so only its SEO block, FAQs, blocks and
 *             schema overrides are editable. `pageKey`/`path` are identity.
 *   landing — the record IS the page, so it also owns the H1, the lede, the URL
 *             and whether the page is live at all, and it can be deleted.
 *
 * Everything is PUT to `/api/page-seo/[id]`, which enforces the same split
 * server-side — the form deciding what to render is a convenience, not the rule.
 */
export function PageSeoForm({
  pageId,
  title,
  path,
  kind = "route",
  defaultValues,
  engineCtx,
}: {
  pageId: string;
  title: string;
  path: string;
  kind?: "route" | "landing";
  defaultValues: PageSeoFormValues;
  engineCtx: EngineContext;
}) {
  const router = useRouter();
  const form = useForm<PageSeoFormValues>({ defaultValues });
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const isLanding = kind === "landing";
  // Watched so the SEO panel's preview and the "view page" link follow an edited
  // path/H1 instead of the values this form was mounted with.
  const livePath = form.watch("path") || path;
  const liveHeading = form.watch("heading") || title;

  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      form.setError(issue.path.join(".") as keyof PageSeoFormValues, {
        type: "manual",
        message: issue.message,
      });
    }
  };

  const onDelete = async () => {
    setSaving(true);
    try {
      await apiClient.delete(`/api/page-seo/${pageId}`);
      toast.success("Landing page deleted.");
      setConfirmDelete(false);
      router.push("/admin/page-seo");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete.");
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    form.clearErrors();
    const payload = toPageSeoPayload(form.getValues(), { isLanding });
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h1 tracking-tighter2">{title}</h1>
            <p className="mt-1 text-body text-muted-foreground">
              {isLanding ? "Landing page at " : "SEO for "}
              <code className="rounded bg-muted px-1 py-0.5 text-small">{livePath}</code>
            </p>
          </div>
          <Link
            href={livePath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-small font-medium text-accent hover:underline"
          >
            View page
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>

        {isLanding && (
          <div className="space-y-5 rounded-lg border border-border bg-card p-5">
            <div>
              <h2 className="text-h4">Page</h2>
              <p className="mt-0.5 text-small text-muted-foreground">
                This page is nothing but this record. The heading and lede render above the
                content blocks below.
              </p>
            </div>
            <TextField
              name="heading"
              label="Page heading (H1)"
              placeholder="eCommerce POS Reviews USA: Best Systems for U.S. Retailers"
              description="The visible headline. Keep it separate from the SEO title, which is written for the search result."
            />
            <TextareaField
              name="subheading"
              label="Lede"
              rows={3}
              description="One short paragraph under the H1. Plain text."
            />
            <TextField
              name="path"
              label="URL path"
              placeholder="/ecommerce-pos-reviews-usa"
              description="One lowercase slug segment. Changing this changes the live URL and leaves no redirect behind."
            />
            <SwitchField
              name="isPublished"
              label="Published"
              description="Unpublished pages 404 and stay out of the sitemap."
            />
          </div>
        )}

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          {/* A `route` record's page is code and never consults `redirectTo`, and
              only the landing route emits hreflang — so neither control is shown
              where it would silently do nothing. */}
          <SeoPanel
            path={livePath}
            fallbackTitle={isLanding ? liveHeading : title}
            showRedirect={isLanding}
            showLocaleVariants={isLanding}
          />
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
              toPageEnginePreview(values as unknown as PageSeoFormValues, {
                title: isLanding ? liveHeading : title,
                path: livePath,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {isLanding ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              Delete page
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
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
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this landing page?</DialogTitle>
            <DialogDescription>
              {livePath} stops resolving and starts returning 404. Its heading, blocks, FAQs and
              SEO copy are deleted with it. To take the page down without losing the content,
              switch Published off instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void onDelete()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}

export default PageSeoForm;
