import type { ProcessorCardData } from "@/lib/serialize";
import {
  COMPANY_SIZES,
  FEATURES,
  INTEGRATIONS,
  PAYMENT_METHODS,
  PRICING_MODELS,
  REGIONS,
} from "@/lib/enums";

/**
 * Client-safe directory primitives (constants, types, pure parsers/helpers).
 *
 * Split out of `lib/processors-query.ts` so Client Components (FilterRail,
 * SortSelect, ActiveFilters, use-filters, …) can import the filter constants and
 * URL parsing WITHOUT pulling in `@/models` / `@/lib/db` — those drag Mongoose
 * into the browser bundle, where `mongoose.models` is undefined and the directory
 * pages crash with "Cannot read properties of undefined (reading 'Processor')".
 *
 * `processors-query.ts` re-exports everything here, so server callers are
 * unaffected.
 */

export const PAGE_SIZE = 12; // TODO §3.4 — 12 per page.

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "fees", label: "Lowest fees" },
  { value: "newest", label: "Newest" },
] as const;
export type ProcessorSort = (typeof SORT_OPTIONS)[number]["value"];
const SORT_VALUES = SORT_OPTIONS.map((s) => s.value) as readonly string[];

/** Online-card-rate buckets for the FilterRail (PRD §9.2). */
export const RATE_BUCKETS = [
  { value: "lt2", label: "Under 2%" },
  { value: "2-2.5", label: "2% – 2.5%" },
  { value: "2.5-3", label: "2.5% – 3%" },
  { value: "gt3", label: "3% and up" },
  { value: "custom", label: "Custom / varies" },
] as const;
const RATE_VALUES = RATE_BUCKETS.map((b) => b.value) as readonly string[];

/** Monthly-fee buckets for the FilterRail (PRD §9.2). */
export const FEE_BUCKETS = [
  { value: "0", label: "$0 — no monthly fee" },
  { value: "lt25", label: "Under $25" },
  { value: "25-99", label: "$25 – $99" },
  { value: "gt100", label: "$100 and up" },
] as const;
const FEE_VALUES = FEE_BUCKETS.map((b) => b.value) as readonly string[];

/** Minimum-rating buckets for the FilterRail. */
export const MIN_RATING_OPTIONS = [
  { value: "4.5", label: "4.5 & up" },
  { value: "4", label: "4.0 & up" },
  { value: "3", label: "3.0 & up" },
] as const;

// Normalizer for the log-scaled review-count term: log10(1000+1) ≈ 3.0004, so a
// processor with ~1000 reviews maxes the term at ~1.0 (capped at 1 regardless).
export const REVIEW_LOG_CAP = Math.log10(1001);

export interface DirectoryParams {
  category?: string; // category slug (the /processors `?category=` facet)
  q?: string;
  sort: ProcessorSort;
  page: number;
  pricingModel: string[];
  methods: string[];
  integrations: string[];
  features: string[];
  region: string[];
  size: string[];
  rate: string[];
  fee: string[];
  minRating?: number;
  verifiedOnly: boolean;
  highRisk: boolean;
}

export interface DirectoryResult {
  items: ProcessorCardData[];
  total: number;
  page: number;
  totalPages: number;
}

/** Minimal accessor both `URLSearchParams` and a `?` adapter satisfy. */
export interface ParamReader {
  get(key: string): string | null;
}

/** Adapt Next's `searchParams` object (`{ k: string | string[] }`) to a `get()` reader. */
export function paramsReader(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
): ParamReader {
  if (sp instanceof URLSearchParams) return sp;
  return {
    get(key) {
      const v = sp[key];
      if (v === undefined) return null;
      return Array.isArray(v) ? (v[0] ?? null) : v;
    },
  };
}

/** Split a comma list and keep only allowed tokens. */
function pickList(reader: ParamReader, key: string, allowed: readonly string[]): string[] {
  const raw = reader.get(key);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => allowed.includes(s)),
    ),
  );
}

/** Parse raw search params into a validated `DirectoryParams` (drops unknown tokens). */
export function parseDirectoryParams(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
): DirectoryParams {
  const reader = paramsReader(sp);

  const sortRaw = reader.get("sort") ?? "recommended";
  const sort = (SORT_VALUES.includes(sortRaw) ? sortRaw : "recommended") as ProcessorSort;

  const page = Math.max(1, Number(reader.get("page")) || 1);
  const minRatingRaw = Number(reader.get("minRating"));
  const minRating = Number.isFinite(minRatingRaw) && minRatingRaw > 0 ? minRatingRaw : undefined;

  return {
    category: reader.get("category")?.trim() || undefined,
    q: reader.get("q")?.trim() || undefined,
    sort,
    page,
    pricingModel: pickList(reader, "pricingModel", PRICING_MODELS),
    methods: pickList(reader, "methods", PAYMENT_METHODS),
    integrations: pickList(reader, "integrations", INTEGRATIONS),
    features: pickList(reader, "features", FEATURES),
    region: pickList(reader, "region", REGIONS),
    size: pickList(reader, "size", COMPANY_SIZES),
    rate: pickList(reader, "rate", RATE_VALUES),
    fee: pickList(reader, "fee", FEE_VALUES),
    minRating,
    verifiedOnly: reader.get("verifiedOnly") === "true",
    highRisk: reader.get("highRisk") === "true",
  };
}

/** True when any facet (not counting the locked category / sort / page) is active. */
export function hasActiveFilters(p: DirectoryParams): boolean {
  return (
    !!p.q ||
    p.pricingModel.length > 0 ||
    p.methods.length > 0 ||
    p.integrations.length > 0 ||
    p.features.length > 0 ||
    p.region.length > 0 ||
    p.size.length > 0 ||
    p.rate.length > 0 ||
    p.fee.length > 0 ||
    p.minRating !== undefined ||
    p.verifiedOnly ||
    p.highRisk
  );
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Validated bucket value lists, exported for the server-side bucket `$match`. */
export { SORT_VALUES, RATE_VALUES, FEE_VALUES };
