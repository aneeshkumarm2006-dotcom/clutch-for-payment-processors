"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { toast } from "sonner";
import type { ZodError } from "zod";
import { Loader2, Star } from "lucide-react";
import {
  COMPANY_SIZES,
  CONTRACT_TYPES,
  FEATURES,
  INTEGRATIONS,
  LISTING_TIERS,
  PAYMENT_METHODS,
  PAYOUT_TIMES,
  PCI_LEVELS,
  PRICING_MODELS,
  REGIONS,
  SUB_RATING_KEYS,
} from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { processorInput, processorPublishInput } from "@/lib/validators";
import { formatRating } from "@/lib/utils";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  EnumSelectField,
  MultiSelectField,
  Section,
  SwitchField,
  TextField,
  TextareaField,
} from "@/components/admin/fields/form-fields";
import { TagInput } from "@/components/admin/fields/TagInput";
import { RepeatableList } from "@/components/admin/fields/RepeatableList";
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import { MultiImageField } from "@/components/admin/fields/MultiImageField";
import { FaqField } from "@/components/admin/fields/FaqField";
import {
  CategoryMultiSelect,
  type CategoryOption,
} from "@/components/admin/fields/CategoryMultiSelect";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  FEE_FIELDS,
  FIELD_TAB,
  blankProcessorValues,
  toProcessorPayload,
  type ProcessorFormValues,
} from "@/components/admin/processors/serialize";

const TABS = [
  { value: "basics", label: "Basics" },
  { value: "company", label: "Company" },
  { value: "pricing", label: "Pricing" },
  { value: "capabilities", label: "Capabilities" },
  { value: "editorial", label: "Editorial" },
  { value: "merchandising", label: "Merchandising" },
  { value: "seo", label: "SEO" },
] as const;

type FieldName = Path<ProcessorFormValues>;

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export interface ProcessorRatings {
  ratingAverage: number;
  ratingCount: number;
  subRatings: Record<string, number>;
}

export function ProcessorForm({
  processorId,
  defaultValues,
  categories,
  ratings,
}: {
  processorId?: string;
  defaultValues?: ProcessorFormValues;
  categories: CategoryOption[];
  ratings?: ProcessorRatings;
}) {
  const router = useRouter();
  const form = useForm<ProcessorFormValues>({
    defaultValues: defaultValues ?? blankProcessorValues(),
  });
  const [activeTab, setActiveTab] = React.useState<string>("basics");
  const [saving, setSaving] = React.useState<false | "draft" | "publish">(false);

  const persistedPublished = (defaultValues ?? blankProcessorValues()).isPublished;

  const applyZodIssues = (error: ZodError) => {
    let firstTab: string | null = null;
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      const top = String(issue.path[0] ?? "");
      form.setError(path as FieldName, { type: "manual", message: issue.message });
      if (!firstTab && FIELD_TAB[top]) firstTab = FIELD_TAB[top];
    }
    if (firstTab) setActiveTab(firstTab);
  };

  const submit = async (targetPublished: boolean, requireComplete: boolean) => {
    form.clearErrors();
    const payload = toProcessorPayload(form.getValues(), targetPublished);
    const schema = requireComplete ? processorPublishInput : processorInput;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      applyZodIssues(parsed.error);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(requireComplete ? "publish" : "draft");
    try {
      if (processorId) {
        // PUT = full replace, so clearing a field in the form actually clears it.
        await apiClient.put(`/api/processors/${processorId}`, parsed.data as Record<string, unknown>);
      } else {
        await apiClient.post("/api/processors", parsed.data as Record<string, unknown>);
      }
      toast.success(
        targetPublished
          ? "Processor published — it's live on the site."
          : processorId
            ? "Draft saved."
            : "Draft created.",
      );
      router.push("/admin/processors");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as FieldName, { type: "manual", message: msg });
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
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h1 tracking-tighter2">
              {processorId ? "Edit processor" : "New processor"}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-small text-muted-foreground">
              {persistedPublished ? (
                <Badge variant="success">Published</Badge>
              ) : (
                <Badge variant="warning">Draft</Badge>
              )}
              {processorId ? "Changes save when you click below." : "Fill the tabs, then save or publish."}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 1. Basics */}
          <TabsContent value="basics" className="space-y-5">
            <TextField name="name" label="Name" placeholder="Stripe" />
            <TextField
              name="slug"
              label="Slug"
              placeholder="auto-generated from name"
              description="URL path: /processor/your-slug. Leave blank to generate from the name."
            />
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
                      folder="logos"
                      aspect="square"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField name="website" label="Website" type="url" placeholder="https://stripe.com" />
              <TextField
                name="affiliateUrl"
                label="Affiliate URL"
                type="url"
                placeholder="https://… (optional)"
                description="If set, the public “Visit website” button uses this."
              />
            </div>
            <TextField
              name="tagline"
              label="Tagline"
              placeholder="Payments infrastructure for the internet"
              description="One line, ~120 characters."
            />
            <TextareaField
              name="shortDescription"
              label="Short description"
              rows={2}
              placeholder="~200 characters — shown on directory cards."
            />
            <FormField
              control={form.control}
              name="longDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Long description</FormLabel>
                  <FormDescription>Rendered as the profile “Overview”.</FormDescription>
                  <FormControl>
                    <RichTextEditor
                      value={(field.value as string) ?? ""}
                      onChange={field.onChange}
                      placeholder="Write the overview…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          {/* 2. Company */}
          <TabsContent value="company" className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField name="foundedYear" label="Founded year" type="number" placeholder="2010" />
              <TextField name="headquarters" label="Headquarters" placeholder="San Francisco, CA, USA" />
            </div>
            <EnumSelectField name="companySize" label="Company size" options={COMPANY_SIZES} />
            <MultiSelectField
              name="supportedRegions"
              label="Supported regions"
              options={REGIONS}
              columns={3}
              description="Drives the directory region filter."
            />
          </TabsContent>

          {/* 3. Pricing */}
          <TabsContent value="pricing" className="space-y-5">
            <MultiSelectField name="pricingModel" label="Pricing model" options={PRICING_MODELS} columns={2} />
            <TextField
              name="pricingSummary"
              label="Pricing summary"
              placeholder="2.9% + 30¢ online, no monthly fee"
            />
            <Section title="Fee table" description="Leave blank for fees that vary or don’t apply.">
              <div className="grid gap-4 sm:grid-cols-2">
                {FEE_FIELDS.map((fee) => (
                  <TextField
                    key={fee.key}
                    name={`fees.${fee.key}` as FieldName}
                    label={fee.label}
                    placeholder={fee.placeholder}
                  />
                ))}
              </div>
            </Section>
            <div className="grid gap-5 sm:grid-cols-3">
              <EnumSelectField name="contractType" label="Contract type" options={CONTRACT_TYPES} />
              <EnumSelectField
                name="freeTrial"
                label="Free trial"
                options={["true", "false"]}
                placeholder="Unspecified"
                getLabel={(v) => (v === "true" ? "Yes" : "No")}
              />
              <EnumSelectField name="payoutTime" label="Payout time" options={PAYOUT_TIMES} />
            </div>
          </TabsContent>

          {/* 4. Capabilities */}
          <TabsContent value="capabilities" className="space-y-6">
            <MultiSelectField
              name="paymentMethods"
              label="Payment methods"
              options={PAYMENT_METHODS}
              columns={3}
            />
            <MultiSelectField name="integrations" label="Integrations" options={INTEGRATIONS} columns={3} />
            <MultiSelectField name="features" label="Features" options={FEATURES} columns={3} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                name="currencies"
                label="Currencies"
                placeholder="135+ currencies"
                description="Free-text display string."
              />
              <EnumSelectField name="pciLevel" label="PCI level" options={PCI_LEVELS} />
            </div>
            <SwitchField
              name="highRiskFriendly"
              label="High-risk friendly"
              description="Surfaced as a directory toggle."
            />
          </TabsContent>

          {/* 5. Editorial */}
          <TabsContent value="editorial" className="space-y-6">
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categories</FormLabel>
                  <FormDescription>Where this processor appears in the directory.</FormDescription>
                  <FormControl>
                    <CategoryMultiSelect
                      options={categories}
                      value={(field.value as string[]) ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bestFor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Best for</FormLabel>
                    <FormControl>
                      <TagInput
                        value={(field.value as string[]) ?? []}
                        onChange={field.onChange}
                        placeholder="Startups, E-commerce…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industries"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industries</FormLabel>
                    <FormControl>
                      <TagInput
                        value={(field.value as string[]) ?? []}
                        onChange={field.onChange}
                        placeholder="Retail, SaaS, Restaurants…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pros"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pros</FormLabel>
                    <FormControl>
                      <RepeatableList
                        value={(field.value as string[]) ?? []}
                        onChange={field.onChange}
                        placeholder="A strength…"
                        addLabel="Add pro"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cons</FormLabel>
                    <FormControl>
                      <RepeatableList
                        value={(field.value as string[]) ?? []}
                        onChange={field.onChange}
                        placeholder="A drawback…"
                        addLabel="Add con"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="screenshots"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Screenshots</FormLabel>
                  <FormControl>
                    <MultiImageField
                      value={(field.value as string[]) ?? []}
                      onChange={field.onChange}
                      folder="screenshots"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TextField
              name="demoVideoUrl"
              label="Demo video URL"
              type="url"
              placeholder="https://… (optional)"
            />

            {/* Ratings — read-only (PRD §10.3); only editorScore is editable. */}
            <Section
              title="Ratings"
              description="Computed from approved reviews by lib/ratings.ts — not editable here."
            >
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <Star className="size-4 fill-star text-star" aria-hidden />
                  <span className="text-h3 tabular-nums">
                    {ratings ? formatRating(ratings.ratingAverage) : "—"}
                  </span>
                  <span className="text-small text-muted-foreground">
                    out of 5 · {ratings?.ratingCount ?? 0} approved{" "}
                    {ratings?.ratingCount === 1 ? "review" : "reviews"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {SUB_RATING_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between text-small">
                      <dt className="text-muted-foreground">{humanizeEnum(key)}</dt>
                      <dd className="tabular-nums text-foreground">
                        {ratings ? formatRating(ratings.subRatings[key]) : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <TextField
                name="editorScore"
                label="Editor score"
                type="number"
                placeholder="0–5"
                description="Manual editorial score (0–5). Factored into the recommended sort."
              />
            </Section>
          </TabsContent>

          {/* 6. Merchandising */}
          <TabsContent value="merchandising" className="space-y-5">
            <EnumSelectField
              name="listingTier"
              label="Listing tier"
              options={LISTING_TIERS}
              allowNone={false}
              description="premier > verified > free in the recommended sort."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SwitchField name="isVerified" label="Verified" description="Shows the verified badge." />
              <SwitchField name="isFeatured" label="Featured" description="Eligible for the homepage." />
              <SwitchField
                name="isSponsored"
                label="Sponsored"
                description="Pins to the top of listings."
              />
              <TextField
                name="sponsorRank"
                label="Sponsor rank"
                type="number"
                placeholder="1"
                description="Lower = higher among sponsors."
              />
            </div>
          </TabsContent>

          {/* 7. SEO */}
          <TabsContent value="seo" className="space-y-5">
            <TextField
              name="seo.metaTitle"
              label="Meta title"
              placeholder="Falls back to the processor name + tagline."
            />
            <TextareaField
              name="seo.metaDescription"
              label="Meta description"
              rows={2}
              placeholder="Falls back to the short description."
            />
            <TextField
              name="seo.keywords"
              label="Meta keywords"
              placeholder="e.g. stripe merchant services, stripe fees, stripe pricing"
              description="Comma-separated. Renders as <meta name=&quot;keywords&quot;>. Note: ignored by Google, used by some smaller engines/tools."
            />
            <FormField
              control={form.control}
              name="seo.ogImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OG image</FormLabel>
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
            <div className="border-t border-border pt-5">
              <FaqField />
            </div>
          </TabsContent>
        </Tabs>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/processors")}
            disabled={!!saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => submit(false, false)}
            disabled={!!saving}
          >
            {saving === "draft" && <Loader2 className="size-4 animate-spin" />}
            {persistedPublished ? "Unpublish & save" : "Save draft"}
          </Button>
          <Button
            type="button"
            variant={persistedPublished ? "primary" : "accent"}
            onClick={() => submit(true, true)}
            disabled={!!saving}
          >
            {saving === "publish" && <Loader2 className="size-4 animate-spin" />}
            {persistedPublished ? "Save changes" : "Publish"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default ProcessorForm;
