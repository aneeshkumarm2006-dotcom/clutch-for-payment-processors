import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { BlogPost, Processor } from "@/models";

/**
 * Set `seo.metaTitle` / `seo.metaDescription` on the documents whose rendered
 * title or description exceeds what Google will show.
 *
 *   npx tsx scripts/fix-meta-lengths.ts --dry-run
 *   npx tsx scripts/fix-meta-lengths.ts
 *
 * Semrush flagged five "title element is too long" pages (84 to 102 characters
 * rendered). Four are blog posts with no `seo.metaTitle`, so `buildMetadata`
 * falls back to the post title and `app/layout.tsx` appends
 * " | Payment Processor Guide" on top of an already-long headline. A stored
 * `metaTitle` renders verbatim with no suffix (see the `useAbsolute` branch in
 * lib/seo.ts), so each replacement below is the complete rendered string.
 *
 * The descriptions are fixed in the same pass because four of them were at or
 * over the 160-character truncation ceiling, and every blog description was the
 * `excerpt` field, which is also the article's literal first sentence. That put
 * the same sentence in the H1 subtitle, the opening paragraph, and the search
 * snippet. Writing a real description fixes the length and the triplication at once.
 *
 * The article H1s are deliberately untouched: they are the reader-facing headline
 * and are fine at their current length. Only the SERP-facing strings change.
 *
 * Idempotent: a field already holding the target value is skipped.
 */

const DRY_RUN = process.argv.includes("--dry-run");

interface MetaFix {
  slug: string;
  metaTitle: string;
  metaDescription: string;
}

/** Blog posts. Created in the admin, so there is no seed file to keep in sync. */
const BLOG_FIXES: MetaFix[] = [
  {
    slug: "how-businesses-can-choose-the-right-merchant-technology-for-long-term-growth",
    metaTitle: "Merchant Technology: How to Choose for Long-Term Growth",
    metaDescription:
      "Merchant technology shapes how you get paid. How to audit your current setup, judge flexibility, and check security before you commit.",
  },
  {
    slug: "ach-payment-a-complete-guide-to-automated-clearing-house-transactions",
    metaTitle: "ACH Payments: How They Work, Timing and Security",
    metaDescription:
      "An ACH payment moves money bank to bank over the Automated Clearing House network. How ACH payments work, how long they take, and how to accept them.",
  },
  {
    slug: "online-payments-a-complete-guide-to-how-digital-transactions-work",
    metaTitle: "Online Payments: Types, Security and How They Work",
    metaDescription:
      "How online payments work, from checkout to settlement, plus the main payment methods, the security layers behind them, and how to pick a provider.",
  },
  {
    slug: "what-is-a-chargeback-a-complete-guide-to-payment-disputes",
    metaTitle: "What Is a Chargeback? How Payment Disputes Work",
    metaDescription:
      "A chargeback reverses a card payment after a customer disputes it. How the dispute process works, what it costs you, and how to prevent chargebacks.",
  },
];

/**
 * Processors. These DO have seed literals, so `scripts/seed-seo.ts` is updated to
 * match in the same change; otherwise the next `npm run seed:seo` reverts them.
 *
 * Stripe's old title was 78 characters AND used "Payment Processing Guide" while
 * the rest of the site uses "Payment Processor Guide". Square's title was within
 * limits; only its 165-character description is trimmed.
 */
const PROCESSOR_FIXES: MetaFix[] = [
  {
    slug: "stripe",
    metaTitle: "Stripe Merchant Services Review: Fees and Pricing",
    metaDescription:
      "An independent Stripe merchant services review covering online rates, Canadian fees, payout speed, the fee calculator, and alternatives to Stripe.",
  },
  {
    slug: "square",
    metaTitle: "Square Review: Fees, Clover Comparison and Alternatives",
    metaDescription:
      "An independent Square review covering Square fees, hardware costs, Clover vs Square, and the best Square alternatives for small businesses.",
  },
];

function report(label: string, field: string, before: string | undefined, after: string) {
  const from = before ? `${before.length} chars` : "unset";
  console.log(`  ${label} ${field}: ${from} -> ${after.length} chars`);
  if (before) console.log(`      was: ${before}`);
  console.log(`      now: ${after}`);
}

async function main() {
  await connectForScript();

  let changed = 0;

  // The two models are iterated together, but their `findOne` overloads don't
  // unify, so the lookup is a per-group callback rather than a shared variable.
  const groups: { kind: string; fixes: MetaFix[]; find: (slug: string) => Promise<any> }[] = [
    { kind: "blog", fixes: BLOG_FIXES, find: (slug) => BlogPost.findOne({ slug }) },
    { kind: "processor", fixes: PROCESSOR_FIXES, find: (slug) => Processor.findOne({ slug }) },
  ];

  for (const { kind, fixes, find } of groups) {
    for (const fix of fixes) {
      const doc = await find(fix.slug);
      if (!doc) {
        console.error(`  MISSING ${kind}: ${fix.slug}`);
        process.exitCode = 1;
        continue;
      }
      const seo = (doc.seo ?? {}) as { metaTitle?: string; metaDescription?: string };
      const label = `${kind}/${fix.slug}`;

      if (seo.metaTitle !== fix.metaTitle) {
        report(label, "metaTitle", seo.metaTitle, fix.metaTitle);
        doc.set("seo.metaTitle", fix.metaTitle);
        changed += 1;
      }
      if (seo.metaDescription !== fix.metaDescription) {
        report(label, "metaDescription", seo.metaDescription, fix.metaDescription);
        doc.set("seo.metaDescription", fix.metaDescription);
        changed += 1;
      }
      if (!DRY_RUN && doc.isModified()) await doc.save();
    }
  }

  console.log(
    changed === 0
      ? "\nNothing to change."
      : DRY_RUN
        ? `\nDRY RUN: ${changed} field(s) would change.`
        : `\nWrote ${changed} field(s).`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
