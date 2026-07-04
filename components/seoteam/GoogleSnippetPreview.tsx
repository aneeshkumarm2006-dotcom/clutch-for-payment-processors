"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { SITE_URL } from "@/lib/seo";
import type { SeoFormValues } from "@/components/seoteam/serialize";

/**
 * Live "Search engine listing" preview (Shopify-style) — a Google-result mock of
 * how the post appears in search, updating as the author edits the title, slug,
 * meta title and meta description. Mirrors `buildMetadata`'s precedence
 * (metaTitle || title, metaDescription || excerpt).
 */
const TITLE_MAX = 60;
const DESC_MAX = 160;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "example.com";
  }
})();

export function GoogleSnippetPreview() {
  const { control } = useFormContext<SeoFormValues>();
  const title = (useWatch({ control, name: "title" }) as string) ?? "";
  const slug = (useWatch({ control, name: "slug" }) as string) ?? "";
  const metaTitle = (useWatch({ control, name: "seo.metaTitle" }) as string) ?? "";
  const metaDescription = (useWatch({ control, name: "seo.metaDescription" }) as string) ?? "";
  const excerpt = (useWatch({ control, name: "excerpt" }) as string) ?? "";

  const effectiveTitle = metaTitle.trim() || title.trim() || "Post title";
  const effectiveDesc =
    metaDescription.trim() ||
    excerpt.trim() ||
    "Add a meta description or excerpt so search engines show a useful snippet.";
  const displaySlug = slug.trim() || slugify(title) || "post-url";

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="mb-2 text-micro font-medium uppercase tracking-wide text-muted-foreground">
        Search engine listing preview
      </p>
      <div className="max-w-xl">
        <p className="truncate text-micro text-ink-500 dark:text-ink-400">
          {HOST} › blog › {displaySlug}
        </p>
        <p className="mt-0.5 truncate text-[1.05rem] leading-tight text-[#1a0dab] dark:text-[#8ab4f8]">
          {truncate(effectiveTitle, TITLE_MAX)}
        </p>
        <p className="mt-1 line-clamp-2 text-small text-ink-600 dark:text-ink-300">
          {truncate(effectiveDesc, DESC_MAX)}
        </p>
      </div>
    </div>
  );
}

export default GoogleSnippetPreview;
