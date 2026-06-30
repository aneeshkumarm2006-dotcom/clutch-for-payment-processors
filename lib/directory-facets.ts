import {
  COMPANY_SIZES,
  FEATURES,
  INTEGRATIONS,
  PAYMENT_METHODS,
  PRICING_MODELS,
  REGIONS,
} from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { FEE_BUCKETS, RATE_BUCKETS } from "@/lib/directory-shared";

/**
 * FilterRail facet config (PRD §9.2 / DESIGN §6.3). Shared by the rail and the
 * active-filter chips so labels stay consistent. `key` matches both the
 * `DirectoryParams` field and the URL query-param name (comma-separated lists).
 */
export type FacetKey =
  | "pricingModel"
  | "rate"
  | "fee"
  | "methods"
  | "integrations"
  | "features"
  | "region"
  | "size";

export interface FacetOption {
  value: string;
  label: string;
}

export interface FacetGroup {
  key: FacetKey;
  label: string;
  options: FacetOption[];
}

const toOptions = (vals: readonly string[]): FacetOption[] =>
  vals.map((v) => ({ value: v, label: humanizeEnum(v) }));

export const FACET_GROUPS: FacetGroup[] = [
  { key: "pricingModel", label: "Pricing model", options: toOptions(PRICING_MODELS) },
  { key: "rate", label: "Online card rate", options: RATE_BUCKETS.map((b) => ({ value: b.value, label: b.label })) },
  { key: "fee", label: "Monthly fee", options: FEE_BUCKETS.map((b) => ({ value: b.value, label: b.label })) },
  { key: "methods", label: "Payment methods", options: toOptions(PAYMENT_METHODS) },
  { key: "integrations", label: "Integrations", options: toOptions(INTEGRATIONS) },
  { key: "features", label: "Features", options: toOptions(FEATURES) },
  { key: "region", label: "Region", options: toOptions(REGIONS) },
  { key: "size", label: "Business size", options: toOptions(COMPANY_SIZES) },
];

/** Look up a human label for an active facet token (used by the chips). */
export function facetOptionLabel(key: FacetKey, value: string): string {
  const group = FACET_GROUPS.find((g) => g.key === key);
  return group?.options.find((o) => o.value === value)?.label ?? humanizeEnum(value);
}
