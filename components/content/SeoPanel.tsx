"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Globe } from "lucide-react";
import { SITE_URL, SITE_NAME, NOINDEX_ROUTES } from "@/lib/seo";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { ImageUploadField } from "@/components/admin/fields/ImageUploadField";

/**
 * Per-page SEO panel — meta, canonical, robots, OG/Twitter, focus keyword — with
 * a live Google-snippet and social-card preview.
 *
 * Panel-agnostic: takes the page's title/description/path field names so it can
 * mount on any form (Processor, Category, Blog, PageSeo) in either /admin or
 * /seoteam. It mirrors `buildMetadata`'s fallback chain exactly, so what an editor
 * sees here is what the page will actually emit.
 */

const TITLE_DISPLAY_MAX = 60;
const DESC_DISPLAY_MAX = 160;

const HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "example.com";
  }
})();

const truncate = (s: string, max: number) => {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Character counter that nags but never blocks — the hard cap lives in zod. */
function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.trim().length;
  const ok = n >= min && n <= max;
  return (
    <span className={ok || n === 0 ? "text-muted-foreground" : "text-warning"}>
      {n} / {max}
      {n > 0 && !ok ? (n < min ? " — a little short" : " — may be truncated") : ""}
    </span>
  );
}

export function SeoPanel({
  name = "seo",
  titleField,
  descriptionField,
  fallbackTitle = "",
  fallbackDescription = "",
  /** Public path of this page, for the SERP preview and the noindex-route notice. */
  path,
  imageField,
  uploadEndpoint,
  onPickFromLibrary,
}: {
  name?: string;
  /** Form field holding the page's own title. Omit for pages whose title isn't editable. */
  titleField?: string;
  descriptionField?: string;
  /** Static fallbacks for pages with no editable title/description (e.g. PageSeo records). */
  fallbackTitle?: string;
  fallbackDescription?: string;
  path: string;
  /** Field holding the page's own image, used as the OG fallback (e.g. `coverImage`). */
  imageField?: string;
  uploadEndpoint?: string;
  onPickFromLibrary?: (apply: (img: { url: string; alt: string }) => void) => void;
}) {
  const { control } = useFormContext();

  // ONE `useWatch` over every field the previews depend on. Watching them
  // individually would mean a hook per field — and `titleField`/`imageField` are
  // optional, so the hook COUNT would vary between mounts. That's a rules-of-hooks
  // violation the moment someone mounts this without one. A fixed-length array
  // keeps the hook count constant; absent fields just watch a harmless path.
  const watched = useWatch({
    control,
    name: [
      titleField ?? `${name}.metaTitle`,
      descriptionField ?? `${name}.metaDescription`,
      `${name}.metaTitle`,
      `${name}.metaDescription`,
      `${name}.ogTitle`,
      `${name}.ogDescription`,
      `${name}.ogImage`,
      imageField ?? `${name}.ogImage`,
    ],
  }) as (string | undefined)[];

  const [
    watchedTitle = "",
    watchedDescription = "",
    metaTitle = "",
    metaDescription = "",
    ogTitle = "",
    ogDescription = "",
    ogImage = "",
    watchedPageImage = "",
  ] = watched;

  const pageTitle = titleField ? watchedTitle : fallbackTitle;
  const pageDescription = descriptionField ? watchedDescription : fallbackDescription;
  const pageImage = imageField ? watchedPageImage : "";

  // The same precedence buildMetadata applies.
  const effectiveTitle = metaTitle.trim() || pageTitle.trim() || "Page title";
  const effectiveDesc =
    metaDescription.trim() ||
    pageDescription.trim() ||
    "Add a meta description so search engines show a useful snippet.";
  const socialTitle = ogTitle.trim() || effectiveTitle;
  const socialDesc = ogDescription.trim() || effectiveDesc;
  const socialImage = ogImage.trim() || pageImage.trim();

  const isForcedNoindex = NOINDEX_ROUTES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  return (
    <div className="space-y-6">
      {/* ---------------- Search ---------------- */}
      <section className="space-y-4">
        <h2 className="text-h4">Search engine listing</h2>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="mb-2 text-micro font-medium uppercase tracking-wide text-muted-foreground">
            Google preview
          </p>
          <div className="max-w-xl">
            <p className="truncate text-micro text-ink-500 dark:text-ink-400">
              {HOST} › {path.replace(/^\//, "").split("/").join(" › ") || "home"}
            </p>
            <p className="mt-0.5 truncate text-[1.05rem] leading-tight text-[#1a0dab] dark:text-[#8ab4f8]">
              {truncate(effectiveTitle, TITLE_DISPLAY_MAX)}
            </p>
            <p className="mt-1 line-clamp-2 text-small text-ink-600 dark:text-ink-300">
              {truncate(effectiveDesc, DESC_DISPLAY_MAX)}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <TextField
            name={`${name}.metaTitle`}
            label="Meta title"
            placeholder="Falls back to the page title."
          />
          <p className="text-micro">
            <CharCount value={metaTitle} min={50} max={60} />
          </p>
        </div>

        <div className="space-y-1">
          <TextareaField
            name={`${name}.metaDescription`}
            label="Meta description"
            rows={3}
            placeholder="Falls back to the page description."
          />
          <p className="text-micro">
            <CharCount value={metaDescription} min={150} max={160} />
          </p>
        </div>

        <TextField
          name={`${name}.focusKeyword`}
          label="Focus keyword"
          description="The one term this page is trying to rank for. Used by the on-page SEO checks."
        />

        <TextField
          name={`${name}.keywords`}
          label="Meta keywords"
          description="Comma-separated. Ignored by Google; kept for other engines and internal tooling."
        />
      </section>

      {/* ---------------- Social ---------------- */}
      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-h4">Social sharing</h2>

        {/* OG card preview */}
        <div className="max-w-md overflow-hidden rounded-lg border border-border">
          {socialImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={socialImage}
              alt=""
              className="aspect-[1.91/1] w-full bg-muted object-cover"
            />
          ) : (
            <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-muted">
              <Globe className="size-8 text-ink-300" aria-hidden />
            </div>
          )}
          <div className="border-t border-border bg-card p-3">
            <p className="text-micro uppercase text-muted-foreground">{HOST}</p>
            <p className="mt-0.5 truncate text-label font-medium text-foreground">{socialTitle}</p>
            <p className="mt-0.5 line-clamp-2 text-small text-muted-foreground">{socialDesc}</p>
          </div>
        </div>

        <TextField
          name={`${name}.ogTitle`}
          label="Social title"
          description="Used only on Facebook / LinkedIn / X. Falls back to the meta title — it never changes the search-result title."
        />
        <TextareaField
          name={`${name}.ogDescription`}
          label="Social description"
          rows={2}
          placeholder="Falls back to the meta description."
        />

        <FormField
          control={control}
          name={`${name}.ogImage`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Social image</FormLabel>
              <FormDescription>
                {imageField
                  ? "Defaults to the page image when blank."
                  : "Defaults to the site-wide share image when blank."}
              </FormDescription>
              <FormControl>
                <ImageUploadField
                  value={field.value || undefined}
                  onChange={(url) => field.onChange(url ?? "")}
                  folder="og"
                  aspect="wide"
                  {...(uploadEndpoint ? { uploadEndpoint } : {})}
                  {...(onPickFromLibrary ? { onPickFromLibrary } : {})}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${name}.twitterCard`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Twitter card</FormLabel>
              <Select
                value={field.value || "summary_large_image"}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="summary_large_image">Large image</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      {/* ---------------- Indexing ---------------- */}
      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-h4">Indexing</h2>

        {isForcedNoindex ? (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-small text-muted-foreground">
            This route is always <code>noindex</code> — it takes query strings that would otherwise
            fill the index with near-duplicate URLs. The toggles below can&rsquo;t override that.
          </p>
        ) : null}

        <FormField
          control={control}
          name={`${name}.canonicalUrl`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Canonical URL</FormLabel>
              <FormDescription>
                Leave blank to use this page&rsquo;s own URL. Must be on {HOST} — a canonical
                pointing at another domain would de-index this page.
              </FormDescription>
              <FormControl>
                <Input
                  placeholder={`${SITE_URL}${path}`}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/*
          Tri-state, and it must stay that way: `undefined` means "say nothing",
          which is what every page that has never been touched should do. These
          switches only ever write `true`/`false` when an editor deliberately flips
          them; the field starts out undefined and buildMetadata emits no robots
          directive for it.
        */}
        {(
          [
            { key: "robotsIndex", label: "Allow indexing", hint: "Off adds noindex — the page disappears from search." },
            { key: "robotsFollow", label: "Follow links", hint: "Off adds nofollow to every link on the page." },
          ] as const
        ).map(({ key, label, hint }) => (
          <FormField
            key={key}
            control={control}
            name={`${name}.${key}`}
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="space-y-0.5 pr-4">
                  <FormLabel>{label}</FormLabel>
                  <FormDescription className="text-micro">{hint}</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    // `undefined` (never set) reads as allowed — that's the site default.
                    checked={field.value !== false}
                    onCheckedChange={(v) => field.onChange(v)}
                    disabled={isForcedNoindex}
                    aria-label={label}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </section>
    </div>
  );
}

export default SeoPanel;
