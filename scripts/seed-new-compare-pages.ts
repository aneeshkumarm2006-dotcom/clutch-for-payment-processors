import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { compareHref } from "@/lib/compare-pairs";
import { Processor } from "@/models";
import {
  DRY_RUN,
  comparison,
  log,
  richtext,
  upsertPageSeoRoute,
  type BlockSpec,
  type SeoSpec,
} from "./content-kit";

/**
 * scripts/seed-new-compare-pages.ts — the 2026-09-02 delivery, i.e. the four
 * head-to-heads in `New Comparison Pages .md` (Stripe vs Square, PayPal vs
 * Square, Stripe vs Braintree, PayPal vs Braintree).
 *
 *   npm run seed:new-compare-pages -- --dry-run   # print every change, write nothing
 *   npm run seed:new-compare-pages                # apply
 *
 * Same contract as `seed-doc-content.ts` / `seed-lowkd-content.ts`, sharing their
 * plumbing via `./content-kit`: nothing is hardcoded into a page, everything
 * lands in Mongo as `seo`, `faqs` and `blocks` on a `PageSeo` record, and every
 * write is a targeted `$set` so re-running is safe.
 *
 * ─── No new pages: all four URLs already existed ────────────────────────────
 * All four pairs are already curated in `lib/compare-pairs.ts`, so
 * `/compare/stripe-vs-square` and its three siblings have been live,
 * prerendered, indexable and in the sitemap (via `getSitemapEntries`) since
 * Stage 7.3. `keyword-page-map.csv` also already assigns each of the four target
 * keywords to exactly those URLs, marked `programmatic`. This doc is therefore
 * not a request for new pages; it is the editorial layer those four generated
 * pages were missing.
 *
 * Landing pages at `/stripe-vs-square` and friends were the alternative and are
 * the wrong call: two indexable pages on one query is the cannibalisation the
 * `clover vs square` note in `compare-pairs.ts` exists to avoid. Clover got a
 * `landing` record only because Clover had no published processor listing, so
 * the compare route would have 404'd for it. Stripe, PayPal, Square and
 * Braintree are all published, so that exception does not apply.
 *
 * ─── The one code change this needed ───────────────────────────────────────
 * `/compare/[pair]` was the last dynamic route with no editorial slot: it read
 * no `PageSeo` at all, so there was nowhere for this prose to land. It is now
 * wired the same way `/alternatives/[slug]` and `/payment-processors/[facet]`
 * already were (`pageSeoMetadata({ byPath: true })` + `getPageSeoByPath` →
 * `<Blocks>` + FAQs). Additive: the ~110 curated pairs with no record render
 * exactly as before.
 *
 * ─── The doc's "Quick comparison" tables are deliberately NOT shipped ───────
 * Each section opens with a 6-8 row table of online rate, in-person rate,
 * monthly fee and payout speed. `CompareTable` already renders every one of
 * those rows for both processors, a few hundred pixels ABOVE where this copy
 * sits, straight from `processors.fees`. Restating them in a `comparison` block
 * would create a second, hand-maintained copy of the fee card that drifts the
 * moment an admin edits a listing.
 *
 * What ships instead is one `comparison` block per page carrying ONLY the rows
 * the matrix has no field for: "Best for", "Setup complexity", "POS hardware",
 * "Consumer recognition", "Owned by", "Checkout experience". The doc's table
 * structure and cell text survive; the duplicated fee rows do not.
 *
 * ─── Numbers: two claims the doc gets wrong against the site's own data ─────
 * Every headline ONLINE rate in the doc matches `scripts/seed.ts` exactly
 * (Stripe 2.9% + $0.30, PayPal 2.99% + $0.49, Square 2.9% + $0.30, Braintree
 * 2.89% + $0.29). Two in-person claims do not, and both would have contradicted
 * the table on the same page:
 *
 *   1. Square in person — doc: "2.6% + $0.10".  Site: `inPersonCardRate`
 *      "2.6% + $0.15". It only appeared in the dropped tables, so it is moot.
 *   2. "Square is usually cheaper in person." Not true against either
 *      counterparty on the site's own numbers:
 *        - vs PayPal Zettle (2.29% + $0.09): Zettle is strictly cheaper, lower
 *          on BOTH the percentage and the fixed fee, at every ticket size.
 *        - vs Stripe Terminal (2.7% + $0.05): they cross at $100
 *          (2.7%x + 0.05 = 2.6%x + 0.15 → x = 100). Stripe is cheaper below it,
 *          Square above.
 *      Both sentences are rewritten to the site's numbers, keeping the doc's
 *      point that Square's in-person case is the hardware and software, not the
 *      rate. `pricingSummary` and `fees` are the authority here; if the doc's
 *      figures are the correct ones the fix is in `scripts/seed.ts`, not here.
 *
 * ─── House rules applied to the writer's copy ──────────────────────────────
 * - Meta titles shipped as written would have been "Stripe vs Square | Payment
 *   Processing Guide". A stored `metaTitle` renders VERBATIM, the brand suffix
 *   was stripped site-wide on 2026-08-01, and the site name is "Payment
 *   Processor Guide" (`SITE_NAME`) rather than the domain the doc used. All four
 *   ship with a descriptive tail instead, and all four are differentiated from
 *   the route's own generated fallback ("Compare A vs B: Fees and Features").
 * - Meta descriptions ship verbatim, except PayPal vs Braintree's, which opened
 *   "PayPal and Braintree are both owned by PayPal" (PayPal does not own
 *   itself).
 * - Google Docs escapes (`\+`) out; curly quotes folded to ASCII; the stripped
 *   em dashes the doc left as double spaces ("Minimal  sign up", "readers,
 *   terminals, registers is polished") restored as real punctuation rather than
 *   left as run-on sentences. `npm run audit:dashes` must stay clean.
 * - Every section heading demotes one level: the page's own `<h1>` is the pair
 *   name, so the doc's "Stripe vs Square: Which Payment Processor Is Right for
 *   You?" becomes an `<h2>` and its sub-sections `<h3>`.
 * - The doc has no internal links. Profile, reviews and sibling-comparison links
 *   were added; every compare href goes through `compareHref` rather than being
 *   hand-written, so a pair that is ever de-curated degrades to the `?ids=`
 *   builder instead of a 404.
 */

/** The four processors the copy names. All must be published for the pages to render. */
const REQUIRED_SLUGS = ["stripe", "paypal", "square", "braintree"];

/** Closing line the doc repeats under all four sections. */
const DISCLAIMER =
  "<p><em>Fees and terms change frequently. Confirm current rates directly with each provider before signing up.</em></p>";

interface ComparePageSpec {
  pageKey: string;
  path: string;
  /** Admin-facing label for the record. */
  title: string;
  seo: SeoSpec;
  faqs: { question: string; answer: string }[];
  blocks: BlockSpec[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. /compare/stripe-vs-square
// ═══════════════════════════════════════════════════════════════════════════

const STRIPE_SQUARE: ComparePageSpec = {
  pageKey: "compare-stripe-vs-square",
  path: "/compare/stripe-vs-square",
  title: "Compare: Stripe vs Square",
  seo: {
    metaTitle: "Stripe vs Square: Fees, Hardware and Setup Compared",
    metaDescription:
      "We compare Stripe vs Square, looking at their pricing, services included, the software and hardware required to use them and more.",
    focusKeyword: "stripe vs square",
    keywords: [
      "stripe vs square",
      "square vs stripe",
      "stripe vs square fees",
      "stripe or square",
      "stripe vs square for small business",
      "stripe vs square pos",
      "is stripe cheaper than square",
    ],
  },
  faqs: [
    {
      question: "Can I use Stripe and Square together?",
      answer:
        "Some businesses do: Square for in-person sales and Stripe for the online store or a custom app. Running two processors adds reconciliation overhead, so it is worth doing deliberately rather than by accident.",
    },
    {
      question: "Which has better fraud protection?",
      answer:
        "Both offer built-in fraud tools. Stripe's Radar is a more customizable, machine-learning-based system aimed at higher-volume online sellers. Square's fraud protection is simpler and tuned for in-person and standard online transactions.",
    },
    {
      question: "Which is cheaper for a small business?",
      answer:
        "Online they are identical at 2.9% + $0.30, so the answer comes down to in-person sales. Stripe Terminal charges 2.7% + $0.05 and Square charges 2.6% + $0.15, which means Stripe is cheaper on tickets under roughly $100 and Square is cheaper above that. Square is still the faster of the two to set up out of the box.",
    },
  ],
  blocks: [
    /*
      Only the rows `CompareTable` has no field for. Fees, monthly cost and
      payout speed are already rendered above this block from the listings.
    */
    comparison({
      title: "Stripe vs Square beyond the rate card",
      headers: ["Best for", "Setup complexity", "POS hardware"],
      rows: [
        {
          name: "Stripe",
          cells: [
            "Developers, SaaS, marketplaces",
            "Requires integration and dev work",
            "Limited (Terminal)",
          ],
        },
        {
          name: "Square",
          cells: [
            "Retail, restaurants, walk-in businesses",
            "Minimal: sign up and start selling",
            "Extensive (readers, registers, kiosks)",
          ],
        },
      ],
    }),
    richtext(
      `<h2>Stripe vs Square: which payment processor is right for you?</h2>` +
        `<p>Stripe and Square are two of the most widely used payment processors, but they are built for different kinds of businesses. <a href="/processor/stripe">Stripe</a> is a developer-first platform designed for building custom online payment experiences. <a href="/processor/square">Square</a> is an all-in-one system built around point-of-sale hardware and simplicity, with online payments layered on top. Here is how they compare.</p>` +
        `<h3>Where Stripe wins</h3>` +
        `<p>Stripe is built API-first. If you are building a custom checkout flow, a subscription billing system, a marketplace that splits payouts between multiple sellers, or an app that needs payments embedded directly into the product, Stripe's tooling is more flexible and more extensive. It supports a wide range of payment methods globally, has mature support for recurring billing, and its documentation is generally considered best-in-class for developers.</p>` +
        `<h3>Where Square wins</h3>` +
        `<p>Square is built for businesses that need to start accepting payments today without engineering resources. Its POS hardware, meaning the readers, terminals and registers, is polished and widely used in retail and food service. Square also bundles free tools many small businesses need anyway: invoicing, basic inventory management, appointment scheduling, and a free online store builder. For a business with a physical counter or storefront, Square typically gets you running faster than Stripe.</p>`,
    ),
    richtext(
      `<h3>Pricing in practice</h3>` +
        `<p>Both charge the same headline online rate (2.9% + $0.30), so pricing alone rarely decides this comparison. The real cost difference shows up in:</p>` +
        `<ul>` +
        `<li><strong>Hardware.</strong> Square sells card readers and terminals directly, with costs built into the ecosystem. Stripe's in-person options are more limited and generally aimed at businesses that already have a Stripe integration.</li>` +
        `<li><strong>Add-on tools.</strong> Square's free-tier tools (POS software, basic invoicing) can offset costs for small businesses that would otherwise pay for separate software. Stripe's ecosystem charges separately for most add-ons (Billing, Radar, Connect) but each is more powerful at scale.</li>` +
        `<li><strong>Volume discounts.</strong> Larger businesses processing significant volume can often negotiate custom <a href="/payment-processors/interchange-plus">interchange-plus pricing</a> with either provider, worth asking about once you are above roughly $250K a year in processing volume.</li>` +
        `</ul>` +
        `<p>In person the two separate on ticket size rather than on headline rate. Stripe Terminal's 2.7% + $0.05 and Square's 2.6% + $0.15 cross at about $100: below that Stripe is the cheaper card-present rate, above it Square is. On a typical coffee-shop basket Stripe wins on paper, which is exactly why the in-person case for Square is the hardware and the software around the transaction rather than the rate itself.</p>`,
    ),
    richtext(
      `<h3>Who should choose which</h3>` +
        `<p><strong>Choose Stripe if</strong> you are building a custom product, an online marketplace, a SaaS subscription business, or need to accept payments across many countries and currencies.</p>` +
        `<p><strong>Choose Square if</strong> you run a retail shop, restaurant, or service business with in-person sales, want hardware and software bundled together, and do not have (or want to hire) developers to manage a payments integration.</p>` +
        `<p>For merchant feedback on support and account stability, read the <a href="/processor/stripe/reviews">Stripe reviews</a> and the <a href="/processor/square/reviews">Square reviews</a>. If PayPal is also on your shortlist, see <a href="${compareHref(["stripe", "paypal"])}">Stripe vs PayPal</a> and <a href="${compareHref(["paypal", "square"])}">PayPal vs Square</a>.</p>` +
        DISCLAIMER,
    ),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. /compare/paypal-vs-square
// ═══════════════════════════════════════════════════════════════════════════

const PAYPAL_SQUARE: ComparePageSpec = {
  pageKey: "compare-paypal-vs-square",
  path: "/compare/paypal-vs-square",
  title: "Compare: PayPal vs Square",
  seo: {
    metaTitle: "PayPal vs Square: Fees, Payouts and POS Compared",
    metaDescription:
      "Compare PayPal vs Square on fees, payout speed, checkout trust, and POS hardware. Find the right processor for online or in-person sales.",
    focusKeyword: "paypal vs square",
    keywords: [
      "paypal vs square",
      "square vs paypal",
      "paypal vs square fees",
      "paypal or square",
      "paypal zettle vs square",
      "paypal vs square for small business",
    ],
  },
  faqs: [
    {
      question: "Can I accept PayPal payments through Square?",
      answer:
        "Square does not natively support PayPal as a payment method at checkout. They operate as separate, competing processors.",
    },
    {
      question: "Which has faster payouts?",
      answer:
        "PayPal balance transfers are effectively instant to your PayPal account, though moving funds to your bank can take a day or incur a small fee for instant transfer. Square's standard payout to a bank account is next-day.",
    },
    {
      question: "Which is better for a new online-only store?",
      answer:
        "PayPal's setup speed and consumer trust make it a common first choice for brand-new online sellers, though many later add Square or another processor as they scale.",
    },
  ],
  blocks: [
    comparison({
      title: "PayPal vs Square beyond the rate card",
      headers: ["Best for", "Consumer recognition", "POS hardware"],
      rows: [
        {
          name: "PayPal",
          cells: [
            "Small business, cross-border, quick setup",
            "Very high: most shoppers already have an account",
            "Limited (via Zettle)",
          ],
        },
        {
          name: "Square",
          cells: [
            "Retail, restaurants, walk-in businesses",
            "Lower brand recognition at checkout",
            "Extensive, purpose-built ecosystem",
          ],
        },
      ],
    }),
    richtext(
      `<h2>PayPal vs Square: which payment processor is right for you?</h2>` +
        `<p><a href="/processor/paypal">PayPal</a> and <a href="/processor/square">Square</a> both target small and growing businesses, but they solve different problems. PayPal is built around a trusted checkout button and a massive existing user base of PayPal wallet holders. Square is built around unifying in-person and online sales into one system. Here is how they stack up.</p>` +
        `<h3>Where PayPal wins</h3>` +
        `<p>PayPal's biggest advantage is trust and reach. Millions of shoppers already have a PayPal account, and offering "Pay with PayPal" at checkout can reduce cart abandonment simply because the option feels familiar. PayPal also makes cross-border selling straightforward: it supports payments in dozens of currencies and is a common default for international buyers who do not want to enter card details on an unfamiliar site. Setup is close to instant, and many businesses can start accepting payments the same day.</p>` +
        `<h3>Where Square wins</h3>` +
        `<p>Square is the stronger choice for businesses that sell in person as well as online. Its hardware lineup, meaning readers, terminals, registers and kiosks, is more mature and more widely deployed in retail and food service than PayPal's Zettle line. Square also unifies inventory, staff management, and reporting across online and in-person sales in one dashboard, which PayPal does not match as tightly.</p>`,
    ),
    richtext(
      `<h3>Pricing in practice</h3>` +
        `<p>PayPal's standard online rate (2.99% + $0.49) is higher than Square's (2.9% + $0.30), and that gap adds up on smaller transactions because of the higher fixed fee. For an online-led business, Square is the cheaper of the two on almost any basket size.</p>` +
        `<p>In person the order reverses. PayPal Zettle charges 2.29% + $0.09 against Square's 2.6% + $0.15, which is lower on both the percentage and the fixed fee, so Zettle is the cheaper card-present rate at every ticket size. The case for Square in a retail or food-service setting is the hardware, the POS software and the unified reporting, not the transaction rate.</p>` +
        `<p>PayPal can still make sense online despite the higher rate if the checkout-conversion boost from brand recognition outweighs the fee difference, which is worth testing directly with your own traffic if you are right on the fence.</p>`,
    ),
    richtext(
      `<h3>Who should choose which</h3>` +
        `<p><strong>Choose PayPal if</strong> you sell primarily online, want the fastest possible setup, do meaningful cross-border business, or want the trust signal of a recognizable checkout button.</p>` +
        `<p><strong>Choose Square if</strong> you have a physical location, need POS hardware, or want in-person and online sales managed from a single system.</p>` +
        `<p>For merchant feedback on payouts, holds and support, read the <a href="/processor/paypal/reviews">PayPal reviews</a> and the <a href="/processor/square/reviews">Square reviews</a>. If you are also weighing a developer-first platform, see <a href="${compareHref(["stripe", "square"])}">Stripe vs Square</a> and <a href="${compareHref(["stripe", "paypal"])}">Stripe vs PayPal</a>.</p>` +
        DISCLAIMER,
    ),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. /compare/stripe-vs-braintree
// ═══════════════════════════════════════════════════════════════════════════

const STRIPE_BRAINTREE: ComparePageSpec = {
  pageKey: "compare-stripe-vs-braintree",
  path: "/compare/stripe-vs-braintree",
  title: "Compare: Stripe vs Braintree",
  seo: {
    metaTitle: "Stripe vs Braintree: Fees, PayPal and Venmo Support",
    metaDescription:
      "Compare Stripe vs Braintree on fees, PayPal/Venmo support, and developer tools. Find the right platform for your SaaS or online business.",
    focusKeyword: "stripe vs braintree",
    keywords: [
      "stripe vs braintree",
      "braintree vs stripe",
      "stripe vs braintree fees",
      "is braintree cheaper than stripe",
      "braintree vs stripe for saas",
      "stripe or braintree",
    ],
  },
  faqs: [
    {
      question: "Can Stripe accept PayPal payments too?",
      answer:
        "Stripe has added limited PayPal support in some regions, but it is not as deeply integrated as Braintree's, which shares infrastructure with its parent company.",
    },
    {
      question: "Is Braintree cheaper than Stripe?",
      answer:
        "Marginally, at standard rates: 2.89% + $0.29 against 2.9% + $0.30. The difference is small enough that most businesses will not choose based on price alone.",
    },
    {
      question: "Which is easier to integrate?",
      answer:
        "Both offer comparable SDKs and documentation quality. Stripe is more commonly cited by developers for documentation clarity, largely due to its larger ecosystem and community.",
    },
  ],
  blocks: [
    comparison({
      title: "Stripe vs Braintree beyond the rate card",
      headers: ["Owned by", "Native PayPal and Venmo support", "Best for", "Ecosystem maturity"],
      rows: [
        {
          name: "Stripe",
          cells: [
            "Independent",
            "Via integration",
            "Developers, SaaS, marketplaces",
            "Extensive, frequently cited as best-in-class",
          ],
        },
        {
          name: "Braintree",
          cells: [
            "PayPal",
            "Built-in, first-class",
            "Developers who also want PayPal or Venmo, and PayPal-heavy audiences",
            "Solid, smaller ecosystem than Stripe",
          ],
        },
      ],
    }),
    richtext(
      `<h2>Stripe vs Braintree: which payment processor is right for you?</h2>` +
        `<p><a href="/processor/stripe">Stripe</a> and <a href="/processor/braintree">Braintree</a> are both developer-focused payment platforms aimed at online businesses, SaaS companies, and marketplaces, which makes this one of the closer comparisons on the site. The key difference: Braintree is owned by <a href="/processor/paypal">PayPal</a>, which gives it a built-in advantage for one specific thing, native PayPal and Venmo acceptance.</p>` +
        `<h3>Where Stripe wins</h3>` +
        `<p>Stripe has a larger, more actively developed ecosystem of tools: Billing for subscriptions, Connect for marketplace payouts, Radar for fraud detection, and a broader set of supported payment methods across more countries. For teams building something more complex than a standard checkout, such as usage-based billing, split payments to multiple parties, or embedded finance features, Stripe's tooling generally goes further out of the box.</p>` +
        `<h3>Where Braintree wins</h3>` +
        `<p>Braintree's standout feature is native, seamless PayPal and Venmo acceptance, since both are owned by the same parent company. If your customer base skews toward PayPal or Venmo users, common in certain US consumer verticals, Braintree lets you accept those payment methods without stitching together a separate PayPal integration alongside your card processing. Braintree's per-transaction rate is also marginally lower than Stripe's.</p>`,
    ),
    richtext(
      `<h3>Pricing in practice</h3>` +
        `<p>The headline rates are close enough (2.89% + $0.29 against 2.9% + $0.30) that pricing is rarely the deciding factor between these two. On a $50 order the difference is a fraction of a cent, and it does not become a real number until you are at a volume where you would be negotiating a custom rate with either provider anyway.</p>` +
        `<p>The more relevant cost question is which platform reduces your total engineering and integration overhead, and that depends heavily on whether PayPal and Venmo acceptance is a requirement or a nice-to-have for your business.</p>`,
    ),
    richtext(
      `<h3>Who should choose which</h3>` +
        `<p><strong>Choose Stripe if</strong> you want the broadest set of developer tools, plan to expand internationally, or need advanced billing, marketplace, or fraud-detection features.</p>` +
        `<p><strong>Choose Braintree if</strong> PayPal and Venmo acceptance matters to your customer base and you would rather have that built in natively than bolt it on separately.</p>` +
        `<p>For merchant feedback on onboarding, support and account stability, read the <a href="/processor/stripe/reviews">Stripe reviews</a> and the <a href="/processor/braintree/reviews">Braintree reviews</a>. Because Braintree is PayPal-owned, the comparison worth reading alongside this one is <a href="${compareHref(["paypal", "braintree"])}">PayPal vs Braintree</a>, which covers when to use the parent product instead.</p>` +
        DISCLAIMER,
    ),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. /compare/paypal-vs-braintree
// ═══════════════════════════════════════════════════════════════════════════

const PAYPAL_BRAINTREE: ComparePageSpec = {
  pageKey: "compare-paypal-vs-braintree",
  path: "/compare/paypal-vs-braintree",
  title: "Compare: PayPal vs Braintree",
  seo: {
    metaTitle: "PayPal vs Braintree: Checkout Control and Fees",
    metaDescription:
      "Braintree is owned by PayPal, but the two serve different needs. Compare setup speed, checkout control, and fees to find your fit.",
    focusKeyword: "paypal vs braintree",
    keywords: [
      "paypal vs braintree",
      "braintree vs paypal",
      "is braintree owned by paypal",
      "braintree vs paypal fees",
      "paypal or braintree",
      "braintree checkout vs paypal checkout",
    ],
  },
  faqs: [
    {
      question: "If Braintree is owned by PayPal, why would I choose one over the other?",
      answer:
        "They are aimed at different technical needs. PayPal is a ready-made checkout product; Braintree is infrastructure you build your own checkout on top of, with PayPal and Venmo support included.",
    },
    {
      question: "Can I accept PayPal payments through Braintree?",
      answer:
        "Yes. Braintree natively supports PayPal and Venmo as payment methods alongside standard card processing, since both share the same parent company.",
    },
    {
      question: "Which is better for a small store just starting out?",
      answer:
        "PayPal, in most cases: the setup is simpler and does not require a developer. Businesses that outgrow PayPal's checkout limitations often migrate to Braintree as they scale.",
    },
  ],
  blocks: [
    comparison({
      title: "PayPal vs Braintree beyond the rate card",
      headers: ["Setup", "Checkout experience", "PayPal and Venmo acceptance", "Best for"],
      rows: [
        {
          name: "PayPal",
          cells: [
            "Fast, minimal integration",
            "Uses the recognizable PayPal button",
            "Native (it is the source)",
            "Fast setup, consumer trust, simple stores",
          ],
        },
        {
          name: "Braintree",
          cells: [
            "Requires developer integration",
            "Fully customizable, embedded checkout",
            "Native (shared infrastructure)",
            "Custom checkout flows, SaaS, marketplaces",
          ],
        },
      ],
    }),
    richtext(
      `<h2>PayPal vs Braintree: which payment processor is right for you?</h2>` +
        `<p>This is a comparison with a twist: <a href="/processor/braintree">Braintree</a> is owned by <a href="/processor/paypal">PayPal</a>. They are not really competitors so much as two different products aimed at two different kinds of businesses within the same company. PayPal is the consumer-facing wallet and checkout button; Braintree is the developer-facing processing platform underneath it, built for businesses that want more control over the payment experience.</p>` +
        `<h3>Where PayPal wins</h3>` +
        `<p>PayPal is the faster path to accepting payments with no development work: add a button, and you are live. It also carries the most consumer recognition of any checkout option, and many shoppers trust and prefer paying with an account they already have rather than entering card details on a new site. For simple stores, freelancers, or businesses that do not need a fully custom checkout, PayPal is the lower-effort option.</p>` +
        `<h3>Where Braintree wins</h3>` +
        `<p>Braintree is built for businesses that want a fully custom checkout experience rather than a PayPal-branded button, while still being able to accept PayPal and Venmo alongside cards, all through one integration. It is the better choice for SaaS products, marketplaces, and any business that needs recurring billing, split payments, or a checkout flow that does not visibly hand off to PayPal. Braintree's per-transaction rate is also lower than PayPal's standard rate.</p>`,
    ),
    richtext(
      `<h3>Pricing in practice</h3>` +
        `<p>Braintree's rate (2.89% + $0.29) is lower than PayPal's standard online rate (2.99% + $0.49), and that gap is more noticeable on smaller transactions because of the higher fixed fee on PayPal's side. On a $15 order the fixed fee alone is worth more than a full percentage point of the basket.</p>` +
        `<p>The trade-off is integration effort. PayPal's button can be live in minutes, while Braintree requires actual development work to set up, so the saving only starts paying for itself once you are processing enough volume for the rate difference to outweigh the build.</p>`,
    ),
    richtext(
      `<h3>Who should choose which</h3>` +
        `<p><strong>Choose PayPal if</strong> you want to start accepting payments immediately with no engineering involved, and you are comfortable with customers checking out through a visibly PayPal-branded flow.</p>` +
        `<p><strong>Choose Braintree if</strong> you have development resources, want a fully custom checkout, and want PayPal and Venmo acceptance built in without sacrificing control over the customer experience.</p>` +
        `<p>For merchant feedback on holds, reserves and support, read the <a href="/processor/paypal/reviews">PayPal reviews</a> and the <a href="/processor/braintree/reviews">Braintree reviews</a>. If you are weighing Braintree against the other developer-first default rather than against its own parent, see <a href="${compareHref(["stripe", "braintree"])}">Stripe vs Braintree</a>.</p>` +
        DISCLAIMER,
    ),
  ],
};

const PAGES = [STRIPE_SQUARE, PAYPAL_SQUARE, STRIPE_BRAINTREE, PAYPAL_BRAINTREE];

// ═══════════════════════════════════════════════════════════════════════════
// Runner
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  await connectToDatabase();
  log(DRY_RUN ? "DRY RUN: no writes\n" : "Applying new compare page content\n");

  /*
    A `/compare/<a>-vs-<b>` page 404s unless BOTH processors are published
    (`dynamicParams = false`, plus the route's own `processors.length < 2` guard).
    Writing a PageSeo record for a URL that 404s would leave orphaned content in
    the admin with no page behind it, so check first and fail loudly.
  */
  const published = await Processor.find({ slug: { $in: REQUIRED_SLUGS }, isPublished: true })
    .select("slug")
    .lean();
  const havePublished = new Set(published.map((p) => String(p.slug)));
  const missing = REQUIRED_SLUGS.filter((s) => !havePublished.has(s));
  if (missing.length) {
    throw new Error(
      `Not published, so their compare pages 404: ${missing.join(", ")}. Publish them (or fix the slugs) before seeding this content.`,
    );
  }

  for (const page of PAGES) {
    log(page.path);
    await upsertPageSeoRoute({
      pageKey: page.pageKey,
      title: page.title,
      path: page.path,
      seo: page.seo,
      faqs: page.faqs,
      blocks: page.blocks,
      // No editor keywords to preserve on the first run; merging keeps any that
      // get added in the admin later.
      mergeKeywordsInto: true,
    });
  }

  log(`\nDone: ${PAGES.length} compare pages.`);
  await mongoose.connection.close();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
