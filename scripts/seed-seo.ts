import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, PageSeo, Processor } from "@/models";

/**
 * scripts/seed-seo.ts — apply the keyword-mapped SEO plan (meta titles,
 * descriptions, keywords, FAQs) to the pages that target them.
 *
 *   npm run seed:seo
 *
 * Idempotent and surgical:
 *  - Static pages (home / processors / compare) are UPSERTED into `PageSeo` by
 *    `pageKey` — these have no Category/Processor record of their own.
 *  - Categories (small-business / international / ecommerce) and the Stripe
 *    processor are updated by slug with `$set` on the specific SEO fields only
 *    (`seo.metaTitle`, `seo.metaDescription`, `seo.keywords`, `faqs`), so no
 *    other content is touched.
 *
 * Everything here stays editable afterwards in the admin panel
 * (Processors / Categories / Page SEO).
 */

interface Faq {
  question: string;
  answer: string;
}
interface GuideSection {
  heading: string;
  /** Simple, safe HTML (`<p>`/`<ul>`). NOTE: the seed write bypasses `sanitizeBlocks`. */
  body: string;
}
interface BuyersGuideSeed {
  title: string;
  intro?: string;
  layout?: "tabs" | "stacked";
  keyTakeaways?: string[];
  sections: GuideSection[];
}
interface SeoBlock {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  /** Editorial focus term. Not rendered — it records which keyword the page is built to win. */
  focusKeyword?: string;
  faqs: Faq[];
  /** Optional Capterra-style buyers guide, seeded as a `buyersGuide` content block. */
  buyersGuide?: BuyersGuideSeed;
}

// --- Static pages → PageSeo ------------------------------------------------
const PAGES: { pageKey: string; title: string; path: string; seo: SeoBlock }[] = [
  {
    pageKey: "home",
    title: "Homepage",
    path: "/",
    seo: {
      metaTitle: "Payment Processing Guide | Compare Payment Processors & Fees",
      metaDescription:
        "Compare payment processing platforms, merchant services providers, and credit card processing services on fees, features, and verified merchant reviews.",
      // The homepage owns the broad "what is this site" head terms. The narrower
      // terms deliberately live elsewhere so they don't cannibalise each other:
      // "online payment processing" → /processors, "online payment gateway" →
      // /glossary/payment-gateway, "payment processing fees" → the fees blog posts.
      focusKeyword: "payment processing guide",
      keywords: [
        "payment processing guide",
        "payment processing platform",
        "payment processing software",
        "merchant services provider",
        "merchant service providers",
        "credit card processing services",
        "business payment solutions",
      ],
      faqs: [
        {
          question: "What is a payment processing guide and why do I need one?",
          answer:
            "It's an independent resource that breaks down fees, features, and processor options so you can compare merchant services without reading ten different pricing pages.",
        },
        {
          question: "How do I compare credit card processing services before choosing one?",
          answer:
            "Look at the online rate, monthly fee, payout speed, and support for your sales channel, then check verified merchant reviews for real-world experience.",
        },
        {
          question: "What should I look for in a merchant services provider?",
          answer:
            "Transparent pricing, no long lock-in, payment methods your customers actually use, and a payment processing platform that integrates with the tools you already run.",
        },
        {
          question: "Is PayCompare free to use?",
          answer:
            "Yes, browsing, filtering, and comparing processors is free for merchants. We're funded by sponsored placements and affiliate links, which never affect ratings.",
        },
      ],
    },
  },
  {
    pageKey: "processors",
    title: "Processors directory",
    path: "/processors",
    seo: {
      metaTitle: "Online Payment Processing Companies | Payment Processing Guide",
      metaDescription:
        "Compare online payment processing companies by fees, features, and verified reviews. Filter payment processing companies online by pricing model, region, and use case.",
      keywords: ["online payment processing companies", "payment processing companies online"],
      faqs: [
        {
          question: "What are the best online payment processing companies for a small store?",
          answer:
            "It depends on volume and platform, but flat-rate providers with no monthly fee are usually the easiest starting point for a new online store.",
        },
        {
          question: "How do online payment processing companies charge fees?",
          answer:
            "Most charge a percentage plus a fixed amount per transaction, and some add a monthly fee, gateway fee, or minimum processing volume.",
        },
        {
          question: "Can I switch payment processing companies without downtime?",
          answer:
            "In most cases yes, especially with hosted checkout or API-based integrations, though you'll want to run both in parallel briefly before fully switching.",
        },
      ],
    },
  },
  {
    pageKey: "compare",
    title: "Compare",
    path: "/compare",
    seo: {
      metaTitle:
        "Payment Processor Comparison | Compare Payment Processors | Payment Processing Guide",
      metaDescription:
        "Run a payment processor comparison on pricing, payout speed, and features. Use our credit card payment processor comparison tool to shortlist 2–4 providers fast.",
      keywords: ["payment processor comparison", "credit card payment processor comparison"],
      faqs: [
        {
          question: "What should I look at in a payment processor comparison?",
          answer:
            "Compare the online rate, monthly fee, payout time, supported payment methods, and integrations side by side, not just the headline percentage.",
        },
        {
          question: "How is a credit card payment processor comparison different from a general one?",
          answer:
            "A credit card-focused comparison weighs interchange pass-through, card network fees, and chargeback handling more heavily than wallet or bank-transfer options.",
        },
        {
          question: "How many processors can I compare at once?",
          answer:
            "You can compare up to 4 processors side by side on pricing, payment methods, integrations, and company facts.",
        },
      ],
    },
  },
];

// --- Categories (by slug) --------------------------------------------------
const CATEGORIES: Record<string, SeoBlock> = {
  "small-business": {
    metaTitle: "Merchant Services for Small Business | Payment Processing Guide",
    metaDescription:
      "Compare merchant services for small business with no long-term contracts, and see real credit card processing fees for small business side by side before signing up.",
    keywords: [
      "merchant services for small business",
      "credit card processing fees for small business",
    ],
    faqs: [
      {
        question: "What merchant services are best for a small business just starting out?",
        answer:
          "Look for $0 monthly fee, no contract lock-in, and fast payouts; flat-rate and interchange-plus providers both work well depending on your volume.",
      },
      {
        question: "What are typical credit card processing fees for a small business?",
        answer:
          "Most small businesses pay somewhere between 2.6% and 3.5% per transaction depending on card type, pricing model, and whether the sale is online or in person.",
      },
      {
        question: "Do small businesses need a monthly minimum with merchant services?",
        answer:
          "Not necessarily. Several providers on this list have no monthly minimum, which suits businesses with lower or seasonal transaction volume.",
      },
    ],
    buyersGuide: {
      title: "Small Business Payment Processing Buyers Guide",
      layout: "tabs",
      intro:
        "<p>Choosing a payment processor as a small business comes down to a few things that actually move the needle: the real cost per sale, how fast you get paid, and whether you're locked into a contract. This guide walks through each so you can shortlist providers with confidence.</p>",
      keyTakeaways: [
        "Flat-rate pricing (e.g. 2.9% + 30¢) is simplest for lower-volume businesses.",
        "Watch for monthly fees, PCI fees, and long-term contracts, not just the headline rate.",
        "Faster payouts matter for cash flow — compare 1–2 day vs standard settlement.",
      ],
      sections: [
        {
          heading: "What is small business payment processing?",
          body:
            "<p>Payment processing is the service that moves money from your customer's card or bank to your account when they buy from you. For a small business, a processor bundles the merchant account, the gateway, and often the card reader or checkout page into one monthly relationship, so you can accept cards online and in person without stitching the pieces together yourself.</p>",
        },
        {
          heading: "What are the benefits for a small business?",
          body:
            "<p>The right processor lowers the friction of getting paid and the cost of every sale. Concrete benefits include:</p><ul><li>Transparent, predictable per-transaction pricing.</li><li>No long-term contract, so you can switch if a better fit appears.</li><li>Faster payouts that smooth out cash flow.</li><li>Built-in tools like invoicing, tap-to-pay, and basic reporting.</li></ul>",
        },
        {
          heading: "What should you consider before signing up?",
          body:
            "<p>Look past the advertised rate. Check the monthly fee, any PCI-compliance or statement fees, the payout schedule, and whether the provider supports the payment methods your customers actually use. If you sell both online and in person, confirm one account covers both channels.</p>",
        },
        {
          heading: "Trends in small business payments",
          body:
            "<p>Tap-to-pay on phones has removed most of the hardware cost of accepting cards in person, and flat-rate pricing has become the default for new businesses. Instant or next-day payouts, once an enterprise feature, are now widely available and worth prioritising for tighter cash flow.</p>",
        },
      ],
    },
  },
  international: {
    metaTitle: "International Payment Processing Companies | Payment Processing Guide",
    metaDescription:
      "Compare international payment processing companies for multi-currency acceptance and local payment methods, including leading global payment processing companies.",
    keywords: [
      "international payment processing companies",
      "global payment processing companies",
    ],
    faqs: [
      {
        question: "What should I look for in international payment processing companies?",
        answer:
          "Prioritize multi-currency settlement, support for local payment methods, and transparent FX conversion rates over just the headline card rate.",
      },
      {
        question: "Which global payment processing companies support the most currencies?",
        answer:
          "Enterprise-grade platforms built for cross-border selling tend to support the widest currency and local-method coverage; check each profile's supported regions.",
      },
      {
        question: "Do international payment processing companies charge extra FX fees?",
        answer:
          "Most add a currency conversion markup on cross-border transactions, so it's worth comparing that rate alongside the base processing fee.",
      },
    ],
    buyersGuide: {
      title: "International Payment Processing Buyers Guide",
      layout: "stacked",
      intro:
        "<p>Selling across borders adds currencies, local payment methods, and FX costs to the usual processing decision. This guide covers what separates a genuinely global processor from a domestic one with an international label.</p>",
      keyTakeaways: [
        "Multi-currency settlement beats converting everything back to one currency.",
        "Local payment methods (not just cards) drive conversion in many markets.",
        "FX markup is a real cost — compare it alongside the base processing rate.",
      ],
      sections: [
        {
          heading: "What is international payment processing?",
          body:
            "<p>International payment processing lets you accept payments from customers in other countries and currencies, then settle the funds in a currency and account that works for your business. A capable provider handles currency conversion, cross-border card rules, and the local methods shoppers expect in each market.</p>",
        },
        {
          heading: "What are the benefits of going global?",
          body:
            "<ul><li>Higher conversion by showing prices in the shopper's own currency.</li><li>Access to local methods like SEPA, iDEAL, or wallets that cards can't reach.</li><li>Consolidated reporting across regions in one dashboard.</li><li>Reduced failed payments from cross-border card declines.</li></ul>",
        },
        {
          heading: "What to consider before buying",
          body:
            "<p>Compare the currency-conversion markup, which local methods and regions are actually supported, and where funds settle. Also check compliance coverage (such as SCA in Europe) and whether payouts can land in multiple currencies without a forced conversion.</p>",
        },
        {
          heading: "Trends in cross-border payments",
          body:
            "<p>Local payment methods keep gaining share against cards worldwide, and real-time cross-border settlement is becoming common. Processors are increasingly competing on transparent FX rather than hiding conversion inside the transaction fee.</p>",
        },
      ],
    },
  },
  ecommerce: {
    metaTitle: "Ecommerce Payment Processing Companies | Payment Processing Guide",
    metaDescription:
      "Compare ecommerce payment processing companies on checkout tools, APIs, and fraud protection, and see how leading digital payment processing companies price out.",
    keywords: [
      "ecommerce payment processing companies",
      "digital payment processing companies",
    ],
    faqs: [
      {
        question: "What do ecommerce payment processing companies charge for online sales?",
        answer:
          "Online transactions typically run 2.6% to 3.5% depending on the provider, with some offering lower rates for higher monthly volume.",
      },
      {
        question:
          "What's the difference between digital payment processing companies and in-person processors?",
        answer:
          "Digital-first processors focus on checkout APIs, hosted pages, and fraud tools for online sales, while in-person processors are built around card readers and POS hardware.",
      },
      {
        question: "Which ecommerce payment processing companies integrate with Shopify?",
        answer:
          "Several processors on this list offer native Shopify integrations; filter by the Shopify integration tag to see them side by side.",
      },
    ],
    buyersGuide: {
      title: "Ecommerce Payment Processing Buyers Guide",
      layout: "stacked",
      intro:
        "<p>For online stores the processor is part of the checkout experience, not just a back-office cost. This guide covers the APIs, fraud tools, and conversion features that separate ecommerce-first providers from general processors.</p>",
      keyTakeaways: [
        "Checkout UX and hosted-page quality directly affect conversion.",
        "Built-in fraud tooling reduces chargebacks without blocking good customers.",
        "Native platform integrations (Shopify, WooCommerce) cut integration time.",
      ],
      sections: [
        {
          heading: "What is ecommerce payment processing?",
          body:
            "<p>Ecommerce payment processing handles card and wallet payments made on your website or app. Beyond moving the money, an ecommerce processor provides the checkout components — hosted pages, embeddable fields, or full APIs — plus the fraud and tokenization tools online sales depend on.</p>",
        },
        {
          heading: "What are the benefits for an online store?",
          body:
            "<ul><li>Optimized checkout that reduces cart abandonment.</li><li>Support for wallets like Apple Pay and Google Pay out of the box.</li><li>Tokenized card storage for subscriptions and one-click reorders.</li><li>Fraud scoring that adapts to your order patterns.</li></ul>",
        },
        {
          heading: "What to consider before buying",
          body:
            "<p>Weigh the integration effort against your platform: a native Shopify or WooCommerce plugin can save weeks versus a raw API. Confirm the fraud tools, chargeback handling, and whether recurring billing is supported natively if you sell subscriptions.</p>",
        },
        {
          heading: "Trends in online checkout",
          body:
            "<p>One-click and wallet-based checkout are now table stakes, and network tokenization is improving authorization rates on repeat customers. Expect processors to keep bundling fraud, tax, and subscription features that used to require separate vendors.</p>",
        },
      ],
    },
  },
};

// --- Processors (by slug) --------------------------------------------------
const PROCESSORS: Record<string, SeoBlock> = {
  stripe: {
    metaTitle: "Stripe Merchant Services | Review, Fees & Pricing | Payment Processing Guide",
    metaDescription:
      "An independent look at Stripe merchant services — online rates, payout speed, integrations, and verified merchant reviews to help you decide if Stripe is the right fit.",
    keywords: ["stripe merchant services"],
    faqs: [
      {
        question: "What do Stripe merchant services cost per transaction?",
        answer:
          "Stripe's standard online rate is 2.9% plus $0.30 per transaction in the US, with volume-based custom pricing available for larger businesses.",
      },
      {
        question: "Does Stripe charge a monthly fee?",
        answer:
          "No, Stripe has no monthly fee on its standard plan; you only pay per-transaction processing costs.",
      },
      {
        question: "Is Stripe good for small businesses or only developers?",
        answer:
          "Stripe is developer-first but also works well for small businesses through no-code tools like Payment Links and hosted checkout pages.",
      },
    ],
  },
};

async function main() {
  await connectToDatabase();

  // 1. Static pages → PageSeo (upsert by pageKey)
  for (const page of PAGES) {
    await PageSeo.updateOne(
      { pageKey: page.pageKey },
      {
        $set: {
          title: page.title,
          path: page.path,
          "seo.metaTitle": page.seo.metaTitle,
          "seo.metaDescription": page.seo.metaDescription,
          "seo.keywords": page.seo.keywords,
          ...(page.seo.focusKeyword ? { "seo.focusKeyword": page.seo.focusKeyword } : {}),
          faqs: page.seo.faqs,
        },
      },
      { upsert: true },
    );
    // eslint-disable-next-line no-console
    console.log(`✓ Page SEO: ${page.title} (${page.path})`);
  }

  // 2. Categories (by slug) — set only SEO fields; leave everything else intact.
  for (const [slug, seo] of Object.entries(CATEGORIES)) {
    const set: Record<string, unknown> = {
      "seo.metaTitle": seo.metaTitle,
      "seo.metaDescription": seo.metaDescription,
      "seo.keywords": seo.keywords,
      faqs: seo.faqs,
    };
    // Seed the buyers guide as a `buyersGuide` content block. NOTE: this
    // full-replaces `blocks` on re-seed (same as `faqs` above), so admin-added
    // blocks on these three seed categories are reset to this known state. The seed
    // write also bypasses `sanitizeBlocks`, hence the plain, safe HTML in the guide.
    if (seo.buyersGuide) {
      const g = seo.buyersGuide;
      set.blocks = [
        {
          type: "buyersGuide",
          id: randomUUID(),
          data: {
            title: g.title,
            ...(g.intro ? { intro: g.intro } : {}),
            layout: g.layout ?? "stacked",
            showToc: true,
            keyTakeaways: g.keyTakeaways ?? [],
            sections: g.sections,
          },
        },
      ];
    }
    const res = await Category.updateOne({ slug }, { $set: set });
    // eslint-disable-next-line no-console
    console.log(
      res.matchedCount > 0
        ? `✓ Category: ${slug}`
        : `⚠ Category not found (skipped): ${slug} — run \`npm run seed\` first`,
    );
  }

  // 3. Processors (by slug)
  for (const [slug, seo] of Object.entries(PROCESSORS)) {
    const res = await Processor.updateOne(
      { slug },
      {
        $set: {
          "seo.metaTitle": seo.metaTitle,
          "seo.metaDescription": seo.metaDescription,
          "seo.keywords": seo.keywords,
          faqs: seo.faqs,
        },
      },
    );
    // eslint-disable-next-line no-console
    console.log(
      res.matchedCount > 0
        ? `✓ Processor: ${slug}`
        : `⚠ Processor not found (skipped): ${slug} — run \`npm run seed\` first`,
    );
  }

  // eslint-disable-next-line no-console
  console.log("\n✓ SEO seed complete. Edit any of it in admin → Processors / Categories / Page SEO.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ SEO seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
