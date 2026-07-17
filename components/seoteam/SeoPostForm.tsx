"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { CircleAlert, CircleCheck, ExternalLink, Loader2 } from "lucide-react";
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
import { MediaPickerDialog } from "@/components/seoteam/MediaPickerDialog";
import {
  UnsavedChangesGuard,
  type UnsavedChangesGuardHandle,
} from "@/components/UnsavedChangesGuard";
import { BlockEditor } from "@/components/content/BlockEditor";
import { SeoPanel } from "@/components/content/SeoPanel";
import { StructuredDataPanel } from "@/components/content/StructuredDataPanel";
import type { EngineContext } from "@/lib/engine";
import {
  blankSeoValues,
  toBlogEnginePreview,
  toSeoPayload,
  type SeoFormValues,
  type Visibility,
} from "@/components/seoteam/serialize";

const isBlankContent = (html: string | undefined) =>
  !html || html.trim() === "" || html === "<p></p>";

/** Debounce before an auto-save fires after the last edit. */
const AUTOSAVE_DELAY = 900;
/** Wait this long before retrying after a failed auto-save. */
const RETRY_DELAY = 5000;

/**
 * Serialize the form to the exact payload we persist, so we can cheaply tell
 * whether anything meaningful changed since the last save (whitespace-only or
 * incomplete-keyword-row edits that don't affect the payload are ignored).
 */
const serializeForCompare = (values: SeoFormValues) => JSON.stringify(toSeoPayload(values));

/** /seoteam post editor: pick a template → write → preview → set visibility → save. */
export function SeoPostForm({
  postId,
  defaultValues,
  engineCtx,
  savedSlug,
}: {
  postId?: string;
  defaultValues?: SeoFormValues;
  /** Site identity for the schema preview — read from SiteSettings by the page. */
  engineCtx: EngineContext;
  savedSlug?: string;
}) {
  const router = useRouter();
  const form = useForm<SeoFormValues>({
    defaultValues: defaultValues ?? blankSeoValues(),
  });
  // Post id lives in state so a brand-new post promotes to "existing" the moment
  // auto-save creates it (via POST). `idRef` mirrors it for use inside async
  // callbacks without a stale closure.
  const [id, setId] = React.useState<string | undefined>(postId);
  const idRef = React.useRef(id);
  idRef.current = id;

  // `saving` = an explicit Save/Publish click is in flight. Auto-save state is
  // tracked separately so the two indicators never fight.
  const [saving, setSaving] = React.useState(false);
  const [autoSaveState, setAutoSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  // Our own dirty flag: current form ≠ what's persisted. We don't rely on
  // react-hook-form's `isDirty` because auto-save clears it continuously.
  const [isDirty, setIsDirty] = React.useState(false);

  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = React.useRef(false); // an auto-save request is in flight
  const dirtyAgainRef = React.useRef(false); // edited again mid-save
  const lastSavedRef = React.useRef<string>(
    serializeForCompare(defaultValues ?? blankSeoValues()),
  );
  const runAutoSaveRef = React.useRef<() => Promise<void>>();
  const guardRef = React.useRef<UnsavedChangesGuardHandle>(null);
  const template = form.watch("template") as BlogTemplate;
  const visibility = form.watch("visibility") as Visibility;

  // Warn before leaving with edits that aren't persisted yet — a debounce still
  // pending, a save in flight, a failed save, or required fields still missing
  // so auto-save can't run. We drop the guard while an explicit Save/Publish is
  // navigating away.
  const hasUnsavedEdits = isDirty && !saving;

  // Shared "Choose from library" picker. Each field/editor passes the apply
  // callback that should receive the selected image.
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const applyRef = React.useRef<((img: { url: string; alt: string }) => void) | null>(null);
  const openPicker = React.useCallback(
    (apply: (img: { url: string; alt: string }) => void) => {
      applyRef.current = apply;
      setPickerOpen(true);
    },
    [],
  );
  const SEOTEAM_UPLOAD = "/api/seoteam/media";

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

  // Debounce an auto-save. Reads the run function through a ref so this callback
  // stays stable (the timer always invokes the latest closure).
  const scheduleAutoSave = React.useCallback((delay = AUTOSAVE_DELAY) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveTimer.current = null;
      void runAutoSaveRef.current?.();
    }, delay);
  }, []);

  // Persist the whole post. Creates the draft on first save (POST → captures the
  // new id), then updates in place (PUT). Published posts save live — the PUT
  // revalidates the public page, matching the site's existing behavior.
  const runAutoSave = React.useCallback(async () => {
    // Coalesce: if a save is already in flight, note that another is needed and
    // let the current one re-schedule when it settles.
    if (savingRef.current) {
      dirtyAgainRef.current = true;
      return;
    }
    const values = form.getValues();
    const parsed = seoBlogPostInput.safeParse(toSeoPayload(values));
    // Can't persist until the required fields (title, content, author) exist.
    // Stay silently "Unsaved" rather than nagging on every keystroke.
    if (!parsed.success) return;

    const snapshot = serializeForCompare(values);
    savingRef.current = true;
    setAutoSaveState("saving");
    try {
      if (idRef.current) {
        await apiClient.put(
          `/api/seoteam/posts/${idRef.current}`,
          parsed.data as Record<string, unknown>,
        );
      } else {
        const created = await apiClient.post<{ _id: string }>(
          "/api/seoteam/posts",
          parsed.data as Record<string, unknown>,
        );
        idRef.current = created._id;
        setId(created._id);
        // Reflect the new id in the URL so a refresh reopens this draft and the
        // full-preview link works — without a router navigation (no remount).
        window.history.replaceState(window.history.state, "", `/seoteam/${created._id}`);
      }
      lastSavedRef.current = snapshot;
      // The author may have typed during the request — recompute against the
      // latest values so we stay dirty (and re-save below) if so.
      setIsDirty(serializeForCompare(form.getValues()) !== lastSavedRef.current);
      setAutoSaveState("saved");
    } catch {
      setAutoSaveState("error");
      scheduleAutoSave(RETRY_DELAY);
    } finally {
      savingRef.current = false;
      if (dirtyAgainRef.current) {
        dirtyAgainRef.current = false;
        scheduleAutoSave(0);
      }
    }
  }, [form, scheduleAutoSave]);

  // Keep the ref pointed at the latest run function for the debounce timer.
  React.useEffect(() => {
    runAutoSaveRef.current = runAutoSave;
  }, [runAutoSave]);

  // Watch every field; whenever the serialized post changes, mark dirty and
  // (re)schedule a save. `watch(cb)` doesn't fire on mount, so loading a post
  // never triggers a spurious save.
  React.useEffect(() => {
    const sub = form.watch(() => {
      const dirty = serializeForCompare(form.getValues()) !== lastSavedRef.current;
      setIsDirty(dirty);
      if (dirty) {
        scheduleAutoSave();
      } else if (autoSaveTimer.current) {
        // Edited back to the saved state — cancel the pending save.
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    });
    return () => sub.unsubscribe();
  }, [form, scheduleAutoSave]);

  // Cancel any pending debounce on unmount.
  React.useEffect(
    () => () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    },
    [],
  );

  const onSubmit = async () => {
    // Cancel any pending auto-save so it doesn't race this explicit save.
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    form.clearErrors();
    const values = form.getValues();
    const parsed = seoBlogPostInput.safeParse(toSeoPayload(values));
    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      if (idRef.current) {
        await apiClient.put(
          `/api/seoteam/posts/${idRef.current}`,
          parsed.data as Record<string, unknown>,
        );
      } else {
        const created = await apiClient.post<{ _id: string }>(
          "/api/seoteam/posts",
          parsed.data as Record<string, unknown>,
        );
        idRef.current = created._id;
        setId(created._id);
      }
      lastSavedRef.current = serializeForCompare(values);
      setIsDirty(false);
      setAutoSaveState("saved");
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
            {autoSaveState === "saving" ? (
              <span className="inline-flex items-center gap-1.5 text-small text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </span>
            ) : autoSaveState === "error" ? (
              <span className="inline-flex items-center gap-1.5 text-small text-warning">
                <CircleAlert className="size-4" />
                Couldn&rsquo;t save — will retry
              </span>
            ) : isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-small text-muted-foreground">
                <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                Unsaved changes
              </span>
            ) : autoSaveState === "saved" ? (
              <span className="inline-flex items-center gap-1.5 text-small text-muted-foreground">
                <CircleCheck className="size-4 text-success" />
                Saved
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => guardRef.current?.confirmNavigation(() => router.push("/seoteam"))}
              disabled={saving}
            >
              Cancel
            </Button>
            {id ? (
              <Button asChild variant="secondary">
                <a href={`/seoteam/preview/${id}`} target="_blank" rel="noopener">
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {/* Editor column with Edit / Preview tabs */}
          <div className="min-w-0">
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
                            altId="coverImageAlt"
                            altValue={form.watch("coverImageAlt")}
                            onAltChange={(v) => form.setValue("coverImageAlt", v)}
                            altPlaceholder="Alt text — describe the cover image for SEO & accessibility"
                            uploadEndpoint={SEOTEAM_UPLOAD}
                            onPickFromLibrary={openPicker}
                            onImageCommitted={scheduleAutoSave}
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
                            imageUploadEndpoint={SEOTEAM_UPLOAD}
                            onPickImageFromLibrary={openPicker}
                            onImageChange={scheduleAutoSave}
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
                    <h2 className="text-h4">Content blocks</h2>
                    <p className="mt-0.5 text-small text-muted-foreground">
                      Optional sections rendered after the post body — an FAQ block also generates
                      FAQ rich-result schema for you.
                    </p>
                  </div>
                  <BlockEditor
                    uploadEndpoint={SEOTEAM_UPLOAD}
                    onPickFromLibrary={openPicker}
                  />
                </section>

                <section className="space-y-4 rounded-lg border border-border bg-card p-5">
                  <StructuredDataPanel
                    contentType="blogPost"
                    ctx={engineCtx}
                    toEntity={(values) =>
                      toBlogEnginePreview(values as unknown as SeoFormValues, savedSlug)
                    }
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
                  <SeoPanel
                    titleField="title"
                    descriptionField="excerpt"
                    imageField="coverImage"
                    path={`/blog/${form.watch("slug") || savedSlug || "…"}`}
                    uploadEndpoint={SEOTEAM_UPLOAD}
                    onPickFromLibrary={openPicker}
                  />
                </section>
              </TabsContent>

              <TabsContent value="preview">
                <PostPreview />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right rail: visibility + live SEO checks */}
          <div className="min-w-0 space-y-4 lg:sticky lg:top-20">
            <VisibilityCard />
            <SeoCheckPanel />
          </div>
        </div>
      </form>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(img) => {
          applyRef.current?.(img);
          applyRef.current = null;
        }}
      />

      <UnsavedChangesGuard ref={guardRef} enabled={hasUnsavedEdits} />
    </Form>
  );
}

export default SeoPostForm;
