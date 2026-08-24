// `@/lib/enums` and nothing heavier: this file is pulled into the client bundle
// by the slide-in, and importing from `@/models` would ship mongoose with it.
import { FEE_SHEET_OFFER, type OfferPageType } from "@/lib/enums";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Fee-sheet slide-in — every tunable in one place.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copy, trigger, frequency and targeting live here rather than inside the
 * component, because these are the things that get changed: an operator asking
 * "can we try 50% instead of 60%" or "keep it off the news posts" should be a
 * one-line diff in a config file, not surgery on a component with a scroll
 * listener and a form in it.
 *
 * There is deliberately no admin UI for this. An interruption that fires on
 * every comparison and blog page is a site-wide design decision, and shipping a
 * switchboard for something nobody has yet asked to change twice is how you end
 * up maintaining a switchboard.
 */

export const OFFER_KEY = FEE_SHEET_OFFER;

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
/**
 * The brief's line, split at its dash.
 *
 * The house rule forbids em dashes in body copy (see NOTES.md), and a headline
 * plus a supporting line is the better design anyway: the offer reads at a
 * glance and the proof sits underneath it rather than trailing off the same
 * sentence.
 */
export const OFFER_COPY = {
  eyebrow: "Free download",
  heading: "Get the processor fee comparison sheet",
  body: "Effective rates for the top 20 providers, updated monthly.",
  emailLabel: "Work email",
  emailPlaceholder: "you@company.com",
  volumeLabel: "Monthly card volume",
  volumeHint: "Optional",
  volumePlaceholder: "Select volume",
  submit: "Send me the sheet",
  submitting: "Sending…",
  /** Shown when the sheet was genuinely emailed. */
  successSent: "Check your inbox. The sheet is on its way to you now.",
  /** Shown when capture worked but nothing could be auto-sent (no URL configured). */
  successQueued: "We’ll email the sheet over to you shortly.",
  privacy: "One email, no newsletter. Unsubscribe any time.",
  dismiss: "Close",
} as const;

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------
/** Fraction of the scrollable range that must be behind the reader. */
export const SCROLL_TRIGGER = 0.6;

/**
 * Absolute floor, in pixels, on top of the percentage.
 *
 * 60% of a page with 300px of scroll is 180px, which fires before the reader has
 * finished the first paragraph and reads as a pop-up rather than an offer. The
 * percentage answers "how far through are they"; this answers "have they
 * actually engaged at all", and a page too short to clear it simply never shows
 * the slide-in.
 */
export const MIN_SCROLL_PX = 400;

/**
 * Grace period after the trigger fires, in ms. Sliding a panel in underneath a
 * reader's cursor the instant they cross a threshold feels like a trap; a beat
 * of delay lands it as an offer.
 */
export const REVEAL_DELAY_MS = 600;

// ---------------------------------------------------------------------------
// Frequency
// ---------------------------------------------------------------------------
/** How long a visitor who saw it is left alone. The brief's number. */
export const COOLDOWN_DAYS = 21;

/**
 * How long a visitor who CONVERTED is left alone.
 *
 * Deliberately not `COOLDOWN_DAYS`: they already have the sheet, and asking for
 * it again three weeks later is the single fastest way to make a returning
 * reader resent the site. The sheet updates monthly, so a year is the point at
 * which re-offering it is a service rather than a nag.
 */
export const CONVERTED_COOLDOWN_DAYS = 365;

/** localStorage key. Versioned so changing the shape cannot crash on old data. */
export const STORAGE_KEY = "ppg:offer:fee-sheet:v1";

/** What we remember about one visitor. Written to localStorage under STORAGE_KEY. */
export interface OfferRecord {
  /** When it was last put in front of them. */
  shownAt?: number;
  /** When they last actually signed up. */
  convertedAt?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The whole frequency policy, as one pure function.
 *
 * Lives here rather than inside the component so it can be tested without a
 * DOM, and so "how often does this thing bother people" is answerable by
 * reading one file.
 */
export function isSuppressed(rec: OfferRecord, now: number): boolean {
  if (rec.convertedAt && now - rec.convertedAt < CONVERTED_COOLDOWN_DAYS * DAY_MS) return true;
  if (rec.shownAt && now - rec.shownAt < COOLDOWN_DAYS * DAY_MS) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------
/**
 * Where it runs: comparison pages and blog posts.
 *
 * The blog INDEX is excluded on purpose — someone scanning a list of headlines
 * has not read anything yet, and an offer there is interruption without earned
 * attention. `/compare` itself is included but the component also stands down
 * while the compare tray is open (see the component), since that is an active
 * task, not reading.
 */
export function offerPageType(pathname: string): OfferPageType | null {
  if (pathname === "/compare" || pathname.startsWith("/compare/")) return "compare";
  if (pathname.startsWith("/alternatives/")) return "alternatives";
  // Posts only. `/blog` and `/blog?page=2` are listings.
  if (pathname.startsWith("/blog/")) return "blog";
  return null;
}
