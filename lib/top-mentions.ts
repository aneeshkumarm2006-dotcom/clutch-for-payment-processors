import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Review } from "@/models/Review";

/**
 * lib/top-mentions.ts — derive the neutral "Top mentions" keyword chips
 * (PRD §8.1 / §9.3 #reviews / DESIGN §6.4) from a processor's **approved**
 * review text.
 *
 * APPROACH (no external NLP dependency):
 *   1. A curated **payment-domain dictionary** (`KEYWORDS`) maps each neutral
 *      chip label to a set of lowercase aliases (single words or phrases). This
 *      is an *allowlist* — only recognised, neutral payment topics ever surface,
 *      so the chips can never leak a reviewer's opinion or random noise the way
 *      a raw term-frequency extractor would.
 *   2. Each review's `title`/`body`/`pros`/`cons` is normalised (lowercased,
 *      punctuation → spaces, collapsed). Multi-word aliases are matched against
 *      that string; single-word aliases are matched against its **stop-word
 *      filtered** token set (`STOP_WORDS`) so common function words can't create
 *      spurious single-token hits. A keyword is counted **once per review**, so
 *      `count` = "how many approved reviews mention this topic".
 *   3. Results are sorted by count (desc, then label asc for stable ordering)
 *      and capped at `TOP_MENTIONS_LIMIT`.
 *
 * `topMentions` is DENORMALISED onto the Processor and recomputed ONLY by
 * `lib/ratings.ts` (alongside the rating aggregate) on every approve/reject/
 * delete — never hand-edited — so it can't drift from the underlying reviews.
 * The same dictionary backs the (optional) "filter reviews by mention" affordance
 * via `buildMentionFilter`, so the chip a user clicks and the count it shows are
 * always derived from one source.
 */

export interface TopMention {
  keyword: string;
  count: number;
}

/** Max chips surfaced in the summary row (DESIGN §6.4 — keep it compact). */
export const TOP_MENTIONS_LIMIT = 8;

/** A topic must appear in at least this many approved reviews to earn a chip. */
const MIN_MENTIONS = 1;

interface KeywordDef {
  /** The neutral chip label shown to users. */
  label: string;
  /** Lowercase match terms; a term with a space is matched as a phrase. */
  aliases: string[];
}

/**
 * Curated, neutral payment-domain topics. Labels are deliberately objective
 * (the topic, not a verdict). Aliases include common synonyms/spellings so the
 * same topic is recognised however a reviewer phrases it. Keep entries neutral —
 * this is a topic dictionary, not a sentiment dictionary.
 */
const KEYWORDS: KeywordDef[] = [
  { label: "Ease of use", aliases: ["easy to use", "ease of use", "user friendly", "user-friendly", "intuitive", "simple to use"] },
  { label: "Customer support", aliases: ["customer support", "customer service", "support team", "support", "help desk", "live chat"] },
  { label: "Pricing", aliases: ["pricing", "price", "prices", "cost", "costs", "expensive", "affordable", "rates"] },
  { label: "Transaction fees", aliases: ["transaction fee", "transaction fees", "processing fee", "processing fees", "per transaction"] },
  { label: "Hidden fees", aliases: ["hidden fee", "hidden fees", "hidden cost", "hidden costs", "surprise fee", "extra fees"] },
  { label: "Payouts", aliases: ["payout", "payouts", "payout time", "deposit", "deposits", "settlement", "next day", "next-day", "funds availability"] },
  { label: "Integrations", aliases: ["integration", "integrations", "plugin", "plugins", "shopify", "woocommerce", "quickbooks", "ecommerce platform"] },
  { label: "API & developer tools", aliases: ["api", "apis", "sdk", "developer", "developers", "documentation", "docs", "webhooks"] },
  { label: "Dashboard", aliases: ["dashboard", "interface", "admin panel", "portal", "back office", "backend"] },
  { label: "Reporting", aliases: ["reporting", "reports", "analytics", "insights", "reconciliation"] },
  { label: "Onboarding", aliases: ["onboarding", "setup", "set up", "set-up", "getting started", "account approval", "sign up", "sign-up"] },
  { label: "Chargebacks", aliases: ["chargeback", "chargebacks", "dispute", "disputes"] },
  { label: "Refunds", aliases: ["refund", "refunds", "refunding"] },
  { label: "Reliability", aliases: ["reliable", "reliability", "uptime", "stable", "stability", "downtime", "outage", "outages"] },
  { label: "Fraud & security", aliases: ["fraud", "security", "secure", "fraud protection", "fraud detection", "pci"] },
  { label: "Account holds", aliases: ["account hold", "account holds", "frozen account", "account frozen", "funds held", "held funds", "account freeze"] },
  { label: "Invoicing", aliases: ["invoice", "invoices", "invoicing", "billing"] },
  { label: "Recurring billing", aliases: ["recurring", "subscription", "subscriptions", "recurring billing", "recurring payments"] },
  { label: "Checkout", aliases: ["checkout", "payment page", "payment link", "payment links", "hosted checkout"] },
  { label: "Mobile app", aliases: ["mobile app", "mobile", "ios app", "android app", "phone app"] },
  { label: "International payments", aliases: ["international", "multi currency", "multi-currency", "multicurrency", "currencies", "cross border", "cross-border", "global"] },
  { label: "Point of sale", aliases: ["point of sale", "pos", "card reader", "terminal", "in person", "in-person"] },
];

/**
 * Common English stop words removed before single-token alias matching, so a
 * generic function word can never be mistaken for a keyword token. Multi-word
 * phrase aliases are matched against the raw normalised string and intentionally
 * keep their stop words (e.g. "easy **to** use", "set **up**").
 */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "so", "of", "to", "in",
  "on", "for", "with", "at", "by", "from", "up", "out", "about", "into", "over",
  "after", "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "it", "its", "this", "that", "these", "those",
  "i", "we", "you", "they", "he", "she", "my", "our", "your", "their", "very",
  "really", "just", "too", "also", "not", "no", "yes", "as", "than", "more",
  "most", "much", "some", "any", "all", "can", "could", "would", "should",
  "will", "get", "got", "use", "used", "using", "them", "there", "here", "off",
  "when", "what", "which", "who", "how", "why", "been", "were", "us", "me",
]);

/** Lowercase, replace non-alphanumerics with spaces, collapse, pad with spaces. */
function normalize(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? ` ${cleaned} ` : "";
}

/** Content tokens (stop words removed) from an already-normalised, padded string. */
function contentTokens(normalized: string): Set<string> {
  const tokens = new Set<string>();
  for (const tok of normalized.trim().split(" ")) {
    if (tok && !STOP_WORDS.has(tok)) tokens.add(tok);
  }
  return tokens;
}

/** Does this review mention the keyword? Phrase aliases hit the string; single tokens hit the token set. */
function mentions(def: KeywordDef, normalized: string, tokens: Set<string>): boolean {
  for (const alias of def.aliases) {
    if (alias.includes(" ")) {
      if (normalized.includes(` ${alias} `)) return true;
    } else if (tokens.has(alias)) {
      return true;
    }
  }
  return false;
}

/** The text fields of a review that feed extraction. */
export interface ReviewText {
  title?: string | null;
  body?: string | null;
  pros?: string | null;
  cons?: string | null;
}

/**
 * Derive `{ keyword, count }[]` (count = approved reviews mentioning the topic)
 * from a set of review texts. Pure + synchronous so it's trivially testable.
 */
export function computeTopMentions(reviews: ReviewText[]): TopMention[] {
  const counts = new Map<string, number>();

  for (const r of reviews) {
    const normalized = normalize([r.title, r.body, r.pros, r.cons].filter(Boolean).join(" "));
    if (!normalized) continue;
    const tokens = contentTokens(normalized);

    for (const def of KEYWORDS) {
      if (mentions(def, normalized, tokens)) {
        counts.set(def.label, (counts.get(def.label) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_MENTIONS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_MENTIONS_LIMIT)
    .map(([keyword, count]) => ({ keyword, count }));
}

/**
 * Load a processor's approved reviews and compute its top mentions. Called by
 * `lib/ratings.ts` so it fires on exactly the same triggers as the rating
 * aggregate. With zero approved reviews this returns `[]` (clearing the chips).
 */
export async function computeTopMentionsForProcessor(
  processorId: string | Types.ObjectId,
): Promise<TopMention[]> {
  await connectToDatabase();
  const _id = typeof processorId === "string" ? new Types.ObjectId(processorId) : processorId;

  const reviews = await Review.find({ processor: _id, status: "approved" })
    .select("title body pros cons")
    .lean();

  return computeTopMentions(reviews as ReviewText[]);
}

/**
 * Build a Mongo filter that matches approved reviews mentioning a given chip
 * label — backs the optional "click a chip to filter the list" affordance. Uses
 * the SAME dictionary as extraction so the filter and the counts stay in sync.
 * Returns `null` for an unknown label (caller should ignore the filter).
 */
export function buildMentionFilter(keyword: string): Record<string, unknown> | null {
  const def = KEYWORDS.find((k) => k.label === keyword);
  if (!def) return null;

  // Word-boundary-ish regex per alias (escaped); OR-ed across the text fields.
  const escaped = def.aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(^|[^a-z0-9])(${escaped.join("|")})([^a-z0-9]|$)`, "i");
  const fields = ["title", "body", "pros", "cons"];

  return { $or: fields.map((f) => ({ [f]: { $regex: pattern } })) };
}
