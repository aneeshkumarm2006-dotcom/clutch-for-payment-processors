/**
 * lib/spam/classify.ts — the shared spam classifier. Pure functions, no I/O, no
 * database, no env reads. Every public form endpoint imports this one module so
 * a rule fixed in one place is fixed everywhere.
 *
 * THE ONE RULE THIS FILE IS BUILT AROUND
 * --------------------------------------
 * Score the DIRECTION of a message, never its topic.
 *
 *   "We can get you ranking on Google, reply YES"   → spam (they sell to us)
 *   "We need help ranking on Google"                → the customer (we sell)
 *
 * Every pattern below is anchored on seller-framing ("we can get YOU…",
 * "increase YOUR traffic") rather than on a topic word. A rule that keys on a
 * topic deletes the business.
 *
 * The classifier is also FORM-AWARE. `/for-processors` exists precisely so that
 * vendors can pitch us, so generic seller framing is the legitimate use of that
 * form and the `agency-pitch` family is suppressed there. Link-building and
 * guest-post pitches are still spam on every form, because they are not a
 * processor listing under any reading.
 *
 * THREE RULES DELIBERATELY NOT WRITTEN — each one ate a real lead elsewhere:
 *
 *   1. No rule scores a bare dollar figure. Real enquiries say "our budget is
 *      $8k a month" constantly. Only retail boilerplate counts as a money
 *      signal, and even that is weighted below the quarantine line on its own.
 *   2. No rule scores a link to the sender's OWN site. Any URL whose host
 *      echoes the sender's email domain, their company name, or a URL the form
 *      legitimately asked for is discounted to zero. A single genuinely foreign
 *      link scores below the quarantine threshold.
 *   3. No rule uses vowel ratio to detect gibberish. At any useful threshold it
 *      calls "partnership" (3 vowels / 11) and "projects" (2 / 8) keyboard
 *      mash. Runs of 6+ consecutive consonants are used instead: real mash is
 *      nothing else, and English tops out at 5 ("strengths").
 */
import {
  QUARANTINE_AT,
  REJECT_AT,
  type SpamCategory,
  type SpamFormKind,
  type SpamReason,
  type SpamResult,
} from "./types";

/**
 * Hosts that are ours. Two jobs: an email from one of these is always allowed
 * (internal test submissions must never be filtered), and our own domain
 * appearing inside a message BODY is a templated-outreach signal.
 */
export const OWN_HOSTS = [
  // The live domain is paymentprocessingguide.com — processING, not processOR.
  // The two read almost identically, and getting it wrong silently disables both
  // the internal-sender whitelist and the templated-outreach signal.
  "paymentprocessingguide.com",
  "davnoot.com",
] as const;

/** Sub-second submissions are machines. Three seconds is a slow human. */
const MIN_HUMAN_FILL_MS = 3_000;

/** No single category may run away with the score. */
const CATEGORY_CAP = 6;

export interface SpamInput {
  form: SpamFormKind;
  /**
   * The free-text fields a human typed, keyed by field name. URL-bearing fields
   * the form legitimately asks for do NOT belong here — pass those as
   * `declaredUrls`.
   */
  text: Record<string, string | undefined>;
  /** Sender's email address, as submitted. */
  email?: string;
  /** Company / business / processor names — used to discount self-links. */
  selfNames?: (string | undefined | null)[];
  /** URLs the form asked for (e.g. Submission.website). Never scored. */
  declaredUrls?: (string | undefined | null)[];
  /** Honeypot field was filled. */
  honeypot?: boolean;
  /**
   * Names of enum-backed <select> fields carrying a value the rendered form
   * could not have emitted. A human picking from a dropdown cannot produce one.
   */
  impossibleFields?: string[];
  /** ms between the form rendering and the POST. `undefined` = no stamp sent. */
  renderAgeMs?: number;
  /**
   * Whether the browser proof applies at all. The backfill passes `false` for
   * rows written before the stamp existed: penalising them for missing a field
   * the form never sent would flag the entire archive.
   */
  stampChecked?: boolean;
  /** The caller found an identical payload within the last 24h. */
  isDuplicate?: boolean;
  /**
   * Hosts treated as ours. Defaults to OWN_HOSTS; the route guard widens it with
   * whatever NEXT_PUBLIC_SITE_URL points at, so a preview deployment on a
   * different domain still recognises itself.
   */
  ownHosts?: readonly string[];
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const URL_RE = /\bhttps?:\/\/[^\s<>()"']+/gi;
const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/gi;
/** Bare host, e.g. "example.co.uk". Requires an alphabetic TLD of 2+. */
const BARE_HOST_RE = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b/gi;

/**
 * Tokens that look like hosts but are not. Without this, "we use Node.js" reads
 * as a link to the `js` TLD.
 */
const NOT_TLDS = new Set([
  "js",
  "ts",
  "jsx",
  "tsx",
  "md",
  "png",
  "jpg",
  "jpeg",
  "csv",
  "pdf",
  "xml",
  "json",
]);

function hostOf(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : "http://" + raw;
    const h = new URL(withScheme).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return null;
  }
}

function pathOf(raw: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : "http://" + raw;
    return new URL(withScheme).pathname;
  } catch {
    return "/";
  }
}

/** "www.checkout.com" → "checkout". The label a brand name would echo. */
function registrableLabel(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  // Handle the common two-part public suffixes without shipping a PSL.
  const twoPart = new Set(["co", "com", "org", "net", "gov", "ac"]);
  const secondLast = parts[parts.length - 2]!;
  if (parts.length >= 3 && twoPart.has(secondLast)) return parts[parts.length - 3]!;
  return secondLast;
}

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

interface FoundLink {
  host: string;
  path: string;
}

/** All links found in the free text, deduped by host+path. */
function extractLinks(text: string): FoundLink[] {
  const withoutEmails = text.replace(EMAIL_RE, " ");
  const found = new Map<string, FoundLink>();

  for (const m of withoutEmails.match(URL_RE) ?? []) {
    const host = hostOf(m);
    if (!host) continue;
    const path = pathOf(m);
    found.set(host + path, { host, path });
  }

  // Bare hosts, but only outside an already-matched absolute URL.
  const stripped = withoutEmails.replace(URL_RE, " ");
  for (const m of stripped.match(BARE_HOST_RE) ?? []) {
    const token = m.toLowerCase().replace(/\.$/, "");
    const tld = token.split(".").pop() ?? "";
    if (NOT_TLDS.has(tld)) continue;
    const host = hostOf(token);
    if (!host) continue;
    if (!found.has(host + "/")) found.set(host + "/", { host, path: "/" });
  }

  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Pattern tables. Each entry is [regex, code, human label].
// ---------------------------------------------------------------------------

type Pattern = [RegExp, string, string];

/**
 * Retail discount boilerplate. Weighted 2 — BELOW the quarantine line — because
 * a genuine merchant absolutely writes "we run 50% off flash sales and need a
 * processor that survives the spike". One phrase survives; a stack of them
 * (which is what real promo blast copy looks like) does not.
 */
const RETAIL_PROMO: Pattern[] = [
  [/\b\d{1,3}\s*%\s*(off|discount)\b/i, "promo-percent-off", "Retail “% off” boilerplate"],
  [/\bfree\s+(shipping|delivery)\b/i, "promo-free-shipping", "“Free shipping” boilerplate"],
  [
    /\b(today\s+only|limited[-\s]time\s+offer|act\s+now|order\s+now|buy\s+now|shop\s+now)\b/i,
    "promo-urgency",
    "Retail urgency boilerplate",
  ],
  [/\b(discount|coupon|promo)\s+code\b/i, "promo-code", "Mentions a discount code"],
  [/\bbest\s+price\s+guarantee(d)?\b/i, "promo-price-guarantee", "“Best price guaranteed”"],
  [
    /\blowest\s+rates?\s+(anywhere|guaranteed|in\s+the\s+(industry|market))\b/i,
    "promo-lowest-rates",
    "Unverifiable “lowest rates” claim",
  ],
];

/**
 * Bulk-mail plumbing. A buyer filling in a contact form never writes an
 * unsubscribe footer, so this is safe at a weight that quarantines on its own.
 */
const BULK_MAIL: Pattern[] = [
  [/\bunsubscribe\b/i, "bulk-unsubscribe", "Contains a bulk-mail unsubscribe footer"],
  [/\bopt[-\s]?out\b[^.]{0,40}\b(email|list|mailing)\b/i, "bulk-optout", "Contains an opt-out footer"],
  [
    /\byou(?:'re| are)\s+receiving\s+this\s+(email|message)\b/i,
    "bulk-receiving-this",
    "“You are receiving this email” footer",
  ],
  [/\bview\s+(this|it)\s+in\s+your\s+browser\b/i, "bulk-view-in-browser", "“View in your browser” footer"],
  [/\bthis\s+(email|message)\s+was\s+sent\s+to\b/i, "bulk-sent-to", "“This email was sent to” footer"],
];

const MAILING_LIST: Pattern[] = [
  [
    /\b(add|sign)\s+(me|us)\s+(up\s+)?to\s+your\s+(mailing|email|newsletter)\s+list\b/i,
    "list-add-me",
    "Asks to be added to a mailing list",
  ],
  [/\bsubscribe\s+(me|us)\b/i, "list-subscribe-me", "Asks to be subscribed"],
];

/**
 * Off-platform contact handles. The playbook weights these as a safe signal,
 * but this site sells to cross-border merchants in India, Nigeria and the Gulf
 * who genuinely do say "reach me on WhatsApp". Weighted 2 — below the
 * quarantine line on its own, enough to tip anything else over.
 */
const OFF_PLATFORM: Pattern[] = [
  [/\b(?:t\.me|wa\.me)\/\S+/i, "offplatform-link", "Links to a Telegram/WhatsApp handle"],
  [
    /\b(whats\s?app|telegram|wechat|skype|viber)\b[^.\n]{0,30}(?:[+@]|\bid\b|\bnumber\b|\bhandle\b)/i,
    "offplatform-handle",
    "Pushes contact to WhatsApp/Telegram/Skype",
  ],
];

/**
 * SEO / link-building outreach. Scored on EVERY form including
 * `/for-processors`: a guest-post pitch is not a processor listing under any
 * reading of that form.
 */
const SEO_OUTREACH: Pattern[] = [
  [
    /\bwe\s+(can|could|will)\s+(get|help|make)\s+(you|your\s+(site|website|business|company))\b[^.]{0,40}\b(rank|ranking|top|first\s+page|page\s+one)\b/i,
    "seo-we-can-rank-you",
    "Offers to rank our site (seller-framed)",
  ],
  [
    /\b(rank|ranking)\s+(you|your\s+(site|website))\b[^.]{0,30}\b(google|first\s+page|page\s+one)\b/i,
    "seo-rank-your-site",
    "Offers to rank our site",
  ],
  [
    /\b(guest\s+post|link\s+(insertion|exchange|building|placement)|do[-\s]?follow\s+link|paid\s+link)\b/i,
    "seo-link-scheme",
    "Guest-post / link-scheme pitch",
  ],
  [
    /\bwe\s+(offer|provide|do|sell)\b[^.]{0,40}\b(backlinks?|seo\s+services?|link\s+building)\b/i,
    "seo-sells-backlinks",
    "Sells backlinks or SEO services",
  ],
  [
    /\bincrease\s+your\s+(traffic|sales|revenue|rankings?|visibility|leads)\b/i,
    "seo-increase-yours",
    "Promises to increase our traffic/sales",
  ],
  [/\b(first|1st)\s+page\s+of\s+google\b/i, "seo-first-page", "“First page of Google” pitch"],
];

/**
 * Generic agency / vendor pitch framing. SUPPRESSED on the `submission` form,
 * where pitching us is the entire point of the page.
 */
const AGENCY_PITCH: Pattern[] = [
  [
    /\b(?:i|we)\s+(?:came\s+across|was\s+browsing|were\s+browsing|stumbled\s+(?:up)?on|found)\s+your\s+(site|website|page|company)\b/i,
    "pitch-came-across",
    "“I came across your website” opener",
  ],
  [/\breply\s+(?:back\s+)?(?:with\s+)?["“]?\s*yes\s*["”]?\b/i, "pitch-reply-yes", "“Reply YES” call to action"],
  [
    /\b(interested\?|if\s+interested)\s*(,|\.)?\s*(just\s+)?(reply|let\s+me\s+know|respond)\b/i,
    "pitch-if-interested",
    "“Interested? Reply” call to action",
  ],
  [
    /\bwould\s+you\s+(be\s+)?(interested|like)\b[^.]{0,60}\b(our|my)\s+(service|services|offer|team|agency|company|solution)\b/i,
    "pitch-would-you-be-interested",
    "Cold pitch for their services",
  ],
  [
    /\bwe\s+(are|'re)\s+(a|an|one\s+of\s+the)\s+(leading|top|renowned|reputed|award[-\s]winning|fastest[-\s]growing)\b/i,
    "pitch-we-are-leading",
    "“We are a leading…” cold-pitch framing",
  ],
  [
    /\bwe\s+(offer|provide)\s+(a\s+)?free\s+(audit|quote|consultation|sample)\b/i,
    "pitch-free-audit",
    "Offers us a free audit/consultation",
  ],
  [/\b(hire|outsource\s+to)\s+(us|our\s+team)\b/i, "pitch-hire-us", "Asks us to hire them"],
  [
    /\bwe\s+have\s+(a\s+)?(team|pool)\s+of\s+(expert|experienced|skilled|dedicated)\b/i,
    "pitch-team-of-experts",
    "“We have a team of experts” framing",
  ],
];

/** Real keyboard mash. Runs of 6+ consonants — never a vowel-ratio test. */
const CONSONANT_RUN_RE = /[bcdfghjklmnpqrstvwxz]{6,}/i;

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

function pushMatches(
  reasons: SpamReason[],
  haystack: string,
  table: Pattern[],
  category: SpamCategory,
  weight: number,
) {
  for (const [re, code, label] of table) {
    if (re.test(haystack)) reasons.push({ code, category, weight, label });
  }
}

/**
 * Classify one public submission. Pure: same input, same verdict, every time.
 * The caller supplies the two facts that need I/O (`isDuplicate`, `renderAgeMs`).
 */
export function classifySubmission(input: SpamInput): SpamResult {
  const reasons: SpamReason[] = [];
  const ownHosts = input.ownHosts ?? OWN_HOSTS;

  const email = (input.email ?? "").trim().toLowerCase();
  const emailDomain = email.includes("@") ? email.split("@").pop()! : "";

  // --- Whitelist: our own people, always. Internal test submissions must never
  // be filtered, or the first thing anyone does after a deploy looks broken.
  if (emailDomain && ownHosts.some((h) => emailDomain === h || emailDomain.endsWith("." + h))) {
    return {
      verdict: "allow",
      score: 0,
      category: "clean",
      reasons: [
        {
          code: "internal-domain",
          category: "clean",
          weight: 0,
          label: "Sender is on our own domain (" + emailDomain + ")",
        },
      ],
    };
  }

  // --- Structural signals a rendered browser form cannot produce -------------
  if (input.honeypot) {
    reasons.push({
      code: "honeypot",
      category: "honeypot",
      weight: 6,
      label: "Filled the hidden honeypot field",
    });
  }
  for (const field of input.impossibleFields ?? []) {
    reasons.push({
      code: "impossible-field",
      category: "impossible-field",
      weight: 6,
      label: "Field “" + field + "” holds a value the form cannot emit",
    });
  }

  // --- Browser proof --------------------------------------------------------
  // A missing stamp scores BELOW the quarantine line on purpose: right after a
  // deploy a browser can hold a stale cached bundle, and that visitor must not
  // have their enquiry bounced. High enough to tip anything else over.
  if (input.stampChecked === false) {
    // Predates the browser proof — deliberately unscored.
  } else if (input.renderAgeMs === undefined) {
    reasons.push({
      code: "no-stamp",
      category: "automation",
      weight: 2,
      label: "No browser render stamp (posted without loading the form)",
    });
  } else if (input.renderAgeMs < 0) {
    reasons.push({
      code: "stamp-future",
      category: "automation",
      weight: 2,
      label: "Render stamp is in the future",
    });
  } else if (input.renderAgeMs < MIN_HUMAN_FILL_MS) {
    reasons.push({
      code: "too-fast",
      category: "automation",
      weight: 4,
      label: "Submitted " + (input.renderAgeMs / 1000).toFixed(1) + "s after the form rendered",
    });
  }
  // A stamp older than a day is a tab left open overnight. Deliberately unscored.

  if (input.isDuplicate) {
    reasons.push({
      code: "duplicate-payload",
      category: "duplicate",
      weight: 5,
      label: "Identical message already received in the last 24h (different address)",
    });
  }

  // --- Content --------------------------------------------------------------
  const haystack = Object.values(input.text)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join("\n");

  if (haystack.trim()) {
    pushMatches(reasons, haystack, RETAIL_PROMO, "retail-promo", 2);
    pushMatches(reasons, haystack, BULK_MAIL, "bulk-mail", 4);
    pushMatches(reasons, haystack, MAILING_LIST, "mailing-list", 3);
    pushMatches(reasons, haystack, OFF_PLATFORM, "off-platform-contact", 2);
    pushMatches(reasons, haystack, SEO_OUTREACH, "seo-outreach", 3);
    // Pitching us IS the point of /for-processors — do not score it there.
    if (input.form !== "submission") {
      pushMatches(reasons, haystack, AGENCY_PITCH, "agency-pitch", 3);
    }

    // --- Links ------------------------------------------------------------
    const declaredHosts = new Set(
      (input.declaredUrls ?? []).flatMap((u) => {
        const h = u ? hostOf(u) : null;
        return h ? [h] : [];
      }),
    );
    const selfBlob = (input.selfNames ?? [])
      .filter(Boolean)
      .map((n) => alnum(String(n)))
      .join("|");

    const isSelfHost = (host: string) => {
      if (declaredHosts.has(host)) return true;
      const label = registrableLabel(host);
      if (!label) return true;
      if (emailDomain && (host === emailDomain || registrableLabel(emailDomain) === label)) return true;
      // A brand name echoing the host: "Checkout.com" ↔ checkout.com.
      if (label.length >= 4 && selfBlob.includes(label)) return true;
      return false;
    };

    for (const link of extractLinks(haystack)) {
      const isOurs = ownHosts.some((h) => link.host === h || link.host.endsWith("." + h));
      if (isOurs) {
        // Our own domain templated into the body. A bare root reads as mail-merge
        // outreach; a deep link reads as someone reporting a problem on a page,
        // which is a correction the contact form explicitly invites.
        const deep = link.path.replace(/\/+$/, "").length > 0;
        reasons.push({
          code: deep ? "own-domain-page-ref" : "own-domain-templated",
          category: deep ? "link-spam" : "agency-pitch",
          weight: deep ? 1 : 4,
          label: deep
            ? "References a page on our own site (" + link.host + link.path + ")"
            : "Our own domain templated into the message (" + link.host + ")",
        });
        continue;
      }
      if (isSelfHost(link.host)) continue; // their own site — never scored
      reasons.push({
        code: "foreign-link",
        category: "link-spam",
        weight: 2,
        label: "Outbound link to a third-party site (" + link.host + ")",
      });
    }

    // --- Gibberish --------------------------------------------------------
    // URLs and emails are stripped first: a base64-ish path segment is not mash.
    const prose = haystack.replace(URL_RE, " ").replace(EMAIL_RE, " ").replace(BARE_HOST_RE, " ");
    const mashed = prose
      .split(/\s+/)
      .filter((t) => t.length >= 6 && !/\d/.test(t) && CONSONANT_RUN_RE.test(t));
    if (mashed.length > 0) {
      reasons.push({
        code: "consonant-run",
        category: "gibberish",
        weight: 4,
        label: "Keyboard mash: " + mashed.slice(0, 3).map((t) => "“" + t + "”").join(", "),
      });
    }
  }

  // --- Score ----------------------------------------------------------------
  // Capped per category so one noisy family cannot manufacture a rejection.
  const perCategory = new Map<SpamCategory, number>();
  for (const r of reasons) {
    perCategory.set(r.category, Math.min(CATEGORY_CAP, (perCategory.get(r.category) ?? 0) + r.weight));
  }
  const score = [...perCategory.values()].reduce((a, b) => a + b, 0);

  const verdict: SpamResult["verdict"] =
    score >= REJECT_AT ? "reject" : score >= QUARANTINE_AT ? "quarantine" : "allow";

  let category: SpamCategory = "clean";
  let best = 0;
  for (const [cat, w] of perCategory) {
    if (w > best) {
      best = w;
      category = cat;
    }
  }

  return { verdict, score, category, reasons };
}
