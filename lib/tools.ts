/**
 * Free-tool registry: the data behind `/tools` (hub) and `/tools/<slug>`.
 *
 * Static TS rather than a Mongoose model, for the same reasons as
 * `lib/glossary.ts` and `lib/facet-pages.ts`: the copy is reference content that
 * changes rarely, benefits from review, and is bound tightly to the calculator
 * code it sits under. The file is client-safe (NO `@/models` import), so the
 * sitemap can read `TOOL_SLUGS` and a `"use client"` calculator can read a rate
 * card without dragging Mongoose into the browser bundle.
 *
 * ─── Anti-cannibalisation rule ────────────────────────────────────────────────
 * The same rule the facet registry states for itself (see `lib/facet-pages.ts`),
 * applied to tools: a tool owns the CALCULATION modifier and nothing else.
 * "calculator", "how much", "estimator", "lookup", "checker".
 *
 *   "<brand> fees" / "<brand> pricing"   → /processor/<slug>
 *   "best <x> processors"                → /payment-processors/<facet>
 *   definitions                          → /glossary/<term>
 *   "x vs y"                             → /compare/<pair>
 *
 * A tool page that reaches for any of those competes with a page this site
 * already ranks. Every tool below therefore ends by linking INTO those pages
 * rather than trying to replace them.
 *
 * ─── Why calculator state never touches the URL ───────────────────────────────
 * Every widget keeps its state in React state, not the query string. Two
 * reasons: no live calculator URL in any SERP we sampled used a query parameter,
 * and a parameterised tool mints an unbounded set of near-duplicate URLs that
 * would then need a `NOINDEX_ROUTES` entry to contain. Keeping state in memory
 * makes the problem not exist.
 *
 * ─── Rate cards are the maintenance liability, not the arithmetic ─────────────
 * The maths is permanent. The published rate cards are not. Every `RateCard`
 * carries `checked` (the date the numbers were read off the processor's own
 * published US schedule) and `sources`, both rendered on the page, because a
 * wrong number renders identically to a right one. Re-verify on the cadence in
 * NOTES.md and move `checked` when you do; do not move it without re-reading the
 * source.
 */

import { MORE_TOOLS } from "@/lib/tools-more";
import { MONEY_TOOLS } from "@/lib/tools-money";
import { BATCH_FOUR_TOOLS } from "@/lib/tools-defs";
// `export * from` re-exports at runtime but does not bring names into local
// scope, and `ToolDef.rateCard` needs the type here.
import type { RateCardKey } from "@/lib/tools-rates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolFaq {
  question: string;
  answer: string;
}

/** A block of explainer copy under the widget. Plain text only: it renders as `<p>`. */
export interface ToolSection {
  heading: string;
  body: string[];
}

export interface ToolRateTable {
  caption: string;
  columns: string[];
  rows: { label: string; note?: string; values: string[] }[];
}

/**
 * Which client island the route mounts.
 *
 * One kind per calculator, except `brand-fee`, which serves Stripe, PayPal and
 * Square from three rate cards. The constants each of the others reads live in
 * `lib/tools-data.ts`.
 */
export type ToolWidgetKind =
  | "processing-fee"
  | "brand-fee"
  | "effective-rate"
  | "pricing-model"
  | "ach-vs-card"
  | "mca"
  | "gross-up"
  | "chargeback"
  | "rolling-reserve"
  | "payout-date"
  | "mcc-lookup"
  | "surcharge"
  | "restaurant"
  | "churn"
  | "lease-vs-buy"
  | "compound-interest"
  | "simple-interest"
  // Batch four. `brand-fee` serves seven of the eight brand pages off a rate
  // card; Helcim and Adyen are interchange-plus and interchange++ respectively,
  // which the flat-rate widget cannot express, so they get their own.
  | "helcim-fee"
  | "adyen-fee"
  | "p2p-business"
  | "interchange-lookup"
  | "downgrade"
  | "chargeback-cost"
  | "refund-cost"
  | "fx-markup"
  | "savings"
  | "junk-fees"
  | "pci-saq"
  | "bnpl"
  | "false-decline"
  | "high-risk"
  | "apr-apy"
  | "loan-amortization"
  | "factoring"
  | "early-payment-discount"
  | "cash-cycle"
  | "margin-markup";

export interface ToolDef {
  slug: string;
  /**
   * The tool's product name, used as the H1 subject and repeated in the copy.
   * AI Overviews refer to third-party calculators BY NAME and never by URL, so a
   * tool that only ever calls itself "our calculator" cannot be referred to.
   */
  name: string;
  h1: string;
  /** Meta title, bare. The layout appends the site name. */
  title: string;
  description: string;
  /** Answer-first intro, above the widget. */
  intro: string;
  tier: 1 | 2 | 3;
  /** One-line summary for the hub grid. */
  summary: string;
  widget: ToolWidgetKind;
  rateCard?: RateCardKey;
  /**
   * A concrete worked result, server-rendered into the HTML. The widget is a
   * client island, so without this the crawler sees an empty shell and an answer
   * engine has no numeric passage to lift.
   */
  workedExample: { scenario: string; result: string };
  sections: ToolSection[];
  rateTable?: ToolRateTable;
  /** Rendered as the visible "assumptions and limits" block. Never omit. */
  assumptions: string[];
  faqs: ToolFaq[];
  /** Other tool slugs. */
  related?: string[];
  /** Outbound links into the pages that own the non-calculator intents. */
  links: { label: string; href: string }[];
  cta: { heading: string; body: string; label: string };
}

/**
 * Rate cards, the effective-rate bands and the rate-card lookups live in
 * `lib/tools-rates.ts` and are re-exported here.
 *
 * They were moved for bundling: the client widgets need them, and importing them
 * from this module dragged the whole registry into the chunk every `/tools/*`
 * page loads. Server code and existing import sites keep working through this
 * re-export; a `"use client"` module must import from `@/lib/tools-rates`
 * directly.
 */
export * from "@/lib/tools-rates";
/**
 * And the card DATA, from `lib/rate-cards`. Server-side only in practice: a
 * `"use client"` module must never import this module at all (see above), and
 * `ToolWidget` passes the one card a page needs into the widget as a prop.
 */
export * from "@/lib/rate-cards";

// ---------------------------------------------------------------------------
// Shared copy
// ---------------------------------------------------------------------------

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const CORE_TOOLS: ToolDef[] = [
  // -------------------------------------------------------------------------
  {
    slug: "stripe-fee-calculator",
    name: "Stripe Fee Calculator",
    h1: "Stripe fee calculator",
    title: "Stripe fee calculator: what Stripe takes per transaction",
    description:
      "Work out what Stripe charges on a payment or a month of volume, including the keyed, international and currency conversion add-ons most calculators leave out.",
    intro:
      "Stripe's US rate is 2.9% plus 30 cents online and 2.7% plus 5 cents in person, but almost nobody pays only that. The add-ons are where the real number comes from: half a percent for a manually keyed card, one and a half percent for a card issued outside the US, and another one percent when a currency has to be converted. This Stripe Fee Calculator stacks them the way Stripe does.",
    tier: 1,
    summary: "Stripe's real US cost per payment, with the keyed, international and FX add-ons stacked.",
    widget: "brand-fee",
    rateCard: "stripe",
    workedExample: {
      scenario: "A $75 online payment on a US-issued card, standard Stripe pricing",
      result:
        "2.9% of $75 is $2.18, plus the 30 cent fixed fee, so Stripe takes $2.48 and you net $72.52. That is an effective rate of 3.30% on this one payment, well above the headline 2.9%, because the fixed fee is a bigger share of a small ticket.",
    },
    sections: [
      {
        heading: "How Stripe's fee is actually calculated",
        body: [
          "Stripe prices per successful transaction. The formula is the same one every card processor uses: a percentage of the amount, plus a flat fee per transaction. On US online card payments that is 2.9% plus $0.30. Take a $100 payment and Stripe keeps $3.20.",
          "The part that surprises people is the flat fee. It does not scale, so it dominates small tickets. On a $5 payment, 2.9% is 15 cents but the fixed fee is 30 cents, which makes the true cost 9% of the sale. On a $500 payment the same fixed fee is a rounding error. If your average ticket is under about $15, the fixed fee is the single biggest thing driving your rate, and no amount of negotiating the percentage will fix it.",
          "In person is cheaper and structured differently. Stripe Terminal is 2.7% plus 5 cents, so the fixed component is six times smaller. That is why a business that takes both online and card-present payments should never model itself on one blended number.",
        ],
      },
      {
        heading: "The three add-ons that make your rate higher than 2.9%",
        body: [
          "Manually keyed cards add 0.5%. If you type a card number in yourself, over the phone or from a written order, Stripe treats it as higher risk and charges accordingly. Saved cards charged later are not keyed and do not attract this.",
          "Cards issued outside the US add 1.5%. This is about where the card was issued, not where your customer is sitting or what currency they paid in. A US business selling to a traveller with a UK card pays this.",
          "Currency conversion adds 1%. This stacks on top of the international add-on when the payment also has to be converted, so a converted foreign card costs 2.9% plus 1.5% plus 1%, which is 5.4% plus 30 cents. That is the number people mean when they say Stripe's international pricing surprised them.",
        ],
      },
      {
        heading: "Where Stripe stops being the cheap option",
        body: [
          "Stripe's flat rate is genuinely competitive for online businesses under roughly $10,000 a month, because there is no monthly fee, no contract and no minimum. The trade is that the rate never improves on its own.",
          "Two things change the maths. First, volume: once you are consistently above five figures a month, interchange-plus pricing usually beats a flat 2.9% because you stop paying a fixed markup on debit cards, which cost the processor far less than rewards credit cards. Second, ticket size: on large B2B invoices, ACH at 0.8% capped at $5.00 costs a fraction of a card payment. A $4,000 invoice is $116.30 on a card and $5.00 by ACH.",
          "Disputes are the other cost line worth planning for. Stripe charges $15.00 for every dispute you receive, win or lose, and you also lose the original amount and the processing fee if you lose.",
        ],
      },
    ],
    rateTable: {
      caption: "Stripe US published rates",
      columns: ["Rate"],
      rows: [
        { label: "Online cards and wallets", values: ["2.9% + $0.30"] },
        { label: "In person (Terminal)", values: ["2.7% + $0.05"] },
        { label: "Manually entered cards", note: "on top of the online rate", values: ["+0.5%"] },
        { label: "Cards issued outside the US", values: ["+1.5%"] },
        { label: "Currency conversion", values: ["+1%"] },
        { label: "Instant bank payments", values: ["2.6% + $0.30"] },
        { label: "ACH Direct Debit", values: ["0.8%, capped at $5.00"] },
        { label: "Dispute received fee", values: ["$15.00"] },
        { label: "Instant payouts", values: ["1.5%, minimum $0.50"] },
      ],
    },
    assumptions: [
      "Rates are Stripe's published US standard pricing, read from stripe.com/pricing on 1 September 2026.",
      "Custom or negotiated pricing, available to larger accounts, is not modelled.",
      "Refunds return the payment amount to the customer but Stripe does not return the original processing fee.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "How much does Stripe charge per transaction?",
        answer:
          "2.9% plus 30 cents for online payments on US-issued cards, and 2.7% plus 5 cents for card-present payments through Stripe Terminal. Manually keyed cards add 0.5%, cards issued outside the US add 1.5%, and currency conversion adds a further 1%.",
      },
      {
        question: "Does Stripe have a monthly fee?",
        answer:
          "No. Standard Stripe pricing has no monthly fee, no setup fee and no minimum. You pay per successful transaction. Some add-on products such as Billing or Tax are priced separately.",
      },
      {
        question: "Why is my Stripe effective rate higher than 2.9%?",
        answer:
          "Almost always the 30 cent fixed fee, the keyed and international add-ons, or dispute fees. The fixed fee alone pushes a $10 payment to 5.9%. Enter your real average ticket above and the calculator shows the effective rate rather than the headline one.",
      },
      {
        question: "Is Stripe cheaper than PayPal?",
        answer:
          "On a standard US card payment, yes. Stripe is 2.9% plus 30 cents against PayPal Checkout at 3.49% plus 49 cents. On a $50 sale that is $1.75 against $2.24. PayPal's cheaper channels, such as QR code at 2.29% plus 9 cents, can beat Stripe in person.",
      },
      {
        question: "Does Stripe refund fees on a refunded payment?",
        answer:
          "No. When you refund a payment the customer gets the full amount back but Stripe keeps the original processing fee, so a refunded sale costs you the fee twice over in margin terms.",
      },
    ],
    related: ["paypal-fee-calculator", "square-fee-calculator", "credit-card-processing-fee-calculator"],
    links: [
      { label: "Stripe review and full pricing breakdown", href: "/processor/stripe" },
      { label: "Stripe vs Square", href: "/compare/stripe-vs-square" },
      { label: "Stripe alternatives", href: "/alternatives/stripe" },
      { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
      { label: "What interchange is", href: "/glossary/interchange" },
    ],
    cta: {
      heading: "Paying more than you expected?",
      body: "Tell us your volume and we will shortlist processors that price differently at your size.",
      label: "Get matched",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "paypal-fee-calculator",
    name: "PayPal Fee Calculator",
    h1: "PayPal fee calculator for US sellers",
    title: "PayPal fee calculator: US seller fees per transaction",
    description:
      "Calculate what PayPal takes from a US sale across Checkout, card payments, invoices, QR code and micropayments, including the international add-on.",
    intro:
      "PayPal does not have one US rate, it has about ten, and the one you pay depends on how the money arrived. PayPal Checkout is 3.49% plus 49 cents. A card entered on your own site is 2.99% plus 49 cents. A QR code in person is 2.29% plus 9 cents. This PayPal Fee Calculator prices the channel you actually used, for US sellers.",
    tier: 1,
    summary: "US seller fees across all ten PayPal channels, priced on the one you actually used.",
    widget: "brand-fee",
    rateCard: "paypal",
    workedExample: {
      scenario: "A $100 domestic sale paid through PayPal Checkout",
      result:
        "3.49% of $100 is $3.49, plus the 49 cent fixed fee, so PayPal takes $3.98 and you net $96.02. The same $100 taken as a QR code payment in person costs $2.38, a saving of $1.60 on one sale.",
    },
    sections: [
      {
        heading: "PayPal's US rates depend entirely on the channel",
        body: [
          "The single most useful thing to know about PayPal's pricing is that the button matters more than the amount. The same $100 sale costs $3.98 through PayPal Checkout, $3.48 through standard card payments, $3.38 through Advanced card payments and $2.38 through a QR code. Nothing about the customer or the product changed.",
          "The headline 3.49% plus 49 cents applies to PayPal Checkout, Guest Checkout, Pay with Venmo and anything PayPal classes as an other commercial transaction. It is the rate most sellers quote when they complain about PayPal, and it is the most expensive of the common ones.",
          "Cards processed on your own site are cheaper: 2.99% plus 49 cents on standard card payments, or 2.89% plus 49 cents on Advanced card payments, which requires approval. Invoicing bills at the Checkout rate of 3.49% plus 49 cents when the customer pays through PayPal or Venmo.",
        ],
      },
      {
        heading: "Micropayments, and the crossover point most sellers miss",
        body: [
          "PayPal offers opt-in micropayments pricing of 4.99% plus 9 cents. The higher percentage looks worse and usually is, but the 9 cent fixed fee instead of 49 cents flips the answer on small tickets.",
          "The crossover sits at roughly $12. Below it, micropayments wins. A $5 sale costs 66 cents on standard Checkout and 34 cents on micropayments. Above about $12 the higher percentage overtakes the fixed-fee saving and standard pricing is cheaper again. If your average ticket is genuinely under $12 and you have not applied for micropayments, you are leaving money on the table every day.",
        ],
      },
      {
        heading: "International sales, disputes and the fees people forget",
        body: [
          "Selling to a buyer outside the US adds 1.5% on top of whichever domestic rate applies. On PayPal Checkout that makes it 4.99% plus 49 cents. If the payment also has to be converted between currencies, PayPal applies a conversion spread of 3.00% to 4.00% depending on the transaction type, and that spread is buried in the exchange rate rather than shown as a line item.",
          "Two fixed costs sit outside the per-transaction rate. A chargeback costs $20.00. A standard dispute costs $15.00. Both are charged in addition to losing the sale amount if the case goes against you, which is why a low chargeback rate is worth more than a slightly better percentage.",
        ],
      },
    ],
    rateTable: {
      caption: "PayPal US seller rates",
      columns: ["Rate"],
      rows: [
        { label: "PayPal Checkout, Guest Checkout, Venmo", values: ["3.49% + $0.49"] },
        { label: "Standard card payments", values: ["2.99% + $0.49"] },
        { label: "Advanced card payments", values: ["2.89% + $0.49"] },
        { label: "Invoicing paid via PayPal or Venmo", values: ["3.49% + $0.49"] },
        { label: "QR code in person", values: ["2.29% + $0.09"] },
        { label: "Point of Sale, card present", values: ["2.29% + $0.09"] },
        { label: "Virtual Terminal", values: ["3.39% + $0.49"] },
        { label: "Pay Later", values: ["4.99% + $0.49"] },
        { label: "Micropayments", values: ["4.99% + $0.09"] },
        { label: "ACH services", values: ["0.80%, capped at $5.00"] },
        { label: "Buyer outside the US", values: ["+1.50%"] },
        { label: "Chargeback fee", values: ["$20.00"] },
        { label: "Standard dispute fee", values: ["$15.00"] },
      ],
    },
    assumptions: [
      "Rates are PayPal's published US seller schedule, read on 27 August 2026 from a page stating it was last updated on 15 July 2026.",
      "US sellers only. PayPal's rates differ by market, and a non-US seller's fees are not modelled here.",
      "Currency conversion spread is shown as a range because PayPal discloses it during the transaction rather than as a fixed published figure.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "How much does PayPal take from $100?",
        answer:
          "Through PayPal Checkout, $3.98, leaving you $96.02. Through standard card payments on your own site, $3.48. Through a QR code in person, $2.38. The channel decides the fee, not the amount.",
      },
      {
        question: "What is PayPal's goods and services fee?",
        answer:
          "Send and receive money for goods and services is 2.99% in the US with no fixed fee. PayPal Checkout, which is what most online stores actually use, is 3.49% plus 49 cents.",
      },
      {
        question: "How much does PayPal charge on an invoice?",
        answer:
          "An invoice paid through PayPal Checkout or Venmo bills at 3.49% plus 49 cents. On a $2,000 invoice that is $70.29, which is why large invoices are usually better collected by ACH at 0.80% capped at $5.00.",
      },
      {
        question: "Are PayPal micropayments cheaper?",
        answer:
          "Only below roughly $12 per transaction. Micropayments pricing is 4.99% plus 9 cents against the standard 3.49% plus 49 cents, so the smaller fixed fee wins on tiny tickets and the higher percentage loses on everything else.",
      },
      {
        question: "Does PayPal refund the fee when you refund a customer?",
        answer:
          "PayPal returns the percentage portion on a refunded commercial transaction but keeps the fixed fee. Check your own account's terms, because this has changed more than once.",
      },
    ],
    related: ["stripe-fee-calculator", "square-fee-calculator", "credit-card-processing-fee-calculator"],
    links: [
      { label: "PayPal review and full pricing breakdown", href: "/processor/paypal" },
      { label: "PayPal vs Square", href: "/compare/paypal-vs-square" },
      { label: "PayPal alternatives", href: "/alternatives/paypal" },
      { label: "Processors for ecommerce", href: "/category/ecommerce" },
      { label: "What a chargeback is", href: "/glossary/chargeback" },
    ],
    cta: {
      heading: "PayPal is rarely the cheapest option at volume",
      body: "Tell us what you process and we will shortlist processors that price your channel mix better.",
      label: "Get matched",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "square-fee-calculator",
    name: "Square Fee Calculator",
    h1: "Square fee calculator",
    title: "Square fee calculator: 2026 rates by plan and channel",
    description:
      "Work out what Square takes on your sales at 2026 rates, across Free, Plus and Premium, for in-person, online, invoice, keyed and API payments.",
    intro:
      "Square raised its US rates in 2026 and most calculators still have not updated. In-person is now 2.6% plus 15 cents on Square Free, not 2.6% plus 10 cents, and online is 3.3% plus 30 cents rather than 2.9%. This Square Fee Calculator uses the current published schedule across all three plans, so the number it gives you is the number Square charges.",
    tier: 1,
    summary: "Current 2026 Square rates across Free, Plus and Premium, and where the plan pays for itself.",
    widget: "brand-fee",
    rateCard: "square",
    workedExample: {
      scenario: "A $40 in-person card payment on Square Free",
      result:
        "2.6% of $40 is $1.04, plus the 15 cent fixed fee, so Square takes $1.19 and you net $38.81. That is an effective rate of 2.98%. The same sale on Square Plus costs $1.15.",
    },
    sections: [
      {
        heading: "Square's 2026 rates, and what changed",
        body: [
          "Square's US in-person rate on the Free plan is 2.6% plus 15 cents. The fixed portion rose from 10 cents, which sounds trivial until you count transactions: a coffee shop taking 6,000 payments a month pays an extra $300 a year for that nickel.",
          "The larger change is online. On Square Free, card payments made online or through an invoice are 3.3% plus 30 cents. That is materially more expensive than the 2.9% most people still quote, and it is the single most common error in the calculators currently ranking for this term. The 2.9% online rate now belongs to Square Plus and Square Premium, or to the Online API on any plan.",
          "Everything else is flat across plans. Manual entry and card on file are 3.5% plus 15 cents. Afterpay is 6% plus 30 cents. EBT is 1.8% plus 5 cents. A card issued outside the US adds 1.5%.",
        ],
      },
      {
        heading: "When a paid Square plan actually pays for itself",
        body: [
          "Square Plus is $49 a month per location and Square Premium is $149 a month per location. Both buy a lower processing rate, so the question is purely arithmetic: does the rate saving beat the subscription?",
          "In person, Plus saves 0.1% against Free. That means Plus breaks even at $49,000 of monthly card-present volume per location. Premium saves 0.2% against Free, which needs $74,500 a month to break even on processing alone.",
          "Online, the gap is much wider. Plus saves 0.4% against Free's 3.3%, so it breaks even at $12,250 of monthly online and invoice volume. If you invoice more than about $12,000 a month on Square Free, you are paying for Square Plus and not receiving it. The calculator above works this out on your real numbers rather than these round ones.",
        ],
      },
      {
        heading: "The costs Square's own calculator will not show you",
        body: [
          "Square's fee calculator exists to sell Square. It will not tell you that your effective rate is high, and it will not compare Square with anything.",
          "Two structural costs matter at scale. Square is flat-rate, so you pay the same percentage on a debit card that costs the network a fraction of a rewards credit card. Above roughly $15,000 a month, interchange-plus pricing usually returns that difference to you. And Square groups invoices with online payments, so a business that thinks of itself as an in-person merchant can quietly be paying the online rate on a large slice of its revenue.",
          "Against that, Square's fixed costs are genuinely low: no monthly fee on Free, next business day payouts included, no contract, and hardware you buy rather than lease. For a business under about $10,000 a month, that combination is usually cheaper in total than a lower headline rate wrapped in monthly fees.",
        ],
      },
    ],
    rateTable: {
      caption: "Square US rates by plan",
      columns: ["Square Free", "Square Plus", "Square Premium"],
      rows: [
        { label: "Tap, dip or swipe", values: ["2.6% + $0.15", "2.5% + $0.15", "2.4% + $0.15"] },
        { label: "Online and invoices", values: ["3.3% + $0.30", "2.9% + $0.30", "2.9% + $0.30"] },
        { label: "Online API", values: ["2.9% + $0.30", "2.9% + $0.30", "2.9% + $0.30"] },
        { label: "Manual entry or card on file", values: ["3.5% + $0.15", "3.5% + $0.15", "3.5% + $0.15"] },
        { label: "Afterpay", values: ["6% + $0.30", "6% + $0.30", "6% + $0.30"] },
        { label: "ACH by invoice", values: ["1%, $1 min", "1%, $1 min, $10 cap", "1%, $1 min, $10 cap"] },
        { label: "Card issued outside the US", values: ["+1.5%", "+1.5%", "+1.5%"] },
        { label: "Monthly fee, per location", values: ["$0", "$49", "$149"] },
      ],
    },
    assumptions: [
      "Rates are Square's published US schedule, read from squareup.com on 12 August 2026.",
      "Plan fees are per location. A multi-location business multiplies the monthly fee, which moves the break-even point.",
      "Square Pro custom pricing, available above $250,000 a year, is not modelled.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "How much does Square charge per transaction?",
        answer:
          "On Square Free in 2026: 2.6% plus 15 cents in person, 3.3% plus 30 cents online or by invoice, 2.9% plus 30 cents through the Online API, and 3.5% plus 15 cents for keyed or card-on-file payments. Square Plus and Premium lower the in-person and online rates.",
      },
      {
        question: "How much does Square take from $100?",
        answer:
          "$2.75 on an in-person sale on Square Free, leaving you $97.25. The same $100 taken online on Square Free costs $3.60. On Square Plus the online cost drops to $3.20.",
      },
      {
        question: "Did Square raise its fees in 2026?",
        answer:
          "Yes. The in-person fixed fee moved from 10 cents to 15 cents, and the online rate on the Free plan is 3.3% plus 30 cents. Several calculators still ranking for this query compute the old numbers.",
      },
      {
        question: "Is Square Plus worth $49 a month?",
        answer:
          "It depends where your volume sits. On online and invoice payments Plus saves 0.4%, so it pays for itself at about $12,250 a month. On in-person payments it saves only 0.1%, which needs about $49,000 a month per location.",
      },
      {
        question: "Does Square charge for invoices?",
        answer:
          "Square groups invoice payments with online payments, so an invoice paid by card costs 3.3% plus 30 cents on Square Free. Paying the same invoice by ACH bank transfer costs 1% with a $1 minimum, capped at $10 on paid plans.",
      },
    ],
    related: ["stripe-fee-calculator", "paypal-fee-calculator", "credit-card-processing-fee-calculator"],
    links: [
      { label: "Square review and full pricing breakdown", href: "/processor/square" },
      { label: "Stripe vs Square", href: "/compare/stripe-vs-square" },
      { label: "Square alternatives", href: "/alternatives/square" },
      { label: "Processors for restaurants", href: "/category/restaurants" },
      { label: "Processors for retail and POS", href: "/category/retail-pos" },
    ],
    cta: {
      heading: "Outgrown flat-rate pricing?",
      body: "Tell us your monthly volume and we will shortlist processors that price on interchange instead.",
      label: "Get matched",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "credit-card-processing-fee-calculator",
    name: "Processing Fee Calculator",
    h1: "Credit card processing fee calculator",
    title: "Credit card processing fee calculator for US merchants",
    description:
      "Model what a quoted rate really costs per month, including the monthly account fees and channel mix that most processing fee calculators leave out.",
    intro:
      "Most credit card processing fee calculators multiply your volume by a rate and stop there. That misses the two things that actually decide your bill: the monthly fixed fees a quote never leads with, and the split between card-present, online and keyed payments, which are priced differently. This Processing Fee Calculator models both, and tells you what your effective rate will be rather than what you were quoted.",
    tier: 1,
    summary: "What a quoted rate really costs per month, monthly fees and channel mix included.",
    widget: "processing-fee",
    workedExample: {
      scenario: "$25,000 a month across 420 transactions at 2.9% plus 30 cents, with $35 of monthly fees",
      result:
        "Processing is $725.00, the per-transaction fees are $126.00 and the fixed monthly charges are $35.00, so the total is $886.00. That is an effective rate of 3.54%, not 2.9%, and $10,632 a year.",
    },
    sections: [
      {
        heading: "The formula, written out",
        body: [
          "Monthly cost equals (monthly volume multiplied by the percentage rate) plus (transaction count multiplied by the per-transaction fee) plus every fixed monthly charge on the account.",
          "Effective rate equals total monthly fees divided by total monthly card volume, multiplied by 100. This is the only number worth comparing between two processors, because it is the only one that includes everything.",
          "The gap between the two is where merchants lose money. A quote of 2.9% plus 30 cents sounds like a 2.9% cost. At a $60 average ticket with $35 of monthly fees on $25,000 of volume, it is 3.54%. That 0.64 percentage point gap is $160 a month, or $1,920 a year, and it appears on no quote.",
        ],
      },
      {
        heading: "The fixed monthly fees a quote will not mention",
        body: [
          "Statement fee, gateway fee, monthly minimum, PCI compliance fee, PCI non-compliance fee, batch fee, and account maintenance. Individually they look small. Together they routinely add $30 to $100 a month, and because they do not scale with volume they hit small merchants hardest.",
          "PCI fees deserve their own paragraph. A PCI compliance fee is typically $8 to $25 a month. A PCI non-compliance fee, charged when you have not completed your annual self-assessment questionnaire, is typically $20 to $40 a month and is entirely avoidable. Merchants pay it for years without realising it is a penalty rather than a cost.",
          "The monthly minimum is the sneakiest. If your agreement sets a $25 monthly minimum and your processing fees come to $18, you are billed the missing $7. In a quiet month you pay for volume you did not process.",
        ],
      },
      {
        heading: "Why the channel split changes the answer",
        body: [
          "Card-present payments are the cheapest to process, because the card is physically there and the fraud risk is lower. Online is more expensive. Manually keyed payments, where someone types the number in, are the most expensive of all, usually by half a percentage point or more.",
          "A merchant who does 80% in person and 20% online has a genuinely different cost base from one with the reverse split, even on identical published rates. Any calculator that asks only for total volume is averaging away the thing that matters. This one asks for the split.",
          "The other lever is average ticket. The per-transaction fee is fixed, so the smaller your average sale, the larger a share of it that fee becomes. Two businesses processing $20,000 a month, one at a $10 average ticket and one at a $200 ticket, pay very different effective rates on the same quote. Run both through the calculator and the difference is usually over a percentage point.",
        ],
      },
      {
        heading: "What to do with the number",
        body: [
          "Under 2.25% is a good rate for most US small businesses. Between 2.25% and 2.75% is normal for flat-rate pricing and hard to improve without switching model. Above 3% there is almost always something specific to fix rather than a rate to haggle over.",
          "The usual causes of a high effective rate, in order: tiered pricing, which is designed to be hard to compare; a small average ticket against a high fixed fee; monthly fees you are not using; a high-risk classification you have outgrown; and a large share of keyed transactions that could be card-present or online instead.",
        ],
      },
    ],
    assumptions: [
      "The calculator prices the rate structure you enter. It does not know your processor's actual agreement, and it cannot see fees you do not tell it about.",
      "Interchange is not modelled here. On interchange-plus pricing, use the interchange-plus calculator, which shows a range rather than a false precise figure.",
      "Chargeback fees, early termination fees and equipment leases sit outside monthly processing cost and are not included.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "How do you calculate credit card processing fees?",
        answer:
          "Multiply your monthly card volume by the percentage rate, multiply your transaction count by the per-transaction fee, then add every fixed monthly charge. Divide that total by your card volume to get your effective rate, which is the only figure worth comparing between processors.",
      },
      {
        question: "How much are credit card processing fees for a small business?",
        answer:
          "Most US small businesses land between 2.2% and 3.5% all in. Flat-rate providers cluster around 2.6% to 3.5% depending on channel. Interchange-plus accounts at reasonable volume usually come in lower, but carry monthly fees that flat-rate providers do not.",
      },
      {
        question: "What is a good credit card processing rate?",
        answer:
          "As an effective rate, under 2.25% is good, 2.25% to 2.75% is average, and anything over 3% is worth investigating rather than negotiating. The number to compare is always the effective rate, never the quoted percentage.",
      },
      {
        question: "How do I calculate a 3% processing fee?",
        answer:
          "Multiply the sale by 0.03. A $100 sale carries $3.00. If there is also a fixed fee, add it: 3% plus 30 cents on $100 is $3.30, which is an effective rate of 3.3% rather than 3%.",
      },
      {
        question: "Can I pass processing fees on to customers?",
        answer:
          "Sometimes, and the rules are state-specific and network-specific. Surcharging credit cards is prohibited in a small number of US states, capped by the card networks, never permitted on debit cards, and requires advance notice to your acquirer. Check your state's current position before you set anything up.",
      },
    ],
    related: ["effective-rate-calculator", "interchange-plus-vs-flat-rate-calculator", "stripe-fee-calculator"],
    links: [
      { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
      { label: "Flat-rate vs interchange-plus", href: "/blog/flat-rate-vs-interchange-plus" },
      { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
      { label: "Flat-rate processors", href: "/payment-processors/flat-rate" },
      { label: "Effective rate, defined", href: "/glossary/effective-rate" },
      { label: "How we rate processors", href: "/methodology" },
    ],
    cta: {
      heading: "See processors that price differently",
      body: "Tell us your volume and channel mix and we will shortlist providers worth quoting against your current rate.",
      label: "Get matched",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "effective-rate-calculator",
    name: "Effective Rate Calculator",
    h1: "Effective rate calculator",
    title: "Effective rate calculator: read your merchant statement",
    description:
      "Turn your merchant statement into an effective rate, then split it into the interchange you cannot negotiate and the processor markup you can.",
    intro:
      "Your effective rate is total fees divided by total card volume. Every calculator that ranks for this stops there, which is a dead end, because it tells you what you pay without telling you what you can change. This Effective Rate Calculator does the split that matters: pass-through cost, meaning interchange and card brand assessments, against processor markup. You cannot negotiate interchange. Markup is the only part anyone can move.",
    tier: 2,
    summary: "Your real rate from your own statement, split into pass-through cost and negotiable markup.",
    widget: "effective-rate",
    workedExample: {
      scenario: "A month with $98,511 of card volume and $5,907 of total fees",
      result:
        "The effective rate is 5.99%, which is extremely high. If $2,120 of that was interchange and assessments, the markup is $3,787, or 384 basis points. The pass-through half is fixed. The 384 basis points is the entire negotiation.",
    },
    sections: [
      {
        heading: "The two formulas",
        body: [
          "Effective rate equals (total fees divided by total card volume) multiplied by 100. Total fees means everything the processor took that month: the discount rate, per-item fees, the statement fee, the gateway fee, PCI charges, the monthly minimum, and anything else on the bill.",
          "Effective markup equals (total fees minus interchange minus card brand assessments) divided by total card volume. This is the number to take into a negotiation, and it is usually quoted in basis points, where one basis point is one hundredth of a percentage point.",
          "The distinction is not academic. Interchange goes to the bank that issued your customer's card and card brand assessments go to Visa and Mastercard. Your processor passes both through and keeps the rest. Asking a processor to lower your rate without knowing the split is asking them to cut into a number you cannot see.",
        ],
      },
      {
        heading: "How to read a merchant statement without help",
        body: [
          "Find total sales volume and total fees first. They are usually on page one, sometimes labelled as gross processing volume and total discount plus other fees. Every other number on the statement is a subdivision of these two.",
          "Then look for an interchange section. On interchange-plus pricing it is itemised by card type, and adding it up gives you the pass-through figure directly. On flat-rate or tiered pricing it is not shown at all, because the whole point of those models is that the split is hidden. In that case, estimate: for a typical US small business mix, interchange plus assessments usually lands between 1.7% and 2.1% of volume.",
          "Finally, list every fixed line item. Statement fee, monthly minimum, PCI compliance, PCI non-compliance, batch fees, gateway fees, account maintenance, and anything described as a regulatory or network access fee. These are the ones that do not scale, and the ones most often left in place for years after they stopped being justified.",
        ],
      },
      {
        heading: "What the answer means",
        body: [
          "For a typical US small business, a markup of 20 to 50 basis points over interchange is competitive. Under 20 basis points is very good. Over 100 basis points, on a merchant with no unusual risk, is a conversation worth having with your processor or with a competitor.",
          "On the effective rate itself, the ladder that merchants actually use is simple. Around 1.6% to 1.7% is excellent. About 2% is fine. 2.5% is high. 3% is expensive. Above 3%, something specific is wrong rather than slightly off.",
          "One caveat that matters. A high effective rate is not always a bad deal. A business with a $6 average ticket, a lot of keyed transactions, or a genuinely high-risk classification will have a higher rate than a jewellery shop taking $900 card-present sales, and no processor can change that. The markup number is the fair comparison, because it strips out the parts nobody controls.",
        ],
      },
      {
        heading: "Why free statement analysis usually has a catch",
        body: [
          "Search for merchant statement analysis and every result asks you to upload a PDF of your financials and hand over a phone number, to a company that sells payment processing, so that it can tell you whether you are overpaying. Some of them charge for the paid version, which tells you the output has real value.",
          "This calculator runs entirely in your browser. Nothing is uploaded, nothing is stored, and no one calls you. If you want a quote afterwards that is your decision to make with the number in hand, which is the right order.",
        ],
      },
    ],
    assumptions: [
      "Quick mode is arithmetic on two numbers you supply and cannot go out of date.",
      "In full mode, the interchange figure is whatever you enter. If your statement does not itemise interchange, the calculator uses an estimate band of 1.7% to 2.1% and labels the result as an estimate.",
      "Interchange varies by card type, merchant category and channel. Anyone publishing a single precise interchange number for all merchants is guessing.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "How do I calculate my effective rate?",
        answer:
          "Divide total monthly fees by total monthly card volume and multiply by 100. If you paid $1,196 in fees on $52,000 of card sales, your effective rate is 2.30%.",
      },
      {
        question: "What is a good effective rate for credit card processing?",
        answer:
          "About 1.6% to 1.7% is excellent, 2% is fine, 2.5% is high and 3% is expensive. Above 3% there is usually a specific cause: tiered pricing, a small average ticket, unused monthly fees, or a high-risk classification.",
      },
      {
        question: "What is the difference between effective rate and quoted rate?",
        answer:
          "The quoted rate is the percentage in the sales pitch. The effective rate is everything you actually paid divided by everything you actually processed, so it includes per-item fees, monthly charges and anything else on the statement. The gap between them is often half a percentage point or more.",
      },
      {
        question: "What is effective markup and why does it matter more?",
        answer:
          "Effective markup is your total fees minus interchange and card brand assessments, divided by volume. Interchange goes to the card-issuing bank and assessments go to the networks, and no processor can discount either. Markup is the only part that is actually negotiable.",
      },
      {
        question: "How do I read a merchant processing statement?",
        answer:
          "Start with total volume and total fees on page one, then find the interchange section if your pricing itemises it, then list every fixed monthly line item. Those three things give you the effective rate, the markup and the list of charges worth questioning.",
      },
    ],
    related: ["credit-card-processing-fee-calculator", "interchange-plus-vs-flat-rate-calculator", "ach-vs-credit-card-fee-calculator"],
    links: [
      { label: "Effective rate, defined", href: "/glossary/effective-rate" },
      { label: "Interchange, defined", href: "/glossary/interchange" },
      { label: "Assessment fee, defined", href: "/glossary/assessment-fee" },
      { label: "Monthly minimum, defined", href: "/glossary/monthly-minimum" },
      { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
      { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
    ],
    cta: {
      heading: "Now you know your markup",
      body: "Tell us your volume and current effective rate and we will shortlist processors worth quoting against it.",
      label: "Get matched",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "interchange-plus-vs-flat-rate-calculator",
    name: "Interchange-Plus vs Flat-Rate Calculator",
    h1: "Interchange-plus vs flat-rate calculator",
    title: "Interchange-plus vs flat-rate calculator with break-even",
    description:
      "Find the monthly volume where interchange-plus pricing overtakes flat-rate, on your own average ticket and card mix, including the answer to stay put.",
    intro:
      "Every page that ranks for this question is published by a company that sells interchange-plus processing, so every one of them concludes switch. None of them computes the point where that stops being true. This calculator returns a break-even monthly volume and a break-even average ticket, which means it can also tell you to stay exactly where you are.",
    tier: 2,
    summary: "The break-even volume where interchange-plus overtakes flat-rate. It can also say stay put.",
    widget: "pricing-model",
    workedExample: {
      scenario: "$18,000 a month across 300 transactions, flat rate 2.9% plus 30 cents against interchange-plus at 0.30% plus 10 cents over an estimated 1.85% interchange",
      result:
        "Flat-rate costs $612.00 a month. Interchange-plus costs $417.00 plus $30 of monthly fees, so $447.00. You save $165 a month, and the break-even sits at $2,769 of monthly volume, so at $18,000 a month you are well past the point where switching pays.",
    },
    sections: [
      {
        heading: "What the two models actually are",
        body: [
          "Flat-rate pricing charges one percentage for every card, regardless of what that card costs the processor. A debit card that costs the network well under 1% and a premium rewards card that costs over 2% are billed to you identically. The processor keeps the difference on the cheap ones.",
          "Interchange-plus passes the real network cost straight through and adds a disclosed markup on top, usually quoted as a percentage plus a per-transaction fee, for example interchange plus 0.30% plus 10 cents. You see exactly what the networks took and exactly what the processor took.",
          "Interchange-plus is nearly always structurally cheaper at the same volume, because you stop subsidising the processor on debit and low-cost cards. What it adds is monthly fees, a more complicated statement and, often, an application process rather than instant signup.",
        ],
      },
      {
        heading: "Where the break-even actually sits",
        body: [
          "The break-even is the monthly volume at which the rate saving from interchange-plus equals the monthly fees it charges. Below it, flat-rate wins. Above it, interchange-plus wins. Published answers to this question range from $5,000 a month to $10,000 a month, and they contradict each other because the answer depends on your numbers rather than on a rule.",
          "Two inputs move it more than anything else. Your card mix: the more debit you take, the sooner interchange-plus wins, because debit is where the flat rate overcharges most. And your average ticket: a low average ticket means more transactions per dollar of volume, which makes the per-transaction fee side of both models matter more than the percentage.",
          "The calculator returns the break-even volume for your inputs, so you get a number rather than a rule of thumb, and you can see how far above or below it you currently sit.",
        ],
      },
      {
        heading: "When flat-rate is genuinely the right answer",
        body: [
          "Below the break-even, flat-rate is not a compromise, it is correct. Paying $30 a month in fees to save $18 a month in rate is a loss, however good the underlying pricing looks.",
          "Flat-rate also wins on things this calculator cannot price. No underwriting wait. No contract or early termination fee. A predictable bill, which matters more to some businesses than a lower one. And no statement to audit, which has real value if nobody in the business wants that job.",
          "The honest framing is that interchange-plus is a better deal that costs more to run. Above the break-even, that trade is worth making. Below it, it is not.",
        ],
      },
      {
        heading: "Why the interchange figure here is a range",
        body: [
          "Visa and Mastercard publish interchange as downloadable rate tables, not as a feed, and the rate depends on card type, merchant category, channel and how the transaction was authorised. There are hundreds of categories.",
          "Any calculator that returns a single precise interchange number for an unknown merchant is presenting a guess as a fact. This one uses a band, defaulting to a typical US small-business blend, and lets you replace it with the real figure off your own statement if you have it. The output moves with the input, which is how it should be.",
        ],
      },
    ],
    assumptions: [
      "Interchange defaults to an estimated blended 1.85% plus assessments, a typical US small-business mix. Replace it with your statement's actual figure for a real answer.",
      "The comparison prices processing only. It does not price the underwriting wait, contract terms or statement complexity, all of which are real costs of switching.",
      "Break-even assumes your card mix and average ticket stay roughly constant as volume grows.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "Is interchange-plus cheaper than flat rate?",
        answer:
          "Above your break-even volume, almost always, because you stop paying a flat percentage on debit cards that cost the network far less. Below it, the monthly fees on an interchange-plus account cost more than the rate saves. The break-even depends on your card mix and average ticket, which is what the calculator works out.",
      },
      {
        question: "At what volume should I switch to interchange-plus?",
        answer:
          "Published answers range from $5,000 to $10,000 a month, and both can be right for different merchants. Enter your own volume, transaction count and monthly fees above and the calculator returns your break-even rather than a rule of thumb.",
      },
      {
        question: "What is interchange-plus pricing?",
        answer:
          "A pricing model where the processor passes the card network's interchange and assessment costs through at cost and adds a separate, disclosed markup, usually a percentage plus a per-transaction fee. It is the most transparent of the common models.",
      },
      {
        question: "What is wrong with tiered pricing?",
        answer:
          "Tiered pricing sorts transactions into qualified, mid-qualified and non-qualified buckets defined by the processor, not the networks. Because the processor decides which transactions land in the expensive buckets, two statements with identical headline rates can cost very different amounts. It is the model most likely to produce a surprising effective rate.",
      },
      {
        question: "Can I get interchange-plus at low volume?",
        answer:
          "Yes. Several providers now offer interchange-plus with no monthly minimum, which moves the break-even down considerably. If the monthly fee is zero, interchange-plus wins at essentially any volume, so the fee is the number to ask about first.",
      },
    ],
    related: ["effective-rate-calculator", "credit-card-processing-fee-calculator", "ach-vs-credit-card-fee-calculator"],
    links: [
      { label: "Flat-rate vs interchange-plus", href: "/blog/flat-rate-vs-interchange-plus" },
      { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
      { label: "Flat-rate processors", href: "/payment-processors/flat-rate" },
      { label: "Interchange-plus, defined", href: "/glossary/interchange-plus" },
      { label: "Tiered pricing, defined", href: "/glossary/tiered-pricing" },
      { label: "Markup, defined", href: "/glossary/markup" },
    ],
    cta: {
      heading: "Above your break-even?",
      body: "Tell us your volume and we will shortlist interchange-plus providers worth quoting.",
      label: "Get matched",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "ach-vs-credit-card-fee-calculator",
    name: "ACH vs Card Fee Calculator",
    h1: "ACH vs credit card fee calculator",
    title: "ACH vs credit card fee calculator for US businesses",
    description:
      "Compare what an invoice costs by ACH bank transfer against a card payment, including the fee caps that make ACH dramatically cheaper on large tickets.",
    intro:
      "On a $50 sale the difference between ACH and a card is small change. On a $10,000 invoice it is not close: the card takes roughly $290 and ACH takes $5.00, because almost every US ACH product caps its fee. This calculator prices both on your real invoice size, models the cap and the minimum properly, and finds the payment size where ACH starts winning.",
    tier: 2,
    summary: "What an invoice costs by ACH against a card, with the fee cap modelled properly.",
    widget: "ach-vs-card",
    workedExample: {
      scenario: "A $10,000 invoice, card at 2.9% plus 30 cents against ACH at 0.8% capped at $5.00",
      result:
        "The card costs $290.30. ACH would be $80.00 uncapped, but the $5.00 cap applies, so it costs $5.00. You keep $285.30 more on this single invoice.",
    },
    sections: [
      {
        heading: "The cap is the entire story",
        body: [
          "A card fee is a percentage with no ceiling, so it grows without limit as the invoice grows. Almost every US ACH product is a percentage with a cap: Stripe is 0.8% capped at $5.00, PayPal is 0.80% capped at $5.00, Square is 1% with a $1 minimum and a $10 cap on paid plans, and Helcim is 0.5% plus 25 cents capped at $6.00.",
          "That cap means ACH cost stops rising at a fixed point while card cost keeps climbing. Against a 2.9% plus 30 cent card rate, an ACH product at 0.8% with no fixed fee is cheaper on every payment, from the first dollar, and the gap widens without limit: about $24 saved on a $1,000 invoice, about $285 on a $10,000 one. A crossover only exists when the ACH product has a minimum fee, as Square's $1 minimum does, and then it sits somewhere around $20 to $30.",
          "Modelling ACH as a single flat percentage, which most comparisons do, gets the answer badly wrong on exactly the invoices where the decision matters. This calculator applies percentage, fixed fee, minimum and cap in the right order.",
        ],
      },
      {
        heading: "What ACH costs you that money does not measure",
        body: [
          "Speed. ACH settles in one to three business days rather than same day, and some providers hold new merchants longer. If your cash flow is tight, that delay has a real price.",
          "Failure handling. ACH payments can be returned for insufficient funds or a closed account, typically days later, and providers charge a return fee. Cards fail at authorisation, which is immediate and cheaper to handle.",
          "Customer friction. A card takes a number your customer already has memorised. ACH takes a bank account and routing number, or a bank login through an aggregator. For a consumer checkout that friction usually costs more in conversion than the fee saves. For a B2B invoice, where the customer is a finance team paying on terms, it costs almost nothing.",
        ],
      },
      {
        heading: "Who should switch, and how",
        body: [
          "The clear case is B2B invoicing with an average invoice over about $500. Offering ACH as the default and cards as the alternative, rather than the other way round, moves most of that volume without any hard requirement.",
          "The other strong case is recurring billing at a meaningful monthly value. Subscription businesses lose money twice on cards, once on the fee and once on involuntary churn when cards expire or get declined. Bank details change far less often than card details.",
          "The case against is consumer checkout, small tickets and anything impulse-driven. Below about $30 the saving is pennies and the friction is real.",
        ],
      },
    ],
    assumptions: [
      "Default ACH pricing is 0.8% capped at $5.00, which matches Stripe and PayPal's published US rates. Change it to your provider's structure.",
      "Return fees, which apply when an ACH payment bounces, are not included in the per-transaction comparison. Budget for them separately if your return rate is above about 0.5%.",
      "Settlement timing is not priced. ACH is slower, and for some businesses that is worth more than the fee saving.",
      NOT_ADVICE,
    ],
    faqs: [
      {
        question: "Is ACH cheaper than a credit card?",
        answer:
          "Almost always, and dramatically so on large invoices. A $10,000 payment costs about $290 on a card at 2.9% plus 30 cents, and $5.00 by ACH at 0.8% with a $5.00 cap. On small tickets the saving is pennies, so convenience should decide, and if your ACH provider charges a minimum fee the card can genuinely be cheaper below about $20.",
      },
      {
        question: "How much are ACH fees?",
        answer:
          "Typically 0.5% to 1% of the payment with a cap between $5.00 and $10.00. Stripe and PayPal both publish 0.8% capped at $5.00. Square charges 1% with a $1 minimum and a $10 cap on paid plans.",
      },
      {
        question: "Who pays the ACH fee?",
        answer:
          "The business receiving the payment, in the same way it pays card processing fees. Passing an ACH fee on to a customer is generally permitted, unlike credit card surcharging, but check your provider's terms and your state's rules first.",
      },
      {
        question: "Is there a fee for ACH payments?",
        answer:
          "For a business accepting them, yes, though it is much smaller than card processing. For a consumer sending one from a personal bank account, usually not. The cost sits with the merchant either way.",
      },
      {
        question: "Should I accept ACH payments?",
        answer:
          "If you invoice B2B customers or bill recurring amounts above about $200, almost certainly. If you run a consumer checkout with small tickets, the added friction usually outweighs the saving.",
      },
    ],
    related: ["credit-card-processing-fee-calculator", "effective-rate-calculator", "interchange-plus-vs-flat-rate-calculator"],
    links: [
      { label: "ACH payment processors", href: "/payment-processors/ach" },
      { label: "ACH, defined", href: "/glossary/ach" },
      { label: "Processors for subscriptions", href: "/category/subscriptions" },
      { label: "Processors for small business", href: "/category/small-business" },
      { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
    ],
    cta: {
      heading: "Want ACH on your invoices?",
      body: "Tell us your invoice volume and we will shortlist processors with strong ACH pricing.",
      label: "Get matched",
    },
  },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Every tool, in hub order. Split across four modules; the later batches are
 * identical in shape. `MORE_TOOLS` is a size split only. `MONEY_TOOLS` is a
 * SUBJECT split: general interest arithmetic rather than a question about a
 * processor, kept separable on purpose. `BATCH_FOUR_TOOLS` is a directory,
 * `lib/tools-defs/`, one file per tool: twenty five entries in one module would
 * be an unreviewable file, and one file per page means a page's copy has its own
 * diff. All of them import `ToolDef` from here as a TYPE, so the import is
 * erased at compile time and there is no runtime cycle.
 */
export const TOOLS: ToolDef[] = [...CORE_TOOLS, ...MORE_TOOLS, ...MONEY_TOOLS, ...BATCH_FOUR_TOOLS];

/** Sitemap and `generateStaticParams` read this. Keep it client-safe. */
export const TOOL_SLUGS: string[] = TOOLS.map((t) => t.slug);

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export const TOOLS_HUB = {
  h1: "Free payment tools and calculators",
  title: "Free payment processing calculators for US merchants",
  description:
    "44 free calculators for US merchants: processing fees, your effective rate, ten processors' published rates, interchange, chargebacks, refunds and cash flow.",
  intro:
    "Every tool here runs in your browser, needs no email address, and shows the rates it used and the date they were checked. They are built for US merchants, in dollars, against the fee schedules processors actually publish. Ten of them price a named processor off its own published card; the rest price the things that do not appear on a rate card at all, from interchange downgrades and chargebacks to what a refund really costs you.",
} as const;
