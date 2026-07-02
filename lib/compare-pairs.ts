/**
 * Curated "popular" compare pairs for the pretty, indexable compare routes
 * (Phase 2 / Stage 7.3 — PRD §9.4, §13).
 *
 * Only pairs on this list get a canonical, crawlable `/compare/<a>-vs-<b>` URL
 * (statically generated + `index:true` + listed in the sitemap). Every other
 * combination stays on the query-param `/compare?ids=` page (noindex), which
 * canonicalizes here whenever it happens to match a listed pair.
 *
 * Selection rule (documented in code so the list isn't arbitrary — mirrors the
 * §9.2 formula-comment convention): a pair qualifies only when BOTH processors
 * are high-salience comparison targets, i.e. the household-name gateways
 * merchants actually cross-shop. Concretely that's the sponsored / most-reviewed
 * gateways (Stripe, PayPal) paired against each other and against the next tier
 * of widely-searched names (Square, Adyen, Braintree, Authorize.net), plus a
 * same-segment head-to-head where both sides genuinely compete (Square vs Stax
 * for retail POS; Razorpay vs PayU for India). The left/right order is FIXED
 * here so each head-to-head has exactly ONE canonical URL (never both
 * `stripe-vs-paypal` *and* `paypal-vs-stripe`). Add a pair only when there's
 * real head-to-head search demand; keep the list short and high-intent.
 *
 * Every slug below MUST be a published-processor slug (see `scripts/seed.ts`);
 * the page/sitemap drop any pair whose processors aren't both published, so a
 * stale entry degrades to a 404 rather than a broken page.
 */
export const POPULAR_COMPARE_PAIRS: readonly (readonly [string, string])[] = [
  // Household-name gateways cross-shopped against each other (original set).
  ["stripe", "paypal"],
  ["stripe", "square"],
  ["stripe", "braintree"],
  ["stripe", "adyen"],
  ["stripe", "authorize-net"],
  ["paypal", "square"],
  ["square", "stax"],
  ["razorpay", "payu"],
  // Expanded high-intent head-to-heads (all among published slugs). Left slug is
  // the more-searched of the pair so each has exactly one canonical URL. Curated
  // to real "X vs Y" demand — NOT the full C(n,2) combinatorial matrix.
  ["stripe", "helcim"], // flat-rate vs interchange-plus — a common value comparison
  ["stripe", "stax"], // flat-rate vs subscription pricing
  ["paypal", "braintree"], // PayPal-owned Braintree — frequently compared
  ["paypal", "adyen"],
  ["paypal", "authorize-net"],
  ["square", "helcim"], // SMB/retail interchange-plus alternative to Square
  ["square", "braintree"],
  ["square", "adyen"],
  ["adyen", "braintree"], // enterprise gateways
  ["braintree", "authorize-net"],
  ["authorize-net", "stax"],
  ["helcim", "stax"], // interchange-plus / membership value plays
];

/** The `-vs-` delimiter joining the two slugs in a pretty compare URL. */
const VS = "-vs-";

/** `["stripe","paypal"]` → `"stripe-vs-paypal"` (the dynamic-route `[pair]` param). */
export function comparePairToParam(pair: readonly string[]): string {
  return pair.join(VS);
}

/**
 * `"stripe-vs-paypal"` → `["stripe","paypal"]`. Splits on the literal `-vs-`
 * delimiter (safe even for hyphenated slugs like `authorize-net`, since `-vs-`
 * never occurs inside a slug). Lower-cases + trims; drops empties.
 */
export function parseComparePairParam(param: string): string[] {
  return param
    .split(VS)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** All curated pairs as route params, for `generateStaticParams` + the sitemap. */
export function comparePairParams(): { pair: string }[] {
  return POPULAR_COMPARE_PAIRS.map((pair) => ({ pair: comparePairToParam(pair) }));
}

// Order-independent lookup: a sorted-slug key → the ONE canonical pretty path.
// Lets the `?ids=` page canonicalize to the pretty URL regardless of slug order.
const PATH_BY_KEY = new Map(
  POPULAR_COMPARE_PAIRS.map((pair) => [
    [...pair].sort().join("|"),
    `/compare/${comparePairToParam(pair)}`,
  ]),
);

/**
 * The canonical pretty path for a set of slugs if (and only if) it matches a
 * curated pair — order-independent, so `?ids=paypal,stripe` still resolves to
 * `/compare/stripe-vs-paypal`. Returns `null` for anything not on the list.
 */
export function prettyComparePath(slugs: string[]): string | null {
  if (slugs.length !== 2) return null;
  const key = slugs
    .map((s) => s.trim().toLowerCase())
    .sort()
    .join("|");
  return PATH_BY_KEY.get(key) ?? null;
}
