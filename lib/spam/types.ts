/**
 * lib/spam/types.ts — the vocabulary shared by the classifier, the routes, the
 * admin UI and the backfill script.
 *
 * Three verdicts, and the difference between them is about who sees the thing:
 *
 *   allow      — stored, emailed, in the normal inbox.
 *   quarantine — stored and categorised, NOT emailed, behind the admin's Spam
 *                view. For submissions a human might plausibly have written.
 *   reject     — never written to the main collection. Copied to
 *                `BlockedSubmission` (30-day TTL) and surfaced under Blocked.
 *                The caller answers with the normal success status so the bot
 *                sees success, doesn't retry, and doesn't adapt.
 *
 * A rejection ALWAYS lands in the bin. That is the only reason rejecting is
 * allowed at all: without a bin, one false positive is a destroyed customer
 * that nobody ever finds out about.
 */

export type SpamVerdict = "allow" | "quarantine" | "reject";

/**
 * Which form the payload came from. The classifier is form-aware on purpose:
 * `/for-processors` exists so vendors can pitch us, so seller-framed language
 * is the legitimate use there and must not be scored. On the contact and quote
 * forms the same sentence is an agency pitch.
 */
export type SpamFormKind = "lead" | "submission" | "review";

export type SpamCategory =
  | "honeypot"
  | "impossible-field"
  | "agency-pitch"
  | "seo-outreach"
  | "link-spam"
  | "retail-promo"
  | "off-platform-contact"
  | "bulk-mail"
  | "mailing-list"
  | "gibberish"
  | "duplicate"
  | "automation"
  | "clean";

/** One scored observation. `label` is what an operator reads in the admin. */
export interface SpamReason {
  code: string;
  category: SpamCategory;
  weight: number;
  label: string;
}

export interface SpamResult {
  verdict: SpamVerdict;
  score: number;
  /** The category of the heaviest reason — what the admin pill shows. */
  category: SpamCategory;
  reasons: SpamReason[];
}

/**
 * Score at which each verdict starts. Deliberately far apart: a single
 * "suspicious but a human might do that" signal must never reach REJECT_AT on
 * its own, and several must.
 */
export const QUARANTINE_AT = 3;
export const REJECT_AT = 6;
