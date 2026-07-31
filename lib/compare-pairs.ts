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

  // --- Segment head-to-heads, added with the 2026-07-31 listing batch ---------
  // Same selection rule as above: both sides have to be names a merchant would
  // actually cross-shop, which in practice means they compete in one segment.
  // Deliberately still not the full matrix — pairs like "Midtrans vs Dharma"
  // (an Indonesian gateway against a US nonprofit-focused ISO) have no searcher
  // behind them and would be thin pages nobody asked for.

  // Gateways sold through ISOs and ISVs. NMI and Authorize.Net are the two names
  // a reseller-sourced merchant is choosing between.
  ["authorize-net", "nmi"],
  ["authorize-net", "fluidpay"],
  ["authorize-net", "paytrace"],
  ["authorize-net", "forte-payments"], // card gateway vs ACH-led gateway
  ["nmi", "fluidpay"], // the closest direct competitor NMI has
  ["nmi", "paytrace"],
  ["nmi", "easy-pay-direct"],
  ["forte-payments", "paytrace"], // ACH and B2B billing

  // Subscription and usage billing. These sit above a gateway, so the comparison
  // that matters is against each other, never against an acquirer.
  ["metronome-billing", "orb-billing"], // the direct rivalry in usage billing
  ["maxio", "orb-billing"],
  ["maxio", "metronome-billing"],
  ["maxio", "chargeover"],
  ["maxio", "billsby"],
  ["maxio", "invoiced"],
  ["chargeover", "billsby"],
  ["chargeover", "invoiced"],

  // Merchant of record vs raw gateway, the decision an indie SaaS seller makes.
  ["polar-payments", "dodo-payments"],
  ["stripe", "polar-payments"],
  ["stripe", "dodo-payments"],

  // High-risk placement. Quote-only providers, so the comparison is approval
  // odds, contract length and reserves rather than a rate card.
  ["paymentcloud", "soar-payments"],
  ["paymentcloud", "durango-merchant-services"],
  ["paymentcloud", "corepay"],
  ["paymentcloud", "easy-pay-direct"],
  ["corepay", "soar-payments"],
  ["corepay", "durango-merchant-services"],
  ["soar-payments", "durango-merchant-services"],
  ["easy-pay-direct", "soar-payments"],

  // US merchant services and interchange-plus value plays.
  ["stax", "payment-depot"], // Stax owns Payment Depot — high-intent search
  ["stax", "dharma-merchant-services"],
  ["stax", "merchant-one"],
  ["helcim", "payment-depot"],
  ["helcim", "dharma-merchant-services"], // the two published-markup shops
  ["helcim", "payjunction"],
  ["helcim", "merchant-one"],
  ["dharma-merchant-services", "payjunction"],
  ["merchant-one", "payment-depot"],
  ["merchant-one", "tidal-commerce"],
  ["payjunction", "banquest"],

  // India. Both sides are RBI-licensed aggregators competing for the same book.
  ["razorpay", "easebuzz"],
  ["payu", "easebuzz"],

  // Cross-border and European.
  ["stripe", "mollie"],
  ["stripe", "midtrans"],
  ["stripe", "solidgate"],
  ["stripe", "ebanx"],
  ["mollie", "adyen"],
  ["adyen", "windcave"], // enterprise omnichannel with own acquiring

  // Specialists whose nearest published rival is Stripe rather than each other.
  // Their true head-to-heads are Coinbase Commerce and Paddle, both of which are
  // seeded unpublished, and a pair naming an unpublished slug renders a 404.
  // "X vs Stripe" is the real search for both anyway: Stripe is the default these
  // are argued against.
  ["stripe", "nowpayments"], // accepting crypto instead of, or alongside, cards
  ["stripe", "revenuecat"], // in-app purchase billing vs web checkout
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

/**
 * The href for ANY "compare these processors" link. A curated pair resolves to
 * its pretty, indexable `/compare/a-vs-b` route; everything else falls back to
 * the `?ids=` tool.
 *
 * Every internal compare link must go through this rather than hand-building a
 * `?ids=` string. `?ids=` is deliberately `noindex` (see `/compare/page.tsx`), so
 * linking a curated pair that way points readers — and every internal link
 * signal — at a URL that tells Google not to index it, while the pretty page the
 * sitemap advertises collects no links at all. The homepage did exactly this for
 * its three "quick pick" comparisons, which is a large part of why 19 of the 20
 * curated pairs sat in Search Console as "Discovered - currently not indexed".
 */
export function compareHref(slugs: string[]): string {
  return prettyComparePath(slugs) ?? `/compare?ids=${slugs.join(",")}`;
}
