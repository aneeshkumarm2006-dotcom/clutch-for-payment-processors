import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, PageSeo, Processor, SiteSettings } from "@/models";
import { blocksSchema, seoSchema, faqsSchema, pageSeoCreate } from "@/lib/validators";

/**
 * scripts/seed-doc-content.ts — the editorial content plan (Google Doc, 9 tabs)
 * applied to the pages it targets.
 *
 *   npm run seed:doc-content -- --dry-run    # print every change, write nothing
 *   npm run seed:doc-content                 # apply
 *
 * Everything written here is admin-editable afterwards. Nothing is hardcoded
 * into a page: copy lands in Mongo as `seo` blocks, `faqs` and content `blocks`,
 * and the pages read it through the same paths an editor's changes take.
 *
 * ─── Why this is not part of `seed-seo.ts` ────────────────────────────────────
 * `seed.ts` and `seed-seo.ts` full-replace the fields they own, so re-running
 * either resets admin edits made since. This script is surgical instead: it
 * `$set`s only the specific paths the doc supplies, and it never touches a field
 * the doc has nothing to say about. Re-running it is safe and idempotent.
 *
 * ─── Two invariants worth knowing before editing ──────────────────────────────
 * 1. `blocks` REPLACE `longDescription` (processors) and `introContent`
 *    (categories) on the public page. So every block list below that targets a
 *    record with existing prose starts by re-wrapping that prose in a `richtext`
 *    block. Drop that and the guide would silently delete the page's opening.
 * 2. Block ids must be STABLE across runs. They are the React key, and a random
 *    id per run would churn the document on every reseed and defeat idempotency.
 *    `blockId()` derives one from the page + block position instead.
 */

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A stable, readable block id. `randomUUID()` (what seed-seo uses) would give
 * every block a new key on every run, so a reseed would look like "all content
 * replaced" to anything diffing the document.
 */
const blockId = (scope: string, index: number): string =>
  `seed-${createHash("sha1").update(`${scope}:${index}`).digest("hex").slice(0, 12)}`;

interface GuideSection {
  heading: string;
  /** Safe HTML: `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<a>`. Sanitized on write. */
  body: string;
}

interface BlockSpec {
  type: string;
  data: Record<string, unknown>;
}

/** A Capterra-style buyers guide block — the doc's "Tab 1..6" structure. */
const guide = (opts: {
  title: string;
  intro?: string;
  layout?: "tabs" | "stacked";
  keyTakeaways?: string[];
  sections: GuideSection[];
}): BlockSpec => ({
  type: "buyersGuide",
  data: {
    title: opts.title,
    ...(opts.intro ? { intro: opts.intro } : {}),
    layout: opts.layout ?? "stacked",
    showToc: true,
    keyTakeaways: opts.keyTakeaways ?? [],
    sections: opts.sections,
  },
});

const richtext = (html: string): BlockSpec => ({ type: "richtext", data: { html } });

const comparison = (opts: {
  title: string;
  headers: string[];
  rows: { name: string; cells: string[] }[];
}): BlockSpec => ({
  type: "comparison",
  data: { title: opts.title, headers: opts.headers, rows: opts.rows },
});

const cta = (opts: {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
}): BlockSpec => ({ type: "cta", data: opts });

/**
 * Tags this script is allowed to write.
 *
 * `lib/sanitize-html.ts` is the real sanitizer, but it imports `server-only` and
 * so cannot run under tsx — which is why `seed-seo.ts` notes that its writes
 * bypass it. Rather than shipping unchecked HTML on that precedent, every string
 * here is checked against an allowlist before it reaches Mongo. The copy is
 * hand-authored, so anything outside this set is a typo, not an attack, and
 * failing the run is the right response to it.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "h2",
  "h3",
  "h4",
  "br",
]);

function assertSafeHtml(scope: string, html: string) {
  for (const match of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g)) {
    const tag = match[1] ?? "";
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) {
      throw new Error(`Disallowed tag <${tag}> in "${scope}". Allowed: ${[...ALLOWED_TAGS].join(", ")}`);
    }
  }
  if (/\son[a-z]+\s*=/i.test(html) || /javascript:/i.test(html)) {
    throw new Error(`Inline handler or javascript: URL in "${scope}"`);
  }
}

/** Walk a block's HTML-bearing fields: `richtext.html`, guide `intro` + section bodies. */
function checkBlockHtml(scope: string, block: BlockSpec) {
  const d = block.data;
  if (typeof d.html === "string") assertSafeHtml(scope, d.html);
  if (typeof d.intro === "string") assertSafeHtml(scope, d.intro);
  if (Array.isArray(d.sections)) {
    for (const s of d.sections as GuideSection[]) assertSafeHtml(scope, s.body);
  }
}

/**
 * Validate through the same zod schema the admin form runs on save. A block this
 * script could write but the UI would reject is a trap for whoever opens the
 * page next.
 */
function prepareBlocks(scope: string, specs: BlockSpec[]) {
  for (const spec of specs) checkBlockHtml(scope, spec);
  const withIds = specs.map((b, i) => ({ ...b, id: blockId(scope, i) }));
  const parsed = blocksSchema.safeParse(withIds);
  if (!parsed.success) {
    throw new Error(
      `Invalid blocks for "${scope}": ${JSON.stringify(parsed.error.flatten(), null, 2)}`,
    );
  }
  return parsed.data;
}

interface SeoSpec {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  focusKeyword?: string;
  /** Site-relative path. Retires this URL with a 308. */
  redirectTo?: string;
  /** hreflang: shared key naming the variant set, plus this variant's BCP 47 tag. */
  localeGroup?: string;
  locale?: string;
}

/** Flatten an SEO spec into dotted `$set` paths, so untouched SEO fields survive. */
function seoSet(scope: string, spec: SeoSpec): Record<string, unknown> {
  const parsed = seoSchema.safeParse(spec);
  if (!parsed.success) {
    throw new Error(`Invalid SEO for "${scope}": ${JSON.stringify(parsed.error.flatten())}`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) out[`seo.${key}`] = value;
  }
  return out;
}

function checkFaqs(scope: string, faqs: { question: string; answer: string }[]) {
  const parsed = faqsSchema.safeParse(faqs);
  if (!parsed.success) {
    throw new Error(`Invalid FAQs for "${scope}": ${JSON.stringify(parsed.error.flatten())}`);
  }
  return parsed.data;
}

/** Union of existing + new keywords, capped at the schema's limit of 20. */
const mergeKeywords = (existing: unknown, added: string[]): string[] =>
  Array.from(
    new Set([...(Array.isArray(existing) ? existing.map(String) : []), ...added]),
  ).slice(0, 20);

const log = (msg: string) => {
  // eslint-disable-next-line no-console
  console.log(msg);
};

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 1 — Homepage extra sections  →  PageSeo "home" blocks
// ═══════════════════════════════════════════════════════════════════════════

const HOME_KEYWORDS = [
  "payment processor",
  "payment processing guide",
  "credit card processing companies",
  "top payment processing companies",
  "merchant services for small business",
  "best payment processor for shopify",
  "payment processing companies",
  "credit card payment processing",
];

const HOME_BLOCKS: BlockSpec[] = [
  guide({
    title: "Payment processing explained",
    layout: "stacked",
    intro:
      "<p>A short guide to how payment processing works, what the different solutions do, and how to compare providers on more than the headline rate.</p>",
    keyTakeaways: [
      "A card payment touches six parties and settles in seconds.",
      "The right solution depends on your sales channels, not on provider size.",
      "Compare total cost of acceptance, not just the advertised transaction rate.",
    ],
    sections: [
      {
        heading: "How payment processing works",
        body:
          "<p>Every time a customer makes a purchase, several technologies work together to complete the transaction securely. Modern payment processing systems connect the customer, merchant, payment processor, issuing bank, acquiring bank, and card network to authorize and settle payments within seconds.</p><p>Whether you're accepting payments online, in-store, or through a mobile device, choosing the right payment processor helps improve transaction speed, security, and customer experience. Businesses can use online payment processing, credit card terminals, virtual terminals, or integrated ecommerce solutions depending on their sales channels.</p><p>Understanding how credit card payment processing works makes it easier to compare providers, reduce processing costs, and select a solution that fits your business goals.</p>",
      },
      {
        heading: "Payment processing solutions for every business",
        body:
          "<p>Today's businesses need flexible payment processing services that support multiple payment methods across online stores, retail locations, mobile devices, and recurring billing platforms. The best payment processing platforms allow businesses to accept credit cards, debit cards, ACH payments, digital wallets, and contactless payments from one centralized system.</p><p>Whether you're launching a startup, operating a local retail store, or managing a growing ecommerce business, selecting reliable online payment processors can improve checkout experiences, automate reporting, and simplify payment management.</p><p>Modern solutions also integrate with accounting software, POS systems, inventory management, CRM platforms, and ecommerce stores for seamless operations.</p>",
      },
      {
        heading: "Choosing the right payment processing company",
        body:
          "<p>Not all payment processing companies offer the same pricing, features, or level of support. When comparing a payment processing company, consider transaction fees, contract terms, settlement speed, fraud protection, PCI compliance, customer service, and software integrations.</p><p>Many businesses also compare multiple credit card processing companies before selecting a provider because pricing structures and available features vary significantly between providers.</p><p>A trusted payment processing guide helps businesses evaluate providers based on real business needs rather than marketing claims, making it easier to choose the right long-term payment partner.</p>",
      },
      {
        heading: "Payment processing for small businesses",
        body:
          "<p>Finding affordable payment processing for small business owners is one of the most important financial decisions a growing company can make. Small businesses often require flexible pricing, fast funding, easy integrations, and dependable customer support.</p><p>Many providers now offer merchant services for small business that combine payment gateways, virtual terminals, POS systems, invoicing, recurring billing, and fraud prevention into one solution.</p><p>Businesses looking for credit card payment processing for small business should compare monthly costs, hardware requirements, ecommerce compatibility, and scalability before making a decision. Whether you run a restaurant, medical practice, contractor business, nonprofit, or online store, selecting the right payment processor helps support long-term growth.</p>",
      },
      {
        heading: "Comparing payment processing platforms",
        body:
          "<p>Businesses today can choose from traditional merchant account providers, all-in-one payment solutions, and modern cloud-based payment processing platforms. Each option offers different pricing models, integrations, reporting features, and support for online or in-person payments.</p><p>Some payment processing systems focus on ecommerce businesses, while others specialize in retail, healthcare, restaurants, subscription billing, or B2B payments. Comparing providers based on transaction fees, payment methods, international support, API capabilities, and security features helps businesses identify the best solution for their industry.</p><p>The right platform should grow alongside your business while keeping payment acceptance simple and secure.</p>",
      },
      {
        heading: "Understanding payment processing fees",
        body:
          "<p>Every payment processor charges fees for handling electronic transactions, but pricing models vary between providers. Businesses may encounter interchange fees, assessment fees, processor markups, monthly account fees, PCI compliance fees, gateway fees, chargeback fees, and hardware costs.</p><p>Comparing credit card payment processing costs alongside service quality, reporting tools, security, and customer support provides a clearer picture of overall value rather than focusing only on transaction rates.</p><p>A reliable payment processing guide helps businesses understand fee structures, compare providers, and identify opportunities to reduce payment acceptance costs without sacrificing security or customer experience.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 2 — ACH payment processing  →  PageSeo route record for the facet page
// ═══════════════════════════════════════════════════════════════════════════

const ACH_SEO: SeoSpec = {
  metaTitle: "ACH Payment Processing | Fees, Setup and Timing Explained",
  metaDescription:
    "Compare ACH payment processing providers on fees, settlement time, and setup. See how ACH payments work, what ACH processing fees cost, and how they beat cards.",
  focusKeyword: "ach payment processing",
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
  ],
};

const ACH_FAQS = [
  {
    question: "What is an ACH payment?",
    answer:
      "An ACH payment is a bank-to-bank transfer sent through the Automated Clearing House network, with no paper check and no card network involved.",
  },
  {
    question: "How long does ACH payment processing take?",
    answer:
      "Standard ACH settles in one to three business days. Same-Day ACH can settle the same business day for eligible transactions.",
  },
  {
    question: "How much are ACH processing fees?",
    answer:
      "Most providers charge a flat fee per transaction, a small percentage, or a monthly plan. Total cost is usually lower than card processing on recurring and high-value payments.",
  },
  {
    question: "How do I set up ACH payments for my business?",
    answer:
      "Choose a processor that supports ACH, complete merchant verification, link your business bank account, enable ACH acceptance, and follow NACHA operating rules.",
  },
  {
    question: "What is the difference between ACH payments and credit card payments?",
    answer:
      "ACH moves money directly between bank accounts at a lower cost but settles in days. Cards authorize instantly and carry interchange, assessment, and markup fees.",
  },
];

const ACH_BLOCKS: BlockSpec[] = [
  guide({
    title: "ACH payment processing guide",
    layout: "stacked",
    intro:
      "<p>What ACH payments are, how long they take, what they cost, and when they are the cheaper option than card acceptance.</p>",
    keyTakeaways: [
      "ACH moves money bank to bank through the Automated Clearing House network.",
      "Standard settlement runs one to three business days, or same day for eligible payments.",
      "ACH usually costs less than cards on recurring, B2B, and high-value transactions.",
    ],
    sections: [
      {
        heading: "What is ACH payment processing?",
        body:
          "<p>ACH payment processing is the electronic movement of money between bank accounts through the Automated Clearing House network. If you've ever wondered what is an ACH payment, or searched for the ACH payment meaning, it simply refers to a secure bank-to-bank transfer that doesn't require paper checks or card networks.</p><p>Businesses use ACH payment processing to accept customer payments, pay suppliers, process payroll, collect subscriptions, and automate recurring billing. Compared with credit cards, ACH payments often have lower processing costs, making them an attractive option for businesses that handle recurring or high-value transactions.</p><p>Whether you're asking what are ACH payments or exploring different payment methods, ACH transfers provide a reliable, secure, and cost-effective way to move funds electronically.</p>",
      },
      {
        heading: "How ACH payments work",
        body:
          "<p>The ACH payment processing workflow begins when a customer authorizes a payment from their bank account. The payment request is securely transmitted through the ACH network, verified by participating financial institutions, and then settled between the sending and receiving banks.</p><p>Depending on the payment type, ACH payment processing time typically ranges from one to three business days, while Same-Day ACH options can accelerate settlement for eligible transactions.</p><p>Businesses commonly use ACH for recurring invoices, payroll, vendor payments, membership fees, loan repayments, and subscription billing because it reduces manual processing and simplifies cash flow management.</p>",
      },
      {
        heading: "ACH processing fees explained",
        body:
          "<p>One of the biggest advantages of ACH payment processing is its predictable pricing. Most providers charge flat transaction fees, percentage-based pricing, or monthly subscription plans depending on transaction volume.</p><p>When comparing ACH processing fees, businesses should review transaction charges, monthly platform fees, return fees, same-day ACH fees, and any additional banking costs. Understanding the complete fee structure helps merchants choose the most cost-effective payment solution.</p><p>Businesses processing large transaction volumes often prefer ACH because total processing costs are generally lower than traditional card payments.</p>",
      },
      {
        heading: "Interchange fees and interchange plus pricing",
        body:
          "<p>Many businesses researching payment acceptance also compare ACH pricing with traditional card pricing models such as interchange plus pricing.</p><p>An interchange fee is the amount paid to the card-issuing bank whenever a credit or debit card transaction is processed. These interchange fees vary based on factors such as card type, transaction method, and industry.</p><p>Businesses comparing payment methods often ask what does interchange mean and how interchange rates affect processing costs. While interchange fees primarily apply to card transactions rather than ACH transfers, understanding both pricing models helps businesses choose the most cost-effective payment strategy.</p><p>For organizations processing recurring bank payments, ACH often eliminates many of the interchange-related costs associated with card payments. Compare providers on <a href=\"/payment-processors/interchange-plus\">interchange plus pricing</a> if most of your volume still runs on cards.</p>",
      },
      {
        heading: "How to set up ACH payments",
        body:
          "<p>Businesses looking to accept bank transfers frequently ask how to set up ACH payments. The process typically involves selecting a payment processor, completing merchant account verification, linking a business bank account, enabling ACH payment capabilities, and complying with NACHA operating rules.</p><p>Many payment providers also support bank account verification, recurring payment automation, invoice generation, and accounting software integrations to simplify payment collection.</p><p>Choosing the right ACH provider depends on transaction volume, processing fees, settlement speed, customer support, security, and available integrations.</p>",
      },
      {
        heading: "ACH payments vs credit card payments",
        body:
          "<p>Both ACH and credit card payments offer secure ways to transfer funds, but they serve different business needs. ACH payment processing is often preferred for recurring billing, payroll, B2B transactions, and large-value payments because processing costs are generally lower.</p><p>Credit card payments typically authorize instantly but include interchange fees, assessment fees, and processor markups. ACH payments, on the other hand, rely on direct bank transfers, making them a cost-effective option for businesses focused on reducing payment acceptance costs.</p><p>Many businesses support both payment methods to provide customers with greater flexibility while optimizing overall payment expenses.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 3 — High risk  →  /category/high-risk
// ═══════════════════════════════════════════════════════════════════════════

const HIGH_RISK_SEO: SeoSpec = {
  metaTitle: "High Risk Merchant Accounts",
  metaDescription:
    "Compare high risk merchant account providers and high risk payment processors on approval rates, fees, rolling reserves, and chargeback tools for your industry.",
  focusKeyword: "high risk merchant account",
  keywords: [
    "high risk merchant account",
    "high risk payment processor",
    "high risk merchant services",
    "high risk payment processing",
    "chargeback management",
  ],
};

const HIGH_RISK_FAQS = [
  {
    question: "What is a high risk merchant account?",
    answer:
      "A payment account for businesses that banks and processors see as more likely to attract chargebacks, fraud, or regulatory scrutiny. It carries extra underwriting rather than a judgement on the business.",
  },
  {
    question: "Which industries need a high risk payment processor?",
    answer:
      "Subscriptions, CBD, travel, online gaming, adult, crypto services, nutraceuticals, digital downloads, ticketing, and cross-border ecommerce are the most common.",
  },
  {
    question: "Why do high risk merchant accounts cost more?",
    answer:
      "The provider carries more financial risk, so pricing usually adds higher transaction rates, monthly fees, gateway fees, chargeback fees, and often a rolling reserve.",
  },
  {
    question: "How can I reduce chargebacks on a high risk account?",
    answer:
      "Use fraud and transaction monitoring, set a clear billing descriptor, answer disputes quickly, publish a plain refund policy, and keep PCI compliance current.",
  },
];

const HIGH_RISK_BLOCKS = (introContent?: string): BlockSpec[] => [
  ...(introContent ? [richtext(introContent)] : []),
  guide({
    title: "High risk payment processing buyers guide",
    layout: "tabs",
    intro:
      "<p>What the high risk label actually means, which industries carry it, what specialist providers charge, and how to keep an account stable once you have one.</p>",
    keyTakeaways: [
      "High risk is an underwriting classification, not a judgement on the business.",
      "Specialist providers trade higher pricing for higher approval rates and real chargeback tooling.",
      "Reserve terms and chargeback ratios matter more to account survival than the headline rate.",
    ],
    sections: [
      {
        heading: "What is a high-risk merchant account?",
        body:
          "<p>A high risk merchant account is a specialized payment account designed for businesses that banks and payment processors classify as having a greater likelihood of chargebacks, fraud, regulatory requirements, or large transaction volumes. Being labeled as high risk does not mean a business is unsafe or illegitimate. It simply means payment providers require additional underwriting and risk management before approving the account.</p><p>Businesses operating in industries such as CBD, travel, online gaming, adult services, digital products, subscription businesses, nutraceuticals, and international ecommerce often require a high risk merchant account to accept credit card and online payments. Unlike standard merchant accounts, high-risk accounts typically include stricter approval requirements, reserve policies, and enhanced fraud monitoring to protect both merchants and payment providers.</p><p>Choosing the right provider allows businesses to process payments reliably while maintaining customer trust and supporting long-term growth.</p>",
      },
      {
        heading: "Industries that need high-risk payment processing",
        body:
          "<p>Many businesses require a high risk payment processor because of the nature of their industry, billing model, or transaction history. Payment providers evaluate multiple factors, including chargeback ratios, average transaction value, international sales, recurring billing, and regulatory obligations when determining risk levels.</p><p>Industries commonly classified as high risk include:</p><ul><li>Subscription and membership businesses</li><li>CBD and hemp products</li><li>Travel and hospitality</li><li>Online gaming and gambling</li><li>Adult entertainment</li><li>Cryptocurrency services</li><li>Nutraceuticals and supplements</li><li>Digital downloads and software</li><li>Ticket sales and event services</li><li>Cross-border ecommerce</li></ul><p>Working with a processor that specializes in high-risk industries increases approval rates and provides payment solutions specifically designed for complex business models.</p>",
      },
      {
        heading: "How to choose a high-risk payment processor",
        body:
          "<p>Selecting the right high risk payment processor requires evaluating much more than transaction fees. Businesses should compare approval rates, supported industries, payment gateway integrations, fraud prevention capabilities, settlement times, customer support, and contract flexibility.</p><p>A reliable provider should offer advanced chargeback management tools, PCI-compliant payment security, multi-currency processing, recurring billing support, and detailed transaction reporting. Businesses processing international payments should also consider currency conversion, global acquiring relationships, and localized payment methods.</p><p>Choosing an experienced processor reduces payment disruptions while creating a more stable payment environment as the business grows. Providers that avoid held funds are worth shortlisting first: see <a href=\"/payment-processors/no-rolling-reserve\">processors with no rolling reserve</a>.</p>",
      },
      {
        heading: "Understanding high-risk merchant account fees",
        body:
          "<p>A high risk merchant account generally carries higher processing costs than a standard merchant account because payment providers assume greater financial risk. Pricing varies depending on the merchant's industry, transaction history, average ticket size, processing volume, and chargeback rate.</p><p>Common costs may include:</p><ul><li>Transaction processing fees</li><li>Monthly account fees</li><li>Payment gateway fees</li><li>Chargeback fees</li><li>Rolling reserve requirements</li><li>Cross-border processing fees</li><li>PCI compliance fees</li></ul><p>While pricing is often higher, specialized providers deliver services that standard payment processors may not offer, including higher approval rates, customized underwriting, and dedicated risk management.</p>",
      },
      {
        heading: "Tips to reduce chargebacks and payment risk",
        body:
          "<p>Managing risk effectively helps businesses maintain healthy payment processing relationships and improve long-term account stability. Payment providers closely monitor chargeback ratios, refund activity, customer complaints, and suspicious transactions throughout the life of a merchant account.</p><p>Businesses can reduce payment risk by:</p><ul><li>Using fraud detection and transaction monitoring tools</li><li>Providing clear billing descriptors</li><li>Responding quickly to customer disputes</li><li>Offering transparent refund policies</li><li>Verifying customer identities when appropriate</li><li>Monitoring unusual transaction patterns</li><li>Maintaining PCI compliance</li></ul><p>Consistently following these best practices can improve account performance and strengthen relationships with acquiring banks and payment processors.</p>",
      },
      {
        heading: "Benefits of specialized high-risk merchant services",
        body:
          "<p>Partnering with a provider that specializes in high risk merchant accounts gives businesses access to payment solutions designed specifically for complex industries. Instead of relying on one-size-fits-all payment services, specialized processors understand the operational challenges associated with higher-risk business models.</p><p>Benefits often include:</p><ul><li>Higher approval rates</li><li>Flexible underwriting</li><li>Global payment acceptance</li><li>Multiple payment gateway options</li><li>Advanced fraud prevention</li><li>Chargeback management tools</li><li>Multi-currency processing</li><li>Dedicated account management</li><li>Scalable payment infrastructure</li></ul><p>With the right high risk payment processor, businesses can accept payments confidently, expand into new markets, and build sustainable revenue while maintaining secure and compliant payment operations.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 4 — Subscriptions and SaaS  →  /category/subscriptions
// ═══════════════════════════════════════════════════════════════════════════

const SUBSCRIPTIONS_SEO: SeoSpec = {
  metaTitle: "Subscription and SaaS Payment Processing | Recurring Billing",
  metaDescription:
    "Compare subscription payment processing and SaaS billing platforms on recurring payments, failed payment recovery, marketplace payouts, and pricing flexibility.",
  focusKeyword: "subscription payment processing",
  keywords: [
    "subscription payment processing",
    "saas payment processing",
    "marketplace payment processing",
    "recurring payments",
    "recurring payment meaning",
    "what is a recurring payment",
    "recurring billing",
  ],
};

const SUBSCRIPTIONS_FAQS = [
  {
    question: "What is a recurring payment?",
    answer:
      "A pre-authorized payment collected automatically on an agreed schedule, so the customer does not re-enter their card details each billing cycle.",
  },
  {
    question: "What is subscription payment processing?",
    answer:
      "It is card and bank payment acceptance built around a billing schedule: stored credentials, automatic renewals, retries on failure, and subscription state that stays in sync.",
  },
  {
    question: "What should a SaaS business look for in a payment processor?",
    answer:
      "Flexible pricing models, usage-based billing, tax automation, smart retries, self-service portals, and reporting that ties revenue back to plan and cohort.",
  },
  {
    question: "How is marketplace payment processing different?",
    answer:
      "A marketplace has to split one buyer payment across many sellers, so it needs seller onboarding and verification, commission handling, and automated payouts.",
  },
];

const SUBSCRIPTIONS_BLOCKS = (introContent?: string): BlockSpec[] => [
  ...(introContent ? [richtext(introContent)] : []),
  guide({
    title: "Subscription and SaaS payment processing buyers guide",
    layout: "tabs",
    intro:
      "<p>How recurring billing actually works, what SaaS and marketplace businesses need on top of card acceptance, and what to compare before committing.</p>",
    keyTakeaways: [
      "Recurring revenue depends as much on failed payment recovery as on the rate you pay.",
      "SaaS billing needs usage-based, tiered, and trial pricing, not just a fixed monthly charge.",
      "Marketplaces need split payments, seller verification, and automated payouts.",
    ],
    sections: [
      {
        heading: "What is subscription payment processing?",
        body:
          "<p>Subscription payment processing enables businesses to automatically collect payments from customers on a recurring schedule. Whether payments are charged weekly, monthly, quarterly, or annually, the payment processor securely stores customer payment credentials and processes future transactions without requiring customers to enter their payment details every billing cycle.</p><p>Many businesses ask what is recurring payment, what is a recurring payment, or search for the recurring payment meaning when exploring subscription billing. A recurring payment is a pre-authorized automatic payment collected according to an agreed billing schedule, making it the foundation of subscription-based business models.</p><p>Subscription payment processing helps businesses generate predictable revenue while providing customers with a seamless payment experience.</p>",
      },
      {
        heading: "SaaS payment processing",
        body:
          "<p>SaaS payment processing is designed for software companies that charge customers through monthly or annual subscriptions. Instead of manually collecting invoices, SaaS businesses automate billing, renewals, payment collection, refunds, and subscription management through integrated payment platforms.</p><p>Modern SaaS payment solutions support flexible pricing models, including fixed subscriptions, usage-based billing, tiered pricing, free trials, and hybrid plans. Businesses can also integrate accounting software, CRM systems, analytics tools, and tax automation platforms to simplify financial operations.</p><p>Choosing the right payment processor helps SaaS companies reduce payment failures, improve customer retention, and scale recurring revenue efficiently.</p>",
      },
      {
        heading: "Benefits of recurring payments",
        body:
          "<p>Businesses across many industries rely on recurring payments to create predictable revenue and simplify billing operations. Instead of requesting manual payments every billing cycle, customers authorize one payment method that is charged automatically according to the agreed schedule.</p><p>The advantages include:</p><ul><li>Predictable monthly revenue</li><li>Reduced administrative work</li><li>Faster payment collection</li><li>Improved customer convenience</li><li>Lower risk of missed invoices</li><li>Better cash flow forecasting</li><li>Increased customer retention</li></ul><p>Whether you're managing memberships, SaaS products, streaming services, online learning platforms, or subscription boxes, recurring payments improve operational efficiency and customer satisfaction.</p>",
      },
      {
        heading: "Marketplace payment processing",
        body:
          "<p>Marketplace payment processing enables online marketplaces to securely accept payments from buyers while distributing funds to multiple sellers. Unlike traditional ecommerce stores, marketplaces require payment systems capable of handling split payments, seller verification, commission management, and automated payouts.</p><p>Modern marketplace payment platforms support identity verification, fraud prevention, multi-currency payments, tax reporting, and secure payment authorization. Whether you're operating a B2B marketplace, service marketplace, rental platform, or multi-vendor ecommerce website, selecting the right marketplace payment solution helps create a smooth payment experience for buyers and sellers alike. See the <a href=\"/category/marketplaces\">marketplace and platform processors</a> for providers built around split payouts.</p>",
      },
      {
        heading: "How recurring billing works",
        body:
          "<p>Recurring billing begins when a customer authorizes automatic payments during signup or checkout. The payment processor securely tokenizes the customer's payment information instead of storing sensitive card details directly. On each billing date, the processor automatically initiates the payment and updates the subscription status based on the transaction result.</p><p>Many subscription platforms also include:</p><ul><li>Automatic renewals</li><li>Payment reminders</li><li>Smart retry logic for failed payments</li><li>Subscription upgrades and downgrades</li><li>Customer self-service portals</li><li>Invoice generation</li><li>Cancellation management</li></ul><p>These features reduce manual work while improving the customer experience throughout the subscription lifecycle.</p>",
      },
      {
        heading: "Choosing the right subscription payment processor",
        body:
          "<p>Selecting the right subscription payment processing solution is essential for businesses that depend on recurring revenue. Beyond transaction fees, businesses should evaluate payment security, billing flexibility, payment gateway integrations, reporting capabilities, customer support, and scalability.</p><p>Look for a platform that supports recurring billing, flexible subscription plans, multiple payment methods, automated failed payment recovery, fraud protection, and detailed analytics. As your subscriber base grows, a reliable payment processor can help maintain high authorization rates, reduce churn, and improve long-term revenue performance.</p><p>A scalable SaaS payment processing solution should grow with your business while providing customers with a secure and frictionless payment experience.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 5 — Stripe  →  /processor/stripe
// ═══════════════════════════════════════════════════════════════════════════

const STRIPE_KEYWORDS = [
  "stripe fees",
  "stripe alternatives",
  "stripe vs square",
  "stripe pricing",
  "stripe fees canada",
  "stripe fee calculator",
];

const STRIPE_BLOCKS = (longDescription?: string): BlockSpec[] => [
  ...(longDescription ? [richtext(longDescription)] : []),
  guide({
    title: "Stripe review: fees, pricing and alternatives",
    layout: "stacked",
    keyTakeaways: [
      "Stripe is pay as you go, with no monthly fee on the standard plan.",
      "The advertised rate is rarely the whole cost once cards, currency, and payouts are counted.",
      "Stripe leads online, Square leads in person. That is usually the deciding factor.",
    ],
    sections: [
      {
        heading: "Stripe overview",
        body:
          "<p>Stripe is one of the world's most popular payment platforms, helping businesses accept online payments, recurring subscriptions, invoices, and international transactions. Its developer-friendly APIs, extensive integrations, and global payment support make it a preferred solution for startups, ecommerce businesses, SaaS companies, and enterprise organizations.</p><p>Many businesses exploring Stripe merchant services choose the platform because it supports credit cards, digital wallets, bank transfers, buy now pay later, recurring billing, and marketplace payments from a single dashboard. Stripe also integrates with platforms such as Shopify, WooCommerce, Magento, BigCommerce, and custom applications.</p><p>Whether you're launching an online store or scaling a global business, Stripe provides flexible payment infrastructure designed for businesses of all sizes.</p>",
      },
      {
        heading: "Stripe fees and pricing",
        body:
          "<p>Understanding Stripe fees is essential before choosing the platform as your payment processor. Stripe primarily uses a pay-as-you-go pricing model, where businesses pay a transaction fee for each successful payment instead of committing to long-term contracts.</p><p>When reviewing Stripe pricing, businesses should also consider optional costs for international cards, currency conversion, chargebacks, instant payouts, invoicing, recurring billing, and additional payment products. Depending on your business model, the total Stripe fee may vary based on payment method, transaction type, and geographic location.</p><p>Comparing Stripe's pricing with other payment processors helps businesses understand the overall cost of accepting payments rather than focusing only on the advertised transaction rate.</p>",
      },
      {
        heading: "Stripe fees in Canada",
        body:
          "<p>Businesses operating in Canada should review Stripe fees Canada before selecting a payment processor. While Stripe offers transparent pricing, total processing costs can vary depending on whether payments are domestic, cross-border, online, or made using premium credit cards.</p><p>Canadian merchants should also consider currency conversion fees, international transaction costs, payout schedules, and supported payment methods when evaluating Stripe. Comparing pricing with local merchant service providers can help determine which solution offers the best value for your business.</p><p>For businesses selling internationally, Stripe's multi-currency capabilities and global payment acceptance remain significant advantages despite additional processing costs.</p>",
      },
      {
        heading: "Stripe fee calculator",
        body:
          "<p>Many businesses search for a Stripe fee calculator to estimate processing costs before accepting payments. A fee calculator allows merchants to quickly calculate Stripe fees based on transaction amount, payment method, and applicable processing rates.</p><p>Using a calculator helps businesses estimate their net revenue after payment processing expenses, compare pricing with competing processors, and forecast monthly payment costs as sales volume grows.</p><p>While fee calculators provide useful estimates, merchants should also review additional charges such as refunds, chargebacks, international payments, and optional services that may affect overall processing expenses.</p>",
      },
      {
        heading: "Stripe vs Square",
        body:
          "<p>The Stripe vs Square comparison depends largely on your business model. Stripe focuses on online payments, ecommerce, SaaS platforms, subscription billing, marketplaces, and developer customization, while Square is widely recognized for its in-person payment solutions, retail POS systems, restaurants, and local service businesses.</p><p>Businesses requiring advanced APIs, recurring billing, and international ecommerce often prefer Stripe. Companies operating physical stores may benefit from Square's integrated hardware and point-of-sale ecosystem.</p><p>Comparing pricing, hardware options, software integrations, payment methods, reporting tools, and customer support helps businesses choose the payment platform that best matches their operational requirements. Put the two <a href=\"/compare/stripe-vs-square\">side by side on pricing and features</a>.</p>",
      },
      {
        heading: "Stripe alternatives",
        body:
          "<p>Although Stripe is one of the leading payment processors, some businesses compare Stripe alternatives to find better pricing, industry-specific features, or different payment capabilities. The right alternative depends on your transaction volume, business type, supported countries, and integration requirements.</p><p>Popular alternatives include providers that specialize in ecommerce, high-risk merchants, subscription billing, in-person payments, or international payment processing. Businesses should compare transaction fees, settlement times, payment methods, fraud protection, reporting tools, and customer support before making a decision.</p><p>Evaluating multiple payment processors ensures your business selects a platform that delivers the right balance of pricing, features, scalability, and customer experience for long-term growth. Start with the full list of <a href=\"/alternatives/stripe\">Stripe alternatives</a>.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 6 — Square and Clover  →  /processor/square
// ═══════════════════════════════════════════════════════════════════════════

const SQUARE_SEO: SeoSpec = {
  metaTitle: "Square Review: Fees, Clover Comparison and Alternatives",
  metaDescription:
    "An independent Square review covering Square fees, hardware costs, Clover vs Square, and the best Square alternatives for small businesses.",
  focusKeyword: "square fees",
  keywords: [
    "square fees",
    "square alternatives",
    "clover vs square",
    "square alternatives for small business",
    "adyen vs square",
    "elavon vs square",
  ],
};

const SQUARE_FAQS = [
  {
    question: "How much are Square fees?",
    answer:
      "Square charges per successful transaction, with different rates for in-person, online, invoiced, and manually keyed payments. There is no charge on a payment that does not complete.",
  },
  {
    question: "Clover vs Square: which is better?",
    answer:
      "Square is faster to set up with clearer pricing, which suits startups and small businesses. Clover offers more hardware choice and industry-specific configurations for larger or more complex operations.",
  },
  {
    question: "What are the best Square alternatives for small business?",
    answer:
      "It depends on channel. Compare providers on processing cost, POS depth, reporting, hardware flexibility, and support before switching.",
  },
  {
    question: "Is Square a good payment processor?",
    answer:
      "Square suits businesses that want simple pricing and bundled business tools. Very high volume, specialized, or international operations should price interchange plus alternatives first.",
  },
];

const SQUARE_BLOCKS = (longDescription?: string): BlockSpec[] => [
  ...(longDescription ? [richtext(longDescription)] : []),
  guide({
    title: "Square review: fees, alternatives and comparisons",
    layout: "stacked",
    keyTakeaways: [
      "Square charges only on completed payments, with rates that vary by channel.",
      "Hardware, software add-ons, and payroll are where the real cost difference shows up.",
      "Square suits simplicity, Clover suits hardware flexibility, Adyen and Elavon suit scale.",
    ],
    sections: [
      {
        heading: "Square overview",
        body:
          "<p>Square is one of the most widely used payment processing platforms for small businesses, offering an all-in-one solution for accepting payments online, in-store, and on the go. In addition to payment processing, Square provides POS software, inventory management, invoicing, employee management, online store tools, and business reporting from a single platform.</p><p>Square is especially popular with retailers, restaurants, salons, service providers, and mobile businesses because it combines easy setup with transparent pricing and a wide selection of payment hardware. Businesses can begin accepting credit cards within minutes without long-term contracts or complicated underwriting.</p><p>Whether you're opening your first store or expanding to multiple locations, Square provides scalable payment solutions that grow alongside your business.</p>",
      },
      {
        heading: "Square fees explained",
        body:
          "<p>Understanding Square fees is one of the most important factors when choosing a payment processor. Square uses transparent transaction-based pricing, allowing businesses to pay processing fees only when payments are successfully completed.</p><p>Depending on how customers pay, businesses may encounter different Square fees for in-person transactions, online payments, invoices, manually entered cards, and recurring payments. While the pricing structure is simple compared with many traditional merchant accounts, businesses should also consider hardware costs, optional software subscriptions, payroll services, and additional business tools.</p><p>Comparing total processing costs instead of just transaction percentages helps merchants determine whether Square offers the best long-term value for their business.</p>",
      },
      {
        heading: "Clover vs Square",
        body:
          "<p>The Clover vs Square comparison depends on the type of business you operate and the features you need. Both platforms support credit card processing, contactless payments, POS systems, inventory management, and business reporting, but they serve different business requirements.</p><p>Square is known for its easy setup, transparent pricing, and integrated software ecosystem, making it an excellent choice for startups and small businesses. Clover offers greater hardware flexibility, customizable POS solutions, and industry-specific features that appeal to larger retail stores, restaurants, and businesses with more complex operational needs.</p><p>When comparing Clover vs Square, businesses should evaluate payment processing costs, hardware options, monthly software fees, customer support, reporting tools, ecommerce integrations, and scalability before making a decision.</p>",
      },
      {
        heading: "Square alternatives",
        body:
          "<p>Although Square is a leading payment processor, many businesses compare Square alternatives to find lower processing costs, additional payment features, or industry-specific functionality. The best payment solution depends on your business size, sales channels, transaction volume, and integration requirements.</p><p>Popular alternatives include payment providers focused on ecommerce, enterprise businesses, international payments, subscription billing, or customized merchant services. Businesses seeking Square alternatives for small business often compare pricing, POS capabilities, reporting, customer support, and hardware flexibility before selecting a provider.</p><p>Reviewing multiple payment processors helps merchants choose the solution that best supports their growth while keeping payment acceptance simple and secure. See every <a href=\"/alternatives/square\">Square alternative we track</a>.</p>",
      },
      {
        heading: "Square vs other payment processors",
        body:
          "<p>Beyond the Clover vs Square comparison, many businesses also evaluate Square against other leading payment platforms. Comparisons such as Adyen vs Square and Elavon vs Square highlight differences in pricing models, global payment capabilities, enterprise features, settlement times, and business support.</p><p>Square is designed primarily for small and medium-sized businesses seeking an easy-to-use payment platform. Adyen focuses on enterprise merchants with international payment requirements, while Elavon offers customized merchant services for businesses looking for traditional payment processing solutions.</p><p>Comparing providers helps merchants identify the payment platform that aligns with their budget, transaction volume, and long-term business goals.</p>",
      },
      {
        heading: "Is Square the right payment processor?",
        body:
          "<p>Square is a strong choice for businesses that value simplicity, transparent pricing, and integrated business management tools. Retail stores, restaurants, service providers, healthcare practices, and ecommerce businesses can all benefit from Square's combination of payment processing, POS software, invoicing, inventory management, and online selling capabilities.</p><p>However, businesses with specialized requirements, very high transaction volumes, or international operations may benefit from comparing Square alternatives before making a final decision. Evaluating Square fees, available features, hardware options, customer support, and integration capabilities provides a complete picture of the platform's long-term value.</p><p>Choosing the right payment processor ultimately depends on your business model, expected growth, and the payment experience you want to deliver to your customers.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 7 — Glossary  →  /glossary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The source doc gives "payment gateway vs payment processor" as a primary
 * keyword to BOTH the glossary and the compare page, with a near-identical tab
 * on each. Two pages on one site competing for one query is a loss either way,
 * so the term is assigned once: to `/compare`, whose intent is comparison and
 * which now needs the ranking justification for being indexable at all.
 *
 * The glossary keeps the topic but reframes it as definition rather than
 * head-to-head, and links across. Its own head term is "payments glossary" — the
 * query the hub genuinely answers. Individual definitions stay with the
 * `/glossary/<term>` pages, which is why "merchant account" is a supporting
 * keyword here and not the focus.
 */
const GLOSSARY_SEO: SeoSpec = {
  metaTitle: "Payments Glossary | Payment Processing Terms Explained",
  metaDescription:
    "Payment terms in plain English: what a merchant account is, how payment links work, what a gateway does, plus chargebacks, settlement, and authorization defined.",
  focusKeyword: "payments glossary",
  keywords: [
    "payments glossary",
    "payment processing terms",
    "payment terms explained",
    "payment links",
    "paypal alternatives",
    "merchant account",
    "what is a merchant account",
  ],
};

const GLOSSARY_FAQS = [
  {
    question: "What does a payment gateway do?",
    answer:
      "It captures and encrypts the customer's payment details at checkout, then hands them to a processor. For a side-by-side of the two roles, see our compare page.",
  },
  {
    question: "What is a merchant account?",
    answer:
      "A bank account that holds card payments temporarily before the funds are transferred to your business bank account. Many providers now include one inside their platform.",
  },
  {
    question: "What are payment links?",
    answer:
      "A secure URL you share by email, SMS, or social media so a customer can pay without you building a checkout. Common for freelancers, clinics, nonprofits, and service businesses.",
  },
  {
    question: "What is a chargeback?",
    answer:
      "A payment dispute raised by the customer with their bank, which reverses the transaction and usually adds a fee for the merchant.",
  },
];

const GLOSSARY_BLOCKS: BlockSpec[] = [
  guide({
    title: "Payment terms explained",
    layout: "stacked",
    intro:
      "<p>The terms that come up most often when you compare providers, in plain English and in the order they matter.</p>",
    keyTakeaways: [
      "A gateway captures the payment, a processor moves the money. Most providers now do both.",
      "A merchant account holds funds between authorization and settlement.",
      "Payment links let you take payment without building a checkout at all.",
    ],
    sections: [
      {
        heading: "What a payment gateway and a payment processor each do",
        body:
          "<p>These two terms are used interchangeably more often than any other pair in payments, but they name different jobs.</p><p>A <a href=\"/glossary/payment-gateway\">payment gateway</a> securely captures and encrypts the payment information a customer submits, whether they're shopping online or paying through a mobile device. A <a href=\"/glossary/payment-processor\">payment processor</a> then communicates with banks and card networks to authorize, route, and settle the transaction.</p><p>Both are needed to complete a payment. Businesses selling online typically require both, and many modern platforms bundle the two into a single product, which is why the distinction blurs in marketing copy.</p><p>Deciding which you actually need is a different question from what each one is. Our <a href=\"/compare\">payment gateway vs payment processor comparison</a> works through that decision channel by channel.</p>",
      },
      {
        heading: "What is a merchant account?",
        body:
          "<p>Many business owners ask what is a merchant account before selecting a payment processor. A merchant account is a special type of bank account that temporarily holds customer card payments before funds are transferred to your business bank account.</p><p>Merchant accounts play an important role in credit card processing because they allow businesses to securely accept electronic payments while financial institutions verify and settle transactions.</p><p>Today, many payment providers include merchant account functionality within their payment platforms, allowing businesses to begin accepting payments without opening a separate account. For a fuller definition, see <a href=\"/glossary/merchant-account\">merchant account</a>.</p>",
      },
      {
        heading: "What are payment links?",
        body:
          "<p>Payment links allow businesses to collect payments by sharing a secure URL with customers through email, SMS, social media, messaging apps, or invoices. Instead of building a complete ecommerce website, customers simply open the payment page, enter their payment details, and complete the purchase securely.</p><p>Payment links are commonly used by freelancers, consultants, healthcare providers, nonprofits, contractors, service businesses, and small retailers that want a fast and simple way to accept online payments.</p><p>Many payment processors also allow businesses to customize payment links, track payment status, automate receipts, and integrate payment requests with accounting software and customer management systems. Compare <a href=\"/payment-processors/with-payment-links\">processors with payment links</a>.</p>",
      },
      {
        heading: "PayPal alternatives",
        body:
          "<p>While PayPal remains one of the most recognized payment platforms, many businesses compare PayPal alternatives based on transaction fees, supported payment methods, international availability, ecommerce integrations, and business features.</p><p>Some alternatives focus on lower processing costs, while others provide stronger subscription billing, marketplace payments, POS systems, or international payment capabilities. The best solution depends on your business model, customer preferences, and expected transaction volume.</p><p>Before switching providers, compare payment processing fees, settlement times, reporting tools, fraud protection, customer support, and integration options to determine which platform offers the greatest long-term value. Browse the current <a href=\"/alternatives/paypal\">PayPal alternatives</a>.</p>",
      },
      {
        heading: "Common payment terms every business should know",
        body:
          "<p>Understanding payment terminology makes it easier to compare providers and choose the right payment solution for your business.</p><p>Some of the most common payment terms include:</p><ul><li><strong>Merchant account</strong>: holds card payments before settlement.</li><li><strong>Payment gateway</strong>: securely captures payment information.</li><li><strong>Payment processor</strong>: routes transactions between banks and card networks.</li><li><strong>Payment link</strong>: a shareable URL used to collect payments online.</li><li><strong>Chargeback</strong>: a payment dispute initiated by the customer.</li><li><strong>Settlement</strong>: the transfer of approved funds into the merchant's bank account.</li><li><strong>Authorization</strong>: the process of verifying that funds are available before completing a transaction.</li></ul><p>Learning these terms helps businesses better understand payment processing, compare providers confidently, and make informed purchasing decisions.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 8 — Compare  →  /compare
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `/compare` now owns "payment gateway vs payment processor" (see the note on
 * `GLOSSARY_SEO`), so the title has to say so — an on-page H2 alone rarely wins a
 * head term the title never mentions. The keyword it already ranked for stays
 * first. `scripts/seed-seo.ts` carries the same two strings; change both or the
 * next `npm run seed:seo` reverts this.
 */
const COMPARE_SEO: SeoSpec = {
  metaTitle: "Payment Processor Comparison | Gateway vs Processor Explained",
  metaDescription:
    "Compare payment processors on pricing, payout speed, and features, and see how a payment gateway, a processor, a merchant account, and a PSP actually differ.",
  focusKeyword: "payment gateway vs payment processor",
  keywords: [
    "payment gateway vs payment processor",
    "payment gateway vs merchant account",
    "payment processor vs payment service provider",
    "hosted vs integrated payment gateway",
    "compare payment processors",
  ],
};

const COMPARE_BLOCKS: BlockSpec[] = [
  guide({
    title: "Which payment solution does your business need?",
    layout: "stacked",
    intro:
      "<p>Gateway, processor, merchant account, PSP. What each one actually does, and which combination fits how you sell.</p>",
    keyTakeaways: [
      "Most modern providers bundle gateway, processing, and merchant account into one product.",
      "A PSP adds fraud, reporting, and billing on top of plain processing.",
      "Hosted gateways cut PCI scope, integrated gateways keep control of checkout.",
    ],
    sections: [
      {
        heading: "Payment gateway vs payment processor",
        body:
          "<p>Understanding the difference between a payment gateway vs payment processor is one of the most common challenges for business owners choosing a payment solution. Although the terms are often used interchangeably, they perform different functions during a payment transaction.</p><p>A payment gateway securely captures and encrypts customer payment information during checkout, while a payment processor communicates with banks and card networks to authorize, route, and settle the transaction. Both components work together to complete secure electronic payments, and many modern providers bundle both services into a single platform.</p><p>For most ecommerce businesses, selecting a provider that includes both gateway and processing services simplifies setup while reducing integration complexity.</p>",
      },
      {
        heading: "Payment gateway vs merchant account",
        body:
          "<p>A payment gateway and a merchant account serve different purposes within the payment ecosystem. The payment gateway securely transfers payment information from the customer to the payment network, while a merchant account temporarily holds approved card payments before funds are deposited into the business bank account.</p><p>Many businesses no longer need to open a separate merchant account because modern payment providers bundle gateway, processing, and merchant account services into one solution. However, larger businesses or merchants with specialized processing requirements may still benefit from dedicated merchant accounts.</p><p>Understanding each component helps businesses select payment solutions that match their sales channels and transaction volume.</p>",
      },
      {
        heading: "Payment processor vs payment service provider",
        body:
          "<p>A payment processor focuses on authorizing transactions and moving funds between banks. A Payment Service Provider, or PSP, offers a broader platform that combines payment processing with additional services such as payment gateways, fraud prevention, reporting, recurring billing, and merchant onboarding.</p><p>Examples of PSPs include providers that bundle multiple payment services into one dashboard, making them ideal for businesses seeking a simplified payment infrastructure.</p><p>Businesses should evaluate whether they require a standalone processor or an all-in-one PSP based on their operational complexity and future growth plans.</p>",
      },
      {
        heading: "Hosted vs integrated payment gateways",
        body:
          "<p>Payment gateways generally fall into two categories: hosted and integrated.</p><p>A hosted payment gateway redirects customers to a secure third-party payment page to complete the transaction, reducing PCI compliance responsibilities for the merchant. An integrated gateway keeps customers on the merchant's website while securely transmitting payment information in the background.</p><p>Hosted gateways are easier to implement, while integrated gateways provide greater control over branding and the checkout experience. The right choice depends on your technical resources, customer experience goals, and security requirements.</p>",
      },
      {
        heading: "Which payment solution does your business need?",
        body:
          "<p>The ideal payment setup depends on how your business accepts payments.</p><ul><li>Ecommerce stores often require both a payment gateway and payment processor.</li><li>Retail businesses typically combine payment processing with POS software.</li><li>Subscription businesses benefit from recurring billing and automated payment management.</li><li>Marketplaces may require split payments and seller payout capabilities.</li><li>International businesses should evaluate multi-currency support and global payment acceptance.</li></ul><p>Choosing a scalable payment platform allows businesses to support future growth without replacing their payment infrastructure.</p>",
      },
      {
        heading: "Popular payment provider comparisons",
        body:
          "<p>Comparing payment providers helps businesses identify the platform that best fits their industry, budget, and operational requirements. Factors such as transaction fees, payment methods, integrations, reporting, settlement speed, and customer support all influence the overall value of a payment solution.</p><p>Explore our detailed comparisons, including:</p><ul><li><a href=\"/compare/stripe-vs-square\">Stripe vs Square</a></li><li><a href=\"/alternatives/stripe\">Stripe alternatives</a></li><li><a href=\"/alternatives/paypal\">PayPal alternatives</a></li><li><a href=\"/category/high-risk\">High-risk payment processors</a></li><li><a href=\"/category/retail-pos\">POS system comparisons</a></li></ul><p>Each guide explains pricing, features, strengths, and limitations to help businesses make informed payment processing decisions.</p>",
      },
    ],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Doc tab 9 — eCommerce POS Reviews  →  two standalone landing pages
// ═══════════════════════════════════════════════════════════════════════════

interface PosProvider {
  name: string;
  bestFor: string;
  price: string;
  features: string;
  pros: string;
  cons: string;
  rating: string;
  /** Review body, already wrapped in `<p>`. May contain internal links. */
  review: string;
  bestForLine: string;
}

const CA_PROVIDERS: PosProvider[] = [
  {
    name: "Shopify POS",
    bestFor: "Shopify sellers",
    price: "Free Starter, full POS from about 149 CAD per month",
    features: "Native Shopify sync, unified inventory, staff PINs, omnichannel returns",
    pros: "Seamless with a Shopify online store, huge app ecosystem",
    cons: "Full feature set locked behind higher-tier plans",
    rating: "4.6/5",
    review:
      "<p>Shopify POS is the natural choice for Canadian retailers already running a Shopify online store, because inventory, customer profiles, and order history sync automatically with no middleware required. The free Starter plan covers basic in-person selling, while the paid tier unlocks staff management, advanced reporting, and omnichannel order routing. Being Ottawa-founded, Shopify's Canadian tax settings are well supported out of the box, including automatic GST, HST, and PST calculation by province.</p>",
    bestForLine:
      "Shopify-native Canadian sellers adding physical retail locations or pop-ups.",
  },
  {
    name: "Square for Retail",
    bestFor: "Small businesses",
    price: "Free plan available, Plus from about 120 CAD per month per location",
    features: "Free tier, built-in payments, inventory, ecommerce integration",
    pros: "Easy setup, transparent flat-rate pricing, no long contracts",
    cons: "Advanced reporting and multi-location tools require paid tiers",
    rating: "4.5/5",
    review:
      "<p>Square's transparent flat-rate CAD pricing and genuinely free entry tier make it an easy on-ramp for new Canadian retailers. Setup takes minutes, hardware is widely available across Canada, and Square Online syncs inventory automatically across channels. Multi-location forecasting and deeper analytics require the Plus plan, and very high-volume sellers may find flat-rate processing pricier than negotiated interchange-plus pricing elsewhere. Read the full <a href=\"/processor/square\">Square review</a>.</p>",
    bestForLine:
      "New or single-location Canadian retailers who want simplicity and predictable costs.",
  },
  {
    name: "Lightspeed Retail",
    bestFor: "Complex inventory",
    price: "From about 145 CAD per month, billed annually",
    features: "Advanced inventory, multi-store management, built-in ecommerce",
    pros: "Deep reporting, strong for large SKU counts, Canadian-built",
    cons: "Higher learning curve, pricier at entry",
    rating: "4.4/5",
    review:
      "<p>Lightspeed was built in Montreal and remains one of the strongest options for Canadian retailers with genuinely complex inventory, such as apparel with size and colour matrices, or thousands of SKUs across multiple locations. Its reporting goes deeper than most competitors here, covering vendor management, purchase order automation, and multi-store comparisons. That depth comes with a steeper onboarding curve and a higher entry price than Square or Helcim.</p>",
    bestForLine:
      "Multi-location Canadian retailers or those with large, complex product catalogs.",
  },
  {
    name: "Clover",
    bestFor: "Flexible hardware",
    price: "Hardware from about 65 CAD, software plans from about 20 to 115 CAD per month",
    features: "App marketplace, custom hardware bundles, third-party integrations",
    pros: "Highly customizable, wide hardware range",
    cons: "Pricing varies by reseller, less transparent online",
    rating: "4.2/5",
    review:
      "<p>Clover's biggest differentiator is flexibility: multiple hardware form factors and a large third-party app marketplace to bolt on functionality from loyalty programs to scheduling. Because Clover is often sold and priced through Canadian banks and independent processors rather than directly, pricing varies by reseller, which makes comparison shopping more important here than with providers publishing one standard rate card.</p>",
    bestForLine:
      "Canadian businesses that want app-store-style customization and varied hardware options.",
  },
  {
    name: "Helcim",
    bestFor: "Cost-conscious merchants",
    price: "No monthly software fee, interchange plus pricing",
    features: "Free POS software, transparent per-transaction pricing, built-in invoicing",
    pros: "No monthly fee, volume-based rate discounts, Canadian support",
    cons: "Fewer built-in retail-specific features than a dedicated retail POS",
    rating: "4.7/5",
    review:
      "<p>Helcim, founded in Calgary, built a loyal Canadian following by doing the opposite of most POS providers: no monthly software fee, and transparent interchange-plus pricing that gets cheaper automatically as volume grows. For cost-conscious merchants who know flat-rate pricing costs more, Helcim is frequently the better deal, with Canadian-based support that understands local banking. Its retail-specific feature set is lighter than Lightspeed or Shopify POS. See the full <a href=\"/processor/helcim\">Helcim review</a>.</p>",
    bestForLine:
      "Canadian merchants prioritizing transparent, low-cost payment processing over deep retail features.",
  },
  {
    name: "Moneris",
    bestFor: "Canadian-owned processor",
    price: "Custom pricing, hardware and plans vary by package",
    features: "Canadian-built, strong RBC and BMO bank integrations, in-person support",
    pros: "Deep familiarity with Canadian tax and compliance, strong local support",
    cons: "Pricing not fully transparent online, setup can involve more paperwork",
    rating: "4.1/5",
    review:
      "<p>Moneris, a joint venture between RBC and BMO, is Canada's largest homegrown payment technology company, with deep integration into Canadian banking and a long track record supporting Canadian tax and compliance requirements. It's a strong choice for retailers who specifically want a domestic, bank-backed processor and value in-person support. Onboarding can involve more paperwork than newer, self-serve competitors, and its online pricing transparency lags behind entrants like Helcim and Square.</p>",
    bestForLine:
      "Canadian retailers who want a domestic, bank-owned processor with strong local support.",
  },
  {
    name: "Loyverse POS",
    bestFor: "Budget-first sellers",
    price: "Free core POS app, paid add-ons for advanced reporting",
    features: "Free inventory management, basic ecommerce sync, multi-store support",
    pros: "No-cost entry point, simple interface",
    cons: "Thinner feature set for growing multi-location retailers",
    rating: "4.0/5",
    review:
      "<p>Loyverse offers a genuinely free core POS app, making it a common starting point for very small Canadian retailers, market vendors, and businesses testing a new sales channel before committing to paid software. Inventory management and basic ecommerce sync are included at no cost, with paid add-ons available for advanced reporting and multi-store analytics. Growing multi-location retailers will likely outgrow its feature set within a year or two.</p>",
    bestForLine:
      "Very small or budget-first Canadian sellers who want to start with zero software cost.",
  },
];

const US_PROVIDERS: PosProvider[] = [
  {
    name: "Shopify POS",
    bestFor: "Shopify sellers",
    price: "Free Starter, full POS from about 89 to 119 USD per month",
    features: "Native Shopify sync, unified inventory, staff PINs, omnichannel returns",
    pros: "Seamless with a Shopify online store, huge app ecosystem",
    cons: "Full feature set locked behind higher-tier plans",
    rating: "4.6/5",
    review:
      "<p>Shopify POS is the natural choice for U.S. retailers already running a Shopify online store, because inventory, customer profiles, and order history sync automatically with no middleware required. The free Starter plan covers basic in-person selling, while the paid tier unlocks staff management, advanced reporting, and omnichannel order routing. Its U.S. tax settings integrate with Avalara for automatic multi-state and local rate calculation.</p>",
    bestForLine: "Shopify-native U.S. sellers adding physical retail locations or pop-ups.",
  },
  {
    name: "Square for Retail",
    bestFor: "Small businesses",
    price: "Free plan available, Plus from about 89 USD per month per location",
    features: "Free tier, built-in payments, inventory, ecommerce integration",
    pros: "Easy setup, transparent flat-rate pricing, no long contracts",
    cons: "Advanced reporting and multi-location tools require paid tiers",
    rating: "4.5/5",
    review:
      "<p>Square's transparent flat-rate USD pricing and genuinely free entry tier make it an easy on-ramp for new U.S. retailers. Setup takes minutes, hardware is widely available, and Square Online syncs inventory automatically across channels. Multi-location forecasting and deeper analytics require the Plus plan, and very high-volume sellers may find flat-rate processing pricier than negotiated interchange-plus pricing elsewhere. Read the full <a href=\"/processor/square\">Square review</a>.</p>",
    bestForLine: "New or single-location U.S. retailers who want simplicity and predictable costs.",
  },
  {
    name: "Lightspeed Retail",
    bestFor: "Complex inventory",
    price: "From about 109 USD per month, billed annually",
    features: "Advanced inventory, multi-store management, built-in ecommerce",
    pros: "Deep reporting, strong for large SKU counts",
    cons: "Higher learning curve, pricier at entry",
    rating: "4.4/5",
    review:
      "<p>Lightspeed remains one of the strongest options for U.S. retailers with genuinely complex inventory, such as apparel with size and colour matrices, or thousands of SKUs across multiple locations. Its reporting goes deeper than most competitors here, covering vendor management, purchase order automation, and multi-store comparisons. That depth comes with a steeper onboarding curve and a higher entry price than Square or Helcim.</p>",
    bestForLine: "Multi-location U.S. retailers or those with large, complex product catalogs.",
  },
  {
    name: "Clover",
    bestFor: "Flexible hardware",
    price: "Hardware from about 49 USD, software plans from about 14.95 to 84.95 USD per month",
    features: "App marketplace, custom hardware bundles, third-party integrations",
    pros: "Highly customizable, wide hardware range",
    cons: "Pricing varies by reseller, less transparent online",
    rating: "4.2/5",
    review:
      "<p>Clover's biggest differentiator is flexibility: multiple hardware form factors and a large third-party app marketplace to bolt on functionality from loyalty programs to scheduling. Because Clover is often sold and priced through U.S. banks and independent processors rather than directly, pricing varies by reseller, which makes comparison shopping more important here than with providers publishing one standard rate card.</p>",
    bestForLine:
      "U.S. businesses that want app-store-style customization and varied hardware options.",
  },
  {
    name: "Helcim",
    bestFor: "Cost-conscious merchants",
    price: "No monthly software fee, interchange plus pricing",
    features: "Free POS software, transparent per-transaction pricing, built-in invoicing",
    pros: "No monthly fee, volume-based rate discounts, no contracts",
    cons: "Fewer built-in retail-specific features than a dedicated retail POS",
    rating: "4.7/5",
    review:
      "<p>Helcim built a loyal U.S. following by doing the opposite of most POS providers: no monthly software fee, and transparent interchange-plus pricing that gets cheaper automatically as volume grows. For cost-conscious merchants who know flat-rate pricing costs more, Helcim is frequently the better deal. Its retail-specific feature set is lighter than Lightspeed or Shopify POS, so highly specialized inventory needs may be underserved. See the full <a href=\"/processor/helcim\">Helcim review</a>.</p>",
    bestForLine:
      "U.S. merchants prioritizing transparent, low-cost payment processing over deep retail features.",
  },
  {
    name: "PayPal Zettle",
    bestFor: "Micro and mobile sellers",
    price: "Free software, pay per transaction",
    features: "Mobile card reader, simple checkout, PayPal and Venmo QR integration",
    pros: "Low commitment, fast setup, familiar brand",
    cons: "Limited depth for growing multi-location retailers",
    rating: "4.0/5",
    review:
      "<p>PayPal Zettle suits U.S. sellers who need to start accepting payments today with minimal commitment, such as market vendors, mobile sellers, or very small retail operations. Free software and pay-per-transaction pricing mean no upfront cost, and integrated PayPal and Venmo QR code payments are a genuine convenience if your customers already use those apps. Feature depth is intentionally limited, and growing multi-location retailers will likely outgrow it within a year or two. Read the full <a href=\"/processor/paypal\">PayPal review</a>.</p>",
    bestForLine:
      "Very small, mobile, or seasonal U.S. sellers who want to start selling with zero commitment.",
  },
  {
    name: "Revel Systems",
    bestFor: "Growing multi-location retail",
    price: "Custom pricing, typically from about 99 USD per month per terminal",
    features: "Enterprise inventory, detailed analytics, open API",
    pros: "Built for scaling multi-location U.S. operations",
    cons: "Higher cost and setup complexity than entry-level platforms",
    rating: "4.1/5",
    review:
      "<p>Revel Systems, built in San Francisco, targets growing multi-location U.S. retailers that have outgrown entry-level POS platforms. Its open API and enterprise-grade inventory and analytics tools make it a common choice for regional chains that need tighter control across locations. That capability comes at a real cost premium and a longer setup process than Square or Shopify POS, which makes Revel a better fit once you're scaling past a handful of locations rather than at day one.</p>",
    bestForLine:
      "Growing multi-location U.S. retailers that need enterprise-grade inventory and reporting tools.",
  },
];

const reviewsHtml = (providers: PosProvider[]): string =>
  providers
    .map(
      (p) =>
        `<h3>${p.name} review</h3>${p.review}<p><strong>Best for:</strong> ${p.bestForLine}</p>`,
    )
    .join("");

const comparisonRows = (providers: PosProvider[]) =>
  providers.map((p) => ({
    name: p.name,
    cells: [p.bestFor, p.price, p.features, p.pros, p.cons, p.rating],
  }));

const POS_HEADERS = ["Best for", "Starting price", "Key features", "Pros", "Cons", "Rating"];

const CA_FAQS = [
  {
    question: "What is the best eCommerce POS system for small businesses in Canada?",
    answer:
      "Square for Retail, or Shopify POS if you already sell on Shopify, offer the best balance of low cost, fast setup, and reliable inventory sync for most small Canadian businesses starting out.",
  },
  {
    question: "How much does an eCommerce POS system cost in Canada?",
    answer:
      "It depends on the model. Some providers charge no monthly fee and take a per-transaction or interchange plus rate, such as Helcim, while others charge a flat monthly fee from roughly 20 to 149 CAD per month plus processing fees, such as Clover, Shopify, and Lightspeed.",
  },
  {
    question: "Does Shopify POS support Interac debit?",
    answer:
      "Yes. Shopify POS supports Interac debit through its supported Canadian card readers, alongside major credit cards and contactless payments.",
  },
  {
    question: "How does GST, HST and PST work with a POS system?",
    answer:
      "A properly configured Canadian POS system applies the correct GST, HST, or PST rate automatically based on the province where the sale occurs in store, or where the item ships for online orders, so you do not calculate rates manually.",
  },
  {
    question: "Can I use the same POS system for both my online store and physical location?",
    answer:
      "Yes, and that is the core purpose of an eCommerce POS. All seven providers reviewed here sync inventory, orders, and customer data between your online store and any physical locations in real time.",
  },
  {
    question: "Is Moneris only available to Canadian businesses?",
    answer:
      "Moneris operates as a domestic Canadian processor, jointly owned by RBC and BMO, with its services and support built specifically around the Canadian market.",
  },
  {
    question: "What is the difference between cloud POS and traditional POS?",
    answer:
      "Cloud POS stores data centrally and syncs in real time across every channel, while traditional POS runs on local, on-premise servers. Cloud is the better fit for most online plus in-person sellers.",
  },
  {
    question: "Are there contract-free eCommerce POS options in Canada?",
    answer:
      "Yes. Square, Helcim, and Loyverse all offer month-to-month terms with no long-term contract required, which reduces risk for newer or seasonal businesses.",
  },
  {
    question: "Which eCommerce POS has the lowest processing fees in Canada?",
    answer:
      "Helcim's interchange plus pricing typically offers the lowest effective cost for established or higher-volume Canadian merchants, since rates improve automatically as volume grows.",
  },
  {
    question: "Do I need a Canadian bank account to use these POS systems?",
    answer:
      "Most providers, including Moneris, Helcim, and Shopify POS, settle directly into a Canadian bank account in CAD, which avoids the currency conversion costs of settling into a foreign-currency account.",
  },
];

const US_FAQS = [
  {
    question: "What is the best eCommerce POS system for small businesses in the USA?",
    answer:
      "Square for Retail, or Shopify POS if you already sell on Shopify, offer the best balance of low cost, fast setup, and reliable inventory sync for most small U.S. businesses starting out.",
  },
  {
    question: "How much does an eCommerce POS system cost in the USA?",
    answer:
      "It depends on the model. Some providers charge no monthly fee and take a per-transaction or interchange plus rate, such as Helcim, while others charge a flat monthly fee from roughly 14.95 to 119 USD per month plus processing fees, such as Clover, Shopify, and Lightspeed.",
  },
  {
    question: "Does my POS system need to handle sales tax for multiple states?",
    answer:
      "Yes, if you have economic nexus in more than one state, which is generally triggered by sales volume or transaction count into that state. Most modern POS platforms integrate with tax automation tools like Avalara or TaxJar to handle this correctly.",
  },
  {
    question: "Is PayPal Zettle available across the USA?",
    answer:
      "Yes. PayPal Zettle, now PayPal Point of Sale, is available to U.S. merchants nationwide, along with QR-code payments through PayPal and Venmo.",
  },
  {
    question: "Can I use the same POS system for both my online store and physical location?",
    answer:
      "Yes, and that is the core purpose of an eCommerce POS. All seven providers reviewed here sync inventory, orders, and customer data between your online store and any physical locations in real time.",
  },
  {
    question: "What is the difference between cloud POS and traditional POS?",
    answer:
      "Cloud POS stores data centrally and syncs in real time across every channel, while traditional POS runs on local, on-premise servers. Cloud is the better fit for most online plus in-person sellers.",
  },
  {
    question: "Is Shopify POS only for Shopify online stores?",
    answer:
      "Shopify POS is built for Shopify's platform, and its native sync advantage only applies if your online store runs on Shopify. Otherwise Square, Clover, or Lightspeed will integrate more naturally.",
  },
  {
    question: "Are there contract-free eCommerce POS options in the USA?",
    answer:
      "Yes. Square, Helcim, and PayPal Zettle all offer month-to-month terms with no long-term contract required, which reduces risk for newer or seasonal businesses.",
  },
  {
    question: "Which eCommerce POS has the lowest processing fees in the USA?",
    answer:
      "Helcim's interchange plus pricing typically offers the lowest effective cost for established or higher-volume U.S. merchants, since rates improve automatically as volume grows.",
  },
  {
    question: "What POS system is best for a growing multi-location U.S. retailer?",
    answer:
      "Lightspeed Retail and Revel Systems are generally the better fit once you are managing multiple locations, given their deeper inventory, reporting, and multi-store management tools.",
  },
];

interface LandingSpec {
  pageKey: string;
  path: string;
  /** Admin label and breadcrumb leaf. */
  title: string;
  heading: string;
  subheading: string;
  seo: SeoSpec;
  faqs: { question: string; answer: string }[];
  blocks: BlockSpec[];
}

const CA_LANDING: LandingSpec = {
  pageKey: "ecommerce-pos-reviews-canada",
  path: "/ecommerce-pos-reviews-canada",
  title: "eCommerce POS Reviews Canada",
  heading: "eCommerce POS Reviews Canada: Best Systems for Canadian Retailers in 2026",
  subheading:
    "Seven eCommerce POS systems compared for Canadian retailers on CAD pricing, GST, HST and PST handling, Interac debit support, and local settlement.",
  seo: {
    metaTitle: "eCommerce POS Reviews Canada",
    metaDescription:
      "Compare the best eCommerce POS Reviews Canada has to offer, with CAD pricing, GST/HST-ready systems, and top providers. Find your fit and start selling today!",
    focusKeyword: "ecommerce pos reviews canada",
    // Regional variant of the USA page. Both must carry the same group and their
    // own locale, or the hreflang set is incomplete and Google drops it.
    localeGroup: "ecommerce-pos-reviews",
    locale: "en-CA",
    keywords: [
      "ecommerce pos reviews canada",
      "best pos system for online store canada",
      "pos for shopify canada",
      "retail pos canada",
      "point of sale comparison canada",
      "best pos for small business canada",
      "omnichannel pos software",
      "cloud pos systems canada",
      "pos with gst hst support",
    ],
  },
  faqs: CA_FAQS,
  blocks: [
    richtext(
      "<p>Running a store in Canada comes with a few wrinkles most U.S.-built POS guides gloss over: GST, HST, and provincial sales tax all behave differently depending on where you're shipping from and to; Interac debit is still the payment method a large share of your in-person customers reach for first; and settlement in Canadian dollars matters if you don't want to eat currency conversion fees on every sale. These eCommerce POS Reviews Canada businesses can actually rely on focus on the systems that handle all of that properly, not a generic global list with Canada bolted on as an afterthought.</p><p>We evaluated each platform against what a real Canadian retailer selling online and in-person needs: accurate multi-province tax handling, native Interac support, CAD pricing and settlement, and genuine local customer support. Whether you're a Shopify seller in Toronto opening a first storefront, a Vancouver boutique syncing inventory across two locations, or a growing Alberta retailer standardizing hardware, you'll find a system below built to handle the Canadian side of your business properly.</p>",
    ),
    richtext(
      "<h2>Why Canadian businesses need an eCommerce POS system</h2><p>A dedicated eCommerce POS system keeps your online catalog, in-store inventory, and customer data in one synchronized record, and for Canadian retailers specifically it needs to do that across provincial tax rules without you manually adjusting anything.</p><ul><li><strong>Inventory drift.</strong> Sell an item in-store while your website still shows it available, and you're issuing refunds and apologies to online customers. Real-time sync between channels solves this.</li><li><strong>Tax complexity across provinces.</strong> A retailer shipping from Ontario to a customer in Alberta needs different tax handling than one shipping to Quebec. A POS system with proper Canadian tax automation applies the right GST, HST, or PST rate automatically based on where the sale happens. Getting this wrong manually is a common source of bookkeeping headaches and CRA compliance risk.</li><li><strong>Fragmented customer data.</strong> A shopper who buys online and later visits your store should be recognized as the same customer, with one purchase history and one loyalty balance, not two disconnected records.</li><li><strong>Reporting blind spots.</strong> If online and in-store sales live in separate dashboards, you're manually reconciling reports every month instead of seeing true performance by product, channel, or location.</li></ul><p>A properly chosen system also gives you centralized staff permissions, CAD settlement without conversion losses, and one vendor relationship instead of three.</p><h2>Best eCommerce POS systems in Canada</h2><p>We evaluated seven platforms with meaningful traction among Canadian retailers running both online and in-person sales, transparent pricing, and active local support.</p><ul><li><strong>Shopify POS</strong>: best for Shopify-based online stores adding physical retail.</li><li><strong>Square for Retail</strong>: best for small businesses wanting simple pricing and fast setup.</li><li><strong>Lightspeed Retail</strong>: best for retailers with complex inventory, proudly built in Montreal.</li><li><strong>Clover</strong>: best for businesses wanting flexible hardware and app choices.</li><li><strong>Helcim</strong>: best for cost-conscious merchants wanting transparent pricing, founded in Calgary.</li><li><strong>Moneris</strong>: best for retailers who want a Canadian-owned processor with deep bank integration.</li><li><strong>Loyverse POS</strong>: best for very small or budget-first sellers who want a free entry point.</li></ul>",
    ),
    comparison({
      title: "eCommerce POS comparison for Canada",
      headers: POS_HEADERS,
      rows: comparisonRows(CA_PROVIDERS),
    }),
    richtext(
      "<p>Pricing shown reflects publicly listed CAD rates at time of publication and varies by plan tier, transaction volume, and hardware bundle. Always confirm current pricing directly with the provider before purchasing.</p>",
    ),
    richtext(`<h2>Individual reviews</h2>${reviewsHtml(CA_PROVIDERS)}`),
    guide({
      title: "How to choose an eCommerce POS in Canada",
      layout: "stacked",
      keyTakeaways: [
        "Match the POS to your online platform first. Shopify sellers get the smoothest path from Shopify POS.",
        "Confirm GST, HST and PST automate by destination, not just by your home province.",
        "Under 5,000 CAD a month favours free or pay-per-transaction plans. Over 50,000 CAD favours interchange plus.",
      ],
      sections: [
        {
          heading: "Key features to look for",
          body:
            "<p>When comparing eCommerce POS Reviews Canada businesses can trust, look past the marketing copy and check for:</p><ul><li>Real-time inventory sync across online and in-store channels.</li><li>Automatic GST, HST and PST calculation based on the province of sale or shipment.</li><li>Interac debit support, still a dominant in-person payment method across Canada.</li><li>CAD settlement without currency conversion fees eating into your margin.</li><li>Unified customer profiles that merge online and in-store purchase history.</li><li>Multi-location support if you operate across more than one province.</li><li>Staff permission controls to limit access to discounts, refunds, and reporting by role.</li><li>Hardware compatibility with receipt printers, barcode scanners, and card readers you may already own.</li><li>Contract flexibility, since month-to-month terms reduce risk if your needs change.</li></ul>",
        },
        {
          heading: "Pricing comparison",
          body:
            "<p>Pricing in the Canadian market falls into the same three general models seen elsewhere, but the effective cost differs once you factor in CAD settlement and Canadian interchange rates. A flat monthly software fee plus card processing, as with Shopify POS, Lightspeed, and Clover, gives predictable software costs but processing rates that don't automatically improve with volume. No monthly fee with interchange plus processing, as with Helcim, means your effective cost drops as transaction volume grows, a model that tends to reward established Canadian retailers. Free software with pay-per-transaction pricing, as with Square's free tier and Loyverse, removes upfront cost entirely, suiting new or low-volume sellers.</p><p>A new Canadian retailer processing under 5,000 CAD a month typically comes out ahead on a free or low-commitment plan. A retailer processing 50,000 CAD a month or more should model interchange plus pricing against flat-rate plans, because at that volume the savings are often significant.</p>",
        },
        {
          heading: "How to choose the right eCommerce POS in Canada",
          body:
            "<ol><li><strong>What platform is your online store built on?</strong> Shopify sellers get the smoothest experience from Shopify POS's native sync.</li><li><strong>How complex is your inventory?</strong> Large SKU counts or multi-location stock favour Lightspeed or Clover.</li><li><strong>What's your monthly processing volume?</strong> High volume favours interchange plus pricing such as Helcim, low volume favours pay-per-transaction models such as Square's free tier or Loyverse.</li><li><strong>Do you sell across multiple provinces?</strong> Confirm the provider automates GST, HST and PST correctly by destination, not just by your home province.</li><li><strong>Does it support Interac debit natively?</strong> This remains one of the most-used in-person payment methods in Canada and shouldn't require a workaround.</li><li><strong>What hardware do you already own?</strong> Reusing existing card readers or receipt printers reduces switching costs.</li><li><strong>How important is contract flexibility?</strong> If your business is still finding its footing, prioritize month-to-month terms.</li></ol>",
        },
        {
          heading: "Cloud POS vs traditional POS",
          body:
            "<p>Traditional, on-premise POS systems run on local servers and can process transactions during an internet outage, which is useful for some brick-and-mortar-only businesses. But for any Canadian retailer running an online store alongside physical locations, the sync gap traditional systems create usually outweighs that benefit.</p><p>Cloud POS systems, which is what every provider in this roundup is, store data centrally and sync in real time across every channel and location, keeping your online catalog and in-store inventory accurate automatically. Most cloud POS providers now include offline modes that queue transactions locally and sync once connectivity returns. For any Canadian business selling online and in-person, cloud POS is the practical default in 2026.</p>",
        },
        {
          heading: "Conclusion",
          body:
            "<p>The right choice among these eCommerce POS Reviews Canada retailers can rely on comes down to your platform, your inventory complexity, and how much you value a Canadian-owned processor versus a global one. Shopify sellers get the smoothest experience with Shopify POS, cost-conscious merchants should take a hard look at Helcim, and retailers wanting deep local banking ties will lean toward Moneris. Whichever direction fits your business, compare at least two providers side by side using the table above before committing to a contract or hardware purchase.</p>",
        },
      ],
    }),
    cta({
      heading: "Not sure which POS fits your store?",
      body: "Filter the full directory by sales channel, pricing model, and the integrations you already run.",
      buttonLabel: "Compare processors",
      buttonUrl: "/processors",
    }),
  ],
};

const US_LANDING: LandingSpec = {
  pageKey: "ecommerce-pos-reviews-usa",
  path: "/ecommerce-pos-reviews-usa",
  title: "eCommerce POS Reviews USA",
  heading: "eCommerce POS Reviews USA: Best Systems for U.S. Retailers in 2026",
  subheading:
    "Seven eCommerce POS systems compared for U.S. retailers on USD pricing, multi-state sales tax automation, EMV and contactless compliance, and domestic settlement.",
  seo: {
    metaTitle: "eCommerce POS Reviews USA",
    metaDescription:
      "Compare the best eCommerce POS Reviews USA has to offer, with USD pricing, sales-tax-ready systems, and top providers. Find your fit and start selling today!",
    focusKeyword: "ecommerce pos reviews usa",
    localeGroup: "ecommerce-pos-reviews",
    locale: "en-US",
    keywords: [
      "ecommerce pos reviews usa",
      "best pos system for online store usa",
      "pos for shopify usa",
      "retail pos united states",
      "point of sale comparison usa",
      "best pos for small business usa",
      "omnichannel pos software",
      "cloud pos systems usa",
      "pos with sales tax automation",
    ],
  },
  faqs: US_FAQS,
  blocks: [
    richtext(
      "<p>Running a store in the United States comes with its own set of operational details that a generic global POS guide tends to skim over: sales tax varies not just by state but often by city and county, with nexus rules that can apply the moment you sell into a new state; EMV chip and contactless compliance affects your liability on fraudulent transactions; and settlement in U.S. dollars into a domestic bank account matters if you want funds available without delay. These eCommerce POS Reviews USA businesses can actually rely on focus on the systems that handle all of that properly, not a generic list with the U.S. treated as one of many markets.</p><p>We evaluated each platform against what a real U.S. retailer selling online and in-person needs: accurate multi-state and local sales tax handling, EMV and NFC compliance, USD pricing and settlement, and responsive domestic support. Whether you're a Shopify seller in Austin opening a first storefront, a Chicago boutique syncing inventory across two locations, or a growing retailer standardizing hardware across states, you'll find a system below built to handle the U.S. side of your business properly.</p>",
    ),
    richtext(
      "<h2>Why U.S. businesses need an eCommerce POS system</h2><p>A dedicated eCommerce POS system keeps your online catalog, in-store inventory, and customer data in one synchronized record, and for U.S. retailers specifically it needs to do that across a genuinely complicated sales tax landscape without manual intervention.</p><ul><li><strong>Inventory drift.</strong> Sell an item in-store while your website still shows it available, and you're issuing refunds and apologies to online customers. Real-time sync between channels solves this.</li><li><strong>Sales tax complexity.</strong> A retailer with economic nexus in multiple states needs to apply the correct combined state, county, and city tax rate for every transaction, rates that can differ block to block in some jurisdictions. A POS system with proper U.S. tax automation, often via a built-in Avalara or TaxJar integration, handles this automatically. Getting it wrong manually is a common source of audit risk.</li><li><strong>Fragmented customer data.</strong> A shopper who buys online and later visits your store should be recognized as the same customer, with one purchase history and one loyalty balance, not two disconnected records.</li><li><strong>Reporting blind spots.</strong> If online and in-store sales live in separate dashboards, you're manually reconciling reports every month instead of seeing true performance by product, channel, or location.</li></ul><p>A properly chosen system also gives you centralized staff permissions, fast USD settlement, and one vendor relationship instead of three.</p><h2>Best eCommerce POS systems in the USA</h2><p>We evaluated seven platforms with meaningful traction among U.S. retailers running both online and in-person sales, transparent pricing, and active domestic support.</p><ul><li><strong>Shopify POS</strong>: best for Shopify-based online stores adding physical retail.</li><li><strong>Square for Retail</strong>: best for small businesses wanting simple pricing and fast setup.</li><li><strong>Lightspeed Retail</strong>: best for retailers with complex inventory across multiple locations.</li><li><strong>Clover</strong>: best for businesses wanting flexible hardware and app choices.</li><li><strong>Helcim</strong>: best for cost-conscious merchants wanting transparent pricing.</li><li><strong>PayPal Zettle</strong>: best for very small or mobile-first sellers who want low commitment.</li><li><strong>Revel Systems</strong>: best for growing multi-location retailers needing enterprise-grade tools, built in San Francisco.</li></ul>",
    ),
    comparison({
      title: "eCommerce POS comparison for the USA",
      headers: POS_HEADERS,
      rows: comparisonRows(US_PROVIDERS),
    }),
    richtext(
      "<p>Pricing shown reflects publicly listed USD rates at time of publication and varies by plan tier, transaction volume, and hardware bundle. Always confirm current pricing directly with the provider before purchasing.</p>",
    ),
    richtext(`<h2>Individual reviews</h2>${reviewsHtml(US_PROVIDERS)}`),
    guide({
      title: "How to choose an eCommerce POS in the USA",
      layout: "stacked",
      keyTakeaways: [
        "Match the POS to your online platform first. Shopify sellers get the smoothest path from Shopify POS.",
        "Confirm state, county and city tax rates automate correctly, not just your home-state rate.",
        "Under 5,000 USD a month favours free or pay-per-transaction plans. Over 50,000 USD favours interchange plus.",
      ],
      sections: [
        {
          heading: "Key features to look for",
          body:
            "<p>When comparing eCommerce POS Reviews USA businesses can trust, look past the marketing copy and check for:</p><ul><li>Real-time inventory sync across online and in-store channels.</li><li>Automatic multi-state and local sales tax calculation, ideally via a built-in Avalara or TaxJar integration.</li><li>EMV and NFC contactless compliance to limit your fraud liability.</li><li>USD settlement into a domestic bank account with predictable payout timing.</li><li>Unified customer profiles that merge online and in-store purchase history.</li><li>Multi-location support if you operate across more than one state.</li><li>Staff permission controls to limit access to discounts, refunds, and reporting by role.</li><li>Hardware compatibility with receipt printers, barcode scanners, and card readers you may already own.</li><li>Contract flexibility, since month-to-month terms reduce risk if your needs change.</li></ul>",
        },
        {
          heading: "Pricing comparison",
          body:
            "<p>Pricing in the U.S. market falls into three general models. A flat monthly software fee plus card processing, as with Shopify POS, Lightspeed, and Clover, gives predictable software costs but processing rates that don't automatically improve with volume. No monthly fee with interchange plus processing, as with Helcim, means your effective cost drops as transaction volume grows, rewarding established or high-volume merchants. Free software with pay-per-transaction pricing, as with Square's free tier and PayPal Zettle, removes upfront cost entirely, suiting new or low-volume sellers.</p><p>A new U.S. retailer processing under 5,000 USD a month typically comes out ahead on a free or low-commitment plan. A retailer processing 50,000 USD a month or more should model interchange plus pricing against flat-rate plans, because at that volume the savings are often significant enough to justify the extra complexity of comparing rates.</p>",
        },
        {
          heading: "How to choose the right eCommerce POS in the USA",
          body:
            "<ol><li><strong>What platform is your online store built on?</strong> Shopify sellers get the smoothest experience from Shopify POS's native sync.</li><li><strong>How complex is your inventory?</strong> Large SKU counts or multi-location stock favour Lightspeed, Clover, or Revel Systems.</li><li><strong>What's your monthly processing volume?</strong> High volume favours interchange plus pricing such as Helcim, low volume favours pay-per-transaction models such as Square's free tier or Zettle.</li><li><strong>Do you have sales tax nexus in multiple states?</strong> Confirm the provider automates state, county, and city tax rates correctly, not just your home-state rate.</li><li><strong>Is the hardware EMV and NFC compliant?</strong> This affects your fraud liability on chip and contactless transactions.</li><li><strong>What hardware do you already own?</strong> Reusing existing card readers or receipt printers reduces switching costs.</li><li><strong>How important is contract flexibility?</strong> If your business is still finding its footing, prioritize month-to-month terms.</li></ol>",
        },
        {
          heading: "Cloud POS vs traditional POS",
          body:
            "<p>Traditional, on-premise POS systems run on local servers and can process transactions during an internet outage, which is useful for some brick-and-mortar-only businesses. But for any U.S. retailer running an online store alongside physical locations, the sync gap traditional systems create usually outweighs that benefit.</p><p>Cloud POS systems, which is what every provider in this roundup is, store data centrally and sync in real time across every channel and location, keeping your online catalog and in-store inventory accurate automatically. Most cloud POS providers now include offline modes that queue transactions locally and sync once connectivity returns. For any U.S. business selling online and in-person, cloud POS is the practical default in 2026.</p>",
        },
        {
          heading: "Conclusion",
          body:
            "<p>The right choice among these eCommerce POS Reviews USA retailers can rely on comes down to your platform, your inventory complexity, and your transaction volume. Shopify sellers get the smoothest experience with Shopify POS, cost-conscious high-volume merchants should take a hard look at Helcim, and retailers scaling past a handful of locations will find Revel Systems or Lightspeed worth the investment. Whichever direction fits your business, compare at least two providers side by side using the table above before committing to a contract or hardware purchase.</p>",
        },
      ],
    }),
    cta({
      heading: "Not sure which POS fits your store?",
      body: "Filter the full directory by sales channel, pricing model, and the integrations you already run.",
      buttonLabel: "Compare processors",
      buttonUrl: "/processors",
    }),
  ],
};

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

async function upsertPageSeoRoute(opts: {
  pageKey: string;
  title: string;
  path: string;
  seo?: SeoSpec;
  faqs?: { question: string; answer: string }[];
  blocks?: BlockSpec[];
  /** Merge into whatever keywords the record already carries instead of replacing. */
  mergeKeywordsInto?: boolean;
}) {
  const existing = await PageSeo.findOne({ pageKey: opts.pageKey }).lean();

  const seoSpec: SeoSpec = { ...opts.seo };
  if (opts.mergeKeywordsInto && seoSpec.keywords) {
    seoSpec.keywords = mergeKeywords(existing?.seo?.keywords, seoSpec.keywords);
  }

  const set: Record<string, unknown> = {
    path: opts.path,
    kind: "route",
    ...(opts.seo ? seoSet(opts.pageKey, seoSpec) : {}),
    ...(opts.faqs ? { faqs: checkFaqs(opts.pageKey, opts.faqs) } : {}),
    ...(opts.blocks ? { blocks: prepareBlocks(opts.pageKey, opts.blocks) } : {}),
  };

  if (DRY_RUN) {
    log(
      `  [dry-run] PageSeo ${opts.pageKey} (${opts.path}) ${existing ? "update" : "insert"}: ${Object.keys(set).join(", ")}`,
    );
    return;
  }

  await PageSeo.updateOne(
    { pageKey: opts.pageKey },
    // `title` is the admin's own label for the record, so it is set once at
    // creation and never rewritten by a reseed.
    { $set: set, $setOnInsert: { title: opts.title, isPublished: true } },
    { upsert: true },
  );
  log(`  ${existing ? "updated" : "created"} PageSeo ${opts.pageKey} (${opts.path})`);
}

async function upsertLanding(spec: LandingSpec) {
  // Validate the identity half through the same schema the admin's create form
  // uses, so a path this script writes is one the UI would also accept.
  const identity = pageSeoCreate.parse({
    title: spec.title,
    path: spec.path,
    heading: spec.heading,
    subheading: spec.subheading,
    isPublished: true,
  });

  const set: Record<string, unknown> = {
    title: identity.title,
    path: identity.path,
    pageKey: identity.pageKey,
    kind: "landing",
    heading: identity.heading,
    subheading: identity.subheading,
    isPublished: true,
    ...seoSet(spec.pageKey, spec.seo),
    faqs: checkFaqs(spec.pageKey, spec.faqs),
    blocks: prepareBlocks(spec.pageKey, spec.blocks),
  };

  const existing = await PageSeo.findOne({ pageKey: identity.pageKey }).lean();

  if (DRY_RUN) {
    log(
      `  [dry-run] landing ${identity.path} ${existing ? "update" : "insert"}: ${(set.blocks as unknown[]).length} blocks, ${spec.faqs.length} FAQs`,
    );
    return;
  }

  await PageSeo.updateOne({ pageKey: identity.pageKey }, { $set: set }, { upsert: true });
  log(`  ${existing ? "updated" : "created"} landing page ${identity.path}`);
}

async function updateCategory(
  slug: string,
  opts: { seo: SeoSpec; faqs: { question: string; answer: string }[]; blocks: (intro?: string) => BlockSpec[] },
) {
  const doc = await Category.findOne({ slug }).select("introContent seo").lean();
  if (!doc) {
    log(`  skipped category ${slug} (not found). Run \`npm run seed\` first`);
    return;
  }

  const introContent = (doc as { introContent?: string }).introContent;
  const blocks = prepareBlocks(`category:${slug}`, opts.blocks(introContent));
  const set: Record<string, unknown> = {
    ...seoSet(`category:${slug}`, {
      ...opts.seo,
      keywords: mergeKeywords(doc.seo?.keywords, opts.seo.keywords ?? []),
    }),
    faqs: checkFaqs(`category:${slug}`, opts.faqs),
    blocks,
  };

  if (DRY_RUN) {
    log(`  [dry-run] category ${slug}: ${blocks?.length} blocks, ${opts.faqs.length} FAQs`);
    return;
  }
  await Category.updateOne({ slug }, { $set: set });
  log(`  updated category ${slug}`);
}

async function updateProcessor(
  slug: string,
  opts: {
    seo?: SeoSpec;
    keywords?: string[];
    faqs?: { question: string; answer: string }[];
    blocks: (longDescription?: string) => BlockSpec[];
  },
) {
  const doc = await Processor.findOne({ slug }).select("longDescription seo faqs").lean();
  if (!doc) {
    log(`  skipped processor ${slug} (not found). Run \`npm run seed\` first`);
    return;
  }

  const longDescription = (doc as { longDescription?: string }).longDescription;
  const blocks = prepareBlocks(`processor:${slug}`, opts.blocks(longDescription));

  // Meta title/description are only written when the doc supplies them. Stripe's
  // live copy was tuned in the admin after the last seed (see NOTES); silently
  // reverting it to a script literal is exactly the clobber this file avoids.
  const seoSpec: SeoSpec = {
    ...opts.seo,
    ...(opts.keywords ? { keywords: mergeKeywords(doc.seo?.keywords, opts.keywords) } : {}),
  };

  const set: Record<string, unknown> = {
    ...seoSet(`processor:${slug}`, seoSpec),
    blocks,
    // Only add FAQs where there are none; an existing set is editorial work.
    ...(opts.faqs && !doc.faqs?.length
      ? { faqs: checkFaqs(`processor:${slug}`, opts.faqs) }
      : {}),
  };

  if (DRY_RUN) {
    log(`  [dry-run] processor ${slug}: ${blocks?.length} blocks, keys ${Object.keys(set).join(", ")}`);
    return;
  }
  await Processor.updateOne({ slug }, { $set: set });
  log(`  updated processor ${slug}`);
}

/**
 * The eCommerce POS USA content was previously started as a Category, which puts
 * it at `/category/ecommerce-pos-reviews-usa`. The doc specifies the root slug,
 * and that is where the full page now lives, so the category is a near-duplicate
 * competing for the same query.
 *
 * A 308 to the landing page is the right consolidation. A canonical is only a
 * hint, and a noindex would remove the old URL while passing nothing on;
 * a redirect hands over whatever the two weeks of indexing earned and stops the
 * two pages competing outright. Nothing is deleted: the category document, its
 * FAQs and its intro copy all stay, and clearing `seo.redirectTo` in the admin
 * brings the page straight back.
 */
async function redirectDuplicateCategory(slug: string, to: string) {
  const doc = await Category.findOne({ slug }).select("slug seo").lean();
  if (!doc) return;
  if (DRY_RUN) {
    log(`  [dry-run] category ${slug}: set seo.redirectTo=${to}, clear stale noindex`);
    return;
  }
  await Category.updateOne(
    { slug },
    {
      // The earlier pass noindexed this record. A redirected URL should not ALSO
      // carry noindex: the 308 is the instruction, and a noindex on the way to
      // it just muddies what the crawler is told.
      $set: { "seo.redirectTo": to },
      $unset: { "seo.robotsIndex": "", "seo.robotsFollow": "" },
    },
  );
  log(`  redirected duplicate category ${slug} to ${to}`);
}

/**
 * The homepage "how it works" copy lives in SiteSettings, where `audit:meta`
 * can't see it — the audit only covers meta titles and descriptions. This is the
 * one en dash left in rendered body copy.
 */
async function fixHomepageDashes() {
  const settings = await SiteSettings.findOne().select("homepage.howItWorks.steps").lean();
  const steps = (settings as { homepage?: { howItWorks?: { steps?: { body?: string }[] } } } | null)
    ?.homepage?.howItWorks?.steps;
  if (!Array.isArray(steps)) return;

  const fixed = steps.map((s) => ({
    ...s,
    // A dash between digits is a range, so it wants "to" rather than a comma.
    body: typeof s.body === "string" ? s.body.replace(/(\d)\s*[–—―]\s*(\d)/g, "$1 to $2") : s.body,
  }));
  const changed = fixed.some((s, i) => s.body !== steps[i]?.body);
  if (!changed) {
    log("  homepage steps already free of dashes");
    return;
  }
  if (DRY_RUN) {
    log("  [dry-run] rewrite en dash ranges in homepage.howItWorks.steps");
    return;
  }
  await SiteSettings.updateOne({}, { $set: { "homepage.howItWorks.steps": fixed } });
  log("  rewrote en dash ranges in homepage steps");
}

/** The homepage renders PageSeo blocks only when its "content" section is on. */
async function ensureHomepageContentSection() {
  const settings = await SiteSettings.findOne().select("homepage").lean();
  const enabled = (settings as { homepage?: { content?: { enabled?: boolean } } } | null)?.homepage
    ?.content?.enabled;
  if (enabled !== false) {
    log("  homepage content section already enabled");
    return;
  }
  if (DRY_RUN) {
    log("  [dry-run] enable homepage.content.enabled (currently off, blocks would not render)");
    return;
  }
  await SiteSettings.updateOne({}, { $set: { "homepage.content.enabled": true } });
  log("  enabled homepage content section");
}

// ---------------------------------------------------------------------------

async function main() {
  await connectToDatabase();
  if (DRY_RUN) log("DRY RUN. Nothing will be written.\n");

  log("Homepage");
  await upsertPageSeoRoute({
    pageKey: "home",
    title: "Homepage",
    path: "/",
    seo: { keywords: HOME_KEYWORDS },
    mergeKeywordsInto: true,
    blocks: HOME_BLOCKS,
  });
  await ensureHomepageContentSection();
  await fixHomepageDashes();

  log("\nACH payment processing");
  await upsertPageSeoRoute({
    pageKey: "payment-processors-ach",
    title: "ACH payment processing",
    path: "/payment-processors/ach",
    seo: ACH_SEO,
    faqs: ACH_FAQS,
    blocks: ACH_BLOCKS,
  });

  log("\nCategories");
  await updateCategory("high-risk", {
    seo: HIGH_RISK_SEO,
    faqs: HIGH_RISK_FAQS,
    blocks: HIGH_RISK_BLOCKS,
  });
  await updateCategory("subscriptions", {
    seo: SUBSCRIPTIONS_SEO,
    faqs: SUBSCRIPTIONS_FAQS,
    blocks: SUBSCRIPTIONS_BLOCKS,
  });

  log("\nProcessors");
  await updateProcessor("stripe", { keywords: STRIPE_KEYWORDS, blocks: STRIPE_BLOCKS });
  await updateProcessor("square", {
    seo: SQUARE_SEO,
    keywords: SQUARE_SEO.keywords,
    faqs: SQUARE_FAQS,
    blocks: SQUARE_BLOCKS,
  });

  log("\nGlossary and compare");
  await upsertPageSeoRoute({
    pageKey: "glossary",
    title: "Payments glossary",
    path: "/glossary",
    seo: GLOSSARY_SEO,
    faqs: GLOSSARY_FAQS,
    blocks: GLOSSARY_BLOCKS,
  });
  await upsertPageSeoRoute({
    pageKey: "compare",
    title: "Compare processors",
    path: "/compare",
    seo: COMPARE_SEO,
    mergeKeywordsInto: true,
    blocks: COMPARE_BLOCKS,
  });

  log("\nLanding pages");
  await upsertLanding(CA_LANDING);
  await upsertLanding(US_LANDING);
  await redirectDuplicateCategory("ecommerce-pos-reviews-usa", US_LANDING.path);

  log(
    DRY_RUN
      ? "\nDry run complete. Re-run without --dry-run to apply."
      : "\nDone. Everything above is editable in admin under Pages & SEO, Categories and Processors.",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Doc content seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
