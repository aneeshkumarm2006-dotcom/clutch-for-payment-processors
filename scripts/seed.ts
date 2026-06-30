import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectToDatabase } from "@/lib/db";
import { BlogPost, Category, Lead, Processor, Review, SiteSettings, Submission, User } from "@/models";
import { ensureUniqueSlug } from "@/models/slug";
import { recomputeProcessorRatings } from "@/lib/ratings";
import type {
  Feature,
  Integration,
  PaymentMethod,
  PricingModel,
  ReviewCompanySize,
} from "@/lib/enums";

/**
 * scripts/seed.ts — demoable dataset (PRD §17).
 *
 *   npm run seed
 *
 * Idempotent: categories, processors, and blog posts are UPSERTED by slug, so
 * re-running refreshes them without creating duplicates and without touching
 * admin-created content. Seeded reviews are tagged `source: "import"` and
 * replaced wholesale each run, then ratings are recomputed via lib/ratings.ts.
 *
 * ⚠️  Rates/fees below were researched against each provider's official pricing
 *     and reputable third-party sources as of June 2026 (US standard pricing;
 *     Razorpay/PayU use India/INR pricing). Pricing changes frequently and some
 *     fields (enterprise/negotiated rates, card-present rates for online-first
 *     gateways) are not officially published — re-verify before going live.
 *     Reviews, leads, and submissions are fictional demo data.
 */

// ---------------------------------------------------------------------------
// Categories (~10 across the §8.2 types)
// ---------------------------------------------------------------------------
interface SeedCategory {
  name: string;
  slug: string;
  type: "use-case" | "industry" | "region" | "feature" | "business-size";
  shortDescription: string;
  introContent: string;
}

const CATEGORIES: SeedCategory[] = [
  {
    name: "E-commerce Payment Processors",
    slug: "ecommerce",
    type: "use-case",
    shortDescription: "Accept online card payments with checkout, APIs, and fraud tools.",
    introContent:
      "<p>The right e-commerce processor balances transparent per-transaction pricing with the checkout experience, payment methods, and fraud tooling your store needs. Compare online card rates, supported wallets, and platform integrations below.</p>",
  },
  {
    name: "In-Person & Retail (POS)",
    slug: "retail-pos",
    type: "use-case",
    shortDescription: "Card-present payments with terminals, readers, and tap-to-pay.",
    introContent:
      "<p>For shops, markets, and pop-ups, in-person processors combine competitive card-present rates with hardware, fast payouts, and tap-to-pay. Compare the options for taking payments at the counter or on the go.</p>",
  },
  {
    name: "Subscriptions & SaaS",
    slug: "subscriptions",
    type: "use-case",
    shortDescription: "Recurring billing, dunning, and usage-based pricing.",
    introContent:
      "<p>Subscription businesses need recurring billing, smart retries, proration, and usage-based pricing — not just a card form. Compare processors on their billing engines and developer tooling.</p>",
  },
  {
    name: "High-Risk Merchants",
    slug: "high-risk",
    type: "use-case",
    shortDescription: "Processors that support higher-risk industries and chargebacks.",
    introContent:
      "<p>If you've been turned away or frozen by a mainstream processor, high-risk-friendly providers underwrite industries others avoid — often with rolling reserves and chargeback tooling. Compare what's on offer.</p>",
  },
  {
    name: "International & Cross-Border",
    slug: "international",
    type: "region",
    shortDescription: "Multi-currency acceptance and local payment methods worldwide.",
    introContent:
      "<p>Selling across borders means accepting local payment methods, settling in multiple currencies, and minimising FX costs. Compare processors built for global reach.</p>",
  },
  {
    name: "Marketplaces & Platforms",
    slug: "marketplaces",
    type: "use-case",
    shortDescription: "Split payments, payouts to sellers, and onboarding.",
    introContent:
      "<p>Marketplaces need to split a single payment across many sellers, onboard sub-merchants, and handle payouts and compliance. Compare processors with first-class platform and split-payment support.</p>",
  },
  {
    name: "Small Business",
    slug: "small-business",
    type: "business-size",
    shortDescription: "Simple, predictable pricing with no long-term contracts.",
    introContent:
      "<p>Small businesses are best served by simple, predictable pricing, quick setup, and no lock-in. Compare processors that won't bury you in monthly fees or annual contracts.</p>",
  },
  {
    name: "Restaurants & Hospitality",
    slug: "restaurants",
    type: "industry",
    shortDescription: "Tipping, table service, and POS built for food & drink.",
    introContent:
      "<p>Restaurants need tipping, fast service, and POS hardware that survives a busy Friday night. Compare processors tailored to food, drink, and hospitality.</p>",
  },
  {
    name: "Nonprofits",
    slug: "nonprofits",
    type: "industry",
    shortDescription: "Discounted rates and recurring donation tooling.",
    introContent:
      "<p>Nonprofits can often access discounted processing and donation-specific features like recurring giving and cover-the-fee options. Compare processors that support mission-driven organisations.</p>",
  },
  {
    name: "For Developers",
    slug: "developers",
    type: "feature",
    shortDescription: "Great APIs, SDKs, webhooks, and documentation.",
    introContent:
      "<p>Developer-first processors live and die by their APIs, SDKs, sandbox, and docs. Compare the options if you're building payments into your own product.</p>",
  },
];

// ---------------------------------------------------------------------------
// Processors (10 — fully populated; SAMPLE DATA)
// ---------------------------------------------------------------------------
interface SeedProcessor {
  name: string;
  slug: string;
  logo: string;
  website: string;
  affiliateUrl?: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  foundedYear: number;
  headquarters: string;
  companySize: "1-50" | "51-250" | "251-1000" | "1000+";
  supportedRegions: string[];
  pricingModel: PricingModel[];
  pricingSummary: string;
  fees: Record<string, string>;
  contractType: "month-to-month" | "annual" | "long-term" | "no-contract";
  freeTrial: boolean;
  payoutTime: "instant" | "same-day" | "next-day" | "2-day" | "t+2" | "t+3" | "varies";
  paymentMethods: PaymentMethod[];
  integrations: Integration[];
  currencies: string;
  features: Feature[];
  pciLevel: "Level 1" | "Level 2" | "Level 3" | "Level 4" | "N/A";
  highRiskFriendly: boolean;
  categorySlugs: string[];
  bestFor: string[];
  industries: string[];
  pros: string[];
  cons: string[];
  editorScore: number;
  listingTier: "free" | "verified" | "premier";
  isVerified: boolean;
  isSponsored: boolean;
  sponsorRank?: number;
  isFeatured: boolean;
  seo: { metaTitle?: string; metaDescription?: string };
}

// Logos are fetched live from Clearbit (major brands) for the demo.
const logo = (domain: string) => `https://logo.clearbit.com/${domain}`;

const PROCESSORS: SeedProcessor[] = [
  {
    name: "Stripe",
    slug: "stripe",
    logo: logo("stripe.com"),
    website: "https://stripe.com",
    tagline: "Developer-first payments infrastructure for internet businesses.",
    shortDescription:
      "A powerful, API-first platform for online payments, subscriptions, and marketplaces with best-in-class developer tooling.",
    longDescription:
      "<p>Stripe is a developer-first payments platform that powers everything from solo SaaS apps to global marketplaces. Its APIs, SDKs, and documentation are widely considered the industry benchmark.</p><h3>Who it's for</h3><p>Teams that want to build a custom payment flow, manage subscriptions with Billing, or run a platform with Connect. Less ideal if you want a no-code, in-person-first setup.</p>",
    foundedYear: 2010,
    headquarters: "San Francisco, CA, USA",
    companySize: "1000+",
    supportedRegions: ["US", "CA", "EU", "UK", "Global"],
    pricingModel: ["flat-rate", "custom-quote"],
    pricingSummary: "2.9% + 30¢ online, no monthly fee. Volume and custom pricing available.",
    fees: {
      onlineCardRate: "2.9% + $0.30",
      inPersonCardRate: "2.7% + $0.05",
      keyedInRate: "3.4% + $0.30",
      internationalRate: "+1.5%",
      achRate: "0.8% (cap $5)",
      monthlyFee: "$0",
      chargebackFee: "$15",
      refundPolicy: "Processing fee not returned on refunds",
    },
    contractType: "no-contract",
    freeTrial: false,
    payoutTime: "2-day",
    paymentMethods: [
      "visa",
      "mastercard",
      "amex",
      "discover",
      "apple-pay",
      "google-pay",
      "ach",
      "sepa",
      "bnpl",
      "wallets",
    ],
    integrations: [
      "api",
      "hosted-checkout",
      "drop-in-ui",
      "shopify",
      "woocommerce",
      "mobile-sdk",
      "payment-links",
      "invoicing",
    ],
    currencies: "135+ currencies",
    features: [
      "recurring-billing",
      "multi-currency",
      "fraud-protection",
      "3d-secure",
      "tokenization",
      "marketplace-split",
      "reporting-dashboard",
      "developer-friendly",
    ],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["ecommerce", "subscriptions", "developers", "international", "marketplaces"],
    bestFor: ["Developers", "SaaS", "Marketplaces"],
    industries: ["SaaS", "Retail", "Marketplaces"],
    pros: [
      "Outstanding API, SDKs, and documentation",
      "Deep subscription and marketplace tooling",
      "Transparent flat-rate pricing with no monthly fee",
    ],
    cons: ["Support can be slow on lower tiers", "Requires development resources to get the most out of it"],
    editorScore: 4.8,
    listingTier: "premier",
    isVerified: true,
    isSponsored: true,
    sponsorRank: 1,
    isFeatured: true,
    seo: {
      metaTitle: "Stripe review — pricing, fees & features",
      metaDescription:
        "Is Stripe right for your business? Compare Stripe's pricing, payment methods, and merchant reviews.",
    },
  },
  {
    name: "PayPal",
    slug: "paypal",
    logo: logo("paypal.com"),
    website: "https://www.paypal.com",
    tagline: "The widely recognised wallet and checkout button merchants trust.",
    shortDescription:
      "A globally recognised payments brand offering express checkout, buyer trust, and broad reach with simple flat-rate pricing.",
    longDescription:
      "<p>PayPal is one of the most recognised names in online payments. Its express checkout button can lift conversion through buyer familiarity and trust, and setup is fast for small businesses.</p><h3>Who it's for</h3><p>Merchants who want a trusted checkout option live quickly, especially for cross-border consumer sales. Costs can run higher than interchange-plus alternatives at scale.</p>",
    foundedYear: 1998,
    headquarters: "San Jose, CA, USA",
    companySize: "1000+",
    supportedRegions: ["US", "CA", "EU", "UK", "Global"],
    pricingModel: ["flat-rate"],
    pricingSummary: "3.49% + 49¢ for PayPal checkout; 2.99% for standard cards. No monthly fee.",
    fees: {
      onlineCardRate: "2.99% + $0.49",
      inPersonCardRate: "2.29% + $0.09",
      keyedInRate: "3.49% + $0.09",
      internationalRate: "+1.5%",
      achRate: "0.8% (cap $5)",
      monthlyFee: "$0",
      chargebackFee: "$20",
      refundPolicy: "Fees not returned on refunds",
    },
    contractType: "no-contract",
    freeTrial: false,
    payoutTime: "instant",
    paymentMethods: ["visa", "mastercard", "amex", "discover", "paypal", "bnpl", "wallets"],
    integrations: ["hosted-checkout", "shopify", "woocommerce", "bigcommerce", "payment-links", "invoicing"],
    currencies: "100+ currencies",
    features: ["fraud-protection", "chargeback-protection", "reporting-dashboard", "recurring-billing"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["ecommerce", "small-business", "international"],
    bestFor: ["Small business", "Cross-border", "Quick setup"],
    industries: ["Retail", "Services"],
    pros: [
      "Trusted brand can lift checkout conversion",
      "Fast setup with no monthly fee",
      "Strong buyer and seller protection",
    ],
    cons: ["Higher headline rates at scale", "Account holds and reserves can be disruptive"],
    editorScore: 4,
    listingTier: "free",
    isVerified: false,
    isSponsored: false,
    isFeatured: true,
    seo: {},
  },
  {
    name: "Square",
    slug: "square",
    logo: logo("squareup.com"),
    website: "https://squareup.com",
    tagline: "All-in-one point of sale and payments for in-person businesses.",
    shortDescription:
      "A complete POS-plus-payments ecosystem with free software, sleek hardware, and flat-rate pricing — ideal for retail and food.",
    longDescription:
      "<p>Square pairs flat-rate payments with a genuinely good free point-of-sale app and affordable hardware. It's a favourite for cafés, markets, and small retailers who want one tidy system.</p><h3>Who it's for</h3><p>In-person and omnichannel small businesses that value ease of use over deep customisation.</p>",
    foundedYear: 2009,
    headquarters: "Oakland, CA, USA",
    companySize: "1000+",
    supportedRegions: ["US", "CA", "UK", "EU"],
    pricingModel: ["flat-rate"],
    pricingSummary: "2.6% + 15¢ in person, 2.9% + 30¢ online. No monthly fee on the free plan.",
    fees: {
      onlineCardRate: "2.9% + $0.30",
      inPersonCardRate: "2.6% + $0.15",
      keyedInRate: "3.5% + $0.15",
      achRate: "1% ($1 min)",
      monthlyFee: "$0",
      chargebackFee: "$0",
      refundPolicy: "Processing fee not returned on refunds",
    },
    contractType: "no-contract",
    freeTrial: true,
    payoutTime: "next-day",
    paymentMethods: ["visa", "mastercard", "amex", "discover", "apple-pay", "google-pay", "wallets"],
    integrations: ["hosted-checkout", "pos-hardware", "woocommerce", "wix", "payment-links", "invoicing", "virtual-terminal"],
    currencies: "Multiple (by region)",
    features: ["tap-to-pay", "reporting-dashboard", "recurring-billing", "fraud-protection"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["retail-pos", "small-business", "restaurants"],
    bestFor: ["Retail", "Restaurants", "Small business"],
    industries: ["Retail", "Restaurants", "Services"],
    pros: ["Excellent free POS software", "Affordable, well-designed hardware", "Predictable flat-rate pricing"],
    cons: ["Account stability concerns for some sellers", "Less suited to complex online needs"],
    editorScore: 4.5,
    listingTier: "verified",
    isVerified: true,
    isSponsored: false,
    isFeatured: true,
    seo: {},
  },
  {
    name: "Adyen",
    slug: "adyen",
    logo: logo("adyen.com"),
    website: "https://www.adyen.com",
    tagline: "Enterprise-grade global payments on a single platform.",
    shortDescription:
      "An enterprise platform unifying online, in-app, and in-person payments worldwide with interchange-plus pricing.",
    longDescription:
      "<p>Adyen is built for large and global businesses that want a single platform across channels and regions, with transparent interchange-plus pricing and powerful data.</p><h3>Who it's for</h3><p>Mid-market and enterprise merchants processing significant volume across borders.</p>",
    foundedYear: 2006,
    headquarters: "Amsterdam, Netherlands",
    companySize: "1000+",
    supportedRegions: ["EU", "UK", "US", "Global"],
    pricingModel: ["interchange-plus"],
    pricingSummary: "Interchange++ : $0.13 + interchange + 0.60% per card transaction. No monthly or setup fee; a minimum monthly invoice applies.",
    fees: {
      onlineCardRate: "Interchange + 0.60% + $0.13",
      inPersonCardRate: "Interchange + 0.60% + $0.13",
      internationalRate: "Varies by method",
      achRate: "$0.27 + $0.13",
      monthlyFee: "$0",
      monthlyMinimum: "$120 invoice minimum",
      chargebackFee: "$15",
      refundPolicy: "Processing fee not returned on refunds",
    },
    contractType: "annual",
    freeTrial: false,
    payoutTime: "t+2",
    paymentMethods: ["visa", "mastercard", "amex", "apple-pay", "google-pay", "ach", "sepa", "bnpl", "wallets"],
    integrations: ["api", "hosted-checkout", "drop-in-ui", "mobile-sdk", "pos-hardware", "virtual-terminal"],
    currencies: "150+ currencies",
    features: ["multi-currency", "fraud-protection", "3d-secure", "tokenization", "reporting-dashboard", "developer-friendly"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["ecommerce", "international", "marketplaces"],
    bestFor: ["Enterprise", "Global", "Omnichannel"],
    industries: ["Retail", "Travel", "SaaS"],
    pros: ["Single platform across channels and regions", "Transparent interchange-plus pricing", "Rich data and risk tooling"],
    cons: ["Built for scale — overkill for small merchants", "Requires technical integration"],
    editorScore: 4.6,
    listingTier: "premier",
    isVerified: true,
    isSponsored: false,
    isFeatured: false,
    seo: {},
  },
  {
    name: "Braintree",
    slug: "braintree",
    logo: logo("braintreepayments.com"),
    website: "https://www.braintreepayments.com",
    tagline: "A PayPal company offering developer-friendly online payments.",
    shortDescription:
      "A flexible, developer-friendly gateway (a PayPal company) with strong support for cards, PayPal, and Venmo.",
    longDescription:
      "<p>Braintree, owned by PayPal, offers a developer-friendly gateway with native PayPal and Venmo acceptance alongside cards and wallets — a popular choice for online businesses already in the PayPal ecosystem.</p>",
    foundedYear: 2007,
    headquarters: "Chicago, IL, USA",
    companySize: "251-1000",
    supportedRegions: ["US", "CA", "EU", "UK", "Global"],
    pricingModel: ["flat-rate"],
    pricingSummary: "2.89% + 29¢ per transaction (standard). No monthly fee.",
    fees: {
      onlineCardRate: "2.89% + $0.29",
      internationalRate: "+1% (currency) +1% (non-US card)",
      achRate: "0.75% (cap $5)",
      monthlyFee: "$0",
      chargebackFee: "$15",
      refundPolicy: "Processing fee not returned on refunds",
    },
    contractType: "no-contract",
    freeTrial: false,
    payoutTime: "2-day",
    paymentMethods: ["visa", "mastercard", "amex", "discover", "apple-pay", "google-pay", "paypal", "ach", "wallets"],
    integrations: ["api", "drop-in-ui", "mobile-sdk", "woocommerce", "payment-links"],
    currencies: "130+ currencies",
    features: ["recurring-billing", "multi-currency", "fraud-protection", "3d-secure", "tokenization", "developer-friendly"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["ecommerce", "subscriptions", "developers"],
    bestFor: ["Developers", "SaaS", "PayPal users"],
    industries: ["SaaS", "Retail"],
    pros: ["Native PayPal and Venmo acceptance", "Solid developer tooling and drop-in UI", "No monthly fee"],
    cons: ["Support tied to PayPal's processes", "Fewer in-person options"],
    editorScore: 4.2,
    listingTier: "verified",
    isVerified: true,
    isSponsored: false,
    isFeatured: false,
    seo: {},
  },
  {
    name: "Authorize.net",
    slug: "authorize-net",
    logo: logo("authorize.net"),
    website: "https://www.authorize.net",
    tagline: "A long-established payment gateway for online and MOTO payments.",
    shortDescription:
      "A veteran gateway (a Visa solution) pairing card processing with a virtual terminal and recurring billing for traditional businesses.",
    longDescription:
      "<p>Authorize.net is one of the longest-running gateways, well suited to businesses that want a virtual terminal, recurring billing, and the option to bring their own merchant account.</p>",
    foundedYear: 1996,
    headquarters: "Foster City, CA, USA",
    companySize: "251-1000",
    supportedRegions: ["US", "CA", "UK", "EU"],
    pricingModel: ["flat-rate", "subscription"],
    pricingSummary: "$25/mo gateway + 2.9% + 30¢, or gateway-only for your own merchant account.",
    fees: {
      onlineCardRate: "2.9% + $0.30",
      keyedInRate: "2.9% + $0.30",
      achRate: "0.75% (eCheck)",
      monthlyFee: "$25",
      setupFee: "$0",
      chargebackFee: "$25",
      refundPolicy: "Transaction fee not returned",
    },
    contractType: "month-to-month",
    freeTrial: false,
    payoutTime: "varies",
    paymentMethods: ["visa", "mastercard", "amex", "discover", "apple-pay", "ach", "wallets"],
    integrations: ["api", "hosted-checkout", "virtual-terminal", "woocommerce", "invoicing"],
    currencies: "Multiple (via merchant account)",
    features: ["recurring-billing", "fraud-protection", "tokenization", "reporting-dashboard"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["ecommerce", "small-business"],
    bestFor: ["Traditional businesses", "MOTO", "Virtual terminal"],
    industries: ["Retail", "Services"],
    pros: ["Mature, stable gateway", "Bring-your-own merchant account option", "Good virtual terminal and recurring billing"],
    cons: ["Dated interface", "Monthly gateway fee on top of processing"],
    editorScore: 3.8,
    listingTier: "free",
    isVerified: false,
    isSponsored: false,
    isFeatured: false,
    seo: {},
  },
  {
    name: "Helcim",
    slug: "helcim",
    logo: logo("helcim.com"),
    website: "https://www.helcim.com",
    tagline: "Transparent interchange-plus pricing with automatic volume discounts.",
    shortDescription:
      "A merchant-friendly processor with interchange-plus pricing, no monthly fees, and automatic volume discounts — great for growing SMBs.",
    longDescription:
      "<p>Helcim offers transparent interchange-plus pricing that gets cheaper automatically as you grow, with no monthly fees or contracts. It covers online, in-person, and invoicing in one account.</p>",
    foundedYear: 2006,
    headquarters: "Calgary, AB, Canada",
    companySize: "51-250",
    supportedRegions: ["US", "CA"],
    pricingModel: ["interchange-plus"],
    pricingSummary: "Interchange + 0.40% + 8¢ in person, + 0.50% + 25¢ online (drops with volume). No monthly fee.",
    fees: {
      onlineCardRate: "Interchange + 0.50% + $0.25",
      inPersonCardRate: "Interchange + 0.40% + $0.08",
      achRate: "0.5% + $0.25 (cap $6)",
      monthlyFee: "$0",
      chargebackFee: "$15",
      refundPolicy: "Chargeback fee refunded if dispute won",
    },
    contractType: "no-contract",
    freeTrial: false,
    payoutTime: "next-day",
    paymentMethods: ["visa", "mastercard", "amex", "discover", "apple-pay", "google-pay", "ach"],
    integrations: ["api", "hosted-checkout", "pos-hardware", "virtual-terminal", "invoicing", "payment-links"],
    currencies: "USD, CAD",
    features: ["recurring-billing", "tap-to-pay", "reporting-dashboard", "no-rolling-reserve", "fraud-protection"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["small-business", "retail-pos", "ecommerce"],
    bestFor: ["Growing SMBs", "Transparent pricing", "Omnichannel"],
    industries: ["Retail", "Services", "B2B"],
    pros: ["Transparent interchange-plus with automatic volume discounts", "No monthly fees or contracts", "Fees refunded on refunds"],
    cons: ["US and Canada only", "Fewer third-party integrations than the giants"],
    editorScore: 4.7,
    listingTier: "verified",
    isVerified: true,
    isSponsored: false,
    isFeatured: true,
    seo: {},
  },
  {
    name: "Stax",
    slug: "stax",
    logo: logo("staxpayments.com"),
    website: "https://staxpayments.com",
    tagline: "Subscription-style pricing that passes interchange straight through.",
    shortDescription:
      "A membership-pricing processor: pay a flat monthly subscription plus direct-cost interchange, which can save high-volume merchants.",
    longDescription:
      "<p>Stax uses a subscription model — a flat monthly fee plus interchange at cost with no percentage markup — which can be very cost-effective for higher-volume merchants.</p>",
    foundedYear: 2014,
    headquarters: "Orlando, FL, USA",
    companySize: "251-1000",
    supportedRegions: ["US"],
    pricingModel: ["subscription", "interchange-plus"],
    pricingSummary: "From $99/mo + interchange + small per-transaction fee. No percentage markup.",
    fees: {
      onlineCardRate: "Interchange + $0.15",
      inPersonCardRate: "Interchange + $0.08",
      achRate: "1% (cap $10)",
      monthlyFee: "$99",
      monthlyMinimum: "None",
      chargebackFee: "$25",
      refundPolicy: "Interchange not returned",
    },
    contractType: "month-to-month",
    freeTrial: false,
    payoutTime: "next-day",
    paymentMethods: ["visa", "mastercard", "amex", "discover", "apple-pay", "google-pay", "ach"],
    integrations: ["api", "hosted-checkout", "pos-hardware", "virtual-terminal", "invoicing"],
    currencies: "USD",
    features: ["recurring-billing", "reporting-dashboard", "tap-to-pay", "fraud-protection"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["small-business", "retail-pos"],
    bestFor: ["High volume", "Predictable cost", "Established businesses"],
    industries: ["Retail", "Healthcare", "Services"],
    pros: ["No percentage markup on interchange", "Predictable flat monthly cost", "Good analytics suite"],
    cons: ["Monthly fee hurts low-volume merchants", "US only"],
    editorScore: 4.1,
    listingTier: "verified",
    isVerified: false,
    isSponsored: false,
    isFeatured: false,
    seo: {},
  },
  {
    name: "Razorpay",
    slug: "razorpay",
    logo: logo("razorpay.com"),
    website: "https://razorpay.com",
    tagline: "India's developer-friendly payments and business banking suite.",
    shortDescription:
      "A leading Indian payments platform with UPI, netbanking, cards, and wallets, plus a full payments and payouts API.",
    longDescription:
      "<p>Razorpay is a leading Indian payment gateway with deep support for UPI, netbanking, cards, and wallets, plus subscriptions, payment links, and payouts — all behind a clean developer API.</p>",
    foundedYear: 2014,
    headquarters: "Bengaluru, India",
    companySize: "1000+",
    supportedRegions: ["IN"],
    pricingModel: ["flat-rate"],
    pricingSummary: "2% per transaction standard (UPI often lower). No setup or annual fee.",
    fees: {
      onlineCardRate: "2%",
      internationalRate: "3%",
      monthlyFee: "₹0",
      setupFee: "₹0",
      refundPolicy: "Fee not returned on refunds",
    },
    contractType: "no-contract",
    freeTrial: false,
    payoutTime: "t+2",
    paymentMethods: ["visa", "mastercard", "amex", "upi", "netbanking", "wallets", "bnpl"],
    integrations: ["api", "hosted-checkout", "drop-in-ui", "woocommerce", "payment-links", "invoicing", "mobile-sdk"],
    currencies: "INR (+ international acceptance)",
    features: ["recurring-billing", "fraud-protection", "3d-secure", "reporting-dashboard", "developer-friendly"],
    pciLevel: "Level 1",
    highRiskFriendly: false,
    categorySlugs: ["ecommerce", "international", "developers", "subscriptions"],
    bestFor: ["India", "Developers", "UPI"],
    industries: ["SaaS", "Retail", "Services"],
    pros: ["Excellent UPI and local method support", "Clean API and dashboard", "Payouts and banking in one suite"],
    cons: ["Primarily India-focused", "International pricing higher"],
    editorScore: 4.5,
    listingTier: "verified",
    isVerified: true,
    isSponsored: true,
    sponsorRank: 2,
    isFeatured: false,
    seo: {},
  },
  {
    name: "PayU",
    slug: "payu",
    logo: logo("payu.com"),
    website: "https://payu.com",
    tagline: "Emerging-market payments across 50+ markets and local methods.",
    shortDescription:
      "A cross-border processor specialising in emerging markets, with broad local payment methods and high-risk acceptance.",
    longDescription:
      "<p>PayU focuses on emerging markets across Asia, Latin America, Central and Eastern Europe, and Africa, with deep local payment method coverage and underwriting for higher-risk sectors.</p>",
    foundedYear: 2002,
    headquarters: "Hoofddorp, Netherlands",
    companySize: "1000+",
    supportedRegions: ["IN", "EU", "Global"],
    pricingModel: ["custom-quote", "flat-rate"],
    pricingSummary: "Custom pricing by market and risk profile. Local methods supported widely.",
    fees: {
      onlineCardRate: "2% – 3% (by market)",
      internationalRate: "Varies by market",
      monthlyFee: "Varies",
      refundPolicy: "Varies by market",
    },
    contractType: "annual",
    freeTrial: false,
    payoutTime: "varies",
    paymentMethods: ["visa", "mastercard", "amex", "upi", "netbanking", "wallets", "bnpl"],
    integrations: ["api", "hosted-checkout", "drop-in-ui", "mobile-sdk", "payment-links"],
    currencies: "Local currencies across 50+ markets",
    features: ["multi-currency", "fraud-protection", "3d-secure", "chargeback-protection"],
    pciLevel: "Level 1",
    highRiskFriendly: true,
    categorySlugs: ["ecommerce", "international", "high-risk"],
    bestFor: ["Emerging markets", "Cross-border", "High-risk"],
    industries: ["Retail", "Travel", "Gaming"],
    pros: ["Deep local method coverage in emerging markets", "Supports higher-risk industries", "Single integration for many markets"],
    cons: ["Pricing is quote-based and opaque", "Onboarding can be slower"],
    editorScore: 3.9,
    listingTier: "free",
    isVerified: false,
    isSponsored: false,
    isFeatured: false,
    seo: {},
  },
];

// ---------------------------------------------------------------------------
// Review templates (rotated across processors → 4 per processor, SAMPLE DATA)
// ---------------------------------------------------------------------------
interface ReviewTemplate {
  reviewerName: string;
  reviewerTitle: string;
  companyName: string;
  companySize: ReviewCompanySize;
  industry: string;
  overallRating: number;
  subRatings: { easeOfUse: number; pricing: number; support: number; features: number; reliability: number };
  title: string;
  body: (name: string) => string;
  pros: string;
  cons: string;
  useCase: string;
  monthlyVolume: "<$10k" | "$10k-$50k" | "$50k-$250k" | "$250k-$1M" | "$1M+";
  isVerified: boolean;
}

const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    reviewerName: "Jordan Reyes",
    reviewerTitle: "Founder",
    companyName: "Northwind Goods",
    companySize: "11-50",
    industry: "Retail",
    overallRating: 5,
    subRatings: { easeOfUse: 5, pricing: 4, support: 4, features: 5, reliability: 5 },
    title: "Scaled with us from day one",
    body: (name) =>
      `We started taking payments with ${name} as a tiny shop and it has scaled with us without a hitch. Integration was straightforward and the dashboard gives us everything we need.`,
    pros: "Reliable, great dashboard, easy to integrate",
    cons: "Wished support was faster early on",
    useCase: "Online store checkout and refunds",
    monthlyVolume: "$50k-$250k",
    isVerified: true,
  },
  {
    reviewerName: "Priya Nair",
    reviewerTitle: "Head of Finance",
    companyName: "Lumen SaaS",
    companySize: "51-200",
    industry: "SaaS",
    overallRating: 4,
    subRatings: { easeOfUse: 4, pricing: 4, support: 3, features: 5, reliability: 4 },
    title: "Strong feature set, watch the fees",
    body: (name) =>
      `${name} handles our recurring billing reliably and the reporting is solid. Fees add up at our volume, so we negotiated custom pricing once we grew.`,
    pros: "Recurring billing, reporting, uptime",
    cons: "Standard pricing is steep at scale",
    useCase: "Subscription billing for a SaaS product",
    monthlyVolume: "$250k-$1M",
    isVerified: true,
  },
  {
    reviewerName: "Marcus Bell",
    reviewerTitle: "Owner",
    companyName: "Bell & Co Cafe",
    companySize: "1-10",
    industry: "Restaurants",
    overallRating: 5,
    subRatings: { easeOfUse: 5, pricing: 4, support: 4, features: 4, reliability: 5 },
    title: "Perfect for our counter",
    body: (name) =>
      `Setup took an afternoon and ${name} just works at the counter during the morning rush. Payouts are quick which really helps cash flow.`,
    pros: "Fast setup, quick payouts, reliable hardware",
    cons: "Would like more advanced reporting",
    useCase: "In-person card payments at a cafe",
    monthlyVolume: "$10k-$50k",
    isVerified: false,
  },
  {
    reviewerName: "Sofia Marchetti",
    reviewerTitle: "E-commerce Manager",
    companyName: "Atlas Apparel",
    companySize: "51-200",
    industry: "Retail",
    overallRating: 4,
    subRatings: { easeOfUse: 4, pricing: 3, support: 4, features: 4, reliability: 5 },
    title: "Dependable for cross-border sales",
    body: (name) =>
      `We sell internationally and ${name} handles multiple currencies and methods without surprises. Reconciliation is much easier than our old provider.`,
    pros: "Multi-currency, stable, good docs",
    cons: "FX and international fees could be clearer",
    useCase: "Cross-border online apparel sales",
    monthlyVolume: "$250k-$1M",
    isVerified: true,
  },
  {
    reviewerName: "David Okafor",
    reviewerTitle: "CTO",
    companyName: "Tradeline",
    companySize: "11-50",
    industry: "Marketplaces",
    overallRating: 5,
    subRatings: { easeOfUse: 4, pricing: 4, support: 4, features: 5, reliability: 5 },
    title: "The API made this easy",
    body: (name) =>
      `Building split payments for our marketplace would have taken months elsewhere. With ${name} the API and docs got us live in weeks. Webhooks are reliable.`,
    pros: "Great API, split payments, webhooks",
    cons: "Some advanced features need a sales call",
    useCase: "Split payments and payouts for a marketplace",
    monthlyVolume: "$1M+",
    isVerified: true,
  },
  {
    reviewerName: "Hannah Schmidt",
    reviewerTitle: "Operations Lead",
    companyName: "Greenfield Nonprofit",
    companySize: "1-10",
    industry: "Nonprofits",
    overallRating: 4,
    subRatings: { easeOfUse: 5, pricing: 5, support: 3, features: 3, reliability: 4 },
    title: "Affordable and simple for donations",
    body: (name) =>
      `${name} let us set up recurring donations quickly and the cost is reasonable for a small nonprofit. Support replies could be faster but we rarely need them.`,
    pros: "Affordable, easy recurring donations",
    cons: "Support response times vary",
    useCase: "Recurring donations for a nonprofit",
    monthlyVolume: "<$10k",
    isVerified: false,
  },
];

// ---------------------------------------------------------------------------
// Blog posts (3 — published; SAMPLE content)
// ---------------------------------------------------------------------------
interface SeedBlogPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string[];
  relatedProcessorSlugs: string[];
  publishedAtDaysAgo: number;
  seo: { metaTitle?: string; metaDescription?: string };
}

const BLOG_POSTS: SeedBlogPost[] = [
  {
    title: "Flat-rate vs interchange-plus: which pricing model saves you more?",
    slug: "flat-rate-vs-interchange-plus",
    excerpt:
      "Flat-rate pricing is simple; interchange-plus is transparent. Here's how to tell which one actually costs your business less.",
    content:
      "<p>Two pricing models dominate card processing: <strong>flat-rate</strong> and <strong>interchange-plus</strong>. The right one depends on your volume, average ticket size, and how much complexity you can tolerate.</p>" +
      "<h2>Flat-rate pricing</h2><p>You pay one blended rate for every transaction — for example 2.9% + 30¢. It's predictable and easy to forecast, which is why it's the default for newer and smaller businesses.</p>" +
      "<h2>Interchange-plus pricing</h2><p>You pay the card network's interchange cost <em>plus</em> a fixed markup. It's more transparent and usually cheaper at scale because you're not subsidising the processor's blended margin.</p>" +
      "<h3>Which should you choose?</h3><ul><li><strong>Low volume or just starting out:</strong> flat-rate keeps things simple.</li><li><strong>Higher or growing volume:</strong> interchange-plus typically wins on cost.</li><li><strong>Want predictability above all:</strong> a subscription/membership model can beat both.</li></ul>" +
      "<p>Run your real numbers before switching — a fraction of a percent adds up fast at volume.</p>",
    author: "PayCompare Editorial",
    tags: ["Pricing", "Fees", "Guides"],
    relatedProcessorSlugs: ["stripe", "helcim", "stax"],
    publishedAtDaysAgo: 7,
    seo: {
      metaTitle: "Flat-rate vs interchange-plus pricing explained",
      metaDescription:
        "A clear comparison of flat-rate and interchange-plus card processing pricing, and how to pick the cheaper option for your volume.",
    },
  },
  {
    title: "The best payment processors for high-risk businesses",
    slug: "best-processors-for-high-risk-businesses",
    excerpt:
      "If mainstream processors keep declining or freezing you, here's what to look for in a high-risk-friendly provider.",
    content:
      "<p>Some industries — from CBD to travel to subscriptions with high chargebacks — get declined or frozen by mainstream processors. High-risk-friendly providers underwrite these businesses, but the terms differ.</p>" +
      "<h2>What 'high-risk' actually means</h2><p>It's about the processor's risk exposure: chargeback rates, regulatory scrutiny, and refund patterns. Being labelled high-risk isn't a judgement on your business — it's about underwriting.</p>" +
      "<h2>What to look for</h2><ul><li><strong>Clear underwriting</strong> for your specific industry.</li><li><strong>Chargeback tooling</strong> and alerts to keep your ratio healthy.</li><li><strong>Reasonable reserves</strong> — understand any rolling reserve before signing.</li><li><strong>Stable settlement</strong> so payouts aren't unpredictably held.</li></ul>" +
      "<h3>A note on cost</h3><p>High-risk processing costs more — that's the trade for acceptance. Compare total cost including reserves, not just the headline rate.</p>",
    author: "PayCompare Editorial",
    tags: ["High-risk", "Guides"],
    relatedProcessorSlugs: ["payu", "authorize-net"],
    publishedAtDaysAgo: 21,
    seo: {
      metaTitle: "Best payment processors for high-risk businesses",
      metaDescription:
        "How to choose a high-risk-friendly payment processor: underwriting, chargeback tooling, reserves, and total cost.",
    },
  },
  {
    title: "How to lower your payment processing fees: 9 levers that actually work",
    slug: "how-to-lower-payment-processing-fees",
    excerpt:
      "Processing fees are negotiable and optimisable. Here are nine practical levers to cut what you pay — without switching blindly.",
    content:
      "<p>Processing fees feel fixed, but a surprising amount is within your control. Here are nine levers, from quick wins to bigger moves.</p>" +
      "<h2>Quick wins</h2><ul><li><strong>Switch to interchange-plus</strong> if you're at volume on a flat or tiered plan.</li><li><strong>Pass less keyed-in volume</strong> — card-present and tokenised rates are lower.</li><li><strong>Enable AVS and 3-D Secure</strong> to qualify for better interchange and cut fraud.</li></ul>" +
      "<h2>Bigger moves</h2><ul><li><strong>Negotiate your markup</strong> once you have leverage from volume.</li><li><strong>Consolidate volume</strong> with one processor to hit discount tiers.</li><li><strong>Review your reserve</strong> and chargeback ratio — both quietly cost you.</li></ul>" +
      "<h3>Measure before and after</h3><p>Pull your <em>effective rate</em> (total fees ÷ total volume) each month. It's the single number that tells you whether any change actually helped.</p>",
    author: "PayCompare Editorial",
    tags: ["Fees", "Optimisation", "Guides"],
    relatedProcessorSlugs: ["stripe", "helcim", "adyen"],
    publishedAtDaysAgo: 35,
    seo: {
      metaTitle: "How to lower your payment processing fees",
      metaDescription:
        "Nine practical ways to reduce card processing fees — pricing models, interchange optimisation, negotiation, and more.",
    },
  },
];

// ---------------------------------------------------------------------------
// Leads (admin dashboard demo data — "Get a quote / Get matched" + contact)
// SAMPLE DATA. `processorSlug` null = generic "get matched" lead.
// ---------------------------------------------------------------------------
interface SeedLead {
  processorSlug: string | null;
  name: string;
  email: string;
  businessName?: string;
  phone?: string;
  monthlyVolume?: "<$10k" | "$10k-$50k" | "$50k-$250k" | "$250k-$1M" | "$1M+";
  businessType?: string;
  message?: string;
  status: "new" | "contacted" | "closed";
  source: string;
  createdDaysAgo: number;
}

const LEADS: SeedLead[] = [
  {
    processorSlug: "stripe",
    name: "Alicia Tan",
    email: "alicia@brightcartshop.com",
    businessName: "BrightCart",
    phone: "+1 415-555-0142",
    monthlyVolume: "$50k-$250k",
    businessType: "E-commerce",
    message: "Moving off a tiered plan and want to compare Stripe's effective rate at our volume.",
    status: "new",
    source: "profile-quote",
    createdDaysAgo: 1,
  },
  {
    processorSlug: null,
    name: "Daniel Brooks",
    email: "dan@brooksboards.co",
    businessName: "Brooks Boards",
    monthlyVolume: "$10k-$50k",
    businessType: "Retail",
    message: "Opening a second location — need a POS + payments setup that won't lock me into a long contract.",
    status: "new",
    source: "get-matched",
    createdDaysAgo: 2,
  },
  {
    processorSlug: "helcim",
    name: "Meera Krishnan",
    email: "meera@northlinewholesale.com",
    businessName: "Northline Wholesale",
    phone: "+1 403-555-0188",
    monthlyVolume: "$250k-$1M",
    businessType: "B2B Wholesale",
    message: "Interested in interchange-plus with volume discounts. Can you share a quote?",
    status: "contacted",
    source: "profile-quote",
    createdDaysAgo: 4,
  },
  {
    processorSlug: "square",
    name: "Tom Whitfield",
    email: "tom@harborcafe.com",
    businessName: "Harbor Cafe",
    monthlyVolume: "$10k-$50k",
    businessType: "Restaurant",
    message: "Need tap-to-pay and tipping for a small cafe. How fast are payouts?",
    status: "contacted",
    source: "profile-quote",
    createdDaysAgo: 6,
  },
  {
    processorSlug: null,
    name: "Priscilla Adeyemi",
    email: "priscilla@lagosthreads.com",
    businessName: "Lagos Threads",
    monthlyVolume: "$50k-$250k",
    businessType: "Cross-border e-commerce",
    message: "Selling into multiple countries — which processor handles local methods and multi-currency best?",
    status: "new",
    source: "get-matched",
    createdDaysAgo: 8,
  },
  {
    processorSlug: "adyen",
    name: "Werner Klein",
    email: "w.klein@altmark-retail.de",
    businessName: "Altmark Retail GmbH",
    phone: "+49 30 5550173",
    monthlyVolume: "$1M+",
    businessType: "Omnichannel retail",
    message: "Enterprise unified commerce across EU + US. Want to discuss interchange++ and settlement.",
    status: "closed",
    source: "profile-quote",
    createdDaysAgo: 12,
  },
  {
    processorSlug: null,
    name: "Sarah Mitchell",
    email: "sarah.mitchell@givewell-foundation.org",
    businessName: "GiveWell Foundation",
    monthlyVolume: "<$10k",
    businessType: "Nonprofit",
    message: "Looking for discounted rates and recurring donation tooling.",
    status: "contacted",
    source: "get-matched",
    createdDaysAgo: 15,
  },
  {
    // Contact-form lead (no processor, no volume) — exercises the `contact` source.
    processorSlug: null,
    name: "James Porter",
    email: "james@porterlegal.com",
    message: "Do you offer guidance on switching processors without downtime? Happy to jump on a call.",
    status: "closed",
    source: "contact",
    createdDaysAgo: 19,
  },
  {
    processorSlug: "razorpay",
    name: "Rohan Gupta",
    email: "rohan@quickkart.in",
    businessName: "QuickKart",
    phone: "+91 98201 55512",
    monthlyVolume: "$50k-$250k",
    businessType: "E-commerce",
    message: "Need UPI + cards with fast settlement for an Indian D2C brand.",
    status: "new",
    source: "profile-quote",
    createdDaysAgo: 23,
  },
  {
    processorSlug: "stax",
    name: "Carla Jimenez",
    email: "carla@summitdental.com",
    businessName: "Summit Dental Group",
    phone: "+1 407-555-0119",
    monthlyVolume: "$250k-$1M",
    businessType: "Healthcare",
    message: "Higher ticket sizes — does the subscription pricing actually save us vs flat-rate?",
    status: "contacted",
    source: "profile-quote",
    createdDaysAgo: 28,
  },
];

// ---------------------------------------------------------------------------
// Submissions (admin "For Processors / get-listed" queue — SAMPLE DATA)
// ---------------------------------------------------------------------------
interface SeedSubmission {
  processorName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  description?: string;
  requestedTier?: "free" | "verified" | "premier";
  status: "new" | "reviewing" | "approved" | "rejected";
  notes?: string;
  createdDaysAgo: number;
}

const SUBMISSIONS: SeedSubmission[] = [
  {
    processorName: "Paddle",
    website: "https://www.paddle.com",
    contactName: "Eleanor Voss",
    contactEmail: "partnerships@paddle.com",
    description:
      "Merchant of record for SaaS — we handle payments, sales tax, and subscription billing globally. We'd like a listing in Subscriptions & SaaS.",
    requestedTier: "premier",
    status: "new",
    createdDaysAgo: 1,
  },
  {
    processorName: "GoCardless",
    website: "https://gocardless.com",
    contactName: "Owen Pryce",
    contactEmail: "owen.pryce@gocardless.com",
    description:
      "Bank debit / ACH-first recurring payments across the UK, EU, and US. Great fit for subscriptions and B2B.",
    requestedTier: "verified",
    status: "reviewing",
    notes: "Verifying processing volume and supported regions before approving the Verified badge.",
    createdDaysAgo: 5,
  },
  {
    processorName: "Mollie",
    website: "https://www.mollie.com",
    contactName: "Lieke de Vries",
    contactEmail: "lieke@mollie.com",
    description:
      "European PSP with local methods (iDEAL, Bancontact, SEPA) and simple pricing. Requesting an International & Cross-Border listing.",
    requestedTier: "verified",
    status: "approved",
    notes: "Approved — converted to a Verified processor draft. Awaiting final fee table.",
    createdDaysAgo: 11,
  },
  {
    processorName: "Payline Data",
    website: "https://paylinedata.com",
    contactName: "Greg Holloway",
    contactEmail: "greg@paylinedata.com",
    description: "Interchange-plus processing for US SMBs and some high-risk verticals.",
    requestedTier: "free",
    status: "new",
    createdDaysAgo: 14,
  },
  {
    processorName: "QuickPay Solutions",
    website: "http://quickpay-solutions-pay.biz",
    contactName: "Marcus Lane",
    contactEmail: "marcus@quickpay-solutions-pay.biz",
    description: "We guarantee the lowest rates anywhere, instant approval for any business!!!",
    requestedTier: "premier",
    status: "rejected",
    notes: "Rejected — unverifiable claims, no public pricing, domain registered recently. Possible spam.",
    createdDaysAgo: 17,
  },
  {
    processorName: "Checkout.com",
    website: "https://www.checkout.com",
    contactName: "Sophia Almeida",
    contactEmail: "sophia.almeida@checkout.com",
    description:
      "Enterprise-grade global payments with direct acquiring and granular data. Requesting a premier listing for the e-commerce and marketplaces categories.",
    requestedTier: "premier",
    status: "reviewing",
    notes: "Strong candidate. Collecting logo + final copy.",
    createdDaysAgo: 22,
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------
async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase() || "admin@paycompare.test";
  const password = process.env.ADMIN_SEED_PASSWORD || "change-me-in-production";
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Admin";
  const passwordHash = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { email },
    { $set: { passwordHash, name, role: "admin" }, $setOnInsert: { email } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  // eslint-disable-next-line no-console
  console.log(`✓ Admin ready: ${email}`);
}

async function seedSettings(): Promise<void> {
  await SiteSettings.findOneAndUpdate(
    { key: "singleton" },
    {
      $set: {
        siteName: "PayCompare",
        homepageHeroTitle: "Find the right payment processor",
        homepageHeroSubtitle:
          "Compare fees, features, and verified merchant reviews — all in one independent directory.",
        featuredCategorySlugs: ["ecommerce", "retail-pos", "subscriptions", "high-risk", "international", "small-business"],
        contactEmail: "hello@paycompare.test",
        socialLinks: { twitter: "https://twitter.com/paycompare", linkedin: "https://www.linkedin.com/company/paycompare" },
        footerText: "© PayCompare. Sample directory — verify fees with each provider before deciding.",
      },
      $setOnInsert: { key: "singleton" },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  // eslint-disable-next-line no-console
  console.log("✓ Site settings ready");
}

async function main(): Promise<void> {
  await connectToDatabase();

  await seedAdmin();
  await seedSettings();

  // --- Categories (upsert by slug) → slug→id map ---
  const categoryIdBySlug = new Map<string, string>();
  for (let i = 0; i < CATEGORIES.length; i += 1) {
    const c = CATEGORIES[i]!;
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      {
        $set: {
          name: c.name,
          type: c.type,
          shortDescription: c.shortDescription,
          introContent: c.introContent,
          displayOrder: i,
          isPublished: true,
        },
        $setOnInsert: { slug: c.slug },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    categoryIdBySlug.set(c.slug, String(doc!._id));
  }
  // eslint-disable-next-line no-console
  console.log(`✓ ${CATEGORIES.length} categories ready`);

  // --- Processors (upsert by slug) → slug→id map ---
  const processorIdBySlug = new Map<string, string>();
  for (const p of PROCESSORS) {
    const categories = p.categorySlugs
      .map((s) => categoryIdBySlug.get(s))
      .filter((id): id is string => Boolean(id));

    // Omit `slug` from $set: it lives in the upsert filter + $setOnInsert, and
    // Mongo rejects updating the same path in both $set and $setOnInsert.
    const { categorySlugs: _omit, slug: _slug, ...rest } = p;
    const doc = await Processor.findOneAndUpdate(
      { slug: p.slug },
      { $set: { ...rest, categories, isPublished: true }, $setOnInsert: { slug: p.slug } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    processorIdBySlug.set(p.slug, String(doc!._id));
  }
  // eslint-disable-next-line no-console
  console.log(`✓ ${PROCESSORS.length} processors ready`);

  // --- Reviews: replace seeded (source: "import") set, then recompute ratings ---
  const processorIds = Array.from(processorIdBySlug.values());
  await Review.deleteMany({ processor: { $in: processorIds }, source: "import" });

  let reviewCount = 0;
  for (let pi = 0; pi < PROCESSORS.length; pi += 1) {
    const p = PROCESSORS[pi]!;
    const processorId = processorIdBySlug.get(p.slug)!;

    // 4 reviews per processor, rotating the template pool so sets differ.
    const docs = Array.from({ length: 4 }).map((_, k) => {
      const t = REVIEW_TEMPLATES[(pi + k) % REVIEW_TEMPLATES.length]!;
      return {
        processor: processorId,
        reviewerName: t.reviewerName,
        reviewerTitle: t.reviewerTitle,
        companyName: t.companyName,
        companySize: t.companySize,
        industry: t.industry,
        reviewerEmail: `${t.reviewerName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        overallRating: t.overallRating,
        subRatings: t.subRatings,
        title: t.title,
        body: t.body(p.name),
        pros: t.pros,
        cons: t.cons,
        useCase: t.useCase,
        monthlyVolume: t.monthlyVolume,
        status: "approved" as const,
        isVerified: t.isVerified,
        source: "import" as const,
      };
    });
    await Review.insertMany(docs);
    reviewCount += docs.length;

    // Aggregates are written ONLY by lib/ratings.ts (PRD §15).
    await recomputeProcessorRatings(processorId);
  }
  // eslint-disable-next-line no-console
  console.log(`✓ ${reviewCount} approved reviews ready (ratings recomputed)`);

  // --- Blog posts (upsert by slug) ---
  const nowMs = Date.now();
  for (const b of BLOG_POSTS) {
    const relatedProcessors = b.relatedProcessorSlugs
      .map((s) => processorIdBySlug.get(s))
      .filter((id): id is string => Boolean(id));
    const publishedAt = new Date(nowMs - b.publishedAtDaysAgo * 24 * 60 * 60 * 1000);

    await BlogPost.findOneAndUpdate(
      { slug: b.slug },
      {
        $set: {
          title: b.title,
          excerpt: b.excerpt,
          content: b.content,
          author: b.author,
          tags: b.tags,
          relatedProcessors,
          status: "published",
          publishedAt,
          seo: b.seo,
        },
        $setOnInsert: { slug: b.slug },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  // eslint-disable-next-line no-console
  console.log(`✓ ${BLOG_POSTS.length} blog posts ready`);

  // --- Leads: replace the seeded demo set wholesale each run ---
  // Seeded leads are identified by their @example/demo emails so re-running
  // refreshes them without wiping real captured leads. We match on the exact
  // emails in our LEADS list.
  const leadEmails = LEADS.map((l) => l.email.toLowerCase());
  await Lead.deleteMany({ email: { $in: leadEmails } });
  const leadDocs = LEADS.map((l) => {
    const processor = l.processorSlug ? processorIdBySlug.get(l.processorSlug) : undefined;
    const createdAt = new Date(nowMs - l.createdDaysAgo * 24 * 60 * 60 * 1000);
    return {
      ...(processor ? { processor } : {}),
      name: l.name,
      email: l.email,
      businessName: l.businessName,
      phone: l.phone,
      monthlyVolume: l.monthlyVolume,
      businessType: l.businessType,
      message: l.message,
      status: l.status,
      source: l.source,
      createdAt,
      updatedAt: createdAt,
    };
  });
  // timestamps:true would overwrite our backdated createdAt on insert, so disable
  // it for the seed. `timestamps` is a valid runtime insertMany option in Mongoose
  // 8 but is missing from the TS InsertManyOptions type, hence the cast.
  await Lead.insertMany(leadDocs, { timestamps: false } as unknown as mongoose.InsertManyOptions);
  // eslint-disable-next-line no-console
  console.log(`✓ ${leadDocs.length} leads ready`);

  // --- Submissions: replace the seeded demo set wholesale each run ---
  const submissionEmails = SUBMISSIONS.map((s) => s.contactEmail.toLowerCase());
  await Submission.deleteMany({ contactEmail: { $in: submissionEmails } });
  const submissionDocs = SUBMISSIONS.map((s) => {
    const createdAt = new Date(nowMs - s.createdDaysAgo * 24 * 60 * 60 * 1000);
    return {
      processorName: s.processorName,
      website: s.website,
      contactName: s.contactName,
      contactEmail: s.contactEmail,
      description: s.description,
      requestedTier: s.requestedTier,
      status: s.status,
      notes: s.notes,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await Submission.insertMany(submissionDocs, {
    timestamps: false,
  } as unknown as mongoose.InsertManyOptions);
  // eslint-disable-next-line no-console
  console.log(`✓ ${submissionDocs.length} submissions ready`);

  // eslint-disable-next-line no-console
  console.log("\n✓ Seed complete — sample data loaded. Verify figures before going live.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
