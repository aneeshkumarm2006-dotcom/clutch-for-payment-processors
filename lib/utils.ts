import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
