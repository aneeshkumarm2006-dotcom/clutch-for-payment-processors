import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, Processor } from "@/models";
import {
  DRY_RUN,
  blockId,
  checkBlockHtml,
  checkFaqs,
  comparison,
  cta,
  guide,
  log,
  prepareBlocks,
  prepareExistingBlocks,
  richtext,
  seoSet,
  upsertLanding,
  upsertPageSeoRoute,
  type BlockSpec,
  type LandingSpec,
  type SeoSpec,
} from "./content-kit";

/**
 * scripts/seed-lowkd-content.ts — the 2026-08-18 low-KD content delivery
 * ("18_8 low kd pages additional content"), applied to the five pages it targets.
 *
 *   npm run seed:lowkd-content -- --dry-run    # print every change, write nothing
 *   npm run seed:lowkd-content                 # apply
 *
 * Same contract as `seed-doc-content.ts`, and it shares that script's plumbing
 * via `./content-kit`: nothing is hardcoded into a page, everything lands in
 * Mongo as `seo`, `faqs` and `blocks`, and every write is a targeted `$set` so
 * re-running is safe and leaves untouched fields alone.
 *
 * ─── What the doc asked for, and where each piece went ───────────────────────
 *
 * | Doc section              | Lands on                                  |
 * |--------------------------|-------------------------------------------|
 * | "clover vs square"       | NEW landing page `/clover-vs-square`      |
 * | "alternatives/square"    | PageSeo route blocks on `/alternatives/square` |
 * | "braintree reviews"      | `reviewsPage` blocks + FAQs on Braintree  |
 * | "interchange plus"       | PageSeo route blocks on the facet page    |
 * | "subscriptions"          | appended to the category's last richtext  |
 *
 * ─── Why the Clover comparison is NOT at /compare/clover-vs-square ───────────
 * `/compare/[pair]` only serves CURATED pairs, and a curated pair renders a
 * side-by-side matrix built from two *published processor records*. There is no
 * Clover listing on the site (see `scripts/data/processors/`), so the route
 * would 404 for this pair, and adding a stub listing purely to unlock the URL
 * would put an unresearched profile in the directory. A `kind: "landing"` record
 * at `/clover-vs-square` is the mechanism that exists for exactly this: a new,
 * indexable URL whose whole content is the record. If Clover is ever listed
 * properly, add `["clover", "square"]` to `POPULAR_COMPARE_PAIRS` and 308 this
 * page at the pretty compare URL via `seo.redirectTo`.
 *
 * ─── House rules applied to the writer's copy ────────────────────────────────
 * - The doc's meta title was "Square vs Clover | Pricing, Fees & POS Comparison
 *   | Payment Processing Guide" (79 chars). `&` fails `npm run audit:meta` and
 *   the brand suffix was stripped site-wide on 2026-08-01, so it ships as
 *   "Square vs Clover: Pricing, Fees and POS Comparison" (50). Same treatment
 *   for Braintree's pre-existing reviews-page title, which had both faults.
 * - Em dashes out (`npm run audit:dashes`), Google Docs escapes (`\+`, `\-`,
 *   `\=`) out, curly quotes folded to ASCII.
 * - "The reviews below" became "above" in the Braintree copy: the editorial slot
 *   on `/processor/<slug>/reviews` renders UNDER the review list, not over it.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. "clover vs square"  →  landing page /clover-vs-square
// ═══════════════════════════════════════════════════════════════════════════

const CLOVER_SQUARE_SEO: SeoSpec = {
  metaTitle: "Square vs Clover: Pricing, Fees and POS Comparison",
  metaDescription:
    "Compare Square vs Clover on pricing, processing fees, hardware, contracts, and switching costs. See which POS and payment processor fits your business.",
  focusKeyword: "clover vs square",
  keywords: [
    "clover vs square",
    "square vs clover",
    "clover vs square pricing",
    "clover payment processing",
    "clover processing fees",
    "clover monthly fees",
    "clover contracts",
    "switch from square to clover",
    "is clover cheaper than square",
    "clover pos vs square pos",
  ],
};

const CLOVER_SQUARE_FAQS = [
  {
    question: "Is Clover cheaper than Square?",
    answer:
      "Not necessarily. It is genuinely difficult to give a blanket answer because Clover pricing can depend on the plan and the provider selling the service. Square generally uses more standardized published pricing, while Clover can be sold through different providers with different agreements. If you are comparing the two, get the actual Clover contract in writing and compare the complete cost rather than looking only at the advertised processing rate.",
  },
  {
    question: "Can I switch from Square to Clover without buying new hardware?",
    answer:
      "No, you should expect to need Clover-compatible hardware when moving from Square to Clover. Square and Clover are separate POS ecosystems, so your existing Square terminal is not simply converted into a Clover terminal. The same principle applies when moving from Clover to Square: you will generally need Square-compatible hardware.",
  },
  {
    question: "Can I switch from Clover to Square?",
    answer:
      "Yes. You can move from Clover to Square, but switching is not simply a matter of changing your payment processor. You will need to consider your Clover contract, any cancellation fees, your existing hardware, POS software, integrations, and how you will move your business data and workflows to Square. Check your Clover agreement before cancelling.",
  },
  {
    question: "Does Clover have a standard processing rate?",
    answer:
      "No. Clover does not have one rate that applies to every merchant. Clover says processing rates can vary based on factors such as the plan, business type, transaction type, and agreement. Some Clover-published plans currently show rates as low as 2.3% + $0.10 for certain on-device transactions, while other payment types can have different rates. Treat published rates as a starting point, not a guaranteed quote.",
  },
  {
    question: "Does Clover charge monthly fees?",
    answer:
      "It can. Clover pricing can include monthly software or service fees depending on the plan and setup, and hardware costs can also be separate. Ask for the complete monthly cost before signing up rather than looking only at the processing rate.",
  },
  {
    question: "Does Clover have contracts?",
    answer:
      "It can, depending on how you purchase your Clover service. Clover states that contract terms and termination fees can vary depending on the service provider. If you are buying Clover through a bank or independent merchant services provider, read the merchant processing agreement carefully before signing.",
  },
  {
    question: "Are Clover and Square the same company?",
    answer:
      "No. Square and Clover are separate payment and POS platforms. Square is operated by Block, while Clover is part of the Fiserv ecosystem.",
  },
  {
    question: "Can I use Clover hardware with Square?",
    answer:
      "Generally, no. Clover and Square use their own hardware and software ecosystems. If you are moving from one system to the other, plan on using hardware that is compatible with the new POS system.",
  },
  {
    question: "Can I negotiate Clover's processing rates?",
    answer:
      "It may be possible depending on the provider and your business situation. This is one of the major differences between Clover and Square. Clover can be sold through banks and other merchant services providers, so the agreement you receive may be different from another merchant's agreement. If you have significant processing volume, ask the provider whether the rate or other fees can be adjusted.",
  },
  {
    question: "What should I compare when choosing between Square and Clover?",
    answer:
      "Do not compare only the advertised processing rate. Look at the processing percentage, the per-transaction fee, monthly software fees, hardware cost, contract length, early termination fees, the payment types you accept, POS features, integrations, customer support, and your expected monthly processing volume. The cheapest-looking rate is not always the cheapest overall option.",
  },
];

const CLOVER_SQUARE_BLOCKS: BlockSpec[] = [
  /*
    The summary table leads, before the 2,000 words explaining it. It is also the
    reason the long copy below is one `buyersGuide` rather than several richtext
    blocks: the guide's HTML allowlist has no `<table>`, so a table has to be its
    own `comparison` block, and a block cannot sit inside a guide section.

    No `url` on the rows: `optionalUrl` requires an absolute URL, so a
    site-relative link would fail validation. Square is linked in the prose.
  */
  comparison({
    title: "Square vs Clover at a glance",
    headers: [
      "Pricing",
      "Sold by",
      "Processing rates",
      "Contract terms",
      "Hardware",
      "Negotiation",
      "Pricing certainty",
    ],
    rows: [
      {
        name: "Square",
        cells: [
          "Generally published",
          "Square",
          "More standardized",
          "Generally straightforward",
          "Square hardware",
          "Limited",
          "Higher",
        ],
      },
      {
        name: "Clover",
        cells: [
          "Varies by plan and provider",
          "Clover and authorized providers or resellers",
          "Can vary",
          "Can vary by provider",
          "Clover hardware",
          "May be available through providers",
          "Depends on your agreement",
        ],
      },
    ],
  }),
  guide({
    title: "Square vs Clover: pricing, fees, hardware and contracts",
    layout: "stacked",
    intro:
      "<p>What each system costs, which fees to pull out of the agreement before you sign, and what it costs to change your mind in two years.</p>",
    keyTakeaways: [
      "Square publishes its pricing. What you pay on Clover depends on who sold it to you.",
      "Two businesses running Clover can hold very different rates, monthly fees and cancellation terms.",
      "The hardware does not carry across, so switching later means buying the new system's equipment.",
    ],
    sections: [
      {
        heading: "Square vs Clover: which one is better for your business?",
        body:
          "<p>Square and Clover get compared constantly, and for good reason. Both combine payment processing, POS software, and hardware into one system, so choosing one is more than simply choosing a credit card processor.</p><p>The important question isn't just \"Which one has the lower processing rate?\" It's \"Who am I buying from, what will I actually pay, and what happens if I want to leave later?\"</p><p>Square keeps things relatively simple. You buy directly from Square and generally get published, standardized pricing. Our full <a href=\"/processor/square\">Square review</a> covers the current rate card and fees.</p><p>Clover is different. Clover systems can be sold directly by Clover or through banks and independent merchant service providers. That means two businesses using Clover could potentially have very different processing rates, monthly fees, contract terms, and cancellation policies.</p><p>For a small business owner, that difference matters.</p><p>If you want straightforward pricing and don't want to negotiate your processing agreement, Square is easier to understand. If you want more flexibility, POS features, or the ability to work with a merchant services provider, Clover may be worth considering, but you need to read the actual agreement before signing.</p>",
      },
      {
        heading: "Clover payment processing pricing",
        body:
          "<p>Clover does not have one universal processing rate that applies to every merchant.</p><p>Your actual pricing can depend on:</p><ul><li>The Clover plan you choose</li><li>Whether you buy directly from Clover or through a reseller</li><li>Your business type</li><li>How the transaction is accepted</li><li>Your processing volume</li><li>Your merchant agreement</li><li>Additional monthly or service fees</li></ul><p>Clover's own pricing information explains that processing rates can vary based on the plan and transaction type. Clover also states that contract terms and termination fees can vary depending on the service provider.</p><h3>What rates should you expect?</h3><p>Published Clover pricing can give you a useful benchmark, but it should not be treated as a guaranteed rate for every Clover merchant.</p><p>For example, Clover currently publishes rates as low as 2.3% + $0.10 for certain on-device transactions, while some plans show 2.9% + $0.30 for other payment types. Clover also gives examples of higher rates for payments that are keyed in or taken virtually.</p><p>If you're getting Clover through a bank or independent reseller, your actual agreement may look different.</p><p>The safest approach is to ask for the complete pricing agreement in writing before comparing Clover with Square.</p><p>Don't compare a Square published rate with a Clover sales quote that only shows the processing percentage. Look at the full cost.</p>",
      },
      {
        heading: "Clover fees to check before you sign",
        body:
          "<p>The processing rate is only one part of the cost. Before signing a Clover agreement, ask about each of the following.</p><h3>Processing fees</h3><p>Find out exactly what you'll pay for:</p><ul><li>Card-present transactions</li><li>Keyed-in transactions</li><li>Online or card-not-present transactions</li><li>Debit transactions</li><li>Rewards or premium credit cards</li><li>American Express transactions</li></ul><h3>Monthly software fees</h3><p>Clover systems can include monthly software or service charges depending on the plan and setup. Clover's pricing pages show that software and hardware plans vary by business type.</p><h3>Hardware costs</h3><p>Ask whether you're buying the equipment, financing it, leasing it, or paying a monthly hardware fee. A low upfront price doesn't necessarily mean the equipment is cheaper over the life of the agreement.</p><h3>Contract length</h3><p>Ask whether you're signing a month-to-month agreement or committing to a specific term.</p><h3>Early termination fees</h3><p>This is particularly important with Clover because the terms can vary depending on the provider. Clover specifically states that termination fees and contract terms can vary between service providers, so don't assume that every Clover contract has the same cancellation policy.</p>",
      },
      {
        heading: "Square vs Clover pricing",
        body:
          "<p>The biggest pricing difference between Square and Clover is predictability, which is what the table above is really showing.</p><p>Square generally publishes its pricing directly, so merchants can see the processing rates and hardware costs before signing up. Clover is more complicated because the system can be sold through different providers. That means a Clover quote from one provider isn't necessarily the same as a Clover quote from another.</p><h3>Which is cheaper?</h3><p>There isn't a universal answer.</p><p>Square may be the better choice if your priority is knowing what you'll pay without negotiating a merchant services agreement. Clover could potentially offer competitive pricing, particularly if a provider gives you a strong processing agreement based on your business volume.</p><p>But don't choose Clover because a salesperson tells you \"our rate is lower than Square.\" Ask for the complete agreement.</p><p>A 2.3% processing rate can look attractive until additional monthly fees, per-transaction charges, equipment costs, or contract terms are included.</p>",
      },
      {
        heading: "Square vs Clover: hardware",
        body:
          "<p>Both Square and Clover combine hardware and software into their POS systems. That makes setup convenient, but it also creates an important consideration: your POS hardware is tied to the ecosystem you're using.</p><p>If you build your business around Square hardware and later move to Clover, you should expect to purchase or obtain Clover-compatible hardware. Likewise, moving from Clover to Square generally means replacing your Clover equipment with Square hardware.</p><p>So when you're comparing these systems, don't only look at today's processing rate. Think about what switching will cost you two or three years from now.</p>",
      },
      {
        heading: "Can you switch from Square to Clover?",
        body:
          "<p>Yes, you can switch providers, but don't expect to keep using your existing Square terminal as your Clover POS.</p><p>Square and Clover are separate POS ecosystems. If you move from Square to Clover, you'll generally need Clover-compatible hardware. The same applies if you move from Clover to Square.</p><p>This is one reason it's worth taking your time before purchasing a complete POS setup. You're not just choosing a payment rate. You're choosing the software, hardware, reporting tools, integrations, and workflow your business will use every day.</p>",
      },
      {
        heading: "Clover vs Square: which is better?",
        body:
          "<p>There's no single winner for every business.</p><h3>Square may make more sense if you want</h3><ul><li>Simple, published pricing</li><li>Easy setup</li><li>Minimal negotiation</li><li>A straightforward POS system</li><li>A system you can start using quickly</li><li>Predictable costs</li></ul><p>Square is particularly appealing to smaller businesses that don't want to spend time comparing merchant agreements.</p><h3>Clover may make more sense if you want</h3><ul><li>A more traditional POS setup</li><li>More hardware options</li><li>Industry-specific POS features</li><li>A larger selection of integrations and apps</li><li>The option to work with a bank or merchant services provider</li><li>The possibility of negotiating your processing agreement</li></ul><p>The trade-off is that Clover pricing can require more homework.</p>",
      },
      {
        heading: "What to ask a Clover salesperson",
        body:
          "<p>Before signing a Clover agreement, don't just ask \"What's your processing rate?\" Ask these questions instead:</p><ol><li>What is my exact rate for card-present transactions?</li><li>What is my rate for keyed-in transactions?</li><li>What is my rate for online or card-not-present transactions?</li><li>Is there a monthly software fee?</li><li>Are there PCI, statement, compliance, or other recurring fees?</li><li>Am I buying, financing, or leasing the hardware?</li><li>How long is the contract?</li><li>Is there an early termination fee?</li><li>What happens if I cancel?</li><li>Can I get the complete agreement in writing before signing?</li></ol><p>That last question is important. Don't compare Square's published pricing against a Clover salesperson's verbal quote. Compare the complete costs in writing.</p>",
      },
      {
        heading: "Square vs Clover: the bottom line",
        body:
          "<p>Square and Clover solve a similar problem, but they approach pricing differently.</p><p>Square's biggest advantage is simplicity. You generally know what you're getting before you sign up. Clover's biggest advantage is flexibility. Depending on how you buy it and who provides your merchant services, you may have more options around pricing, hardware, and payment processing.</p><p>But that flexibility comes with more responsibility for the merchant.</p><p>If you want price certainty from day one, Square is easier to evaluate. If you're considering Clover, don't automatically reject it because the pricing isn't as simple. Instead, get the complete agreement and calculate the real cost of processing, including the rate, per-transaction fee, monthly fees, hardware costs, and cancellation terms. That's the number worth comparing.</p>",
      },
      {
        heading: "Final recommendation",
        body:
          "<p>If your priority is simple pricing and fewer surprises, Square is usually easier to evaluate. If you prefer Clover's POS features and want to explore different merchant service providers, Clover can be worth considering, but make sure you understand the agreement before committing.</p><p>The best payment processor isn't necessarily the one advertising the lowest rate. It's the one that gives you the lowest predictable total cost for the way your business actually takes payments.</p>",
      },
    ],
  }),
  cta({
    heading: "Comparing Square against more than Clover?",
    body: "See how Square lines up against Helcim, Stripe, Stax and the rest of the directory on fees, contract terms, and verified merchant reviews.",
    buttonLabel: "See Square alternatives",
    buttonUrl: "/alternatives/square",
  }),
];

const CLOVER_SQUARE_LANDING: LandingSpec = {
  pageKey: "clover-vs-square",
  path: "/clover-vs-square",
  title: "Square vs Clover",
  heading: "Square vs Clover",
  subheading:
    "Square and Clover both bundle payment processing, POS software, and hardware into one system, so this is a bigger decision than picking a processing rate. Here is what each one actually costs, and what it costs to leave.",
  seo: CLOVER_SQUARE_SEO,
  faqs: CLOVER_SQUARE_FAQS,
  blocks: CLOVER_SQUARE_BLOCKS,
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. "alternatives/square"  →  PageSeo route record for /alternatives/square
// ═══════════════════════════════════════════════════════════════════════════

/*
  The doc's four sections sit BELOW the generated shortlist they qualify, which
  is why they are separate richtext blocks rather than one: an editor should be
  able to reorder or drop "how much can you save" without touching the rest.

  The "by business need" list is the reason this page earns an editorial record
  at all — it is the only place on the site that maps a reason for leaving Square
  onto a specific listing, so every name in it is linked. Clover has no listing,
  so it points at the new comparison page instead.
*/
const SQUARE_ALTERNATIVES_SEO: SeoSpec = {
  focusKeyword: "square alternatives",
  keywords: [
    "square alternatives",
    "alternatives to square",
    "square competitors",
    "better than square",
    "switch from square",
    "square effective rate",
  ],
};

const SQUARE_ALTERNATIVES_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>Square alternatives by business need</h2><p>The best Square alternative depends on what you want to improve.</p><ul>" +
      "<li><strong>Lower processing costs at higher volume:</strong> <a href=\"/processor/helcim\">Helcim</a> or <a href=\"/processor/stax\">Stax</a></li>" +
      "<li><strong>POS and hardware:</strong> Clover, covered in our <a href=\"/clover-vs-square\">Square vs Clover comparison</a></li>" +
      "<li><strong>Online payments and developer tools:</strong> <a href=\"/processor/stripe\">Stripe</a> or <a href=\"/processor/braintree\">Braintree</a></li>" +
      "<li><strong>High-risk businesses:</strong> <a href=\"/processor/paymentcloud\">PaymentCloud</a></li>" +
      "<li><strong>Traditional merchant services:</strong> <a href=\"/processor/payment-depot\">Payment Depot</a> or <a href=\"/processor/payjunction\">PayJunction</a></li>" +
      "</ul><p>Compare the full pricing, features, and contract terms before switching.</p>",
  ),
  richtext(
    "<h2>When should you consider a Square alternative?</h2>" +
      "<p>Square works well for many small businesses, but another processor may make more sense if your needs have changed.</p>" +
      "<p>You may want to compare alternatives if you're processing more volume, looking for <a href=\"/payment-processors/interchange-plus\">interchange-plus pricing</a>, need more advanced payment integrations, want different POS hardware, or have a business model that requires a <a href=\"/category/high-risk\">high-risk payment processor</a>.</p>" +
      "<p>The goal isn't simply to find a lower advertised rate. It's to find a payment setup that fits your business and costs less for the way you actually process payments.</p>",
  ),
  richtext(
    "<h2>How much can you save by switching from Square?</h2>" +
      "<p>There is no standard savings amount because your actual cost depends on transaction volume, average ticket size, card mix, and monthly fees.</p>" +
      "<p>Before switching, calculate your <strong>effective Square rate</strong> using a recent processing statement:</p>" +
      "<p><strong>Total processing fees / total processed volume = effective rate</strong></p>" +
      "<p>Then compare that number with the complete cost from another processor, including processing fees, monthly charges, and hardware costs. This gives you a much more realistic comparison than looking at the advertised rate alone.</p>",
  ),
  richtext(
    "<h2>Don't compare processing rates alone</h2>" +
      "<p>A lower percentage doesn't always mean a lower overall cost. When comparing Square with another processor, check:</p>" +
      "<ul><li>Processing rate</li><li>Per-transaction fee</li><li>Monthly fees</li><li>Hardware costs</li><li>Contract length</li><li>Cancellation fees</li><li>Payment methods</li><li>POS and software features</li></ul>" +
      "<p>The right alternative is the one that gives you the best overall value for your business, not necessarily the lowest headline rate.</p>",
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. "braintree reviews"  →  /processor/braintree/reviews
// ═══════════════════════════════════════════════════════════════════════════

/*
  The record already carried a `reviewsPage.seo.metaTitle` of "Braintree Reviews
  | Pricing, Fees, Pros & Cons | Payment Processing Guide" — 74 characters with
  an ampersand `audit:meta` rejects and the brand suffix that was stripped
  site-wide on 2026-08-01. The doc gave no title for this page, so rather than
  leave a known violation in place it ships adapted, on the same rule the doc's
  own titles get. The existing description is clean and is left alone.
*/
const BRAINTREE_REVIEWS_SEO: SeoSpec = {
  metaTitle: "Braintree Reviews: Pricing, Fees, Pros and Cons",
  focusKeyword: "braintree reviews",
};

const BRAINTREE_REVIEWS_FAQS = [
  {
    question: "Is Braintree good for small businesses?",
    answer:
      "It can be, but Braintree is generally a better fit for businesses with access to development resources. Its API-first approach gives developers a lot of control, but it isn't as plug-and-play as some payment platforms designed specifically for small businesses.",
  },
  {
    question: "How does Braintree pricing compare to Stripe?",
    answer:
      "Braintree and Stripe have similar published headline pricing for standard card payments, generally around 2.9% + $0.30 per transaction. Your actual cost can differ depending on your agreement, transaction volume, and payment methods. Braintree also supports PayPal and Venmo natively, which can be an important advantage if you want to offer those payment options through the same integration.",
  },
];

const BRAINTREE_REVIEWS_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>What to know before reading Braintree reviews</h2>" +
      "<p>Before looking at individual reviews, there are two things worth knowing about Braintree.</p>" +
      "<p>First, you can accept both <strong>credit and debit cards as well as PayPal and Venmo</strong> through the same integration. That can be useful if you want to offer customers more payment options without building separate payment integrations.</p>" +
      "<p>Second, Braintree is designed primarily for businesses with developers or technical resources. Support can feel less direct than with a traditional standalone processor because Braintree is part of the broader <a href=\"/processor/paypal\">PayPal</a> ecosystem.</p>" +
      "<p>The reviews above are only a small sample, but they point to a consistent pattern: <strong>Braintree is a strong fit for developers building custom checkout experiences, subscriptions, or marketplace payments, but it may be less suitable if you expect quick phone-based support whenever an issue comes up.</strong></p>",
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. "interchange plus"  →  /payment-processors/interchange-plus
// ═══════════════════════════════════════════════════════════════════════════

/*
  An editor's FAQs REPLACE the facet registry's rather than appending to them
  (see `/payment-processors/[facet]/page.tsx`), so the registry's two questions
  are restated here verbatim ahead of the doc's two. Drop them and the page
  silently loses "Is interchange-plus cheaper than flat-rate?" the moment this
  record is written.
*/
const INTERCHANGE_PLUS_FAQS = [
  {
    question: "Is interchange-plus cheaper than flat-rate?",
    answer:
      "For established businesses with consistent volume, interchange-plus is usually cheaper because you pay the real interchange cost plus a small fixed markup instead of a blended rate. Very small or new businesses may still prefer flat-rate simplicity.",
  },
  {
    question: "What does interchange-plus mean?",
    answer:
      "Interchange is the fee the card networks charge; 'plus' is your processor's fixed markup on top. Because the two are itemised, you can see exactly what you're paying, unlike tiered or blended pricing.",
  },
  {
    question: "What is a typical interchange-plus markup?",
    answer:
      "A common range is around 0.10% to 0.50% plus a per-transaction fee on top of interchange, although actual pricing varies by processor, business type, processing volume, and risk profile.",
  },
  {
    question: "How do I calculate my effective rate under interchange-plus pricing?",
    answer:
      "Divide your total processing fees by your total processed volume for the same statement period. For example, $450 in total processing fees on $25,000 in transactions is a 1.80% effective rate. Use a full statement cycle rather than calculating the rate from one transaction, because your interchange mix can change throughout the month.",
  },
];

const INTERCHANGE_PLUS_SEO: SeoSpec = {
  focusKeyword: "interchange plus pricing",
  keywords: [
    "interchange plus pricing",
    "interchange plus",
    "interchange fees",
    "interchange rates",
    "effective rate",
    "interchange plus vs flat rate",
  ],
};

const INTERCHANGE_PLUS_BLOCKS: BlockSpec[] = [
  richtext(
    "<h2>How interchange plus pricing actually works</h2>" +
      "<p>Interchange-plus pricing separates your payment processing cost into two parts: the <strong>interchange fee</strong> set by the card networks and issuing banks, plus a markup charged by your processor.</p>" +
      "<p>For example, if a transaction has an interchange cost of <strong>1.65% + $0.10</strong> and your processor charges a markup of <strong>0.30% + $0.10</strong>, your total cost would be <strong>1.95% + $0.20</strong> for that transaction.</p>" +
      "<p>The advantage is transparency. Instead of paying one blended rate, you can see the interchange cost and processor markup separately on your statement.</p>" +
      "<p>Your effective rate can change from month to month because different cards have different interchange rates. A basic debit card may cost less to process than a rewards credit card, for example.</p>" +
      "<p>The tradeoff is simplicity. Flat-rate processors such as <a href=\"/processor/square\">Square</a> and standard <a href=\"/processor/stripe\">Stripe</a> pricing are easier to understand upfront. Interchange-plus pricing can become more attractive as processing volume grows, but the actual savings depend on your transaction mix, processor markup, and monthly fees. The <a href=\"/payment-processors/flat-rate\">flat-rate processors</a> page covers the other side of that decision.</p>",
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. "subscriptions"  →  /category/subscriptions
// ═══════════════════════════════════════════════════════════════════════════

/*
  One paragraph, and it belongs at the end of the category's existing SaaS copy
  rather than in a block of its own — the last richtext block already closes on
  "Best SaaS Payment Processing Providers", and this is the next sentence of that
  thought. Appending also avoids the trap: this category's blocks were edited in
  the admin after `seed-doc-content.ts` last ran, so writing a fresh block list
  here would delete that editor's work.
*/
const SUBSCRIPTIONS_SAAS_PARAGRAPH =
  "<p>If SaaS payment processing is the specific problem you're solving, rather than billing in general, start by looking at tools such as <a href=\"/processor/chargebee\">Chargebee</a> or Stripe Billing alongside your payment processor. The difficult part of SaaS payments isn't just accepting cards; it's handling recurring billing, trials, proration, failed payments, and dunning reliably as your customer base grows.</p>";

/** Idempotency probe: a phrase from the paragraph that nothing else says. */
const SUBSCRIPTIONS_SAAS_MARKER = "rather than billing in general";

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

/**
 * Add blocks and FAQs to a processor's REVIEWS archive (`reviewsPage.*`), not to
 * its profile. The two are separate editorial layers on purpose: the profile
 * targets "{name} review / pricing / fees" and the archive targets
 * "{name} reviews", and one `metaTitle` cannot serve both.
 */
async function updateProcessorReviewsPage(
  slug: string,
  opts: {
    seo?: SeoSpec;
    faqs?: { question: string; answer: string }[];
    blocks?: BlockSpec[];
  },
) {
  const doc = await Processor.findOne({ slug }).select("reviewsPage").lean();
  if (!doc) {
    log(`  skipped processor ${slug} (not found). Run \`npm run seed\` first`);
    return;
  }

  const scope = `processor:${slug}:reviewsPage`;
  const set: Record<string, unknown> = {
    ...(opts.seo ? seoSet(scope, opts.seo, "reviewsPage.seo") : {}),
    ...(opts.faqs ? { "reviewsPage.faqs": checkFaqs(scope, opts.faqs) } : {}),
    ...(opts.blocks ? { "reviewsPage.blocks": prepareBlocks(scope, opts.blocks) } : {}),
  };

  if (DRY_RUN) {
    log(`  [dry-run] ${slug} reviews page: ${Object.keys(set).join(", ")}`);
    return;
  }
  await Processor.updateOne({ slug }, { $set: set });
  log(`  updated ${slug} reviews page`);
}

/**
 * Append one paragraph to a category's LAST richtext block.
 *
 * Deliberately additive. `seed-doc-content.ts` owns this category's block list
 * and would replace it wholesale; this doc contributes a single closing
 * paragraph, and rewriting the list to add it would drop the sections an editor
 * has since written in the admin. The marker makes the append idempotent, and if
 * there is no richtext block to append to the paragraph becomes its own block
 * rather than being silently dropped.
 */
async function appendCategoryParagraph(
  slug: string,
  opts: { html: string; marker: string },
) {
  const doc = await Category.findOne({ slug }).select("blocks").lean<
    { blocks?: { type: string; id: string; data?: Record<string, unknown> }[] } | null
  >();
  if (!doc) {
    log(`  skipped category ${slug} (not found). Run \`npm run seed\` first`);
    return;
  }

  const scope = `category:${slug}:append`;
  checkBlockHtml(scope, { type: "richtext", data: { html: opts.html } });

  const blocks = [...(doc.blocks ?? [])];
  if (blocks.some((b) => String(b.data?.html ?? "").includes(opts.marker))) {
    log(`  category ${slug} already carries the paragraph`);
    return;
  }

  let lastRichtext = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i]?.type === "richtext" && typeof blocks[i]?.data?.html === "string") {
      lastRichtext = i;
    }
  }

  if (lastRichtext === -1) {
    blocks.push({
      type: "richtext",
      id: blockId(scope, blocks.length),
      data: { html: opts.html },
    });
  } else {
    const target = blocks[lastRichtext]!;
    blocks[lastRichtext] = {
      ...target,
      data: { ...target.data, html: `${String(target.data?.html ?? "")}${opts.html}` },
    };
  }

  const parsed = prepareExistingBlocks(scope, blocks);

  if (DRY_RUN) {
    log(
      `  [dry-run] category ${slug}: ${lastRichtext === -1 ? "append new richtext block" : `append paragraph to block #${lastRichtext}`}`,
    );
    return;
  }
  await Category.updateOne({ slug }, { $set: { blocks: parsed } });
  log(`  appended SaaS tooling paragraph to category ${slug}`);
}

// ---------------------------------------------------------------------------

async function main() {
  await connectToDatabase();
  if (DRY_RUN) log("DRY RUN. Nothing will be written.\n");

  log("Square vs Clover landing page");
  await upsertLanding(CLOVER_SQUARE_LANDING);

  log("\nSquare alternatives");
  await upsertPageSeoRoute({
    pageKey: "alternatives-square",
    title: "Square alternatives",
    path: "/alternatives/square",
    seo: SQUARE_ALTERNATIVES_SEO,
    mergeKeywordsInto: true,
    blocks: SQUARE_ALTERNATIVES_BLOCKS,
  });

  log("\nBraintree reviews");
  await updateProcessorReviewsPage("braintree", {
    seo: BRAINTREE_REVIEWS_SEO,
    faqs: BRAINTREE_REVIEWS_FAQS,
    blocks: BRAINTREE_REVIEWS_BLOCKS,
  });

  log("\nInterchange-plus");
  await upsertPageSeoRoute({
    pageKey: "payment-processors-interchange-plus",
    title: "Interchange-plus payment processors",
    path: "/payment-processors/interchange-plus",
    seo: INTERCHANGE_PLUS_SEO,
    mergeKeywordsInto: true,
    faqs: INTERCHANGE_PLUS_FAQS,
    blocks: INTERCHANGE_PLUS_BLOCKS,
  });

  log("\nSubscriptions category");
  await appendCategoryParagraph("subscriptions", {
    html: SUBSCRIPTIONS_SAAS_PARAGRAPH,
    marker: SUBSCRIPTIONS_SAAS_MARKER,
  });

  log(
    DRY_RUN
      ? "\nDry run complete. Re-run without --dry-run to apply."
      : "\nDone. Everything above is editable in admin under Pages and SEO, Categories and Processors.",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Low-KD content seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
