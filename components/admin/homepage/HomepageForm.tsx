"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { ExternalLink, Loader2 } from "lucide-react";
import { homepageInput, pageSeoUpdate } from "@/lib/validators";
import { HOMEPAGE_DEFAULTS, HOME_SECTION_KEYS, type HomeSectionKey } from "@/lib/homepage";
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
import { CheckboxGroup } from "@/components/admin/fields/CheckboxGroup";
import { FaqField } from "@/components/admin/fields/FaqField";
import { BlockEditor } from "@/components/content/BlockEditor";
import { SeoPanel } from "@/components/content/SeoPanel";
import { StructuredDataPanel } from "@/components/content/StructuredDataPanel";
import {
  UnsavedChangesGuard,
  type UnsavedChangesGuardHandle,
} from "@/components/UnsavedChangesGuard";
import type { EngineContext } from "@/lib/engine";
import { toPageEnginePreview } from "@/components/admin/page-seo/serialize";
import {
  AddRowButton,
  IconField,
  PlaceholderField,
  RowControls,
  SectionCard,
  SectionHeadingFields,
  SectionOrderList,
} from "@/components/admin/homepage/SectionFields";
import {
  toHomepagePayload,
  toHomepageSeoPayload,
  type HomepageFormValues,
} from "@/components/admin/homepage/serialize";

export interface CategoryOption {
  slug: string;
  name: string;
}

/**
 * The landing-page editor: hero, every section below it, their order, and the
 * page's meta/FAQ/schema — one form, one Save.
 *
 * It writes to TWO endpoints because the content lives in two records that
 * already existed: the layout/copy on the SiteSettings singleton
 * (`/api/settings/homepage`) and the meta/FAQ/blocks on the "home" PageSeo record
 * (`/api/page-seo/[id]`, the same one `/admin/page-seo` edits). Both are
 * validated up front so a failure in either leaves both untouched.
 *
 * Tab panels unmount when inactive — react-hook-form keeps their values
 * (`shouldUnregister` defaults to false), so edits survive tab switches. Don't
 * turn that option on.
 */
export function HomepageForm({
  defaultValues,
  categories,
  pageSeoId,
  engineCtx,
}: {
  defaultValues: HomepageFormValues;
  categories: CategoryOption[];
  /** ObjectId of the "home" PageSeo record — upserted by the page before render. */
  pageSeoId: string;
  engineCtx: EngineContext;
}) {
  const router = useRouter();
  const form = useForm<HomepageFormValues>({ defaultValues });
  const [saving, setSaving] = React.useState(false);
  const guardRef = React.useRef<UnsavedChangesGuardHandle>(null);

  const { isDirty } = form.formState;
  const hasUnsavedEdits = isDirty && !saving;

  const nameBySlug = React.useMemo(
    () => Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  const steps = useFieldArray({ control: form.control, name: "howItWorks.steps" });
  const cards = useFieldArray({ control: form.control, name: "ctaBand.cards" });

  // Drives the "hidden" markers on the order list.
  const enabledFlags = useWatch({
    control: form.control,
    name: HOME_SECTION_KEYS.map((k) => `${k}.enabled` as const) as never,
  }) as (boolean | undefined)[];
  const hiddenSections = React.useMemo(() => {
    const set = new Set<HomeSectionKey>();
    HOME_SECTION_KEYS.forEach((key, i) => {
      if (enabledFlags?.[i] === false) set.add(key);
    });
    return set;
  }, [enabledFlags]);

  /**
   * Zod paths from `homepageInput` are prefixed with `homepage.` (the payload
   * nests them); the form's field names are not. Strip it or every error lands on
   * a field that doesn't exist and the form looks valid while refusing to save.
   */
  const applyZodIssues = (error: ZodError) => {
    for (const issue of error.issues) {
      const path = issue.path.join(".").replace(/^homepage\./, "");
      form.setError(path as never, { type: "manual", message: issue.message });
    }
  };

  const onSubmit = async () => {
    form.clearErrors();
    const values = form.getValues();

    const content = homepageInput.safeParse(toHomepagePayload(values));
    const seo = pageSeoUpdate.safeParse(toHomepageSeoPayload(values));
    if (!content.success || !seo.success) {
      if (!content.success) applyZodIssues(content.error);
      if (!seo.success) applyZodIssues(seo.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.put("/api/settings/homepage", content.data as Record<string, unknown>);
      await apiClient.put(`/api/page-seo/${pageSeoId}`, seo.data as Record<string, unknown>);
      toast.success("Landing page saved.");
      // Re-baseline so the unsaved-changes guard stops firing on saved values.
      form.reset(values);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key.replace(/^homepage\./, "") as never, { type: "manual", message: msg });
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

  const d = HOMEPAGE_DEFAULTS;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h1 tracking-tighter2">Landing page</h1>
            <p className="mt-1 text-body text-muted-foreground">
              Everything on the homepage: hero, sections, their order, and the page&rsquo;s meta.
              Leave a field blank to fall back to its built-in default (shown greyed in the input).
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex shrink-0 items-center gap-1.5 text-small font-medium text-accent hover:underline"
          >
            View live page
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>

        <Tabs defaultValue="hero">
          <TabsList className="flex-wrap">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="order">Order</TabsTrigger>
            <TabsTrigger value="seo">SEO &amp; meta</TabsTrigger>
            <TabsTrigger value="content">FAQs &amp; content</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────── Hero ─────────────────────────── */}
          <TabsContent value="hero" className="space-y-6">
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 className="text-h4">Headline</h2>
              <PlaceholderField
                name="hero.eyebrow"
                label="Eyebrow"
                placeholder="None"
                description="Small label above the headline. Blank hides it."
              />
              <TextField
                name="homepageHeroTitle"
                label="Hero title"
                placeholder={d.hero.title}
                description="The page's H1. Required."
              />
              <TextareaField
                name="homepageHeroSubtitle"
                label="Hero subtitle"
                rows={2}
                placeholder={d.hero.subtitle}
              />
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 className="text-h4">Search box</h2>
              <SwitchField
                name="hero.searchEnabled"
                label="Show the search box"
                description="Submits to /search."
              />
              <PlaceholderField
                name="hero.searchPlaceholder"
                label="Placeholder text"
                placeholder={d.hero.searchPlaceholder}
              />
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 className="text-h4">Buttons</h2>
              <div className="space-y-4 rounded-lg border border-border p-4">
                <SwitchField
                  name="hero.primaryCtaEnabled"
                  label="Show the primary button"
                  description="Opens the “get matched” lead dialog. Leads are tagged source: home-hero."
                />
                <PlaceholderField
                  name="hero.primaryCtaLabel"
                  label="Primary button label"
                  placeholder={d.hero.primaryCtaLabel}
                />
              </div>
              <div className="space-y-4 rounded-lg border border-border p-4">
                <SwitchField name="hero.secondaryCtaEnabled" label="Show the secondary button" />
                <div className="grid gap-5 sm:grid-cols-2">
                  <PlaceholderField
                    name="hero.secondaryCtaLabel"
                    label="Secondary button label"
                    placeholder={d.hero.secondaryCtaLabel}
                  />
                  <PlaceholderField
                    name="hero.secondaryCtaHref"
                    label="Secondary button target"
                    placeholder={d.hero.secondaryCtaHref}
                    description="A path (/processors) or an on-page anchor (#how-it-works)."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 className="text-h4">Stat row</h2>
              <SwitchField
                name="hero.statsEnabled"
                label="Show the stat row"
                description="Counts are live from the database. A count of zero hides its own stat."
              />
              <div className="grid gap-5 sm:grid-cols-3">
                <PlaceholderField
                  name="hero.statProcessorsLabel"
                  label="Processors label"
                  placeholder={d.hero.statProcessorsLabel}
                />
                <PlaceholderField
                  name="hero.statReviewsLabel"
                  label="Reviews label"
                  placeholder={d.hero.statReviewsLabel}
                />
                <PlaceholderField
                  name="hero.statCategoriesLabel"
                  label="Categories label"
                  placeholder={d.hero.statCategoriesLabel}
                />
              </div>
            </section>
          </TabsContent>

          {/* ───────────────────────── Sections ───────────────────────── */}
          <TabsContent value="sections" className="space-y-6">
            <SectionCard
              name="categories.enabled"
              title="Popular categories"
              description="Category cards. Hidden automatically when no categories are published."
            >
              <SectionHeadingFields
                name="categories"
                defaults={d.categories}
                limitLabel="Cards to show"
                limitDescription="Featured categories first, then the rest in display order."
              />
              <FormField
                control={form.control}
                name="featuredCategorySlugs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Featured categories</FormLabel>
                    <FormDescription>
                      Pinned to the front of the grid, in the order shown here. The remaining
                      slots fill with the next published categories.
                    </FormDescription>
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
                          No categories yet. Create some first.
                        </p>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SectionCard>

            <SectionCard
              name="featured.enabled"
              title="Featured processors"
              description="Sponsored/featured processors. Hidden when none are marked featured."
            >
              <SectionHeadingFields
                name="featured"
                defaults={d.featured}
                limitLabel="Cards to show"
              />
            </SectionCard>

            <SectionCard name="howItWorks.enabled" title="How it works">
              <SectionHeadingFields name="howItWorks" defaults={d.howItWorks} />
              <div className="space-y-3">
                <FormLabel>Steps</FormLabel>
                {steps.fields.length === 0 && (
                  <p className="text-small text-muted-foreground">
                    No steps. The section renders its heading only.
                  </p>
                )}
                {steps.fields.map((row, i) => (
                  <div key={row.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-label uppercase text-ink-500">Step {i + 1}</span>
                      <RowControls
                        index={i}
                        total={steps.fields.length}
                        onMove={steps.move}
                        onRemove={steps.remove}
                        label={`step ${i + 1}`}
                      />
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-[12rem_1fr]">
                      <IconField name={`howItWorks.steps.${i}.icon`} />
                      <PlaceholderField
                        name={`howItWorks.steps.${i}.title`}
                        label="Title"
                        placeholder="Browse"
                      />
                    </div>
                    <div className="mt-4">
                      <TextareaField
                        name={`howItWorks.steps.${i}.body`}
                        label="Body"
                        rows={2}
                        placeholder="What happens at this step."
                      />
                    </div>
                  </div>
                ))}
                <AddRowButton
                  label="Add step"
                  onClick={() => steps.append({ icon: "check", title: "", body: "" })}
                />
              </div>
            </SectionCard>

            <SectionCard
              name="compare.enabled"
              title="Compare teaser"
              description="Auto-generated “A vs B” cards, paired from the top-rated processors."
            >
              <SectionHeadingFields
                name="compare"
                defaults={d.compare}
                limitLabel="Pairs to show"
                limitDescription="Each pair uses two processors, so this pulls twice as many."
              />
            </SectionCard>

            <SectionCard
              name="blog.enabled"
              title="From the blog"
              description="Most recent published posts. Hidden when there are none."
            >
              <SectionHeadingFields name="blog" defaults={d.blog} limitLabel="Posts to show" />
            </SectionCard>

            <SectionCard
              name="content.enabled"
              title="Custom content blocks"
              description="Renders the blocks you build on the “FAQs & content” tab."
            >
              <PlaceholderField
                name="content.title"
                label="Heading"
                placeholder="None"
                description="Optional heading above the blocks. Blank renders the blocks alone."
              />
            </SectionCard>

            <SectionCard name="ctaBand.enabled" title="Call-to-action band">
              <div className="space-y-3">
                {cards.fields.length === 0 && (
                  <p className="text-small text-muted-foreground">
                    No cards. The band renders nothing.
                  </p>
                )}
                {cards.fields.map((row, i) => (
                  <div key={row.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-label uppercase text-ink-500">Card {i + 1}</span>
                      <RowControls
                        index={i}
                        total={cards.fields.length}
                        onMove={cards.move}
                        onRemove={cards.remove}
                        label={`card ${i + 1}`}
                      />
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-[12rem_1fr]">
                      <IconField name={`ctaBand.cards.${i}.icon`} />
                      <PlaceholderField
                        name={`ctaBand.cards.${i}.title`}
                        label="Title"
                        placeholder="Used a processor? Write a review"
                      />
                    </div>
                    <div className="mt-4">
                      <TextareaField
                        name={`ctaBand.cards.${i}.body`}
                        label="Body"
                        rows={2}
                        placeholder="One or two lines of supporting copy."
                      />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <PlaceholderField
                        name={`ctaBand.cards.${i}.cta`}
                        label="Button label"
                        placeholder="Write a review"
                      />
                      <PlaceholderField
                        name={`ctaBand.cards.${i}.href`}
                        label="Button target"
                        placeholder="/write-review"
                      />
                    </div>
                  </div>
                ))}
                <AddRowButton
                  label="Add card"
                  onClick={() =>
                    cards.append({ icon: "sparkles", title: "", body: "", href: "", cta: "" })
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              name="faq.enabled"
              title="FAQs"
              description="Renders the Q&As from the “FAQs & content” tab, plus their FAQPage schema."
            >
              <PlaceholderField name="faq.title" label="Heading" placeholder={d.faq.title} />
            </SectionCard>
          </TabsContent>

          {/* ────────────────────────── Order ────────────────────────── */}
          <TabsContent value="order">
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <div>
                <h2 className="text-h4">Section order</h2>
                <p className="mt-0.5 text-small text-muted-foreground">
                  The order sections render in, below the hero. Use each section&rsquo;s own
                  switch on the Sections tab to hide it.
                </p>
              </div>
              <FormField
                control={form.control}
                name="sectionOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <SectionOrderList
                        value={(field.value as HomeSectionKey[]) ?? [...HOME_SECTION_KEYS]}
                        onChange={field.onChange}
                        hidden={hiddenSections}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </TabsContent>

          {/* ─────────────────────────── SEO ─────────────────────────── */}
          <TabsContent value="seo">
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <SeoPanel
                path="/"
                titleField="homepageHeroTitle"
                descriptionField="homepageHeroSubtitle"
              />
            </section>
          </TabsContent>

          {/* ──────────────────── FAQs & content blocks ──────────────── */}
          <TabsContent value="content" className="space-y-6">
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <FaqField description="Rendered in the FAQs section and emitted as FAQ rich-result schema. Hiding the section on the Sections tab removes the schema too, because Google only accepts FAQ markup for Q&As the visitor can see." />
            </section>
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <div>
                <h2 className="text-h4">Content blocks</h2>
                <p className="mt-0.5 text-small text-muted-foreground">
                  Free-form sections rendered wherever &ldquo;Custom content blocks&rdquo; sits in
                  the order.
                </p>
              </div>
              <BlockEditor />
            </section>
          </TabsContent>

          {/* ───────────────────────── Schema ────────────────────────── */}
          <TabsContent value="schema">
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <StructuredDataPanel
                contentType="page"
                ctx={engineCtx}
                toEntity={(values) => {
                  // Only the PageSeo half of this form feeds the schema engine;
                  // the hero/section copy isn't part of the "page" content type.
                  const { seo, faqs, blocks, structuredData } =
                    values as unknown as HomepageFormValues;
                  return toPageEnginePreview(
                    { seo, faqs, blocks, structuredData },
                    { title: "Homepage", path: "/" },
                  );
                }}
              />
            </section>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save landing page
          </Button>
        </div>
      </form>

      <UnsavedChangesGuard ref={guardRef} enabled={hasUnsavedEdits} />
    </Form>
  );
}

export default HomepageForm;
