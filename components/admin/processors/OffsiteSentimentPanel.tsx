"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { SENTIMENT_TONES, type SentimentTone } from "@/lib/enums";
import { hasSentimentContent, STAR_LEVELS, TONE_OPTION_LABELS } from "@/lib/sentiment";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TextField, TextareaField } from "@/components/admin/fields/form-fields";
import { TagInput } from "@/components/admin/fields/TagInput";
import {
  blankQuote,
  blankTheme,
  blankThread,
} from "@/components/admin/processors/serialize";

/**
 * "What people say elsewhere" — the editor for the Google-listing and Reddit
 * overviews on `/processor/<slug>/reviews`.
 *
 * Mounted on the Processor form's Reviews-page tab, bound to
 * `reviewsPage.googleReviews.*` and `reviewsPage.reddit.*`.
 *
 * ## Both sections are optional, and most listings will use neither
 *
 * That is the constraint the whole panel is shaped around. Nothing here is
 * required, nothing here blocks a save, and a section left untouched writes
 * nothing to the document: `lib/validators/sentiment.ts` collapses an all-blank
 * section to `undefined` and the write route `$unset`s it. The "In use" / "Empty"
 * badges exist so an editor scrolling this tab can tell which state a section is
 * in without reading every field.
 *
 * ## Why it is this many fields and not a rich-text box
 *
 * Because the public page renders a card, not a paragraph: it draws a histogram,
 * groups themes into two columns, and links each thread and quote back to its
 * source. All of that needs the parts kept apart. It also keeps the sections
 * honest — a `checkedOn` date and a source URL are hard to skip when they have
 * their own inputs, and both are printed on the page underneath the numbers.
 *
 * ## Nothing here is HTML
 *
 * Every field is plain text and reaches the page as a text node, with no
 * sanitizer between the two. Do not add a rich-text field to this panel without
 * routing it through `sanitizeBlocks` first.
 */

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

/** Compact bare input bound to a form path. Used inside repeatable rows. */
function RowInput({
  name,
  placeholder,
  type = "text",
  className,
}: {
  name: string;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormControl>
            <Input type={type} placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function RowTextarea({
  name,
  placeholder,
  rows = 2,
}: {
  name: string;
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
          <FormControl>
            <Textarea rows={rows} placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** The chrome around one repeatable list: rows, a remove button, an add button. */
function RowList({
  label,
  description,
  count,
  onAdd,
  addLabel,
  emptyLabel,
  children,
}: {
  label: string;
  description?: string;
  count: number;
  onAdd: () => void;
  addLabel: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {description && <FormDescription>{description}</FormDescription>}
      <div className="space-y-3">
        {count === 0 && <p className="text-small text-muted-foreground">{emptyLabel}</p>}
        {children}
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onAdd} className="mt-1">
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </FormItem>
  );
}

function RowShell({
  index,
  onRemove,
  removeLabel,
  children,
}: {
  index: number;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="text-micro font-medium text-muted-foreground">#{index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={removeLabel}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Tone picker. No "None" option: every theme belongs in one of the two columns. */
function ToneSelect({ name }: { name: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={(field.value as string) || "mixed"}
          onValueChange={field.onChange}
        >
          <FormControl>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {SENTIMENT_TONES.map((tone) => (
              <SelectItem key={tone} value={tone}>
                {TONE_OPTION_LABELS[tone]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Repeatable lists shared by both sections
// ---------------------------------------------------------------------------

/**
 * Themes. `tone` decides which of the two public columns the theme renders in,
 * with "mixed" filed alongside the criticisms — a caveat listed under "what they
 * praise" is how a review page loses a reader's trust.
 */
function ThemeRows({ name, description }: { name: string; description: string }) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <RowList
      label="Recurring themes"
      description={description}
      count={fields.length}
      onAdd={() => append(blankTheme())}
      addLabel="Add theme"
      emptyLabel="No themes yet."
    >
      {fields.map((item, i) => (
        <RowShell key={item.id} index={i} onRemove={() => remove(i)} removeLabel={`Remove theme ${i + 1}`}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <RowInput
              name={`${name}.${i}.label`}
              placeholder="Underwriting speed"
              className="flex-1"
            />
            <ToneSelect name={`${name}.${i}.tone`} />
          </div>
          <RowInput
            name={`${name}.${i}.detail`}
            placeholder="One line of detail. Optional."
          />
        </RowShell>
      ))}
    </RowList>
  );
}

/**
 * Quotes. `rating` is only drawn for star-rated sources, so it is hidden on the
 * Reddit section rather than sitting there inviting an invented number.
 */
function QuoteRows({
  name,
  description,
  showRating,
  authorPlaceholder,
  contextPlaceholder,
}: {
  name: string;
  description: string;
  showRating: boolean;
  authorPlaceholder: string;
  contextPlaceholder: string;
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <RowList
      label="Quotes"
      description={description}
      count={fields.length}
      onAdd={() => append(blankQuote())}
      addLabel="Add quote"
      emptyLabel="No quotes yet."
    >
      {fields.map((item, i) => (
        <RowShell key={item.id} index={i} onRemove={() => remove(i)} removeLabel={`Remove quote ${i + 1}`}>
          <RowTextarea name={`${name}.${i}.text`} placeholder="The excerpt, in their words." rows={3} />
          <div className="grid gap-2 sm:grid-cols-3">
            <RowInput name={`${name}.${i}.author`} placeholder={authorPlaceholder} />
            <RowInput name={`${name}.${i}.context`} placeholder={contextPlaceholder} />
            <RowInput name={`${name}.${i}.date`} placeholder="August 2026" />
          </div>
          <div className={cn("grid gap-2", showRating ? "sm:grid-cols-[8rem_1fr]" : "")}>
            {showRating && (
              <RowInput name={`${name}.${i}.rating`} type="number" placeholder="Stars (1-5)" />
            )}
            <RowInput name={`${name}.${i}.url`} placeholder="https://… link to the original" />
          </div>
        </RowShell>
      ))}
    </RowList>
  );
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

/**
 * The histogram is five fixed rows, highest star first, because that is the order
 * a Google listing shows them in and the editor is transcribing top to bottom.
 * Leaving a row blank drops it (`toGoogleOverviewPayload`), so a listing that
 * only publishes three bars is fine.
 */
function StarBreakdownRows({ name }: { name: string }) {
  return (
    <FormItem>
      <FormLabel>Star breakdown</FormLabel>
      <FormDescription>
        How many reviews sit at each star, as the listing shows them. Optional, and partial is fine:
        blank rows are ignored. Leave the whole thing empty to show no histogram.
      </FormDescription>
      <div className="space-y-2">
        {STAR_LEVELS.map((stars, i) => (
          <div key={stars} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-small tabular-nums text-muted-foreground">
              {stars} star
            </span>
            <RowInput
              name={`${name}.${i}.count`}
              type="number"
              placeholder="Reviews at this rating"
              className="flex-1"
            />
          </div>
        ))}
      </div>
    </FormItem>
  );
}

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

/** Threads. A thread needs a link or the reader cannot check the claim about it. */
function ThreadRows({ name }: { name: string }) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <RowList
      label="Threads worth reading"
      description="Listed on the page with your takeaway underneath, each linking out to Reddit. A thread must have a URL: an unlinked one is a claim nobody can check."
      count={fields.length}
      onAdd={() => append(blankThread())}
      addLabel="Add thread"
      emptyLabel="No threads yet."
    >
      {fields.map((item, i) => (
        <RowShell key={item.id} index={i} onRemove={() => remove(i)} removeLabel={`Remove thread ${i + 1}`}>
          <RowInput name={`${name}.${i}.title`} placeholder="Thread title, as posted" />
          <RowInput name={`${name}.${i}.url`} placeholder="https://reddit.com/r/…" />
          <div className="grid gap-2 sm:grid-cols-4">
            <RowInput name={`${name}.${i}.subreddit`} placeholder="r/smallbusiness" />
            <RowInput name={`${name}.${i}.date`} placeholder="March 2026" />
            <RowInput name={`${name}.${i}.upvotes`} type="number" placeholder="Upvotes" />
            <RowInput name={`${name}.${i}.comments`} type="number" placeholder="Comments" />
          </div>
          <RowInput name={`${name}.${i}.takeaway`} placeholder="Why this thread is here, in one line." />
        </RowShell>
      ))}
    </RowList>
  );
}

function SubredditsField({ name }: { name: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Subreddits</FormLabel>
          <FormDescription>
            Where the discussion lives. Shown under the section heading. &ldquo;r/&rdquo; is added
            for you.
          </FormDescription>
          <FormControl>
            <TagInput
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              placeholder="smallbusiness, then Enter"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

/**
 * One source, with a badge saying whether it will render.
 *
 * The badge reads the live form values through the same `hasSentimentContent`
 * the page and the sitemap use, so "Empty" here means exactly "this section will
 * not appear and will not make the URL indexable".
 */
function SentimentSection({
  name,
  title,
  description,
  children,
}: {
  name: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const values = useWatch({ name }) as unknown;
  const inUse = hasSentimentContent(values);

  return (
    <section className="rounded-lg border border-border p-4 lg:p-5">
      {/* Badge on the title's own line, not beside the description: the tab is
          narrower than the description's measure, so a shared row wraps the badge
          underneath and it stops reading as the section's status. */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-h4 text-foreground">{title}</h4>
        <Badge variant={inUse ? "verified" : "neutral"}>{inUse ? "In use" : "Empty"}</Badge>
      </div>
      <p className="mt-0.5 max-w-prose text-small text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export function OffsiteSentimentPanel({
  name = "reviewsPage",
  processorName,
}: {
  /** Parent path. The two sections mount at `<name>.googleReviews` / `<name>.reddit`. */
  name?: string;
  /** Only used for placeholder copy, so the fields read as this processor's. */
  processorName?: string;
}) {
  const { control } = useFormContext();
  const who = processorName?.trim() || "this processor";
  const google = `${name}.googleReviews`;
  const reddit = `${name}.reddit`;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-h4">What people say elsewhere</h3>
        <p className="mt-0.5 max-w-prose text-small text-muted-foreground">
          Editor summaries of {who}&rsquo;s Google listing and its Reddit discussion, shown between
          the rating summary and the review list. Both are optional and most listings will use
          neither. Nothing you enter here is counted in the site&rsquo;s own rating or emitted as
          rating schema, and none of it is fetched automatically: it is what you read, on the date
          you say you read it.
        </p>
      </div>

      <SentimentSection
        name={google}
        title="Google reviews"
        description="The processor's Google Business Profile or Maps listing: its score, what the reviews say, and the quotes behind it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name={`${google}.rating`}
            label="Google rating"
            type="number"
            placeholder="4.8"
            description="0 to 5, as the listing shows it."
          />
          <TextField
            name={`${google}.reviewCount`}
            label="Google review count"
            type="number"
            placeholder="27"
          />
        </div>

        <StarBreakdownRows name={`${google}.breakdown`} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name={`${google}.profileUrl`}
            label="Listing URL"
            placeholder="https://maps.google.com/…"
            description="Linked from the section header so a reader can check the numbers."
          />
          <TextField
            name={`${google}.profileName`}
            label="Name on the listing"
            placeholder="Corepay LLC"
            description="Only if Google lists it under a different name."
          />
        </div>

        <TextField
          name={`${google}.heading`}
          label="Section heading"
          placeholder={`What Google reviewers say about ${who}`}
        />
        <TextareaField
          name={`${google}.summary`}
          label="Summary"
          rows={6}
          placeholder="What is actually going on over there. Leave a blank line between paragraphs."
          description="The read on the listing: what the score is made of, when the reviews arrived, and what they have in common. Plain text, blank line for a new paragraph."
        />

        <ThemeRows
          name={`${google}.themes`}
          description="What reviewers keep praising and keep flagging. Rendered as two columns, split by tone. Mixed sits with the criticisms."
        />

        <QuoteRows
          name={`${google}.quotes`}
          description="Short excerpts from actual reviews, each ideally linked. A summary of other people's opinions is only checkable if some of the originals are on the page."
          showRating
          authorPlaceholder="Marcus T."
          contextPlaceholder="Google review"
        />

        <TextField
          name={`${google}.checkedOn`}
          label="Checked on"
          placeholder="19 August 2026"
          description="Printed under the numbers. These figures do not refresh themselves, so the page has to say how old they are."
        />
      </SentimentSection>

      <SentimentSection
        name={reddit}
        title="Reddit"
        description="What merchants say about this processor on Reddit: the overall read, the threads worth opening, and the comments behind them."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name={`${reddit}.tone`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Overall tone</FormLabel>
                <Select
                  value={(field.value as string) || undefined}
                  onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-muted-foreground">
                      None
                    </SelectItem>
                    {SENTIMENT_TONES.map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {TONE_OPTION_LABELS[tone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Reddit has no rating, so this is the section&rsquo;s headline signal.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <TextField
            name={`${reddit}.volumeNote`}
            label="How much there is"
            placeholder="About a dozen threads since 2024"
            description="In your words. Shown next to the subreddits."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SubredditsField name={`${reddit}.subreddits`} />
          <TextField
            name={`${reddit}.searchUrl`}
            label="Reddit link"
            placeholder="https://www.reddit.com/search/?q=…"
            description="A search or hub link, for a reader who wants the raw threads."
          />
        </div>

        <TextField
          name={`${reddit}.heading`}
          label="Section heading"
          placeholder={`What Reddit says about ${who}`}
        />
        <TextareaField
          name={`${reddit}.summary`}
          label="Summary"
          rows={6}
          placeholder="What the discussion actually amounts to. Leave a blank line between paragraphs."
          description="Who is posting, what they agree on, and what a merchant should take from it. Plain text, blank line for a new paragraph."
        />

        <ThemeRows
          name={`${reddit}.themes`}
          description="What comes up in its favour and what keeps getting raised against it. Rendered as two columns, split by tone."
        />

        <ThreadRows name={`${reddit}.threads`} />

        <QuoteRows
          name={`${reddit}.quotes`}
          description="Comments worth quoting, each ideally linked to the permalink."
          showRating={false}
          authorPlaceholder="u/merchant_dev"
          contextPlaceholder="r/smallbusiness"
        />

        <TextField
          name={`${reddit}.checkedOn`}
          label="Checked on"
          placeholder="19 August 2026"
          description="Printed under the summary. Threads move on; the page should say when you last looked."
        />
      </SentimentSection>
    </div>
  );
}

export default OffsiteSentimentPanel;
