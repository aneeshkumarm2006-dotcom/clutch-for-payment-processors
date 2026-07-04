"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CalendarDays, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { RichText } from "@/components/public/RichText";
import { Badge } from "@/components/ui/badge";
import type { SeoFormValues } from "@/components/seoteam/serialize";

/**
 * Instant in-editor preview — renders the current (unsaved) form values with the
 * public blog typography, so authors see the post as it will look without saving.
 * Keyword backlinks are injected server-side only, so they don't appear here; the
 * "Open full preview" route renders them for real.
 */
function estimateReadingMinutes(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 200));
}

export function PostPreview() {
  const { control } = useFormContext<SeoFormValues>();
  const title = (useWatch({ control, name: "title" }) as string) ?? "";
  const excerpt = (useWatch({ control, name: "excerpt" }) as string) ?? "";
  const coverImage = (useWatch({ control, name: "coverImage" }) as string) ?? "";
  const author = (useWatch({ control, name: "author" }) as string) ?? "";
  const tags = (useWatch({ control, name: "tags" }) as string[]) ?? [];
  const content = (useWatch({ control, name: "content" }) as string) ?? "";
  const publishedAt = (useWatch({ control, name: "publishedAt" }) as string) ?? "";
  const keywords = (useWatch({ control, name: "keywords" }) as SeoFormValues["keywords"]) ?? [];

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const readingMinutes = content ? estimateReadingMinutes(content) : 0;
  const hasKeywords = keywords.some((k) => k.keyword?.trim() && k.url?.trim());

  return (
    <div className="rounded-lg border border-border bg-card p-5 lg:p-8">
      <article className="mx-auto max-w-prose">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <h1 className="mt-3 text-display text-foreground">{title || "Untitled post"}</h1>
        {excerpt && <p className="mt-3 text-body-lg text-muted-foreground">{excerpt}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y py-3 text-small text-muted-foreground">
          {author && <span className="font-medium text-foreground">{author}</span>}
          {mounted && publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
            </span>
          )}
          {readingMinutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {readingMinutes} min read
            </span>
          ) : null}
        </div>

        {coverImage && (
          <div className="mt-8 overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={`Cover image for ${title}`}
              className="h-auto w-full object-cover"
            />
          </div>
        )}

        {content ? (
          <RichText html={content} className="mt-10" />
        ) : (
          <p className="mt-10 text-body text-muted-foreground">
            Nothing to preview yet — start writing in the Edit tab.
          </p>
        )}

        {hasKeywords && (
          <p className="mt-8 rounded-md border border-border bg-muted px-3 py-2 text-micro text-muted-foreground">
            Keyword backlinks apply on the published page — they don’t show in this quick preview.
            Use “Open full preview” to see them.
          </p>
        )}
      </article>
    </div>
  );
}

export default PostPreview;
