import type { DirectoryParams } from "@/lib/directory-shared";

/**
 * Facet ("best-for") landing-page registry — the data behind
 * `/payment-processors/<facet>`.
 *
 * Each entry is a curated, indexable landing page that pre-filters the directory
 * on ONE capability axis (an integration, payment method, pricing model, or
 * feature) and wraps the live results in unique intro copy + FAQs. The page
 * reuses `queryDirectory` (the same engine as `/category/[slug]`), so ranking
 * never drifts.
 *
 * Anti-cannibalisation rule: facets deliberately target axes the seeded
 * CATEGORIES do NOT own. Categories already cover use-case/industry/business-size
 * (ecommerce, retail-pos, subscriptions, high-risk, international, marketplaces,
 * small-business, restaurants, nonprofits, developers), so facets stick to
 * platform integrations, payment methods, pricing models, and discrete features.
 *
 * `filter` maps straight onto `DirectoryParams` fields. In the page it is merged
 * with the user's rail params so the facet stays locked (capability facets union
 * to narrow further; classification facets overwrite so the lock can't be widened
 * away). This file is client-safe (no `@/models`), so the sitemap can import
 * `FACET_SLUGS` without pulling Mongoose into the bundle.
 */

export interface FacetFilter {
  pricingModel?: string[];
  methods?: string[];
  integrations?: string[];
  features?: string[];
  region?: string[];
  highRisk?: boolean;
}

export interface FacetPageDef {
  /** URL segment, e.g. "for-shopify" → `/payment-processors/for-shopify`. */
  slug: string;
  /** Page H1. */
  h1: string;
  /** Meta title (bare — the `· PayCompare` suffix is appended by the layout). */
  title: string;
  /** Meta description. */
  description: string;
  /** Answer-first intro paragraph (unique per page). */
  intro: string;
  /** Directory constraint that defines this facet. */
  filter: FacetFilter;
  /** 2–3 useful FAQs, also emitted as FAQPage JSON-LD. */
  faqs: { question: string; answer: string }[];
  /** Slugs of related facet pages, for internal linking. */
  related?: string[];
}

export const FACET_PAGES: FacetPageDef[] = [
  // --- Platform integrations -------------------------------------------------
  {
    slug: "for-shopify",
    h1: "Best payment processors for Shopify",
    title: "Best payment processors for Shopify stores",
    description:
      "Compare payment processors that integrate with Shopify on fees, payment methods, payout times, and verified merchant reviews.",
    intro:
      "The best payment processor for a Shopify store keeps checkout conversion high while keeping fees predictable. These processors integrate with Shopify (as the native gateway or through a supported app) so you can take cards and wallets without rebuilding checkout.",
    filter: { integrations: ["shopify"] },
    faqs: [
      {
        question: "Which payment processor is best for Shopify?",
        answer:
          "It depends on your volume and where you sell. Flat-rate processors are simplest for new stores, while interchange-plus options can be cheaper at scale. Compare the Shopify-compatible processors here on effective rate, payout time, and reviews.",
      },
      {
        question: "Do I have to use Shopify Payments?",
        answer:
          "No. Shopify supports many third-party gateways, though using an external processor can add a transaction fee on some Shopify plans. Weigh that fee against the processor's own rate before switching.",
      },
    ],
    related: ["for-woocommerce", "for-bigcommerce", "flat-rate"],
  },
  {
    slug: "for-woocommerce",
    h1: "Best payment processors for WooCommerce",
    title: "Best payment processors for WooCommerce",
    description:
      "Compare WooCommerce-compatible payment processors on fees, payment methods, integrations, and verified merchant reviews.",
    intro:
      "WooCommerce runs on WordPress, so the right processor is one with a well-maintained WooCommerce extension and clear pricing. These processors plug into WooCommerce to accept cards, wallets, and (with some) alternative payment methods.",
    filter: { integrations: ["woocommerce"] },
    faqs: [
      {
        question: "What is the cheapest processor for WooCommerce?",
        answer:
          "The cheapest option is usually an interchange-plus processor once you have steady volume, because you pay the true card cost plus a fixed markup. Compare the WooCommerce-ready processors here to see effective rates side by side.",
      },
      {
        question: "Is there a free WooCommerce payment plugin?",
        answer:
          "Most major processors offer their WooCommerce extension for free and make money on transaction fees rather than a plugin licence. Always check for monthly gateway or platform fees on top of the per-transaction rate.",
      },
    ],
    related: ["for-shopify", "for-wix", "interchange-plus"],
  },
  {
    slug: "for-bigcommerce",
    h1: "Best payment processors for BigCommerce",
    title: "Best payment processors for BigCommerce",
    description:
      "Compare BigCommerce-compatible payment processors on fees, payout times, payment methods, and verified merchant reviews.",
    intro:
      "BigCommerce lets you connect a wide range of gateways without extra transaction fees on its own plans, so the processor's rate is what really matters. These processors integrate with BigCommerce for card and wallet payments.",
    filter: { integrations: ["bigcommerce"] },
    faqs: [
      {
        question: "Does BigCommerce charge extra transaction fees?",
        answer:
          "BigCommerce does not add its own transaction fee for using a third-party gateway, unlike some platforms. You still pay your processor's per-transaction rate, so compare those rates below.",
      },
    ],
    related: ["for-shopify", "for-woocommerce", "multi-currency"],
  },
  {
    slug: "for-wix",
    h1: "Best payment processors for Wix",
    title: "Best payment processors for Wix stores",
    description:
      "Compare Wix-compatible payment processors on fees, payment methods, payout times, and verified merchant reviews.",
    intro:
      "For a Wix store, the best processor is one Wix supports directly so checkout stays on-site and mobile-friendly. These processors work with Wix to accept cards and popular digital wallets.",
    filter: { integrations: ["wix"] },
    faqs: [
      {
        question: "Which payment processors work with Wix?",
        answer:
          "Wix supports several major gateways alongside its own Wix Payments. Compare the Wix-compatible processors here on rate, payout speed, and reviews to find the best fit for your store.",
      },
    ],
    related: ["for-squarespace", "for-shopify", "flat-rate"],
  },
  {
    slug: "for-squarespace",
    h1: "Best payment processors for Squarespace",
    title: "Best payment processors for Squarespace",
    description:
      "Compare Squarespace-compatible payment processors on fees, payout times, payment methods, and verified merchant reviews.",
    intro:
      "Squarespace Commerce integrates with a small set of processors, so your choice comes down to fees and payout speed. These processors connect to Squarespace to take card and wallet payments at checkout.",
    filter: { integrations: ["squarespace"] },
    faqs: [
      {
        question: "What payment processors does Squarespace support?",
        answer:
          "Squarespace works with a limited number of gateways for online checkout. Compare the supported processors here on effective rate and merchant reviews before committing.",
      },
    ],
    related: ["for-wix", "for-shopify", "flat-rate"],
  },
  {
    slug: "with-virtual-terminal",
    h1: "Payment processors with a virtual terminal",
    title: "Payment processors with a virtual terminal",
    description:
      "Compare processors that offer a virtual terminal for phone, mail, and keyed-in payments — on fees, features, and verified reviews.",
    intro:
      "A virtual terminal lets you key in card payments from any browser. It's ideal for phone and mail orders, invoicing, and businesses without a physical card reader. These processors include a virtual terminal in their dashboard.",
    filter: { integrations: ["virtual-terminal"] },
    faqs: [
      {
        question: "What is a virtual terminal?",
        answer:
          "A virtual terminal is a secure web page in your payment dashboard where you manually enter a customer's card details to take a payment, useful for phone (MOTO) and mail orders. Keyed-in transactions usually cost more than card-present ones.",
      },
    ],
    related: ["with-invoicing", "with-payment-links", "interchange-plus"],
  },
  {
    slug: "with-payment-links",
    h1: "Payment processors with payment links",
    title: "Payment processors with payment links",
    description:
      "Compare processors that support shareable payment links — no website needed — on fees, features, and verified reviews.",
    intro:
      "Payment links let you get paid without a checkout page: create a link, share it by email, text, or social, and the customer pays on a hosted page. These processors support payment links out of the box.",
    filter: { integrations: ["payment-links"] },
    faqs: [
      {
        question: "How do payment links work?",
        answer:
          "You generate a secure link for a fixed or custom amount and send it to the customer; they pay on the processor's hosted page and you get the funds like any other transaction. No website or developer work is required.",
      },
    ],
    related: ["with-invoicing", "with-virtual-terminal", "flat-rate"],
  },
  {
    slug: "with-invoicing",
    h1: "Payment processors with invoicing",
    title: "Payment processors with built-in invoicing",
    description:
      "Compare processors with built-in invoicing on fees, recurring options, payment methods, and verified merchant reviews.",
    intro:
      "Built-in invoicing turns your processor into a lightweight billing tool: send a branded invoice, let customers pay by card or bank transfer, and track what's outstanding. These processors include invoicing without a separate subscription.",
    filter: { integrations: ["invoicing"] },
    faqs: [
      {
        question: "Can I send invoices and take card payments in one place?",
        answer:
          "Yes. The processors listed here include invoicing, so you can issue an invoice and collect payment through the same account instead of bolting on a separate billing product.",
      },
    ],
    related: ["with-payment-links", "with-virtual-terminal", "multi-currency"],
  },
  // --- Payment methods -------------------------------------------------------
  {
    slug: "ach",
    h1: "Best ACH payment processors",
    title: "Best ACH payment processors",
    description:
      "Compare processors that support ACH bank transfers on fees, payout times, features, and verified merchant reviews.",
    intro:
      "ACH payments move money directly between US bank accounts, so they're far cheaper than cards for large or recurring charges, often a flat fee rather than a percentage. These processors support ACH alongside card payments.",
    filter: { methods: ["ach"] },
    faqs: [
      {
        question: "Why use ACH instead of cards?",
        answer:
          "ACH fees are typically a small flat amount or a capped percentage, which makes them much cheaper than card fees on high-value or recurring payments. The trade-off is slower settlement, usually a few business days.",
      },
      {
        question: "How much does ACH processing cost?",
        answer:
          "ACH usually costs a flat fee per transaction or a low capped percentage, versus roughly 2.5–3% for cards. Compare the ACH-capable processors here to see exact pricing.",
      },
    ],
    related: ["interchange-plus", "with-invoicing", "multi-currency"],
  },
  {
    slug: "crypto",
    h1: "Best crypto payment processors",
    title: "Best cryptocurrency payment processors",
    description:
      "Compare processors that accept cryptocurrency payments on fees, supported coins, settlement, and verified merchant reviews.",
    intro:
      "Crypto payment processors let you accept digital currencies and, in most cases, settle to your bank in local currency so you avoid holding volatile assets. These processors support cryptocurrency payments.",
    filter: { methods: ["crypto"] },
    faqs: [
      {
        question: "Can I accept crypto and settle in dollars?",
        answer:
          "Most crypto processors let the customer pay in cryptocurrency while you receive a fiat payout, removing price-volatility risk. Check each processor's supported coins and settlement options below.",
      },
    ],
    related: ["ach", "multi-currency", "interchange-plus"],
  },
  {
    slug: "apple-pay",
    h1: "Payment processors that support Apple Pay",
    title: "Payment processors with Apple Pay",
    description:
      "Compare processors that support Apple Pay on fees, integrations, payout times, and verified merchant reviews.",
    intro:
      "Apple Pay speeds up checkout and cuts cart abandonment on iPhone and Safari by letting customers pay with Face ID or Touch ID. These processors support Apple Pay online, in-app, or in person.",
    filter: { methods: ["apple-pay"] },
    faqs: [
      {
        question: "Does accepting Apple Pay cost extra?",
        answer:
          "Apple does not charge merchants a separate fee for Apple Pay; you pay your processor's normal card rate. Compare the Apple Pay-ready processors here on that rate and their integrations.",
      },
    ],
    related: ["google-pay", "for-shopify", "flat-rate"],
  },
  {
    slug: "google-pay",
    h1: "Payment processors that support Google Pay",
    title: "Payment processors with Google Pay",
    description:
      "Compare processors that support Google Pay on fees, integrations, payout times, and verified merchant reviews.",
    intro:
      "Google Pay gives Android and Chrome shoppers a fast, saved-card checkout that can lift conversion. These processors support Google Pay across web and in-app payments.",
    filter: { methods: ["google-pay"] },
    faqs: [
      {
        question: "Is Google Pay free for merchants?",
        answer:
          "Google Pay adds no separate merchant fee — you pay your processor's standard card rate. Compare the Google Pay-compatible processors below on rate and platform support.",
      },
    ],
    related: ["apple-pay", "for-shopify", "flat-rate"],
  },
  {
    slug: "bnpl",
    h1: "Payment processors with buy now, pay later",
    title: "Payment processors with BNPL (buy now, pay later)",
    description:
      "Compare processors that offer buy now, pay later on fees, supported providers, and verified merchant reviews.",
    intro:
      "Buy now, pay later (BNPL) lets customers split a purchase into instalments while you get paid up front, which can raise average order value. These processors offer BNPL directly or through integrated providers.",
    filter: { methods: ["bnpl"] },
    faqs: [
      {
        question: "How does BNPL affect my payout?",
        answer:
          "With most BNPL options you receive the full amount up front and the provider takes on the instalment risk, in exchange for a higher fee than a standard card transaction. Compare the BNPL-capable processors here for details.",
      },
    ],
    related: ["apple-pay", "for-shopify", "flat-rate"],
  },
  // --- Pricing models --------------------------------------------------------
  {
    slug: "interchange-plus",
    h1: "Best interchange-plus payment processors",
    title: "Best interchange-plus payment processors",
    description:
      "Compare interchange-plus payment processors on transparency, effective rate, features, and verified merchant reviews.",
    intro:
      "Interchange-plus pricing shows you the true card-network cost plus a fixed markup, so it's the most transparent model and usually the cheapest once you have steady volume. These processors offer interchange-plus pricing.",
    filter: { pricingModel: ["interchange-plus"] },
    faqs: [
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
    ],
    related: ["flat-rate", "ach", "no-rolling-reserve"],
  },
  {
    slug: "flat-rate",
    h1: "Best flat-rate payment processors",
    title: "Best flat-rate payment processors",
    description:
      "Compare flat-rate payment processors on pricing, ease of setup, features, and verified merchant reviews.",
    intro:
      "Flat-rate pricing charges one predictable percentage (plus a fixed fee) on every sale, with no monthly minimums, which makes it the simplest model for new and low-volume businesses. These processors use flat-rate pricing.",
    filter: { pricingModel: ["flat-rate"] },
    faqs: [
      {
        question: "Who should use flat-rate pricing?",
        answer:
          "Flat-rate suits new stores, low or unpredictable volume, and anyone who values simple, predictable costs over squeezing out the lowest possible rate. As volume grows, interchange-plus often becomes cheaper.",
      },
    ],
    related: ["interchange-plus", "for-shopify", "apple-pay"],
  },
  // --- Features --------------------------------------------------------------
  {
    slug: "multi-currency",
    h1: "Multi-currency payment processors",
    title: "Best multi-currency payment processors",
    description:
      "Compare multi-currency payment processors on supported currencies, FX rates, payout options, and verified reviews.",
    intro:
      "Multi-currency processing lets customers pay in their own currency and lets you settle in yours, which improves international conversion and clarifies FX costs. These processors support multiple currencies.",
    filter: { features: ["multi-currency"] },
    faqs: [
      {
        question: "What is multi-currency processing?",
        answer:
          "It's the ability to present prices and accept payment in several currencies, then settle to your account, sometimes in the original currency, sometimes converted. Watch the FX margin, which varies by processor.",
      },
    ],
    related: ["crypto", "ach", "interchange-plus"],
  },
  {
    slug: "no-rolling-reserve",
    h1: "Payment processors with no rolling reserve",
    title: "Payment processors with no rolling reserve",
    description:
      "Compare processors that don't hold a rolling reserve on cash flow, terms, fees, and verified merchant reviews.",
    intro:
      "A rolling reserve is when a processor withholds a percentage of your sales for months to cover potential chargebacks. That's a real drag on cash flow. These processors advertise no rolling reserve, so more of your revenue lands on schedule.",
    filter: { features: ["no-rolling-reserve"] },
    faqs: [
      {
        question: "What is a rolling reserve?",
        answer:
          "It's a risk buffer: the processor holds back, say, 5–10% of each transaction for a set period before releasing it. Processors with no rolling reserve pay out your full balance on the normal payout schedule.",
      },
    ],
    related: ["interchange-plus", "ach", "flat-rate"],
  },
  {
    slug: "tap-to-pay",
    h1: "Payment processors with Tap to Pay",
    title: "Payment processors with Tap to Pay on phone",
    description:
      "Compare processors that support Tap to Pay — contactless payments on a phone — on fees, hardware, and verified reviews.",
    intro:
      "Tap to Pay turns a phone into a contactless card reader, so you can take in-person payments with no extra hardware. These processors support Tap to Pay on compatible iPhone or Android devices.",
    filter: { features: ["tap-to-pay"] },
    faqs: [
      {
        question: "Do I need a card reader for Tap to Pay?",
        answer:
          "No. Tap to Pay uses the NFC chip already in a compatible phone, so customers tap their card or wallet directly on your device. Compare the processors here on their in-person rate and device support.",
      },
    ],
    related: ["apple-pay", "google-pay", "flat-rate"],
  },
];

/** Every facet slug, for `generateStaticParams` + the sitemap. */
export const FACET_SLUGS: string[] = FACET_PAGES.map((f) => f.slug);

const FACET_BY_SLUG = new Map(FACET_PAGES.map((f) => [f.slug, f]));

/** Look up a facet page by slug (undefined if not curated). */
export function getFacetPage(slug: string): FacetPageDef | undefined {
  return FACET_BY_SLUG.get(slug);
}

/** Deduped union of two string lists (order-stable, first-seen wins). */
function unionArr(a: string[], b?: string[]): string[] {
  if (!b || b.length === 0) return a;
  return Array.from(new Set([...a, ...b]));
}

/**
 * Merge a facet's constraint into the user's parsed directory params so the facet
 * stays locked: capability facets (`$all` — methods/integrations/features) union
 * to allow further narrowing; classification facets (`$in` — pricingModel/region)
 * and `highRisk` overwrite so a user can't widen the lock away via the rail.
 */
export function mergeFacetParams(parsed: DirectoryParams, filter: FacetFilter): DirectoryParams {
  return {
    ...parsed,
    methods: unionArr(parsed.methods, filter.methods),
    integrations: unionArr(parsed.integrations, filter.integrations),
    features: unionArr(parsed.features, filter.features),
    pricingModel: filter.pricingModel ?? parsed.pricingModel,
    region: filter.region ?? parsed.region,
    highRisk: filter.highRisk ? true : parsed.highRisk,
  };
}
