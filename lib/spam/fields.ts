import { LISTING_TIERS, MONTHLY_VOLUMES, OFFER_VOLUMES, REVIEW_COMPANY_SIZES } from "@/lib/enums";
import type { SpamInput } from "./classify";
import type { SpamFormKind } from "./types";

/**
 * lib/spam/fields.ts — which field of which form means what.
 *
 * Kept out of `classify.ts` on purpose: the classifier only ever sees "here is
 * some text a human typed", so it stays form-agnostic and testable. This module
 * is the single place that knows a lead calls it `message` while a review calls
 * it `body`, and it is shared by the live route guard and the backfill script so
 * the two cannot drift apart and disagree about the same row.
 */

export interface FormSpec {
  /** Free-text fields, in the order an operator would read them. */
  text: string[];
  emailField: string;
  /** Company / brand names, used to discount links to the sender's own site. */
  selfNameFields?: string[];
  /** URL fields the form legitimately asks for — never scored as links. */
  urlFields?: string[];
  /** Enum-backed selects: a value outside the list is one a browser can't emit. */
  enums?: Record<string, readonly string[]>;
  /**
   * Fields hashed for duplicate detection. NEVER include the email: floods
   * replay one payload across many harvested addresses, so hashing the address
   * would give every copy a different fingerprint and the rule would never fire.
   */
  fingerprintFields: string[];
}

export const FORM_SPECS: Record<SpamFormKind, FormSpec> = {
  lead: {
    text: ["name", "businessName", "businessType", "message"],
    emailField: "email",
    selfNameFields: ["businessName"],
    enums: { monthlyVolume: MONTHLY_VOLUMES },
    fingerprintFields: ["name", "businessName", "message"],
  },
  /**
   * The fee-sheet slide-in: an email, and optionally one dropdown answer.
   *
   * `text` is empty because the form has NO free-text field, so every
   * content rule the classifier owns has nothing to read and scores zero. What
   * still protects it is everything that doesn't need prose — the honeypot, the
   * render stamp, both rate limits, Turnstile, and the impossible-value check on
   * the one enum.
   *
   * `fingerprintFields` is empty for the same reason, and that is correct rather
   * than a gap: the hash deliberately excludes the email (see fingerprint.ts),
   * which would leave nothing to hash, and `fingerprintPayload` already returns
   * null below 24 characters. Duplicate ADDRESSES are handled where they belong
   * — a unique index on the collection, which upserts instead of inserting.
   */
  offer: {
    text: [],
    emailField: "email",
    enums: { volume: OFFER_VOLUMES },
    fingerprintFields: [],
  },
  submission: {
    text: ["processorName", "contactName", "description"],
    emailField: "contactEmail",
    selfNameFields: ["processorName"],
    urlFields: ["website"],
    enums: { requestedTier: LISTING_TIERS },
    fingerprintFields: ["processorName", "contactName", "description"],
  },
  review: {
    text: [
      "reviewerName",
      "reviewerTitle",
      "companyName",
      "industry",
      "title",
      "body",
      "pros",
      "cons",
      "useCase",
    ],
    emailField: "reviewerEmail",
    selfNameFields: ["companyName"],
    enums: { companySize: REVIEW_COMPANY_SIZES, monthlyVolume: MONTHLY_VOLUMES },
    fingerprintFields: ["reviewerName", "companyName", "title", "body"],
  },
};

export const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Field names carrying a value the rendered <select> could not have emitted. */
export function impossibleFieldsOf(form: SpamFormKind, raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [field, allowed] of Object.entries(FORM_SPECS[form].enums ?? {})) {
    const value = str(raw[field]);
    if (value && !allowed.includes(value)) out.push(field);
  }
  return out;
}

/**
 * Turn a raw payload (or a stored document) into the classifier's input. The
 * caller supplies the two facts that need I/O — `renderAgeMs` and `isDuplicate`.
 */
export function toSpamInput(
  form: SpamFormKind,
  raw: Record<string, unknown>,
  extras: Pick<
    SpamInput,
    "honeypot" | "renderAgeMs" | "stampChecked" | "isDuplicate" | "ownHosts"
  > = {},
): SpamInput {
  const spec = FORM_SPECS[form];
  const text: Record<string, string | undefined> = {};
  for (const field of spec.text) text[field] = str(raw[field]);

  return {
    form,
    text,
    email: str(raw[spec.emailField]),
    selfNames: (spec.selfNameFields ?? []).map((f) => str(raw[f])),
    declaredUrls: (spec.urlFields ?? []).map((f) => str(raw[f])),
    impossibleFields: impossibleFieldsOf(form, raw),
    ...extras,
  };
}
