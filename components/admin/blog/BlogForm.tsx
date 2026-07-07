"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { Loader2 } from "lucide-react";
import type { BlogStatus } from "@/lib/enums";
import { blogPostInput } from "@/lib/validators";
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
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import { TagInput } from "@/components/admin/fields/TagInput";
import { CategoryMultiSelect } from "@/components/admin/fields/CategoryMultiSelect";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  blankBlogValues,
  toBlogPayload,
  type BlogFormValues,
} from "@/components/admin/blog/serialize";

/** Blog create/edit form (PRD §10.8). Save draft vs Publish set the status. */
export function BlogForm({
  postId,
  defaultValues,
  processorOptions,
}: {
  postId?: string;
  defaultValues?: BlogFormValues;
  processorOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const form = useForm<BlogFormValues>({
    defaultValues: defaultValues ?? blankBlogValues(),
  });
  const [saving, setSaving] = React.useState<BlogStatus | null>(null);

  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      form.setError(issue.path.join(".") as keyof BlogFormValues, {
        type: "manual",
        message: issue.message,
      });
    }
  };

  const onSubmit = async (status: BlogStatus) => {
    form.clearErrors();
    const payload = toBlogPayload(form.getValues(), status);
    const parsed = blogPostInput.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(status);
    try {
      if (postId) {
        await apiClient.put(`/api/blog/${postId}`, parsed.data as Record<string, unknown>);
        toast.success(status === "published" ? "Post published." : "Draft saved.");
      } else {
        await apiClient.post("/api/blog", parsed.data as Record<string, unknown>);
        toast.success(status === "published" ? "Post published." : "Draft created.");
      }
      router.push("/admin/blog");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as keyof BlogFormValues, { type: "manual", message: msg });
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

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
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
            placeholder="One- or two-line summary shown on cards and in search."
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
                    altId="coverImageAlt"
                    altValue={form.watch("coverImageAlt")}
                    onAltChange={(v) => form.setValue("coverImageAlt", v)}
                    altPlaceholder="Alt text — describe the cover image for SEO & accessibility"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
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
                    placeholder="Write the post…"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relatedProcessors"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Related processors</FormLabel>
                <FormDescription>
                  Shown as cards at the foot of the post and used for internal linking.
                </FormDescription>
                <FormControl>
                  <CategoryMultiSelect
                    options={processorOptions}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="Select processors…"
                    emptyText="No processors yet. Add one first."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-h4">SEO</h2>
          <TextField name="seo.metaTitle" label="Meta title" placeholder="Falls back to the title." />
          <TextareaField
            name="seo.metaDescription"
            label="Meta description"
            rows={2}
            placeholder="Falls back to the excerpt."
          />
          <FormField
            control={form.control}
            name="seo.ogImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OG image</FormLabel>
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
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/blog")}
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

export default BlogForm;
