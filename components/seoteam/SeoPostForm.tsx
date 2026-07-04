"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { ExternalLink, Loader2 } from "lucide-react";
import type { BlogTemplate } from "@/lib/enums";
import { seoBlogPostInput } from "@/lib/validators";
import { getSeoTemplate } from "@/lib/seo-templates";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { VisibilityCard } from "@/components/seoteam/VisibilityCard";
import { PostPreview } from "@/components/seoteam/PostPreview";
import { GoogleSnippetPreview } from "@/components/seoteam/GoogleSnippetPreview";
import {
  blankSeoValues,
  toSeoPayload,
  type SeoFormValues,
  type Visibility,
} from "@/components/seoteam/serialize";

const isBlankContent = (html: string | undefined) =>
  !html || html.trim() === "" || html === "<p></p>";

/** /seoteam post editor: pick a template → write → preview → set visibility → save. */
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
  const [saving, setSaving] = React.useState(false);
  const template = form.watch("template") as BlogTemplate;
  const visibility = form.watch("visibility") as Visibility;

  const saveLabel =
    visibility === "draft" ? "Save draft" : visibility === "scheduled" ? "Schedule" : "Publish";

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

  const onSubmit = async () => {
    form.clearErrors();
    const payload = toSeoPayload(form.getValues());
    const parsed = seoBlogPostInput.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      if (postId) {
        await apiClient.put(`/api/seoteam/posts/${postId}`, parsed.data as Record<string, unknown>);
      } else {
        await apiClient.post("/api/seoteam/posts", parsed.data as Record<string, unknown>);
      }
      const vis = form.getValues("visibility");
      toast.success(
        vis === "draft" ? "Draft saved." : vis === "scheduled" ? "Post scheduled." : "Post published.",
      );
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
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h1 tracking-tighter2">{postId ? "Edit post" : "New post"}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/seoteam")}
              disabled={saving}
            >
              Cancel
            </Button>
            {postId ? (
              <Button asChild variant="secondary">
                <a href={`/seoteam/preview/${postId}`} target="_blank" rel="noopener">
                  <ExternalLink className="size-4" />
                  Open full preview
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled
                title="Save a draft first to open the full preview"
              >
                <ExternalLink className="size-4" />
                Open full preview
              </Button>
            )}
            <Button type="button" variant="accent" onClick={() => void onSubmit()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saveLabel}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          {/* Editor column with Edit / Preview tabs */}
          <div>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-6">
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
                  <TextField
                    name="title"
                    label="Title"
                    placeholder="Flat-rate vs interchange-plus pricing"
                  />
                  <TextField
                    name="slug"
                    label="Slug (URL handle)"
                    placeholder="auto-generated from title"
                    description="URL path: /blog/your-slug. Leave blank to generate from the title."
                  />
                  <TextField name="author" label="Author" placeholder="Jane Doe" />
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
                            imageFolder="blog"
                          />
                        </FormControl>
                        <FormDescription>
                          Paste from Google Docs or Word — or click <span aria-hidden>&lt;&gt;</span> to
                          edit the raw HTML and drop in embed codes.
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
                  <h2 className="text-h4">Search engine listing</h2>
                  <GoogleSnippetPreview />
                  <MetaCharField
                    name="seo.metaTitle"
                    label="Page title"
                    min={50}
                    max={60}
                    placeholder="Falls back to the post title."
                    description="Shown as the search-result title. Over ~70 chars may be truncated by Google."
                  />
                  <MetaCharField
                    name="seo.metaDescription"
                    label="Meta description"
                    min={150}
                    max={160}
                    multiline
                    rows={3}
                    placeholder="Falls back to the excerpt."
                    description="Shown as the search-result snippet. Over ~320 chars may be truncated."
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
              </TabsContent>

              <TabsContent value="preview">
                <PostPreview />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right rail: visibility + live SEO checks */}
          <div className="space-y-4 lg:sticky lg:top-20">
            <VisibilityCard />
            <SeoCheckPanel />
          </div>
        </div>
      </form>
    </Form>
  );
}

export default SeoPostForm;
