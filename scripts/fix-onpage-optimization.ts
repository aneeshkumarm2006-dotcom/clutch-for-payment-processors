import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { BlogPost, Processor, SiteSettings } from "@/models";
import { HOMEPAGE_DEFAULTS } from "@/lib/homepage";

/**
 * Fix the on-page slots behind Semrush's "content not optimized" on six URLs.
 *
 *   npx tsx scripts/fix-onpage-optimization.ts --dry-run
 *   npx tsx scripts/fix-onpage-optimization.ts
 *
 * The check fires when a page's target term is missing from the slots that carry
 * weight (H1, first paragraph, headings) even where body density looks fine. Each
 * change below fills a slot that was measurably empty on the live page.
 *
 *  - Processor H1s. The route rendered `<h1>{name}</h1>`, so every profile had a
 *    one-word heading. `app/(public)/processor/[slug]/page.tsx` now falls back to
 *    "{name} review" and honours `seo.h1`; the two audited profiles get a
 *    specific one.
 *
 *  - Homepage. The H1 in Mongo is "Find the right payment processor" and the lede
 *    carries no target term at all, so the site's own name appears in no
 *    structural slot on its own homepage.
 *
 *  - Blog keyword backlinks. All four flagged posts had ZERO contextual internal
 *    links: the only links inside <main> were the breadcrumb and three auto
 *    "more from the blog" cards. The site already has the machinery for this —
 *    `injectKeywordLinks` runs on every render and turns `keywords` into anchors
 *    without touching the stored body — and the field was simply empty. Filling
 *    it links each post into the glossary, facet, and directory clusters it
 *    should be feeding, and (deliberately) points the head terms at the pages
 *    that own them in keyword-page-map.csv rather than letting the posts compete
 *    with /glossary/chargeback and /payment-processors/ach.
 *
 *  - Cover image alt text. All four fell back to "Cover image for {title}",
 *    which describes nothing.
 *
 * Idempotent: every field is compared before it is written.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const changes: string[] = [];
const note = (s: string) => {
  changes.push(s);
  console.log(`  ${s}`);
};

/** Processor `seo.h1` overrides. Everything else uses the "{name} review" default. */
const PROCESSOR_H1: Record<string, string> = {
  stripe: "Stripe merchant services review",
  square: "Square review: fees, hardware and alternatives",
};

interface BlogFix {
  slug: string;
  coverImageAlt: string;
  /** keyword -> internal path. Rendered as dofollow anchors on first occurrence. */
  links: Record<string, string>;
}

/**
 * Anchors are chosen from terms that ACTUALLY appear in each body (verified by
 * scanning the stored HTML), and each anchor describes what it points at. A
 * keyword the injector never matches is a link that silently does not exist, and
 * an anchor that misdescribes its destination is worse than no link at all.
 *
 * Head terms deliberately point AWAY from the post: "chargebacks" goes to
 * /glossary/chargeback, "ACH payments" to /payment-processors/ach. Those pages
 * own the terms in keyword-page-map.csv, and the posts were competing with them
 * while passing them nothing.
 */
const BLOG_FIXES: BlogFix[] = [
  {
    slug: "ach-payment-a-complete-guide-to-automated-clearing-house-transactions",
    coverImageAlt:
      "An ACH payment moving between two bank accounts over the Automated Clearing House network",
    links: {
      "ACH payments": "/payment-processors/ach",
      authorization: "/glossary/authorization",
      "recurring billing": "/glossary/recurring-billing",
      "processing fees": "/glossary/effective-rate",
      "payment processors": "/processors",
    },
  },
  {
    slug: "online-payments-a-complete-guide-to-how-digital-transactions-work",
    coverImageAlt:
      "An online payment travelling from customer checkout through the gateway and processor to the merchant's bank",
    links: {
      "payment gateway": "/glossary/payment-gateway",
      tokenization: "/glossary/tokenization",
      "digital wallets": "/glossary/digital-wallet",
      settlement: "/glossary/settlement",
      "payment processors": "/processors",
    },
  },
  {
    slug: "what-is-a-chargeback-a-complete-guide-to-payment-disputes",
    coverImageAlt:
      "A chargeback dispute moving between cardholder, issuing bank, payment processor and merchant",
    links: {
      chargebacks: "/glossary/chargeback",
      disputes: "/glossary/dispute",
      refund: "/glossary/refund",
      "recurring billing": "/glossary/recurring-billing",
      "payment processors": "/processors",
    },
  },
  {
    slug: "how-businesses-can-choose-the-right-merchant-technology-for-long-term-growth",
    coverImageAlt:
      "A business owner reviewing merchant technology options on a point-of-sale terminal and laptop",
    // Only one accurate anchor exists in this post's 353 words. It is thin enough
    // that the real fix is more article, not more links.
    links: {
      checkout: "/glossary/hosted-checkout",
    },
  },
];

/**
 * Homepage hero. The H1 and the lede under it.
 *
 * Read from `HOMEPAGE_DEFAULTS` rather than copied: this script and the built-in
 * default are the same two strings, and when they were spelled out twice a later
 * copy change to one of them made re-running this script silently revert it.
 */
const HERO_TITLE = HOMEPAGE_DEFAULTS.hero.title;
const HERO_SUBTITLE = HOMEPAGE_DEFAULTS.hero.subtitle;

async function main() {
  await connectForScript();

  // --- Processor H1s --------------------------------------------------------
  for (const [slug, h1] of Object.entries(PROCESSOR_H1)) {
    const doc = await Processor.findOne({ slug });
    if (!doc) {
      console.error(`  MISSING processor: ${slug}`);
      process.exitCode = 1;
      continue;
    }
    if ((doc.seo as { h1?: string } | undefined)?.h1 !== h1) {
      note(`processor/${slug} seo.h1 -> "${h1}"`);
      doc.set("seo.h1", h1);
      if (!DRY_RUN) await doc.save();
    }
  }

  // --- Homepage hero --------------------------------------------------------
  const settings = await SiteSettings.findOne({ key: "singleton" });
  if (settings) {
    if (settings.homepageHeroTitle !== HERO_TITLE) {
      note(`homepageHeroTitle: "${settings.homepageHeroTitle}" -> "${HERO_TITLE}"`);
      settings.homepageHeroTitle = HERO_TITLE;
    }
    if (settings.homepageHeroSubtitle !== HERO_SUBTITLE) {
      note(`homepageHeroSubtitle -> "${HERO_SUBTITLE}"`);
      settings.homepageHeroSubtitle = HERO_SUBTITLE;
    }
    if (!DRY_RUN && settings.isModified()) await settings.save();
  } else {
    console.error("  MISSING SiteSettings singleton");
    process.exitCode = 1;
  }

  // --- Blog posts -----------------------------------------------------------
  for (const fix of BLOG_FIXES) {
    const doc = await BlogPost.findOne({ slug: fix.slug });
    if (!doc) {
      console.error(`  MISSING blog post: ${fix.slug}`);
      process.exitCode = 1;
      continue;
    }

    if (doc.coverImageAlt !== fix.coverImageAlt) {
      note(`blog/${fix.slug} coverImageAlt -> "${fix.coverImageAlt}"`);
      doc.coverImageAlt = fix.coverImageAlt;
    }

    // Only keywords that actually appear in the body are worth storing: a keyword
    // the injector never matches is a link that silently does not exist.
    const body = String(doc.content ?? "");
    const present = Object.entries(fix.links).filter(([kw]) =>
      new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body),
    );
    const skipped = Object.keys(fix.links).filter((kw) => !present.some(([k]) => k === kw));
    if (skipped.length) {
      console.log(`  (blog/${fix.slug}: not in body, skipped: ${skipped.join(", ")})`);
    }

    const wanted = present.map(([keyword, url]) => ({ keyword, url, rel: "dofollow" as const }));
    const current = (doc.keywords ?? []).map((k) => `${k.keyword}|${k.url}`).sort().join(",");
    const next = wanted.map((k) => `${k.keyword}|${k.url}`).sort().join(",");
    if (current !== next) {
      note(`blog/${fix.slug} keywords: ${doc.keywords?.length ?? 0} -> ${wanted.length} internal backlink(s)`);
      doc.set("keywords", wanted);
    }

    if (!DRY_RUN && doc.isModified()) await doc.save();
  }

  console.log(
    changes.length === 0
      ? "\nNothing to change."
      : DRY_RUN
        ? `\nDRY RUN: ${changes.length} change(s) pending.`
        : `\nWrote ${changes.length} change(s).`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
