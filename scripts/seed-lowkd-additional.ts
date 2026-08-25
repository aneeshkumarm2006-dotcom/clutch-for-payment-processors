import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { compareHref } from "@/lib/compare-pairs";
import { BlogPost, PageSeo, Processor } from "@/models";
import {
  DRY_RUN,
  blockId,
  checkBlockHtml,
  log,
  mergeKeywords,
  prepareExistingBlocks,
  richtext,
  seoSet,
  type BlockSpec,
  type SeoSpec,
} from "./content-kit";

/**
 * scripts/seed-lowkd-additional.ts — the 2026-08-25 delivery, i.e. the
 * "# 25-08 additional sections" block at the TOP of
 * `low kd pages additional content.md`.
 *
 *   npm run seed:lowkd-additional -- --dry-run   # print every change, write nothing
 *   npm run seed:lowkd-additional                # apply
 *
 * The rest of that .md (clover vs square, alternatives/square, braintree
 * reviews, interchange plus, subscriptions) is the earlier 18_8 delivery and is
 * already live via `scripts/seed-lowkd-content.ts`. Nothing here touches those
 * pages. One script per doc delivery, sharing `./content-kit`.
 *
 * ─── Where each doc section went ────────────────────────────────────────────
 *
 * | Doc section                     | Lands on                                  |
 * |---------------------------------|-------------------------------------------|
 * | /processor/braintree            | 2 richtext blocks on the Braintree profile |
 * | /processor/adyen                | 1 richtext block on the Adyen profile      |
 * | /processor/square               | 1 richtext block spliced into the profile  |
 * | /blog/...aba-routing-number...  | in-body edits to `content` (top + tail)    |
 * | /blog/...pci-compliance...      | a new `<h2>` section inside `content`      |
 * | /payment-processors/ach         | 1 richtext block ABOVE the buyers guide    |
 *
 * ─── The trap this script is mostly built around ────────────────────────────
 * Braintree and Adyen had NO blocks, only `longDescription`. A processor profile
 * renders `hasBlocks ? <Blocks/> : <RichText longDescription/>`, so the first
 * block added to either listing SILENTLY RETIRES its researched overview prose.
 * `writeProcessorBlocks` therefore seeds `longDescription` as block #0 whenever
 * it is creating a block list from scratch. Square already had blocks (its #0 is
 * exactly that mirror), so its new section is spliced in at index 1 instead.
 *
 * ─── Numbers: the doc disagrees with the site's own fee tables ──────────────
 * The doc states rates that contradict `processors.fees`, which renders in the
 * Pricing table a few hundred pixels BELOW the prose on the same page:
 *
 *   Braintree — doc: "flat 2.59% + $0.49".  Site: `onlineCardRate` 2.89% + $0.29
 *                    (and `pricingSummary` "2.89% + 29c per transaction").
 *   Square    — doc: "2.6% + $0.10" in person, and online/keyed-in merged at
 *                    "2.9% + $0.30".  Site: 2.6% + $0.15 in person, 2.9% + $0.30
 *                    online, 3.5% + $0.15 KEYED-IN, which the doc conflates with
 *                    online. Square prices those two separately.
 *   Adyen     — doc: "there genuinely isn't a public rate card". Site publishes
 *                    "Interchange + 0.60% + $0.13" in the same table.
 *
 * The copy below therefore keeps the doc's ARGUMENT and structure but uses the
 * site's own numbers, because a page that states one rate in prose and another
 * in its table two scrolls down is worse than either number being wrong. If the
 * doc's figures are the correct ones, the fix is not in this file: update
 * `scripts/data/processors/*.json` (`fees`, `pricingSummary`) and re-run
 * `add-processors.ts`, then change the three prose strings here to match.
 *
 * ─── House rules applied to the writer's copy ───────────────────────────────
 * - Em dashes out (`npm run audit:dashes`), Google Docs escapes (`\+`, `\=`)
 *   out, bullet glyphs (the doc's literal `●`) turned into real `<ul>`.
 * - Writer-facing meta commentary is NOT reader-facing copy and was cut: "Most
 *   of the traffic hitting this page is trying to answer...", "(the number
 *   people are searching for)", "(Answer this in the first paragraph)", and the
 *   ACH section's whole "what this page should lead with" framing. The facet
 *   page already leads with the listing grid (see the `[facet]` route), so that
 *   instruction was structural advice that is already satisfied.
 * - Every "Links to add" target was checked against the DB before linking. All
 *   three compare pairs are curated (`POPULAR_COMPARE_PAIRS`), so the hrefs are
 *   built with `compareHref` rather than hand-written.
 *
 * ─── Pre-existing defects repaired on the two blog posts ────────────────────
 * Both posts are being edited for SEO anyway, and both carry damage that would
 * undercut the sections being added:
 * - The PCI post's stored `title` ends in a stray " ?" and its body has an em
 *   dash. Its `excerpt` also promises "compliance levels" that the body never
 *   covered, which is the exact gap the doc's new section fills.
 * - The ABA post has four sentences that a previous dash sweep welded together
 *   ("...nine-digit code the terminology just depends..."), plus 11 en dashes
 *   used as list separators that `audit:dashes` flags. Converted to the
 *   `<strong>Label:</strong>` pattern the same post already uses further down,
 *   because `--fix` would turn them into ungrammatical commas.
 * - Neither post had any `seo` at all, so both fell back to a 71-73 character
 *   title. Tight `metaTitle`/`metaDescription` added (mine, not the doc's).
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. /processor/braintree
// ═══════════════════════════════════════════════════════════════════════════

const BRAINTREE_SEO: SeoSpec = {
  focusKeyword: "braintree fees",
  keywords: [
    "braintree fees",
    "braintree pricing",
    "braintree vs stripe",
    "braintree vs paypal",
    "braintree transaction fees",
    "is braintree cheaper than stripe",
  ],
};

const BRAINTREE_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>What Braintree actually charges</h2>" +
      "<p>Braintree's standard US card rate is <strong>2.89% + $0.29</strong> per transaction, with no monthly fee and no setup fee on the standard plan. It is a flat rate rather than a pass-through of the underlying card cost, which makes it a meaningfully simpler structure than <a href=\"/payment-processors/interchange-plus\">interchange-plus pricing</a>, though it can work out more expensive at high volume than a negotiated interchange-plus rate.</p>" +
      "<p>PayPal payments processed through Braintree carry the same rate. Venmo and other alternative payment methods can be priced separately, so check those directly rather than assuming the headline rate covers them.</p>" +
      "<p>That flat, published structure is Braintree's main selling point against a processor like <a href=\"/processor/stripe\">Stripe</a>, which prices almost identically at 2.9% + $0.30. The two are close enough that the per-transaction economics only really separate at the extremes of average order size, which is worth checking against your own numbers rather than assuming the two are interchangeable.</p>",
  ),
  richtext(
    "<h2>Braintree vs Stripe vs PayPal: the actual decision points</h2>" +
      "<ul>" +
      "<li><strong>Choose Braintree if</strong> you are already inside the PayPal ecosystem (Braintree is PayPal-owned), you need strong native support for Venmo and PayPal Checkout alongside cards, or you are a larger merchant who can negotiate volume-based custom pricing below the flat rate.</li>" +
      "<li><strong>Choose Stripe if</strong> you want the deepest developer documentation and the widest range of pre-built integrations and financial products, meaning billing, invoicing and embedded finance tools beyond basic payment acceptance.</li>" +
      "<li><strong>Choose <a href=\"/processor/paypal\">PayPal</a> directly, not via Braintree, if</strong> you are a smaller merchant who wants the fastest possible setup and brand recognition at checkout is worth more to you than rate optimisation.</li>" +
      "</ul>" +
      `<p>For the full side-by-side, see our <a href="${compareHref(["stripe", "braintree"])}">Stripe vs Braintree comparison</a> and our <a href="${compareHref(["paypal", "braintree"])}">PayPal vs Braintree comparison</a>. For merchant feedback on support and account stability, see the <a href="/processor/braintree/reviews">Braintree reviews</a>, or browse the full <a href="/processors">processor directory</a>.</p>`,
  ),
];

/** Idempotency probe: a phrase from the copy that nothing else on the page says. */
const BRAINTREE_MARKER = "the actual decision points";

// ═══════════════════════════════════════════════════════════════════════════
// 2. /processor/adyen
// ═══════════════════════════════════════════════════════════════════════════

const ADYEN_SEO: SeoSpec = {
  focusKeyword: "adyen pricing",
  keywords: [
    "adyen pricing",
    "adyen fees",
    "adyen alternatives",
    "adyen vs stripe",
    "adyen minimum volume",
    "is adyen good for small business",
  ],
};

const ADYEN_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>Who Adyen is actually built for</h2>" +
      "<p>A lot of the confusion in this space comes from Adyen being compared directly to Stripe and Braintree as though the three serve the same customer. Mostly they don't. Adyen is built for large, high-volume merchants operating across multiple countries and currencies, and it prices on <a href=\"/payment-processors/interchange-plus\">interchange-plus</a> rather than a flat rate.</p>" +
      "<p>That is why searches for \"adyen fees\" and \"adyen pricing\" so often turn up frustratingly vague answers. The markup is published, and it is in the pricing table on this page, but the markup is not the cost. What you actually pay is interchange plus that markup, which moves with your card mix and the countries you sell into, and larger merchants negotiate the markup itself. There is no single number to quote back, and a monthly invoice minimum applies on top.</p>" +
      "<p>For smaller businesses and startups searching for Adyen alternatives specifically because they hit a wall trying to get onboarded or priced, that instinct is usually correct. Adyen's sales process and volume expectations are built around merchants processing at serious scale, not early-stage or small business needs. <a href=\"/processor/stripe\">Stripe</a>, <a href=\"/processor/braintree\">Braintree</a> or <a href=\"/processor/square\">Square</a> are typically a better starting point below that line.</p>" +
      `<p>If you are comparing specifically against Stripe, see our <a href="${compareHref(["stripe", "adyen"])}">Stripe vs Adyen comparison</a>. For merchant feedback on the onboarding and support experience, see the <a href="/processor/adyen/reviews">Adyen reviews</a>.</p>`,
  ),
];

const ADYEN_MARKER = "Who Adyen is actually built for";

// ═══════════════════════════════════════════════════════════════════════════
// 3. /processor/square
// ═══════════════════════════════════════════════════════════════════════════

/*
  Spliced in at index 1: the existing block #0 is the longDescription mirror
  (the "who it's for" positioning) and block #1 is the buyers guide, whose
  "Square fees explained" section talks around the rates without ever stating
  one. Concrete numbers belong above that, not below it.
*/
/*
  The first six terms are the ones the listing already carried. They are restated
  rather than left to `withMergedKeywords` because the very first run of this
  script wrote its own list straight over them, so there is nothing left in the
  document to merge with. Keep them here.
*/
const SQUARE_SEO: SeoSpec = {
  keywords: [
    "square fees",
    "square alternatives",
    "clover vs square",
    "square alternatives for small business",
    "adyen vs square",
    "elavon vs square",
    "square processing rates",
    "square in person rate",
    "square keyed in rate",
    "square monthly fee",
  ],
};

const SQUARE_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>Square's actual per-transaction cost, stated plainly</h2>" +
      "<p>Square's standard in-person rate is <strong>2.6% + $0.15</strong> per tap, dip or swipe. Online payments run <strong>2.9% + $0.30</strong>, and manually keyed-in cards run <strong>3.5% + $0.15</strong>. Those last two are the ones that catch merchants off guard, because an in-store demo price is not what the same business pays on its e-commerce or phone orders.</p>" +
      "<p>There is no monthly fee on the free plan, though Square's paid plans unlock lower processing rates in exchange for a monthly subscription. Model that against your actual volume before assuming the free plan is the cheapest option overall, because the break-even sits lower than most merchants expect.</p>" +
      "<p>Square's real differentiator against <a href=\"/processor/stripe\">Stripe</a> or <a href=\"/processor/braintree\">Braintree</a> isn't the processing rate itself, since all three sit in a similar range. It is the integrated hardware and point-of-sale software. That makes Square the sensible default for a business with a physical storefront, and comparatively less compelling for a pure online business that would get more out of Stripe's developer tooling. If you sell through Shopify, compare the <a href=\"/payment-processors/for-shopify\">Shopify-compatible processors</a> first; everything else we track is in the <a href=\"/processors\">processor directory</a>.</p>",
  ),
];

const SQUARE_MARKER = "stated plainly";

// ═══════════════════════════════════════════════════════════════════════════
// 4. /payment-processors/ach
// ═══════════════════════════════════════════════════════════════════════════

/*
  Goes ABOVE the existing buyers guide. The doc's point is that people landing on
  this query already know what ACH is and want to know how to pick between
  providers, so the "how they differ" copy has to sit ahead of the explainer that
  currently opens the editorial slot.
*/
/* Same restatement as Square: the first nine were already on the record. */
const ACH_SEO: SeoSpec = {
  keywords: [
    "ach payment processing",
    "ach processing fees",
    "interchange plus pricing",
    "what is an ach payment",
    "ach payment meaning",
    "how to set up ach payments",
    "ach payment processing time",
    "interchange fees",
    "interchange rates",
    "ach payment providers",
    "ach payment platforms",
    "best ach processors",
    "same day ach",
    "ach settlement time",
  ],
};

const ACH_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>What actually separates one ACH provider from another</h2>" +
      "<p>Most people comparing ACH providers already know what ACH is. Three things do the real work of separating them.</p>" +
      "<ul>" +
      "<li><strong>Per-transaction cost.</strong> ACH is typically far cheaper than card processing, often under 1%, and frequently a flat $0.25 to $1.00 per transaction rather than a percentage of the amount at all. On a $2,000 invoice that difference is the whole argument.</li>" +
      "<li><strong>Settlement speed.</strong> Standard ACH takes one to three business days. Same-day ACH is available at a premium through most providers now, so the question is what the premium costs rather than whether it is offered.</li>" +
      "<li><strong>Verification method.</strong> Instant bank verification, the Plaid-style login flow, versus older micro-deposit verification that waits on two small test deposits landing. This decides how long it takes a new customer to complete their first payment, which matters more than the fee for anything subscription-shaped.</li>" +
      "</ul>" +
      "<p>For how ACH fits alongside card processing in a broader payment stack, see our <a href=\"/payment-processors/for-shopify\">Shopify payment providers</a> guide, and our <a href=\"/payment-processors/interchange-plus\">interchange-plus pricing</a> explainer for how the cost comparison against cards actually works.</p>",
  ),
];

const ACH_MARKER = "separates one ACH provider from another";

// ═══════════════════════════════════════════════════════════════════════════
// 5. /blog/what-is-an-aba-routing-number-...
// ═══════════════════════════════════════════════════════════════════════════

const ABA_SLUG = "what-is-an-aba-routing-number-a-complete-guide-to-finding-and-using-yours";

const ABA_SEO: SeoSpec = {
  metaTitle: "ABA Routing Number: What It Is and How to Find Yours",
  metaDescription:
    "An ABA number and a routing number are the same nine-digit code. Where to find yours, and when a wire transfer needs a different number than ACH.",
  focusKeyword: "aba routing number",
  keywords: [
    "aba routing number",
    "is an aba number the same as a routing number",
    "what is an aba number",
    "aba number vs routing number",
    "how to find routing number",
    "wire routing number vs ach routing number",
  ],
};

/*
  The doc's instruction was literal: answer "is an ABA number the same as a
  routing number" IN THE FIRST PARAGRAPH. So this is an in-body edit to
  `content`, not a block. Blog blocks render UNDERNEATH the body (see
  `components/public/BlogArticle.tsx`), which is the opposite of what was asked.

  The doc's "how to find yours" bullets and its wire-vs-ACH nuance are NOT
  reproduced: the post already has a six-item "How to Find Your Routing Number"
  section and already carries the nuance twice. Only the direct answer and the
  outbound links were actually missing.
*/
const ABA_ANSWER =
  "<p><strong>Is an ABA number the same as a routing number?</strong> Yes. For virtually every practical purpose they are the same nine-digit code, and the two terms are used interchangeably in US banking. \"ABA\" names the American Bankers Association, which created the numbering system in 1910. \"Routing number\" describes what the number does, which is route a transaction to the correct financial institution. You will see \"ABA\" more often around wire transfers and \"routing number\" more often around direct deposit and ACH, but both point at the identical number printed on your check.</p>";

const ABA_LINKS =
  "<p>For how this fits into a larger money movement, see our guides to <a href=\"/blog/eft-meaning-what-is-an-electronic-funds-transfer-eft\">electronic funds transfers</a> and <a href=\"/blog/what-is-a-bank-wire-transfer-a-complete-guide-to-fast-and-secure-money-transfers\">bank wire transfers</a>, plus <a href=\"/blog/swift-code-and-bic\">SWIFT codes and BICs</a> for the international equivalent of a routing number. If you are setting up bank payments for a business rather than a personal account, start with <a href=\"/payment-processors/ach\">ACH payment processing</a>.</p>";

// ═══════════════════════════════════════════════════════════════════════════
// 6. /blog/what-is-pci-compliance-...
// ═══════════════════════════════════════════════════════════════════════════

const PCI_SLUG = "what-is-pci-compliance-a-complete-guide-to-protecting-payment-card-data";

const PCI_SEO: SeoSpec = {
  metaTitle: "PCI Compliance Explained: Levels, Rules and How to Comply",
  metaDescription:
    "Which PCI compliance level applies to your business, what PCI DSS actually requires, and the hosted-checkout shortcut to the simplest SAQ.",
  focusKeyword: "pci compliance",
  keywords: [
    "pci compliance",
    "pci compliance levels",
    "pci dss requirements",
    "pci level 4 merchant",
    "saq a",
    "what is pci dss",
  ],
};

/*
  Goes between "Who Needs PCI Compliance?" and "The 12 Core PCI DSS
  Requirements": it answers "does this apply to me, and how much" before the
  reader is asked to absorb twelve control families.

  The doc named only levels 4 and 1. Levels 2 and 3 are filled in here because
  the heading promises four and the post's own `excerpt` has always promised
  "compliance levels" the body never delivered. The thresholds are the standard
  card-brand ones.
*/
const PCI_LEVELS_SECTION =
  "<h2>The Four PCI Compliance Levels, and Who They Actually Apply To</h2>" +
  "<p>Most PCI explainers stay abstract. What a merchant actually needs first is to know which level applies to them, because the requirements scale dramatically between them.</p>" +
  "<ul>" +
  "<li><p><strong>Level 4</strong> covers merchants processing fewer than 20,000 e-commerce transactions, or up to 1 million total transactions, a year. This is the vast majority of small businesses, and compliance is usually just an annual self-assessment questionnaire (SAQ), often handled almost automatically if you use a compliant processor.</p></li>" +
  "<li><p><strong>Level 3</strong> covers roughly 20,000 to 1 million e-commerce transactions a year, still on an annual self-assessment plus quarterly network scans.</p></li>" +
  "<li><p><strong>Level 2</strong> covers roughly 1 million to 6 million transactions a year across all channels, where some card brands begin requiring an on-site assessment rather than a self-assessment.</p></li>" +
  "<li><p><strong>Level 1</strong> covers more than 6 million transactions a year and requires a full annual on-site audit by a Qualified Security Assessor. It is a materially bigger undertaking than most readers of this page will ever need.</p></li>" +
  "</ul>" +
  "<h3>The Fastest Way Most Small Businesses Get Compliant</h3>" +
  "<p>If you use a modern processor's hosted checkout or hosted payment fields, rather than building your own card-entry form and handling raw card numbers on your own servers, you typically qualify for a much simpler SAQ type: <strong>SAQ A</strong>. The reason is straightforward. You are never actually touching cardholder data. The processor is.</p>" +
  "<p>That single detail is what turns an intimidating compliance topic into a near non-issue for most small merchants on a standard processor integration. For which processors handle it well out of the box, see our <a href=\"/processors\">processor comparison hub</a> and our guide to <a href=\"/blog/how-to-accept-credit-card-payments\">accepting credit card payments</a>. For the wider case, see <a href=\"/blog/why-secure-digital-transactions-matter-for-every-business\">why secure digital transactions matter for every business</a>.</p>";

const PCI_LEVELS_ANCHOR = "<h2>The 12 Core PCI DSS Requirements</h2>";

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

/**
 * Splice blocks into a processor PROFILE's block list.
 *
 * Two things this exists to get right:
 *
 * 1. `longDescription` seeding. The profile renders blocks INSTEAD of
 *    `longDescription`, so on a listing that has none, adding the first block
 *    would drop the researched overview off the page with no warning. When the
 *    stored list is empty, `longDescription` becomes block #0.
 * 2. Existing ids survive. `prepareExistingBlocks` (not `prepareBlocks`) keeps
 *    whatever ids are already stored, so splicing into Square's list does not
 *    rewrite the React key of the buyers guide sitting next to it.
 */
async function writeProcessorBlocks(
  slug: string,
  opts: { seo?: SeoSpec; blocks: BlockSpec[]; at: number; marker: string },
) {
  const doc = await Processor.findOne({ slug })
    .select("blocks longDescription seo")
    .lean<{
      blocks?: { type: string; id: string; data?: Record<string, unknown> }[];
      longDescription?: string;
      seo?: { keywords?: string[] };
    } | null>();
  if (!doc) {
    log(`  skipped processor ${slug} (not found). Run \`npm run seed\` first`);
    return;
  }

  const scope = `processor:${slug}:25-08`;
  for (const b of opts.blocks) checkBlockHtml(scope, b);

  const existing = [...(doc.blocks ?? [])];
  const set: Record<string, unknown> = opts.seo
    ? seoSet(scope, withMergedKeywords(opts.seo, doc.seo?.keywords))
    : {};

  if (existing.some((b) => String(b.data?.html ?? "").includes(opts.marker))) {
    log(`  processor ${slug} already carries the 25-08 copy`);
    if (Object.keys(set).length && !DRY_RUN) {
      await Processor.updateOne({ slug }, { $set: set });
      log(`  refreshed ${slug} seo (${Object.keys(set).join(", ")})`);
    }
    return;
  }

  // The longDescription mirror, only when we are creating the list from nothing.
  const seeded =
    existing.length === 0 && doc.longDescription
      ? [{ type: "richtext", id: blockId(scope, 0), data: { html: doc.longDescription } }]
      : existing;

  const added = opts.blocks.map((b, i) => ({ ...b, id: blockId(scope, i + 1) }));
  const at = Math.min(Math.max(opts.at, 0), seeded.length);
  const next = [...seeded.slice(0, at), ...added, ...seeded.slice(at)];

  const parsed = prepareExistingBlocks(scope, next);
  set.blocks = parsed;

  if (DRY_RUN) {
    log(
      `  [dry-run] processor ${slug}: ${existing.length} -> ${next.length} blocks` +
        `${existing.length === 0 && doc.longDescription ? " (longDescription seeded as #0)" : ""}` +
        `, insert at ${at}${opts.seo ? `, seo: ${Object.keys(seoSet(scope, opts.seo)).join(", ")}` : ""}`,
    );
    return;
  }
  await Processor.updateOne({ slug }, { $set: set });
  log(`  updated processor ${slug} (${next.length} blocks)`);
}

/** Same splice, for a PageSeo route record that already has an editorial block list. */
async function insertPageSeoBlocks(
  pageKey: string,
  opts: { seo?: SeoSpec; blocks: BlockSpec[]; at: number; marker: string },
) {
  const doc = await PageSeo.findOne({ pageKey }).lean<{
    blocks?: { type: string; id: string; data?: Record<string, unknown> }[];
    seo?: { keywords?: string[] };
  } | null>();
  if (!doc) {
    log(`  skipped PageSeo ${pageKey} (not found). Run \`npm run seed:seo\` first`);
    return;
  }

  const scope = `pageseo:${pageKey}:25-08`;
  for (const b of opts.blocks) checkBlockHtml(scope, b);

  const seoPaths = opts.seo ? seoSet(scope, withMergedKeywords(opts.seo, doc.seo?.keywords)) : {};

  const existing = [...(doc.blocks ?? [])];
  if (existing.some((b) => String(b.data?.html ?? "").includes(opts.marker))) {
    log(`  PageSeo ${pageKey} already carries the 25-08 copy`);
    if (Object.keys(seoPaths).length && !DRY_RUN) {
      await PageSeo.updateOne({ pageKey }, { $set: seoPaths });
      log(`  refreshed ${pageKey} seo (${Object.keys(seoPaths).join(", ")})`);
    }
    return;
  }

  const added = opts.blocks.map((b, i) => ({ ...b, id: blockId(scope, i) }));
  const at = Math.min(Math.max(opts.at, 0), existing.length);
  const next = [...existing.slice(0, at), ...added, ...existing.slice(at)];

  const set: Record<string, unknown> = {
    blocks: prepareExistingBlocks(scope, next),
    ...seoPaths,
  };

  if (DRY_RUN) {
    log(`  [dry-run] PageSeo ${pageKey}: ${existing.length} -> ${next.length} blocks, insert at ${at}`);
    return;
  }
  await PageSeo.updateOne({ pageKey }, { $set: set });
  log(`  updated PageSeo ${pageKey} (${next.length} blocks)`);
}

/**
 * Keywords are ADDED to, never swapped out.
 *
 * `seoSet` writes `seo.keywords` as a whole array, so handing it this delivery's
 * six terms would silently drop whatever the page already ranked for. Square
 * carried "clover vs square" and "elavon vs square"; the ACH facet carried its
 * own focus keyword. Both would have gone.
 */
const withMergedKeywords = (spec: SeoSpec, existing: unknown): SeoSpec =>
  spec.keywords ? { ...spec, keywords: mergeKeywords(existing, spec.keywords) } : spec;

/**
 * `readingTimeMinutes` is NOT a model hook — it is recomputed by the two
 * `/api/seoteam/posts` routes on every save (`computeReadingTime`). A script
 * writing `content` with `updateOne` bypasses that entirely and leaves a stale
 * number under the byline, which after a 20 to 40 percent body growth is a
 * visible lie on the page.
 *
 * The real implementation lives behind `lib/html-analyze.ts`, which imports
 * `server-only` and so cannot run under tsx (the same constraint `content-kit`
 * documents for the sanitizer). This mirrors its arithmetic: strip tags, collapse
 * whitespace, count words, divide by 200, floor at 1.
 */
const readingTime = (html: string): number => {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Math.max(1, Math.round((text ? text.split(/\s+/).length : 0) / 200));
};

interface BodyEdit {
  label: string;
  /** Applied only if this string is ABSENT from the body, which makes the run idempotent. */
  absent: string;
  apply: (html: string) => string;
}

/** Replace `find` with `replace` exactly once, and shout if `find` was not there. */
const swap =
  (find: string, replace: string) =>
  (html: string): string => {
    if (!html.includes(find)) throw new Error(`anchor not found: ${JSON.stringify(find.slice(0, 60))}`);
    return html.replace(find, replace);
  };

/**
 * Edit a blog post's `content` in place.
 *
 * Blog posts are the one model where blocks are NOT the answer: `content` is the
 * authoritative body (`injectKeywordLinks`, the reading-time calculation and
 * `lib/seo-checks.ts` all read it, and blocks render below it), so copy that has
 * to appear at a specific point in the article has to go into `content` itself.
 * Each edit carries its own absence probe so a re-run is a no-op.
 */
async function editBlogPost(
  slug: string,
  opts: { seo?: SeoSpec; title?: string; edits: BodyEdit[] },
) {
  const doc = await BlogPost.findOne({ slug })
    .select("content title readingTimeMinutes seo")
    .lean<{
      content: string;
      title: string;
      readingTimeMinutes?: number;
      seo?: { keywords?: string[] };
    } | null>();
  if (!doc) {
    log(`  skipped blog post ${slug} (not found)`);
    return;
  }

  const scope = `blog:${slug}`;
  let html = doc.content;
  const applied: string[] = [];

  for (const edit of opts.edits) {
    if (html.includes(edit.absent)) continue;
    html = edit.apply(html);
    applied.push(edit.label);
  }

  checkBlockHtml(scope, { type: "richtext", data: { html } });

  const minutes = readingTime(html);
  const set: Record<string, unknown> = {
    ...(opts.seo ? seoSet(scope, withMergedKeywords(opts.seo, doc.seo?.keywords)) : {}),
    ...(opts.title && opts.title !== doc.title ? { title: opts.title } : {}),
    ...(html !== doc.content ? { content: html } : {}),
    ...(minutes !== doc.readingTimeMinutes ? { readingTimeMinutes: minutes } : {}),
  };

  if (!Object.keys(set).length) {
    log(`  blog post ${slug} already up to date`);
    return;
  }
  if (DRY_RUN) {
    log(
      `  [dry-run] blog ${slug}: ${applied.length ? applied.join(", ") : "no body edits"}` +
        ` (${doc.content.length} -> ${html.length} chars); $set ${Object.keys(set).join(", ")}`,
    );
    return;
  }
  await BlogPost.updateOne({ slug }, { $set: set });
  log(`  updated blog ${slug}: ${applied.length ? applied.join(", ") : "seo only"}`);
}

// ---------------------------------------------------------------------------

async function main() {
  await connectToDatabase();
  if (DRY_RUN) log("DRY RUN. Nothing will be written.\n");

  log("Braintree profile");
  await writeProcessorBlocks("braintree", {
    seo: BRAINTREE_SEO,
    blocks: BRAINTREE_BLOCKS,
    at: 1, // after the longDescription mirror this run seeds as #0
    marker: BRAINTREE_MARKER,
  });

  log("\nAdyen profile");
  await writeProcessorBlocks("adyen", {
    seo: ADYEN_SEO,
    blocks: ADYEN_BLOCKS,
    at: 1,
    marker: ADYEN_MARKER,
  });

  log("\nSquare profile");
  await writeProcessorBlocks("square", {
    // Square already has a researched metaTitle/description; only the keyword
    // list is widened, and `seoSet` leaves every path it is not given alone.
    seo: SQUARE_SEO,
    blocks: SQUARE_BLOCKS,
    at: 1, // between the existing overview richtext and the buyers guide
    marker: SQUARE_MARKER,
  });

  log("\nACH facet page");
  await insertPageSeoBlocks("payment-processors-ach", {
    seo: ACH_SEO,
    blocks: ACH_BLOCKS,
    at: 0, // above the existing buyers guide
    marker: ACH_MARKER,
  });

  log("\nABA routing number post");
  await editBlogPost(ABA_SLUG, {
    seo: ABA_SEO,
    edits: [
      {
        label: "direct answer in the opening",
        absent: "Is an ABA number the same as a routing number?",
        apply: swap(
          "<h2>What Is an ABA Routing Number?</h2>",
          `${ABA_ANSWER}<h2>What Is an ABA Routing Number?</h2>`,
        ),
      },
      {
        label: "outbound links after the bottom line",
        absent: "SWIFT codes and BICs",
        apply: (html) => `${html}${ABA_LINKS}`,
      },
      {
        label: "repair welded sentence (nine-digit code)",
        absent: "nine-digit code. The terminology",
        apply: swap(
          "same underlying nine-digit code the terminology just depends",
          "same underlying nine-digit code. The terminology just depends",
        ),
      },
      {
        label: "repair welded sentence (transaction type)",
        absent: "transaction type, because using the wrong one",
        apply: swap(
          "applies to that specific transaction type using the wrong one can delay",
          "applies to that specific transaction type, because using the wrong one can delay",
        ),
      },
      {
        label: "repair welded sentence (double-check)",
        absent: "is identical. Always double-check",
        apply: swap(
          "the routing number is identical always double-check.",
          "the routing number is identical. Always double-check.",
        ),
      },
      {
        label: "repair welded sentence (bottom line)",
        absent: "financial system. It works alongside",
        apply: swap(
          "within the US financial system it works alongside your account number",
          "within the US financial system. It works alongside your account number",
        ),
      },
      {
        label: "en dash list separators to colons (11)",
        // The probe is the state AFTER the edit, like every other one here.
        // Probing for the dash itself would invert the check and skip the fix.
        absent: "<strong>Direct deposit:</strong>",
        // Every one of the 11 is `<strong>Label</strong> – text`, and the post
        // already uses `<strong>Label:</strong> text` in its last list, so this
        // makes the page internally consistent as well as dash-clean.
        apply: (html) => html.replaceAll("</strong> – ", ":</strong> "),
      },
    ],
  });

  log("\nPCI compliance post");
  await editBlogPost(PCI_SLUG, {
    seo: PCI_SEO,
    title: "What Is PCI Compliance? A Complete Guide to Protecting Payment Card Data",
    edits: [
      {
        label: "the four compliance levels + SAQ A shortcut",
        absent: "The Four PCI Compliance Levels",
        apply: swap(PCI_LEVELS_ANCHOR, `${PCI_LEVELS_SECTION}${PCI_LEVELS_ANCHOR}`),
      },
      {
        label: "em dash out (house rule)",
        absent: "best practice. It is a requirement",
        apply: swap(
          "not just a best practice—it is a requirement",
          "not just a best practice. It is a requirement",
        ),
      },
    ],
  });

  log("\nDone.");
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
