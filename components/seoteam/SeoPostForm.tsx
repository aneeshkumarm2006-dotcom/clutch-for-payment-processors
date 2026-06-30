"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { Loader2 } from "lucide-react";
import type { BlogStatus, BlogTemplate } from "@/lib/enums";
import { seoBlogPostInput } from "@/lib/validators";
import { getSeoTemplate } from "@/lib/seo-templates";
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
import { TextField, TextareaField, SwitchField } from "@/components/admin/fields/form-fields";
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import { TagInput } from "@/components/admin/fields/TagInput";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { MetaCharField } from "@/components/seoteam/MetaCharField";
import { KeywordLinksField } from "@/components/seoteam/KeywordLinksField";
import { SeoCheckPanel } from "@/components/seoteam/SeoCheckPanel";
import { TemplatePicker } from "@/components/seoteam/TemplatePicker";
import {
  blankSeoValues,
  toSeoPayload,
  type SeoFormValues,
} from "@/components/seoteam/serialize";

const isBlankContent = (html: string | undefined) => !html || html.trim() === "" || html === "<p></p>";

/** /seoteam post editor: pick a template → write → add keyword backlinks → publish. */
export function SeoPostForm({
  postId,
  defaultValues,
}: {
  postId?: string;
  defaultValues?: SeoFormValues;
}) {
  const router = useRouter();
  const form = useForm<SeoFormValues>({
    defaultValues: defaultValues ?? blankSeoValues(),
  });
  const [saving, setSaving] = React.useState<BlogStatus | null>(null);
  const template = form.watch("template") as BlogTemplate;

  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      form.setError(issue.path.join(".") as keyof SeoFormValues, {
        type: "manual",
        message: issue.message,
      });
    }
  };

  const handleSelectTemplate = (id: BlogTemplate) => {
    form.setValue("template", id, { shouldDirty: true });
    // Pre-fill a fresh editor; never clobber content the author has started.
    if (isBlankContent(form.getValues("content"))) {
      const starter = getSeoTemplate(id)?.starterHtml ?? "";
      form.setValue("content", starter, { shouldDirty: true });
    }
  };

  const handleInsertOutline = (id: BlogTemplate) => {
    const starter = getSeoTemplate(id)?.starterHtml ?? "";
    form.setValue("content", starter, { shouldDirty: true });
    toast.success("Outline inserted into the editor.");
  };

  const onSubmit = async (status: BlogStatus) => {
    form.clearErrors();
    const payload = toSeoPayload(form.getValues(), status);
    const parsed = seoBlogPostInput.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(status);
    try {
      if (postId) {
        await apiClient.put(`/api/seoteam/posts/${postId}`, parsed.data as Record<string, unknown>);
        toast.success(status === "published" ? "Post published." : "Draft saved.");
      } else {
        await apiClient.post("/api/seoteam/posts", parsed.data as Record<string, unknown>);
        toast.success(status === "published" ? "Post published." : "Draft created.");
      }
      router.push("/seoteam");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as keyof SeoFormValues, { type: "manual", message: msg });
          }
        }
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <h1 className="text-h1 tracking-tighter2">{postId ? "Edit post" : "New post"}</h1>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          {/* Editor column */}
          <div className="space-y-6">
            <section className="space-y-3 rounded-lg border border-border bg-card p-5">
              <div>
                <h2 className="text-h4">Template</h2>
                <p className="mt-0.5 text-small text-muted-foreground">
                  Pick a structure to start from — it pre-fills the editor with a heading outline.
                </p>
              </div>
              <TemplatePicker
                value={template}
                onSelect={handleSelectTemplate}
                onInsertOutline={handleInsertOutline}
              />
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <TextField name="title" label="Title" placeholder="Flat-rate vs interchange-plus pricing" />
              <TextField
                name="slug"
                label="Slug"
                placeholder="auto-generated from title"
                description="URL path: /blog/your-slug. Leave blank to generate from the title."
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField name="author" label="Author" placeholder="Jane Doe" />
                <TextField
                  name="publishedAt"
                  label="Publish date"
                  type="date"
                  description="Defaults to today when you publish."
                />
              </div>
              <TextareaField
                name="excerpt"
                label="Excerpt"
                rows={2}
                placeholder="One- or two-line summary shown on cards and used as the meta description fallback."
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagInput value={field.value ?? []} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coverImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover image</FormLabel>
                    <FormControl>
                      <ImageUploadField
                        value={field.value || undefined}
                        onChange={(url) => field.onChange(url ?? "")}
                        folder="blog"
                        aspect="wide"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-3 rounded-lg border border-border bg-card p-5">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Write or paste your post…"
                      />
                    </FormControl>
                    <FormDescription>
                      Paste from Google Docs or Word — basic formatting is preserved.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4 rounded-lg border border-border bg-card p-5">
              <div>
                <h2 className="text-h4">Keyword backlinks</h2>
                <p className="mt-0.5 text-small text-muted-foreground">
                  Each keyword is turned into a link to its URL where it appears in the post.
                </p>
              </div>
              <KeywordLinksField />
              <SwitchField
                name="linkFirstOccurrenceOnly"
                label="Link first occurrence only"
                description="On (recommended): link the first time each keyword appears. Off: link every occurrence."
              />
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 className="text-h4">SEO</h2>
              <MetaCharField
                name="seo.metaTitle"
                label="Meta title"
                min={50}
                max={60}
                placeholder="Falls back to the post title."
                description="Shown as the search-result title."
              />
              <MetaCharField
                name="seo.metaDescription"
                label="Meta description"
                min={150}
                max={160}
                multiline
                rows={3}
                placeholder="Falls back to the excerpt."
                description="Shown as the search-result snippet."
              />
              <FormField
                control={form.control}
                name="seo.ogImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social share image</FormLabel>
                    <FormDescription>Defaults to the cover image when blank.</FormDescription>
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
          </div>

          {/* SEO checks rail */}
          <div className="lg:sticky lg:top-20">
            <SeoCheckPanel />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/seoteam")}
            disabled={saving !== null}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onSubmit("draft")}
            disabled={saving !== null}
          >
            {saving === "draft" && <Loader2 className="size-4 animate-spin" />}
            Save draft
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => void onSubmit("published")}
            disabled={saving !== null}
          >
            {saving === "published" && <Loader2 className="size-4 animate-spin" />}
            Publish
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default SeoPostForm;
