/**
 * lib/analyticshub/serialize.ts — server→client row shapes for the Leads source.
 *
 * Follows the repo's `toXxxData` convention (`lib/serialize.ts`): flatten lean
 * Mongo docs to plain, fully-serializable rows. Critically, the reviewer/lead
 * **email is private and never included** — the recent-leads list shows name,
 * business, volume, and source only.
 */

interface LeanLead {
  _id: unknown;
  name?: string;
  businessName?: string;
  monthlyVolume?: string;
  businessType?: string;
  source?: string;
  status?: string;
  createdAt?: Date | string;
}

interface LeanReview {
  _id: unknown;
  reviewerName?: string;
  companyName?: string;
  overallRating?: number;
  title?: string;
  status?: string;
  createdAt?: Date | string;
}

export interface LeadRow {
  id: string;
  name: string;
  business: string | null;
  volume: string | null;
  source: string | null;
  status: string | null;
  createdAt: string | null;
}

export interface ReviewRow {
  id: string;
  reviewer: string;
  company: string | null;
  rating: number | null;
  title: string | null;
  status: string | null;
  createdAt: string | null;
}

function iso(v: Date | string | undefined): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toLeadRow(doc: LeanLead): LeadRow {
  return {
    id: String(doc._id),
    name: doc.name ?? "—",
    business: doc.businessName ?? null,
    volume: doc.monthlyVolume ?? null,
    source: doc.source ?? null,
    status: doc.status ?? null,
    createdAt: iso(doc.createdAt),
  };
}

export function toReviewRow(doc: LeanReview): ReviewRow {
  return {
    id: String(doc._id),
    reviewer: doc.reviewerName ?? "—",
    company: doc.companyName ?? null,
    rating: typeof doc.overallRating === "number" ? doc.overallRating : null,
    title: doc.title ?? null,
    status: doc.status ?? null,
    createdAt: iso(doc.createdAt),
  };
}
