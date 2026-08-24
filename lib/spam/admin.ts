import { BlockedSubmission, Lead, OfferSignup, Review, Submission } from "@/models";
import type { SpamFormKind } from "./types";

/**
 * lib/spam/admin.ts — the read side of the admin's Spam and Blocked views.
 *
 * Quarantined rows live in their normal collection with `spam.verdict ===
 * "quarantine"`; blocked ones live only in `BlockedSubmission`. This module
 * flattens both into one shape the table can render, so the UI doesn't need to
 * know which of four collections a row came from.
 */

/**
 * The three collections a public submission can land in, behind the narrow
 * structural type this module and the spam routes actually use.
 *
 * A plain `{ lead: Lead, submission: Submission, review: Review }` map types as
 * a UNION of three `Model<T>`s, and TypeScript refuses to call a method on a
 * union of differently-parameterised generic signatures. Narrowing to the four
 * operations we need makes the map usable without reaching for `any`.
 */
interface SpamCollection {
  find(filter: Record<string, unknown>): {
    sort(order: Record<string, 1 | -1>): { lean(): Promise<unknown[]> };
  };
  countDocuments(filter: Record<string, unknown>): Promise<number>;
  deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount?: number }>;
  findByIdAndUpdate(
    id: string,
    update: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): { lean(): Promise<unknown> };
}

/** Model lookup shared by every spam write path, so the mapping lives in one place. */
export const MODEL_BY_FORM: Record<SpamFormKind, SpamCollection> = {
  lead: Lead as unknown as SpamCollection,
  offer: OfferSignup as unknown as SpamCollection,
  submission: Submission as unknown as SpamCollection,
  review: Review as unknown as SpamCollection,
};

export interface SpamRowData {
  id: string;
  form: SpamFormKind;
  /** Who sent it, as one display string. */
  who: string;
  email?: string;
  /** The message itself, trimmed for the table. */
  preview: string;
  score: number;
  category: string;
  reasons: string[];
  ip?: string;
  network?: string;
  createdAt: string;
}

const s = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : new Date(String(v ?? Date.now())).toISOString();

/** One row's display fields, whichever form it came from. */
function describe(form: SpamFormKind, d: Record<string, unknown>) {
  if (form === "lead") {
    return {
      who: s(d.name) ?? "Unknown",
      email: s(d.email),
      preview: s(d.message) ?? s(d.businessName) ?? "(no message)",
    };
  }
  if (form === "offer") {
    // No name and no message to show: the address IS the submission. The volume
    // bucket and the page it converted on are the only other facts there are,
    // and both are what an operator needs to judge whether it looks real.
    return {
      who: s(d.email) ?? "Unknown",
      email: s(d.email),
      preview: [s(d.volume), s(d.pagePath)].filter(Boolean).join(" · ") || "(fee sheet signup)",
    };
  }
  if (form === "submission") {
    return {
      who: s(d.processorName) ?? "Unknown",
      email: s(d.contactEmail),
      preview: s(d.description) ?? s(d.website) ?? "(no description)",
    };
  }
  return {
    who: s(d.reviewerName) ?? "Unknown",
    email: s(d.reviewerEmail),
    preview: [s(d.title), s(d.body)].filter(Boolean).join(": ") || "(no review text)",
  };
}

/**
 * Everything currently held in quarantine, newest first.
 *
 * Rows an operator has already cleared by hand (`spam.clearedAt`) are excluded:
 * a human decision sticks, and the row is back in the normal inbox.
 */
export async function listQuarantined(): Promise<SpamRowData[]> {
  const query = { "spam.verdict": "quarantine", "spam.clearedAt": { $exists: false } };
  const forms: SpamFormKind[] = ["lead", "offer", "submission", "review"];
  const rows: SpamRowData[] = [];

  for (const form of forms) {
    const docs = await MODEL_BY_FORM[form].find(query).sort({ createdAt: -1 }).lean();
    for (const doc of docs) {
      const d = doc as unknown as Record<string, unknown>;
      const spam = (d.spam ?? {}) as Record<string, unknown>;
      rows.push({
        id: String(d._id),
        form,
        ...describe(form, d),
        score: Number(spam.score ?? 0),
        category: String(spam.category ?? "unknown"),
        reasons: Array.isArray(spam.reasons) ? (spam.reasons as string[]) : [],
        ip: s(spam.ip),
        network: s(spam.network),
        createdAt: iso(d.createdAt),
      });
    }
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Everything in the 30-day blocked bin, newest first. */
export async function listBlocked(): Promise<SpamRowData[]> {
  const docs = await BlockedSubmission.find({ restoredAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((doc) => {
    const d = doc as unknown as Record<string, unknown>;
    const form = String(d.form) as SpamFormKind;
    const payload = (d.payload ?? {}) as Record<string, unknown>;
    return {
      id: String(d._id),
      form,
      ...describe(form, payload),
      score: Number(d.score ?? 0),
      category: String(d.category ?? "unknown"),
      reasons: Array.isArray(d.reasons) ? (d.reasons as string[]) : [],
      ip: s(d.ip),
      network: s(d.network),
      createdAt: iso(d.createdAt),
    };
  });
}

/** How many rows each inbox is holding back, for the "N in Spam" hint. */
export async function countQuarantined(form: SpamFormKind): Promise<number> {
  return MODEL_BY_FORM[form].countDocuments({
    "spam.verdict": "quarantine",
    "spam.clearedAt": { $exists: false },
  });
}
