import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { Processor } from "@/models";

/**
 * Strip the hardcoded brand suffix from stored processor `seo.metaTitle` values.
 *
 *   npx tsx scripts/fix-processor-title-suffix.ts --dry-run
 *   npx tsx scripts/fix-processor-title-suffix.ts
 *
 * Thirty processor titles were stored as
 *   "<Name> Review | Pricing, Fees and Features | Payment Processing Guide"
 * which is 66 to 88 rendered characters. Two things are wrong with the suffix:
 *
 *  1. It is redundant. A stored `metaTitle` renders VERBATIM (the `useAbsolute`
 *     branch in lib/seo.ts) precisely so an editor can control the whole string;
 *     baking a brand suffix into it just spends 26 characters of a 60-character
 *     budget. Google truncates what is left, so the fees and features the title
 *     is actually competing on get cut instead.
 *
 *  2. It is the wrong brand. The site name is "Payment Processor Guide"
 *     (SITE_NAME in lib/seo.ts, the layout title template, and the Organization
 *     JSON-LD). "Payment Processing Guide" is the DOMAIN, not the brand. Shipping
 *     both across the site muddies the entity for exactly the audience that
 *     matters here.
 *
 * Semrush only flagged 5 over-long titles because its crawl budget covered 78 of
 * 278 URLs. This is the same defect on the pages it never reached.
 *
 * Idempotent: only documents whose metaTitle still ends with the suffix change.
 */

const DRY_RUN = process.argv.includes("--dry-run");

/** Every brand-suffix spelling that has been stored, longest first. */
const SUFFIXES = [
  " | Payment Processing Guide",
  " | Payment Processor Guide",
  " - Payment Processing Guide",
  " - Payment Processor Guide",
];

async function main() {
  await connectForScript();

  const docs = await Processor.find({ "seo.metaTitle": { $exists: true, $ne: "" } }).select(
    "slug seo.metaTitle",
  );

  let changed = 0;
  let stillLong = 0;

  for (const doc of docs) {
    const current = (doc.seo as { metaTitle?: string } | undefined)?.metaTitle?.trim();
    if (!current) continue;

    const suffix = SUFFIXES.find((s) => current.endsWith(s));
    if (!suffix) {
      if (current.length > 60) {
        stillLong += 1;
        console.log(`  (${doc.slug}: ${current.length} chars, no known suffix to strip)`);
      }
      continue;
    }

    const next = current.slice(0, -suffix.length).trim();
    if (!next) {
      console.error(`  ${doc.slug}: metaTitle is only the suffix; leaving it alone`);
      continue;
    }

    console.log(`  ${doc.slug.padEnd(28)} ${current.length} -> ${next.length}: ${next}`);
    doc.set("seo.metaTitle", next);
    changed += 1;
    if (!DRY_RUN) await doc.save();
    if (next.length > 60) stillLong += 1;
  }

  console.log(
    changed === 0
      ? "\nNothing to change."
      : DRY_RUN
        ? `\nDRY RUN: ${changed} title(s) would be shortened.`
        : `\nShortened ${changed} title(s).`,
  );
  if (stillLong) {
    console.log(`${stillLong} title(s) are still over 60 characters and need a manual rewrite.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
