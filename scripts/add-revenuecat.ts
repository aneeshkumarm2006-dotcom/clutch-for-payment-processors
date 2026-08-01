import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, Processor } from "@/models";
import { processorPublishInput } from "@/lib/validators/processor";

/**
 * Add / refresh the RevenueCat listing.
 *
 * Deliberately NOT folded into `scripts/seed.ts`. That file is the sample-data
 * seed: it rewrites all ten demo processors from its own literals (clobbering any
 * admin edit) and attaches four fabricated reviews to each. RevenueCat is a
 * researched, real listing, so it gets its own idempotent upsert that touches one
 * document and nothing else.
 *
 *   npx tsx scripts/add-revenuecat.ts            # write
 *   npx tsx scripts/add-revenuecat.ts --dry-run  # validate + print, write nothing
 *
 * Re-running is safe: it upserts on `slug` and overwrites the fields below.
 *
 * --- Editorial note ---------------------------------------------------------
 * RevenueCat is NOT a payment processor in the sense the rest of this directory
 * uses the word. It never touches the card: Apple, Google, Stripe, or Paddle take
 * the money and hold the funds, and RevenueCat is the subscription/entitlement
 * layer on top, charging a percentage of the revenue it tracks. Every field below
 * is written to make that boundary obvious rather than to file it alongside
 * Stripe and Adyen as an equivalent. `pciLevel: "N/A"` is deliberate and correct
 * (no cardholder data reaches RevenueCat), not a gap in the research.
 *
 * Figures verified against revenuecat.com/pricing and the RevenueCat docs in
 * July 2026. They change; re-check before quoting.
 */

/**
 * The RC mark from revenuecat.com/favicon/favicon.png, resized to 128px, WebP
 * compressed, and served from the CDN.
 *
 * Previously an inline `data:` URI. Logos moved to the CDN in
 * `scripts/migrate-logos-to-cdn.ts`: a data URI is re-downloaded on every page
 * view, adds its base64 weight to both the HTML and the RSC payload, and becomes
 * an invalid `Product.image` once `absoluteUrl()` resolves it against the site
 * origin. Do not put a data URI back here.
 */
const LOGO_URL =
  "https://res.cloudinary.com/de26l2h0a/image/upload/v1785612744/logos/revenuecat-logo-45aa00ec.webp";

/** Category slugs this listing belongs to. Both exist (see `scripts/seed.ts`). */
const CATEGORY_SLUGS = ["subscriptions", "developers"] as const;

const REVENUECAT = {
  name: "RevenueCat",
  slug: "revenuecat",
  logo: LOGO_URL,
  website: "https://www.revenuecat.com",
  tagline: "In-app subscription infrastructure for mobile and web apps.",
  shortDescription:
    "A subscription billing layer for apps. One SDK covers the App Store, Google Play, and web purchases, with paywalls, experiments, and revenue analytics. The card itself is processed by Apple, Google, Stripe, or Paddle.",
  longDescription:
    "<p>RevenueCat is subscription infrastructure for apps rather than a card processor. A single SDK sits in front of Apple's StoreKit, Google Play Billing, the Amazon Appstore, and web checkout, so one set of entitlements decides what a customer has paid for on every platform. It handles receipt validation, renewals, upgrades, grace periods, and refunds, then reports the result in one revenue dashboard.</p>" +
    "<h3>How the money actually moves</h3>" +
    "<p>RevenueCat never touches the card. In-app purchases are billed by Apple or Google, which take a 15 to 30 percent commission and pay out on their own schedule. Web purchases run through RevenueCat Billing on Stripe, through your own Stripe Billing catalogue, or through Paddle acting as merchant of record. RevenueCat's fee sits on top of whichever one you use: nothing below $2,500 in monthly tracked revenue, then 1% of gross tracked revenue.</p>" +
    "<h3>Who it is for</h3>" +
    "<p>Mobile-first subscription apps that want paywalls, A/B tests, and cohort analytics without building the billing plumbing twice. It is not a fit for in-person payments, conventional e-commerce checkout, or any business that needs a merchant account of its own.</p>",

  foundedYear: 2017,
  headquarters: "San Francisco, CA, USA",
  companySize: "51-250" as const,
  supportedRegions: ["US", "CA", "EU", "UK", "Global"],

  // 1% of tracked revenue is a platform fee, not a per-transaction card rate, so
  // this reads as "subscription" pricing with a negotiated Enterprise tier.
  pricingModel: ["subscription", "custom-quote"] as const,
  pricingSummary:
    "Free below $2,500 in monthly tracked revenue, then 1% of gross tracked revenue. Card processing is billed separately by Apple, Google, Stripe, or Paddle. Enterprise pricing is custom.",
  fees: {
    // The "starting rate" stat on the profile. RevenueCat's own cut only.
    onlineCardRate: "1% of tracked revenue",
    monthlyFee: "$0",
    setupFee: "$0",
    earlyTerminationFee: "$0",
    refundPolicy:
      "Refunds are issued by the store or gateway, and tracked revenue adjusts to match.",
  },
  contractType: "no-contract" as const,
  freeTrial: true,
  // Apple and Google pay out on their own cycles, Stripe on a rolling schedule.
  payoutTime: "varies" as const,

  // What a customer can pay with. Web checkout via RevenueCat Billing is cards
  // (with 3DS), Apple Pay, and Google Pay through Stripe; in-app purchases use
  // whatever the customer has on file with the store.
  paymentMethods: ["visa", "mastercard", "amex", "discover", "apple-pay", "google-pay", "wallets"] as const,
  integrations: ["api", "hosted-checkout", "drop-in-ui", "mobile-sdk", "payment-links"] as const,
  currencies: "Multi-currency via store price tiers and Stripe",
  features: [
    "recurring-billing",
    "multi-currency",
    "3d-secure",
    "reporting-dashboard",
    "developer-friendly",
  ] as const,
  // Cardholder data never reaches RevenueCat. Stripe is the PCI Level 1 party.
  pciLevel: "N/A" as const,
  highRiskFriendly: false,

  bestFor: ["Mobile apps", "Subscription apps", "Developers"],
  industries: ["Mobile apps", "SaaS", "Gaming"],
  pros: [
    "One SDK and one entitlement model across the App Store, Google Play, and the web",
    "Free below $2,500 in monthly tracked revenue, so early-stage apps pay nothing",
    "Paywalls, A/B tests, and cohort analytics that would otherwise be a build",
  ],
  cons: [
    "Not a payment processor. Apple, Google, Stripe, or Paddle still take the payment, hold the funds, and own the chargeback",
    "The 1% fee is charged on gross revenue before the app store commission, so it costs more than it first looks",
    "No in-person payments and nothing for conventional e-commerce checkout",
  ],
  editorScore: 4.5,

  // Editorially added, no commercial relationship: the same tier PayPal and
  // Authorize.net sit on. Nothing here buys placement.
  listingTier: "free" as const,
  isVerified: false,
  isSponsored: false,
  isFeatured: false,
  isPublished: true,

  seo: {
    metaTitle: "RevenueCat Review | Pricing, Fees and Features",
    metaDescription:
      "An independent look at RevenueCat, the in-app subscription platform. What its 1 percent tracked revenue fee covers, how web billing works, and who it suits.",
    keywords: ["revenuecat review", "revenuecat pricing", "revenuecat fees"],
    focusKeyword: "revenuecat review",
  },
  faqs: [
    {
      question: "Is RevenueCat a payment processor?",
      answer:
        "No. RevenueCat is a subscription management layer. The payment is taken by Apple, Google, Stripe, or Paddle, and RevenueCat sits on top to validate receipts, track entitlements across platforms, and report revenue.",
    },
    {
      question: "How much does RevenueCat cost?",
      answer:
        "RevenueCat is free below $2,500 in monthly tracked revenue. Above that the Pro plan costs 1% of gross tracked revenue, and Enterprise pricing is negotiated. Payment processing fees are billed separately by the store or gateway.",
    },
    {
      question: "Can I sell subscriptions on the web with RevenueCat?",
      answer:
        "Yes. RevenueCat Web supports three billing engines: RevenueCat Billing, which uses Stripe as the gateway and leaves you as merchant of record; your own Stripe Billing catalogue, optionally with Stripe Managed Payments; and Paddle Billing, where Paddle is the merchant of record.",
    },
    {
      question: "Which payment methods does RevenueCat web checkout accept?",
      answer:
        "RevenueCat Billing accepts cards with 3D Secure, Apple Pay, and Google Pay through Stripe. In-app purchases use whatever payment method the customer already has on file with Apple or Google.",
    },
  ],
  // Matches the other profiles: the engine generates Product, AggregateRating,
  // Review, Breadcrumb, and FAQPage nodes; nothing is suppressed here.
  structuredData: { customMode: "append" as const },
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();

  // Resolve category slugs to ids. A missing slug is fatal: publishing without a
  // category would drop the listing out of every directory facet.
  const cats = await Category.find({ slug: { $in: CATEGORY_SLUGS } }, { slug: 1 }).lean();
  const found = new Map(cats.map((c) => [c.slug, String(c._id)]));
  const missing = CATEGORY_SLUGS.filter((s) => !found.has(s));
  if (missing.length) {
    throw new Error(`Missing categories: ${missing.join(", ")}. Run \`npm run seed\` first.`);
  }
  const categories = CATEGORY_SLUGS.map((s) => found.get(s)!);

  // Validate through the SAME schema the admin form uses on Publish, so this
  // script cannot write a document the UI would reject.
  const parsed = processorPublishInput.parse({ ...REVENUECAT, categories });

  if (dryRun) {
    const { logo, ...rest } = parsed;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ...rest, logo: `${logo?.slice(0, 32)}... (${logo?.length} chars)` }, null, 2));
    // eslint-disable-next-line no-console
    console.log("\n✓ Valid. Dry run: nothing was written.");
    return;
  }

  // `slug` lives in the filter + $setOnInsert; Mongo rejects the same path in
  // both $set and $setOnInsert (same reason as scripts/seed.ts).
  const { slug: _slug, ...set } = parsed;
  const doc = await Processor.findOneAndUpdate(
    { slug: REVENUECAT.slug },
    { $set: set, $setOnInsert: { slug: REVENUECAT.slug } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  // eslint-disable-next-line no-console
  console.log(
    `✓ ${doc!.name} ready at /processor/${doc!.slug} (published: ${doc!.isPublished}, categories: ${CATEGORY_SLUGS.join(", ")})`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
