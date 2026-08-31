import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { compareHref } from "@/lib/compare-pairs";
import { seoDefaults } from "@/config/content-engine";
import { Processor } from "@/models";
import {
  DRY_RUN,
  blockId,
  checkBlockHtml,
  checkFaqs,
  log,
  mergeKeywords,
  prepareExistingBlocks,
  richtext,
  seoSet,
  type BlockSpec,
  type SeoSpec,
} from "./content-kit";

/**
 * scripts/seed-braintree-profile.ts — the 2026-08-31 Braintree delivery.
 *
 *   npm run seed:braintree-profile -- --check     # validate the copy, no DB needed
 *   npm run seed:braintree-profile -- --dry-run   # print every change, write nothing
 *   npm run seed:braintree-profile                # apply
 *
 * One script per doc delivery, sharing `./content-kit` — the same rule as
 * `seed-doc-content.ts`, `seed-lowkd-content.ts` and `seed-lowkd-additional.ts`.
 * Every write is a targeted `$set`, so a field this delivery has nothing to say
 * about is left exactly as an editor left it.
 *
 * ─── What the doc is, and where each part lands ─────────────────────────────
 *
 * A full rewrite of the `/processor/braintree` PROFILE (not `/reviews`, which is
 * merchant feedback and keeps its own copy under `reviewsPage.*`). It targets
 * "braintree review", "braintree fees / pricing", the long-tail "braintree ICI
 * fees", and the three-way "braintree vs stripe vs paypal" comparison.
 *
 * | Doc section                      | Lands on                                   |
 * |----------------------------------|--------------------------------------------|
 * | Page H1 "Braintree Review"       | `seo.h1` (the profile renders it over the   |
 * |                                  | generated "Braintree review")               |
 * | What Is Braintree Payments?      | richtext block 1                            |
 * | How Braintree works              | richtext block 2                            |
 * | Braintree Pricing and Fees       | richtext block 3 (+ the "Is Braintree       |
 * |                                  | expensive?" h3)                             |
 * | Braintree ICI Fees Explained     | richtext block 4 (3 h3 subsections)         |
 * | Braintree vs Stripe vs PayPal    | richtext block 5                            |
 * | Who Is Braintree Best For?       | richtext block 6                            |
 * | Is Braintree a Good Processor?   | richtext block 7                            |
 * | Pros / Cons                      | the `pros` / `cons` ARRAYS, never a block   |
 * | 12 FAQs                          | `faqs` (renders as the FAQ section, and     |
 * |                                  | feeds FAQPage JSON-LD via the engine)       |
 * | Best for / Regions / Industries  | already on the record, unchanged            |
 * | Listed in / Alternatives / stats | rendered natively by the profile route      |
 *
 * Blocks all render inside the profile's Overview section, which is what puts a
 * doc "Pricing and Fees" heading directly above the page's own `Pricing` H2.
 * That is the route's shape, not a bug.
 *
 * ─── Decisions taken on the writer's copy ───────────────────────────────────
 *
 * 1. **The doc's fee-breakdown TABLE is not reproduced.** The profile already
 *    renders `processors.fees` as a two-column table in the Pricing section a few
 *    hundred pixels below this prose, with the same numbers in it. A second,
 *    identical table is duplicate content for a reader and adds nothing for a
 *    crawler, so the figures are stated once in the pricing paragraph, which then
 *    points down at the table. The one row the stored `fees` shape cannot hold
 *    (Venmo, 3.49% + $0.49) is therefore stated in the prose AND in an FAQ.
 * 2. **The doc's Features / Payment methods lists are enum-bound.** "Payment
 *    vaulting" is the `tokenization` token the record already carries, and
 *    "Custom integrations" is `api`; both already render. `venmo` was genuinely
 *    missing and has been added to `PAYMENT_METHODS` (`lib/enums.ts`) plus its
 *    label, because the doc names Venmo as a differentiator six times and the
 *    directory's method filter had no way to express it. It is set on Braintree
 *    only; PayPal's own listing is a separate call.
 * 3. **Cons.** The doc's five are used, with two adjustments: its vague "Support
 *    experience can vary" is sharpened to the structural fact the reviews page
 *    documents at length (email and ticket only, routed through PayPal), and the
 *    record's existing "fewer in-person options" con is kept, because it is a
 *    real differentiator the doc simply does not mention.
 * 4. **Meta.** The doc supplied no SEO title or description, and the listing had
 *    none, so the profile was falling back to a 33-character generated title.
 *    Both are written here to the house rules: no "&", no brand suffix, no
 *    non-ASCII glyphs, inside the 50-60 / 150-160 character bands
 *    (`npm run audit:meta`).
 * 5. **House rules on the body.** Em and en dashes out (`npm run audit:dashes`),
 *    the doc's bullet glyphs turned into real `<ul>` / `<ol>`, and every internal
 *    link target checked: the two compare hrefs are built with `compareHref`
 *    because both pairs are curated, and the three category links match the
 *    listing's own `categorySlugs`.
 *
 * ─── How re-running works ───────────────────────────────────────────────────
 *
 * The Braintree profile already carried three blocks from the 2026-08-25
 * delivery (`seed-lowkd-additional.ts`): a mirror of `longDescription`, "What
 * Braintree actually charges", and "Braintree vs Stripe vs PayPal: the actual
 * decision points". This delivery SUPERSEDES all three. Its pricing section and
 * its vs-section say the same things at more depth, and leaving both in place
 * would state Braintree's rate three times on one screen.
 *
 * `SUPERSEDED_IDS` therefore lists those blocks by their deterministic ids (with
 * a text marker as a fallback, in case an editor has since re-created them),
 * plus THIS delivery's own ids. The new blocks are written at the position of
 * the first superseded block, every other block keeps its id and its order, and
 * a second run replaces this delivery's own blocks in place rather than
 * appending a duplicate set.
 *
 * If the listing turns out to have no blocks at all, the new list still opens
 * with "What Is Braintree Payments?", which is a superset of the stored
 * `longDescription` that the profile would otherwise render. Nothing is lost
 * when blocks take over from it (see the note in `seed-lowkd-additional.ts`).
 */

const SLUG = "braintree";
const SCOPE = `processor:${SLUG}:31-08`;

/** Validate the copy and print it, with no Mongo connection. See `validateCopy`. */
const CHECK_ONLY = process.argv.includes("--check");

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const SEO: SeoSpec = {
  metaTitle: "Braintree Payments Review: Fees, Pricing and Features",
  metaDescription:
    "Braintree charges 2.89% + $0.29 with no monthly fee. Our review covers Braintree pricing, ICI and interchange-plus fees, Venmo rates, features, pros and cons.",
  h1: "Braintree Review",
  focusKeyword: "braintree review",
  keywords: [
    "braintree review",
    "braintree payments",
    "braintree fees",
    "braintree pricing",
    "braintree ici fees",
    "braintree interchange plus",
    "braintree vs stripe",
    "braintree vs paypal",
    "braintree transaction fees",
    "is braintree owned by paypal",
    "braintree venmo fee",
    "braintree chargeback fee",
    "is braintree cheaper than stripe",
  ],
};

// ---------------------------------------------------------------------------
// Blocks (all render inside the profile's Overview section)
// ---------------------------------------------------------------------------

const BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>What Is Braintree Payments?</h2>" +
      "<p>Braintree Payments is a payment processing platform owned by PayPal. It lets businesses accept credit cards, debit cards, PayPal, Venmo and digital wallets through websites and mobile apps.</p>" +
      "<p>Braintree combines payment processing with developer tools, recurring billing, payment method storage, fraud protection and support for multiple currencies. It is most often used by ecommerce businesses, SaaS companies, subscription services, marketplaces, and businesses that want to offer PayPal alongside card payments.</p>" +
      "<p>Braintree was founded in Chicago in 2007 and was acquired by eBay in 2013 for approximately $800 million. It operates today as part of PayPal's payments business.</p>" +
      "<p>PayPal describes Braintree as a full-stack payment platform: payment processing, gateway services, merchant account capabilities, recurring billing, payment card storage, foreign currency acceptance, and the APIs and SDKs that tie those together.</p>",
  ),
  richtext(
    "<h2>How Braintree works</h2>" +
      "<p>Braintree sits between your checkout, the payment networks, and the customer's bank or payment provider. A typical transaction runs like this:</p>" +
      "<ol>" +
      "<li>The customer chooses a payment method at checkout.</li>" +
      "<li>Braintree securely sends the payment details for authorization.</li>" +
      "<li>The payment network and the issuing bank approve or decline the transaction.</li>" +
      "<li>Braintree processes the approved payment.</li>" +
      "<li>The funds settle and are paid out to the merchant.</li>" +
      "</ol>" +
      "<p>Businesses integrate through Braintree's APIs, its Drop-in UI, mobile SDKs, payment links and supported ecommerce plugins, so one account can serve a website and a mobile app without a second contract or a second checkout flow.</p>",
  ),
  richtext(
    "<h2>Braintree Pricing and Fees</h2>" +
      "<p>Braintree's standard US card rate is <strong>2.89% + $0.29</strong> per transaction, with no monthly fee. Additional fees apply depending on the payment method, card origin, currency and transaction type: international cards and non-USD settlement each add 1%, ACH runs 0.75% capped at $5, Venmo is priced separately at 3.49% + $0.49, and a chargeback costs $15. Processing fees are not returned when a transaction is refunded. The full row-by-row breakdown is in the pricing table below.</p>" +
      '<p>Braintree also offers custom flat rates, <a href="/payment-processors/interchange-plus">interchange-plus pricing</a> and discounted rates to eligible established businesses, based on factors such as business model and processing volume. Those are the current published US standard rates; pricing differs by country and by merchant agreement.</p>' +
      "<h3>Is Braintree expensive?</h3>" +
      "<p>The standard flat rate is easy to understand, but it is not the cheapest option for a high-volume merchant. As volume grows, the number worth watching is your effective rate, meaning total processing cost divided by total volume, rather than the headline percentage.</p>" +
      "<p>For a small business, a flat rate with no monthly fee is usually worth more than shaving basis points off individual transactions. For a larger business, negotiating the pricing model has a bigger impact on total payment costs than anything else on this page, and Braintree makes custom and interchange-plus pricing available specifically to eligible established merchants.</p>",
  ),
  richtext(
    "<h2>Braintree ICI Fees Explained</h2>" +
      '<p>If you are searching for Braintree ICI fees, you are almost certainly looking for interchange costs or interchange-plus pricing. There is no single universal "ICI fee" that applies to every Braintree merchant. Braintree offers both blended flat pricing and Interchange Plus pricing, and what you pay depends on your pricing agreement and your transaction mix.</p>' +
      "<h3>What is interchange?</h3>" +
      "<p>Interchange is the fee attached to a card transaction, set by the applicable card network rules. The cost varies with:</p>" +
      "<ul>" +
      "<li>Card type</li>" +
      "<li>Credit or debit card</li>" +
      "<li>Consumer or commercial card</li>" +
      "<li>Card-present or card-not-present transaction</li>" +
      "<li>Merchant category</li>" +
      "<li>Transaction characteristics</li>" +
      "<li>Card issuing country</li>" +
      "</ul>" +
      "<p>Which is why there is no single interchange percentage that applies to every Braintree transaction.</p>" +
      "<h3>How does Braintree interchange-plus pricing work?</h3>" +
      "<p>Under interchange-plus pricing, the cost is separated into the underlying interchange cost and the processor's agreed markup. In plain terms: interchange, plus applicable network costs, plus the Braintree or acquirer markup, equals your total processing cost. Braintree's own agreement states that merchants can choose between blended pricing and Interchange Plus pricing where available.</p>" +
      "<h3>Is Braintree interchange-plus cheaper?</h3>" +
      '<p>It can be, particularly for a business processing significant volume, but it is not automatically cheaper. The total depends on your transaction mix, average transaction size, card types, share of international transactions, and the markup you negotiate. Compare the effective processing rate rather than the advertised percentage. Our <a href="/payment-processors/interchange-plus">interchange-plus pricing guide</a> walks through how to run that comparison.</p>',
  ),
  richtext(
    "<h2>Braintree vs Stripe vs PayPal</h2>" +
      "<p>The best option depends on your payment methods, business size, technical requirements and processing volume.</p>" +
      "<ul>" +
      "<li><strong>Choose Braintree</strong> if you want PayPal and Venmo alongside cards, need recurring billing, or already operate inside the PayPal ecosystem.</li>" +
      '<li><strong>Choose <a href="/processor/stripe">Stripe</a></strong> if you want the deepest developer tooling, the widest set of integrations, and a broader financial product ecosystem around billing and invoicing.</li>' +
      '<li><strong>Choose <a href="/processor/paypal">PayPal</a> directly</strong> if you are a smaller business that wants a familiar PayPal checkout and the fastest possible setup.</li>' +
      '<li><strong>Choose <a href="/processor/adyen">Adyen</a></strong> if you are a larger or international business that needs global coverage and interchange-plus pricing as standard.</li>' +
      "</ul>" +
      `<p>For the full side-by-side, see our <a href="${compareHref(["stripe", "braintree"])}">Stripe vs Braintree comparison</a> and our <a href="${compareHref(["paypal", "braintree"])}">PayPal vs Braintree comparison</a>. For merchant feedback on support and account stability, see the <a href="/processor/braintree/reviews">Braintree reviews</a>, or browse the full <a href="/processors">processor directory</a>.</p>`,
  ),
  richtext(
    "<h2>Who Is Braintree Best For?</h2>" +
      "<ul>" +
      '<li><strong>SaaS and subscription businesses.</strong> Recurring payments and stored payment methods are native, which covers memberships, SaaS and subscription billing. Compare the field in <a href="/category/subscriptions">subscriptions and SaaS processors</a>.</li>' +
      '<li><strong>Ecommerce businesses.</strong> Cards, PayPal, Venmo and supported digital wallets all arrive through a single integration. See the rest of the <a href="/category/ecommerce">ecommerce payment processors</a>.</li>' +
      '<li><strong>Developers.</strong> APIs, mobile SDKs and a Drop-in UI cover both a fully custom checkout and a fast install. See other <a href="/category/developers">processors for developers</a>.</li>' +
      "<li><strong>PayPal users.</strong> Braintree is the route to accepting cards while keeping PayPal in the checkout, without maintaining two separate payment integrations.</li>" +
      "<li><strong>Marketplaces.</strong> Braintree supports marketplace payment flows for businesses that need to facilitate payments between customers and sellers.</li>" +
      "</ul>",
  ),
  richtext(
    "<h2>Is Braintree a Good Payment Processor?</h2>" +
      "<p>Braintree is a strong option for online businesses that need card processing alongside PayPal, Venmo and digital wallets. The standard pricing is simple, but any business processing significant volume should look past the headline 2.89% + $0.29 rate. Eligible established merchants can access custom flat rates or interchange-plus pricing, and that changes the economics substantially as payment volume grows.</p>" +
      '<p>For a smaller business, straightforward pricing and no monthly fee make it easy to get started. For a larger one, the useful question is not "what is Braintree\'s rate" but "what will my effective processing cost be under the pricing model I qualify for". The trade-off to weigh either way is support, which is email and ticket based and routed through PayPal, as the <a href="/processor/braintree/reviews">Braintree reviews</a> set out in detail.</p>' +
      '<p>If PayPal matters to your customers and you want it alongside card payments without maintaining separate integrations, Braintree is worth shortlisting. If it does not, judge it against <a href="/processor/stripe">Stripe</a> and the rest of the <a href="/processors">processor directory</a> on rate and tooling alone.</p>',
  ),
];

// ---------------------------------------------------------------------------
// Pros / cons (the arrays, NOT a block — the profile renders them itself, so a
// prosCons block here would print the same list twice)
// ---------------------------------------------------------------------------

const PROS = [
  "Native PayPal and Venmo acceptance",
  "Solid developer tooling and Drop-in UI",
  "No monthly fee on standard pricing",
  "Recurring billing and payment vaulting built in",
  "Interchange-plus pricing available to eligible businesses",
];

const CONS = [
  "Standard pricing gets expensive at higher volumes",
  "International cards and non-USD settlement each add 1%",
  "$15 chargeback fee, and processing fees are not returned on refunds",
  "Pricing varies by merchant agreement and region",
  "Support is email and ticket based, routed through PayPal",
  "Fewer in-person and point-of-sale options than a full-service processor",
];

// ---------------------------------------------------------------------------
// FAQs (render as the profile's FAQ section + feed FAQPage JSON-LD)
// ---------------------------------------------------------------------------

const FAQS = [
  {
    question: "What is Braintree Payments?",
    answer:
      "Braintree Payments is a PayPal-owned payment processing platform that lets businesses accept credit cards, debit cards, PayPal, Venmo, digital wallets and other supported payment methods online and in mobile apps.",
  },
  {
    question: "Is Braintree owned by PayPal?",
    answer:
      "Yes. Braintree is part of PayPal. It was founded in Chicago in 2007 and acquired by eBay in 2013, before becoming part of PayPal's payments business.",
  },
  {
    question: "How much does Braintree charge per transaction?",
    answer:
      "The current standard US rate for cards and third-party digital wallets is 2.89% + $0.29 per transaction. Other fees apply depending on the transaction and the payment method: international cards and non-USD settlement add 1% each, and ACH runs 0.75% capped at $5.",
  },
  {
    question: "Does Braintree have a monthly fee?",
    answer: "No. Braintree's standard US pricing has no monthly fee and no setup fee.",
  },
  {
    question: "What are Braintree ICI fees?",
    answer:
      'There is no single standard Braintree "ICI fee". If you mean interchange or interchange-plus fees, Braintree offers Interchange Plus pricing where available. Under that model the applicable interchange cost is separated from the processor\'s markup, so what you pay moves with your card mix rather than sitting at one published percentage.',
  },
  {
    question: "Does Braintree offer interchange-plus pricing?",
    answer:
      "Yes. Braintree states that established businesses may be eligible for interchange-plus pricing, custom flat rates or discounted rates, based on their business model and processing volume.",
  },
  {
    question: "Is Braintree good for SaaS businesses?",
    answer:
      "Yes. Braintree supports recurring billing, stored payment methods and developer integrations, which covers most SaaS and subscription billing requirements without a separate billing platform.",
  },
  {
    question: "Does Braintree support PayPal?",
    answer:
      "Yes. Braintree accepts PayPal alongside card payments through the same integration. PayPal transactions are subject to the applicable PayPal merchant fees.",
  },
  {
    question: "Does Braintree support Venmo?",
    answer:
      "Yes. Venmo is available to eligible US merchants. The current published US rate is 3.49% + $0.49 per transaction, which is priced separately from the standard card rate.",
  },
  {
    question: "Does Braintree charge a chargeback fee?",
    answer: "Yes. The current published US chargeback fee is $15 per chargeback.",
  },
  {
    question: "Are Braintree processing fees refunded?",
    answer:
      "No. Braintree states that transaction processing fees are not returned when a transaction is refunded, so a refunded sale still costs you the original processing fee.",
  },
  {
    question: "Is Braintree better than Stripe?",
    answer:
      "Neither is universally better. Braintree suits businesses that want PayPal and Venmo alongside card processing; Stripe suits businesses that want the broadest developer and financial-product ecosystem. The two price within a few basis points of each other, so the decision usually comes down to payment methods, transaction mix and technical requirements rather than the rate.",
  },
];

// ---------------------------------------------------------------------------
// Supersession
// ---------------------------------------------------------------------------

type StoredBlock = { type: string; id: string; data?: Record<string, unknown> };

/**
 * Blocks this delivery replaces, matched by id first and by a text marker as a
 * fallback. Ids are deterministic (`blockId(scope, index)`), which is what lets a
 * later delivery name an earlier one's output exactly.
 *
 * Anything NOT matched here is an admin's own block and is preserved untouched,
 * in its original order.
 */
const SUPERSEDED_SCOPES: { scope: string; count: number }[] = [
  // 2026-08-25 (`seed-lowkd-additional.ts`): the longDescription mirror at index
  // 0, then "What Braintree actually charges" and the vs-section at 1 and 2.
  { scope: `processor:${SLUG}:25-08`, count: 3 },
  // This delivery's own blocks, so a second run replaces rather than appends.
  { scope: SCOPE, count: BLOCKS.length },
];

const SUPERSEDED_IDS = new Set(
  SUPERSEDED_SCOPES.flatMap(({ scope, count }) =>
    Array.from({ length: count }, (_, i) => blockId(scope, i)),
  ),
);

/** Fallback probes, in case an editor re-created any of the above by hand. */
const SUPERSEDED_MARKERS = [
  "What Braintree actually charges",
  "the actual decision points",
  "<h2>What Is Braintree Payments?</h2>",
  "<h2>How Braintree works</h2>",
  "<h2>Braintree Pricing and Fees</h2>",
  "<h2>Braintree ICI Fees Explained</h2>",
  "<h2>Braintree vs Stripe vs PayPal</h2>",
  "<h2>Who Is Braintree Best For?</h2>",
  "<h2>Is Braintree a Good Payment Processor?</h2>",
];

const isSuperseded = (b: StoredBlock): boolean =>
  SUPERSEDED_IDS.has(b.id) ||
  SUPERSEDED_MARKERS.some((m) => String(b.data?.html ?? "").includes(m));

// ---------------------------------------------------------------------------

/**
 * Everything the copy can be judged on WITHOUT a database: the HTML allowlist,
 * the block schema the admin form saves through, the FAQ schema, the SEO schema,
 * and the two advisory meta length bands from `config/content-engine.ts`.
 *
 * Split out and reachable as `--check` because a bad shape should be catchable
 * before anyone has a Mongo connection in front of them. `--dry-run` still needs
 * one, since what it reports is the diff against what is actually stored.
 */
function validateCopy() {
  for (const b of BLOCKS) checkBlockHtml(SCOPE, b);
  // `blocksSchema` is `.optional()`, so the parse result is typed as possibly
  // undefined even though a non-empty list can never come back that way.
  const blocks =
    prepareExistingBlocks(
      SCOPE,
      BLOCKS.map((b, i) => ({ ...b, id: blockId(SCOPE, i) })),
    ) ?? [];
  const faqs = checkFaqs(SCOPE, FAQS);
  const seoPaths = seoSet(SCOPE, SEO);

  log(`${blocks.length} blocks, ${faqs?.length ?? 0} FAQs, ${PROS.length} pros, ${CONS.length} cons`);
  log(`seo paths: ${Object.keys(seoPaths).join(", ")}`);
  log(
    `metaTitle ${SEO.metaTitle?.length} chars (band ${seoDefaults.titleLength.min}-${seoDefaults.titleLength.max}), ` +
      `metaDescription ${SEO.metaDescription?.length} chars ` +
      `(band ${seoDefaults.descriptionLength.min}-${seoDefaults.descriptionLength.max})`,
  );
  for (const b of blocks) {
    const html = String((b.data as { html?: string } | undefined)?.html ?? "");
    log(`  ${b.id}  ${/<h2>(.*?)<\/h2>/.exec(html)?.[1] ?? b.type}`);
  }
}

async function main() {
  if (CHECK_ONLY) {
    validateCopy();
    return;
  }

  await connectToDatabase();
  if (DRY_RUN) log("DRY RUN. Nothing will be written.\n");

  const doc = await Processor.findOne({ slug: SLUG })
    .select("blocks longDescription seo pros cons paymentMethods faqs")
    .lean<{
      blocks?: StoredBlock[];
      longDescription?: string;
      seo?: { keywords?: string[] };
      pros?: string[];
      cons?: string[];
      paymentMethods?: string[];
      faqs?: { question: string; answer: string }[];
    } | null>();

  if (!doc) {
    log(`processor ${SLUG} not found. Run \`npm run seed\` first.`);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  for (const b of BLOCKS) checkBlockHtml(SCOPE, b);

  const existing = [...(doc.blocks ?? [])];
  const firstSuperseded = existing.findIndex(isSuperseded);
  const kept = existing.filter((b) => !isSuperseded(b));
  const at = firstSuperseded === -1 ? 0 : Math.min(firstSuperseded, kept.length);

  const added = BLOCKS.map((b, i) => ({ ...b, id: blockId(SCOPE, i) }));
  const next = [...kept.slice(0, at), ...added, ...kept.slice(at)];

  // `seoSet` writes `seo.keywords` whole, so the listing's existing terms are
  // merged in rather than overwritten (the schema caps the union at 20).
  const seo = { ...SEO, keywords: mergeKeywords(doc.seo?.keywords, SEO.keywords ?? []) };
  const seoPaths = seoSet(SCOPE, seo);

  const paymentMethods = Array.from(new Set([...(doc.paymentMethods ?? []), "venmo"]));

  const set: Record<string, unknown> = {
    ...seoPaths,
    blocks: prepareExistingBlocks(SCOPE, next),
    faqs: checkFaqs(SCOPE, FAQS),
    pros: PROS,
    cons: CONS,
    paymentMethods,
  };

  if (DRY_RUN) {
    log(`processor ${SLUG}`);
    log(
      `  blocks: ${existing.length} stored -> ${next.length} ` +
        `(${existing.length - kept.length} superseded, ${kept.length} kept, ` +
        `${added.length} written at index ${at})`,
    );
    for (const b of next) {
      const html = String((b.data as { html?: string } | undefined)?.html ?? "");
      const heading = /<h2>(.*?)<\/h2>/.exec(html)?.[1] ?? `${b.type} block`;
      log(`      ${added.some((a) => a.id === b.id) ? "NEW " : "kept"}  ${b.id}  ${heading}`);
    }
    log(`  faqs: ${doc.faqs?.length ?? 0} -> ${FAQS.length}`);
    log(
      `  pros: ${doc.pros?.length ?? 0} -> ${PROS.length}, ` +
        `cons: ${doc.cons?.length ?? 0} -> ${CONS.length}`,
    );
    log(
      `  paymentMethods: ${(doc.paymentMethods ?? []).join(", ")} -> ${paymentMethods.join(", ")}`,
    );
    log(`  seo: ${Object.keys(seoPaths).join(", ")}`);
    await mongoose.disconnect();
    return;
  }

  await Processor.updateOne({ slug: SLUG }, { $set: set });
  log(
    `updated processor ${SLUG}: ${next.length} blocks, ${FAQS.length} FAQs, ` +
      `${PROS.length} pros, ${CONS.length} cons, seo rewritten`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
