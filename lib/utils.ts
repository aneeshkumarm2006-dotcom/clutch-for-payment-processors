import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge configured for our custom type scale (DESIGN §3.1). Without this,
 * named font-size utilities like `text-small`/`text-h3` are unknown to tailwind-merge
 * and get misgrouped with text-color utilities (e.g. `text-primary-foreground`),
 * so the color is wrongly dropped as a "conflict" — producing black-on-black buttons.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "h2",
            "h3",
            "h4",
            "body-lg",
            "body",
            "small",
            "label",
            "micro",
          ],
        },
      ],
    },
  },
});

/** Merge Tailwind class lists, resolving conflicts. Used by all shadcn/ui components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a name/title into a URL-safe, lowercase slug.
 * Uniqueness is enforced at the model layer (Stage 1).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-"); // collapse repeats
}

/** Format a 0–5 rating to one decimal place (e.g. 4.8). Returns "—" when absent. */
export function formatRating(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

/** Compact review/count formatting: 1234 → "1.2k". */
export function formatCount(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "0";
  if (value < 1000) return String(value);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Render a possibly-missing field gracefully (PRD §9.3: show "—"/"Varies"). */
export function orDash(value?: string | number | null): string {
  if (value == null || value === "") return "—";
  return String(value);
}

/** Human-readable date, e.g. "Jun 29, 2026". */
export function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

/** Human-readable byte size (e.g. "2.4 MB"). Returns "—" when the size is unknown. */
export function formatBytes(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Best-effort filename from a URL's last path segment (query/hash stripped). */
export function filenameFromUrl(url: string): string {
  try {
    const path = url.split(/[?#]/)[0] ?? url;
    const seg = path.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(seg) || url;
  } catch {
    return url;
  }
}

/** File extension (lowercased, no dot) inferred from a URL, if any. */
export function formatFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const name = url.split(/[?#]/)[0] ?? "";
  const match = /\.([a-z0-9]{2,5})$/i.exec(name);
  return match ? match[1]!.toLowerCase() : undefined;
}

/** Build a query string from a record, dropping empty values. */
export function toQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
