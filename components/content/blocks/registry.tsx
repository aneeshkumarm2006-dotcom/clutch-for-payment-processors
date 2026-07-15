"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  AlignLeft,
  BookOpen,
  Code2,
  Columns3,
  Grid2x2,
  Image as ImageIcon,
  ListChecks,
  MessageCircleQuestion,
  Megaphone,
  Plus,
  Trash2,
} from "lucide-react";
import type { BlockType } from "@/lib/validators/blocks";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { TagInput } from "@/components/admin/fields/TagInput";
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";
import { EnumSelectField, SwitchField } from "@/components/admin/fields/form-fields";

/**
 * Block registry — the extensibility seam for modular content.
 *
 * Adding a block type is a three-step change and touches nothing else:
 *   1. a member in the zod union   (`lib/validators/blocks.ts`)
 *   2. an entry here               (label, icon, blank value, edit form)
 *   3. a case in the renderer      (`components/public/Blocks.tsx`)
 *
 * `blank()` must return a value that the zod member will accept once filled in —
 * it seeds a brand-new block, so its shape has to match or the first save fails
 * with errors on fields the editor never saw.
 */

/** `name` is the RHF path to THIS block, e.g. `blocks.3`. Fields hang off `${name}.data`. */
export interface BlockEditProps {
  name: string;
  /** Upload endpoint — differs between /admin and /seoteam. */
  uploadEndpoint?: string;
  onPickFromLibrary?: (apply: (img: { url: string; alt: string }) => void) => void;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** True when this block emits structured data — surfaced in the picker. */
  schema?: string;
  blank: () => Record<string, unknown>;
  Edit: React.ComponentType<BlockEditProps>;
}

// --- shared bits ------------------------------------------------------------

function Field({
  name,
  label,
  placeholder,
  rows,
}: {
  name: string;
  label?: string;
  placeholder?: string;
  rows?: number;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label ? <FormLabel>{label}</FormLabel> : null}
          <FormControl>
            {rows ? (
              <Textarea rows={rows} placeholder={placeholder} {...field} value={field.value ?? ""} />
            ) : (
              <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** A repeating sub-list inside a block (FAQ rows, comparison rows, features). */
function Rows({
  name,
  addLabel,
  blank,
  children,
}: {
  name: string;
  addLabel: string;
  blank: () => Record<string, unknown>;
  children: (rowName: string, index: number) => React.ReactNode;
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="space-y-2">
      {fields.map((item, index) => (
        // `item.id` — RHF's stable key. NOT the array index: reordering or removing
        // a row re-renders the list, and an index key would remount the inputs.
        <div key={item.id} className="rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-micro font-medium text-muted-foreground">#{index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              aria-label={`Remove row ${index + 1}`}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="space-y-2">{children(`${name}.${index}`, index)}</div>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => append(blank())}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

// --- the eight blocks -------------------------------------------------------

const richtext: BlockDef = {
  type: "richtext",
  label: "Rich text",
  description: "Headings, paragraphs, lists, links.",
  icon: AlignLeft,
  blank: () => ({ html: "" }),
  Edit: ({ name, uploadEndpoint, onPickFromLibrary }) => {
    const { control } = useFormContext();
    return (
      <FormField
        control={control}
        name={`${name}.data.html`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RichTextEditor
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder="Write…"
                {...(uploadEndpoint ? { imageUploadEndpoint: uploadEndpoint } : {})}
                {...(onPickFromLibrary ? { onPickImageFromLibrary: onPickFromLibrary } : {})}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  },
};

const faq: BlockDef = {
  type: "faq",
  label: "FAQ",
  description: "Questions and answers.",
  icon: MessageCircleQuestion,
  schema: "FAQPage",
  blank: () => ({ title: "", items: [{ question: "", answer: "" }] }),
  Edit: ({ name }) => (
    <div className="space-y-3">
      <Field name={`${name}.data.title`} label="Heading (optional)" placeholder="Frequently asked questions" />
      <Rows
        name={`${name}.data.items`}
        addLabel="Add question"
        blank={() => ({ question: "", answer: "" })}
      >
        {(row) => (
          <>
            <Field name={`${row}.question`} placeholder="Question" />
            <Field name={`${row}.answer`} placeholder="Answer" rows={3} />
          </>
        )}
      </Rows>
    </div>
  ),
};

const comparison: BlockDef = {
  type: "comparison",
  label: "Comparison table",
  description: "Compare options side by side.",
  icon: Columns3,
  schema: "ItemList",
  blank: () => ({ title: "", headers: [], rows: [{ name: "", url: "", cells: [] }] }),
  Edit: ({ name }) => {
    const { control } = useFormContext();
    return (
      <div className="space-y-3">
        <Field name={`${name}.data.title`} label="Heading (optional)" placeholder="Stripe vs PayPal" />
        <FormField
          control={control}
          name={`${name}.data.headers`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Columns</FormLabel>
              <FormControl>
                <TagInput value={field.value ?? []} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormLabel>Rows</FormLabel>
        <Rows
          name={`${name}.data.rows`}
          addLabel="Add row"
          blank={() => ({ name: "", url: "", cells: [] })}
        >
          {(row) => (
            <>
              <Field name={`${row}.name`} placeholder="Name (e.g. Stripe)" />
              <Field name={`${row}.url`} placeholder="Link (optional)" />
              <FormField
                control={control}
                name={`${row}.cells`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TagInput value={field.value ?? []} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </Rows>
        <p className="text-micro text-muted-foreground">
          Cell values line up with the columns above, in order.
        </p>
      </div>
    );
  },
};

const featureGrid: BlockDef = {
  type: "featureGrid",
  label: "Feature grid",
  description: "A grid of features or benefits.",
  icon: Grid2x2,
  blank: () => ({ title: "", items: [{ title: "", description: "" }] }),
  Edit: ({ name }) => (
    <div className="space-y-3">
      <Field name={`${name}.data.title`} label="Heading (optional)" placeholder="Why choose us" />
      <Rows
        name={`${name}.data.items`}
        addLabel="Add feature"
        blank={() => ({ title: "", description: "" })}
      >
        {(row) => (
          <>
            <Field name={`${row}.title`} placeholder="Feature title" />
            <Field name={`${row}.description`} placeholder="Description" rows={2} />
          </>
        )}
      </Rows>
    </div>
  ),
};

const prosCons: BlockDef = {
  type: "prosCons",
  label: "Pros & cons",
  description: "Two columns of upsides and downsides.",
  icon: ListChecks,
  blank: () => ({ title: "", pros: [], cons: [] }),
  Edit: ({ name }) => {
    const { control } = useFormContext();
    return (
      <div className="space-y-3">
        <Field name={`${name}.data.title`} label="Heading (optional)" placeholder="Pros and cons" />
        <div className="grid gap-3 sm:grid-cols-2">
          {(["pros", "cons"] as const).map((key) => (
            <FormField
              key={key}
              control={control}
              name={`${name}.data.${key}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="capitalize">{key}</FormLabel>
                  <FormControl>
                    <TagInput value={field.value ?? []} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>
    );
  },
};

const cta: BlockDef = {
  type: "cta",
  label: "Call to action",
  description: "A heading and a button.",
  icon: Megaphone,
  blank: () => ({ heading: "", body: "", buttonLabel: "", buttonUrl: "" }),
  Edit: ({ name }) => (
    <div className="space-y-3">
      <Field name={`${name}.data.heading`} label="Heading" placeholder="Ready to compare?" />
      <Field name={`${name}.data.body`} label="Body (optional)" rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name={`${name}.data.buttonLabel`} label="Button label" placeholder="Compare now" />
        <Field name={`${name}.data.buttonUrl`} label="Button URL" placeholder="/compare" />
      </div>
    </div>
  ),
};

const media: BlockDef = {
  type: "media",
  label: "Image",
  description: "An image with alt text and a caption.",
  icon: ImageIcon,
  blank: () => ({ url: "", alt: "", caption: "" }),
  Edit: ({ name, uploadEndpoint, onPickFromLibrary }) => {
    const { control, watch, setValue } = useFormContext();
    return (
      <div className="space-y-3">
        <FormField
          control={control}
          name={`${name}.data.url`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ImageUploadField
                  value={field.value || undefined}
                  onChange={(url) => field.onChange(url ?? "")}
                  folder="blocks"
                  aspect="wide"
                  altId={`${name}.data.alt`}
                  altValue={watch(`${name}.data.alt`)}
                  onAltChange={(v) => setValue(`${name}.data.alt`, v, { shouldDirty: true })}
                  altPlaceholder="Alt text — describe the image for SEO & accessibility"
                  {...(uploadEndpoint ? { uploadEndpoint } : {})}
                  {...(onPickFromLibrary ? { onPickFromLibrary } : {})}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Field name={`${name}.data.caption`} label="Caption (optional)" />
      </div>
    );
  },
};

const htmlEmbed: BlockDef = {
  type: "htmlEmbed",
  label: "HTML / embed",
  description: "Paste an embed code (YouTube, a form, …).",
  icon: Code2,
  blank: () => ({ html: "" }),
  Edit: ({ name }) => (
    <div className="space-y-2">
      <Field name={`${name}.data.html`} rows={5} placeholder="<iframe src=…></iframe>" />
      <p className="text-micro text-muted-foreground">
        Scripts and event handlers are stripped when you save.
      </p>
    </div>
  ),
};

const buyersGuide: BlockDef = {
  type: "buyersGuide",
  label: "Buyers guide",
  description: "A long-form guide with a table of contents.",
  icon: BookOpen,
  schema: "Article",
  blank: () => ({
    title: "",
    intro: "",
    layout: "stacked",
    showToc: true,
    keyTakeaways: [],
    sections: [{ heading: "", body: "" }],
  }),
  Edit: ({ name, uploadEndpoint, onPickFromLibrary }) => {
    const { control } = useFormContext();
    const richTextProps = {
      ...(uploadEndpoint ? { imageUploadEndpoint: uploadEndpoint } : {}),
      ...(onPickFromLibrary ? { onPickImageFromLibrary: onPickFromLibrary } : {}),
    };
    return (
      <div className="space-y-3">
        <Field
          name={`${name}.data.title`}
          label="Guide heading (optional)"
          placeholder="Payment Processor Buyers Guide"
        />

        <FormField
          control={control}
          name={`${name}.data.intro`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Intro (optional)</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="A short intro shown above the table of contents…"
                  {...richTextProps}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <EnumSelectField
            name={`${name}.data.layout`}
            label="Layout"
            options={["stacked", "tabs"]}
            allowNone={false}
            getLabel={(v) => (v === "tabs" ? "Tabs (Capterra style)" : "Stacked (below directory)")}
            description="Tabs add an “All products / Buyers guide” switch; stacked shows the guide below the directory."
          />
          <SwitchField
            name={`${name}.data.showToc`}
            label="Show table of contents"
            description="A jump-link list built from your section headings."
          />
        </div>

        <FormField
          control={control}
          name={`${name}.data.keyTakeaways`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Key takeaways (optional)</FormLabel>
              <FormControl>
                <TagInput value={field.value ?? []} onChange={field.onChange} />
              </FormControl>
              <FormDescription>A short TL;DR bullet list shown at the top of the guide.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormLabel>Sections</FormLabel>
        <Rows
          name={`${name}.data.sections`}
          addLabel="Add section"
          blank={() => ({ heading: "", body: "" })}
        >
          {(row) => (
            <>
              <Field
                name={`${row}.heading`}
                placeholder='Section heading (e.g. "What is a payment processor?")'
              />
              <FormField
                control={control}
                name={`${row}.body`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Section body…"
                        {...richTextProps}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </Rows>
        <p className="text-micro text-muted-foreground">
          Tip: for “typical features” and “what to consider”, the Feature grid and Pros &amp; cons
          blocks pair well with a guide.
        </p>
      </div>
    );
  },
};

export const BLOCK_REGISTRY: Record<BlockType, BlockDef> = {
  richtext,
  faq,
  comparison,
  featureGrid,
  prosCons,
  cta,
  media,
  htmlEmbed,
  buyersGuide,
};

export const BLOCK_LIST: BlockDef[] = Object.values(BLOCK_REGISTRY);
