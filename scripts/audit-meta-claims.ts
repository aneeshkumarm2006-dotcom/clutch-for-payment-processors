import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { Category, PageSeo, Processor } from "@/models";
import { GLOSSARY_TERMS } from "@/lib/glossary";

/**
 * Check that every hard number asserted in a meta title or description is still true.
 *
 *   npx tsx scripts/audit-meta-claims.ts
 *
 * WHY THIS EXISTS
 *
 * The meta copy was rewritten to be concrete rather than categorical, because
 * "Compare 41 payment processors by rate and monthly fee" earns a click and
 * "Compare leading payment processing solutions" does not. Every count and rate
 * in it was verified true at the time of writing.
 *
 * The cost of that is coupling: publish a 42nd processor, unpublish one, or let a
 * provider change its pricing page, and a claim that was accurate becomes a false
 * statement sitting in Google's index. Nothing else in the codebase would notice.
 * On a site whose entire pitch is that its figures can be checked, a stale count
 * in the SERP is worse than a vague one.
 *
 * So the claims are declared here, next to the query that proves them, and this
 * script fails when reality moves. Run it before a deploy and after any change to
 * the processor catalogue.
 *
 * Adding a new numeric claim to meta copy? Add it here in the same commit, or it
 * is unguarded.
 */

interface Claim {
  /** Where the number appears, for the failure message. */
  where: string;
  /** The claim in English, as a reader would read it. */
  claim: string;
  /** What the copy asserts. */
  expected: number | string;
  /** What is actually true right now. */
  actual: () => Promise<number | string>;
}

async function publishedCount(filter: Record<string, unknown> = {}): Promise<number> {
  return Processor.countDocuments({ isPublished: true, ...filter });
}

async function categoryCount(slug: string): Promise<number> {
  const cat = await Category.findOne({ slug, isPublished: true }).select("_id").lean();
  if (!cat) return -1;
  return publishedCount({ categories: cat._id });
}

async function categoryMembers(slug: string): Promise<string> {
  const cat = await Category.findOne({ slug, isPublished: true }).select("_id").lean();
  if (!cat) return "(category missing)";
  const rows = await Processor.find({ isPublished: true, categories: cat._id })
    .select("name")
    .sort({ name: 1 })
    .lean();
  return rows.map((r) => String(r.name)).sort().join(", ");
}

/** A fee field on one processor, for the rate claims. */
async function fee(slug: string, field: "onlineCardRate" | "monthlyFee"): Promise<string> {
  const p = await Processor.findOne({ slug }).select("fees").lean();
  return String((p?.fees as Record<string, string> | undefined)?.[field] ?? "(missing)");
}

const CLAIMS: Claim[] = [
  // --- counts -------------------------------------------------------------
  {
    where: "PageSeo /processors title",
    claim: "Compare 41 Payment Processors by Rate and Monthly Fee",
    expected: 41,
    actual: () => publishedCount(),
  },
  {
    where: "PageSeo /processors description",
    claim: "...and 39 more sit alongside them (Stripe + Helcim + 39 = 41)",
    expected: 41,
    actual: () => publishedCount(),
  },
  {
    where: "PageSeo /glossary title",
    claim: "50 Payment Processing Terms Defined in Plain English",
    expected: 50,
    actual: async () => GLOSSARY_TERMS.length,
  },
  {
    where: "PageSeo /payment-processors/ach description",
    claim: "25 processors support it",
    expected: 25,
    actual: () => publishedCount({ paymentMethods: "ach" }),
  },
  {
    where: "Category ecommerce description",
    claim: "Thirty online processors ranked",
    expected: 30,
    actual: () => categoryCount("ecommerce"),
  },
  {
    where: "Category marketplaces description",
    claim: "Only Stripe, Adyen and Mollie handle that split",
    expected: "Adyen, Mollie, Stripe",
    actual: () => categoryMembers("marketplaces"),
  },
  {
    where: "Category retail-pos description",
    claim: "Twelve counter setups compared",
    expected: 12,
    actual: () => categoryCount("retail-pos"),
  },
  {
    where: "Category subscriptions description",
    claim: "26 recurring billing processors",
    expected: 26,
    actual: () => categoryCount("subscriptions"),
  },
  {
    where: "Category high-risk description",
    claim: "Seven providers here take the accounts mainstream processors decline",
    expected: 7,
    actual: () => categoryCount("high-risk"),
  },
  {
    where: "Category small-business title",
    claim: "Helcim vs Square vs Stax and 16 More (3 + 16 = 19)",
    expected: 19,
    actual: () => categoryCount("small-business"),
  },
  {
    where: "Category restaurants description",
    claim: "narrow this list to four",
    expected: 4,
    actual: () => categoryCount("restaurants"),
  },
  {
    where: "Category nonprofits description",
    claim: "Three other processors listed (Dharma + 3 = 4)",
    expected: 4,
    actual: () => categoryCount("nonprofits"),
  },
  {
    where: "Category developers description",
    claim: "four of the 15 processors in this list",
    expected: 15,
    actual: () => categoryCount("developers"),
  },

  // --- rates --------------------------------------------------------------
  // These are quoted in meta copy, so they must match what the profile shows.
  // A mismatch means the SERP snippet contradicts the page it links to.
  { where: "Category ecommerce / subscriptions / restaurants", claim: "Stripe posts 2.9% + $0.30", expected: "2.9% + $0.30", actual: () => fee("stripe", "onlineCardRate") },
  { where: "Category retail-pos / small-business", claim: "Helcim bills interchange plus 0.50%", expected: "Interchange + 0.50% + $0.25", actual: () => fee("helcim", "onlineCardRate") },
  { where: "Category ecommerce", claim: "Mollie lists 1.8%", expected: "1.8% + EUR 0.25", actual: () => fee("mollie", "onlineCardRate") },
  { where: "Category retail-pos / small-business", claim: "Stax charges 99 dollars a month", expected: "$99", actual: () => fee("stax", "monthlyFee") },
  { where: "Category small-business", claim: "Stax: interchange plus 15 cents", expected: "Interchange + $0.15", actual: () => fee("stax", "onlineCardRate") },
  { where: "Category international", claim: "Adyen adds 0.60% and 13 cents over interchange", expected: "Interchange + 0.60% + $0.13", actual: () => fee("adyen", "onlineCardRate") },
  { where: "Category international", claim: "PayU 2 to 3 percent", expected: "2% to 3% (by market)", actual: () => fee("payu", "onlineCardRate") },
  { where: "Category nonprofits", claim: "Dharma cuts the monthly fee from 20 dollars to 15", expected: "$20, $15 nonprofit", actual: () => fee("dharma-merchant-services", "monthlyFee") },
  { where: "Category nonprofits", claim: "Dharma: interchange plus 0.20% and 11 cents", expected: "IC + 0.20% + $0.11", actual: () => fee("dharma-merchant-services", "onlineCardRate") },
  { where: "Category subscriptions", claim: "RevenueCat takes 1 percent of tracked revenue", expected: "1% of tracked revenue", actual: () => fee("revenuecat", "onlineCardRate") },
];

async function main() {
  await connectForScript();

  const failures: string[] = [];
  for (const c of CLAIMS) {
    const actual = await c.actual();
    const ok = String(actual) === String(c.expected);
    if (!ok) {
      failures.push(
        `  ${c.where}\n      claim:    "${c.claim}"\n      asserts:  ${c.expected}\n      actually: ${actual}`,
      );
    }
  }

  console.log(`Checked ${CLAIMS.length} numeric claims in meta copy.`);
  if (!failures.length) {
    console.log("PASS: every number asserted in a title or description is still true.");
  } else {
    console.error(`\nFAIL: ${failures.length} claim(s) no longer match the data:\n`);
    for (const f of failures) console.error(f + "\n");
    console.error(
      "Fix the copy (admin, or the seed literal) or fix the data. A stale count in the\n" +
        "SERP is worse than a vague one on a site that sells verifiability.",
    );
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
