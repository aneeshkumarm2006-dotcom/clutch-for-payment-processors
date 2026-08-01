import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { SiteSettings } from "@/models";

/**
 * Repair the placeholder identity data that shipped to production in SiteSettings.
 *
 *   npx tsx scripts/fix-site-identity.ts --dry-run
 *   npx tsx scripts/fix-site-identity.ts
 *
 * Three separate live defects, all from the same singleton document:
 *
 *  1. `socialLinks.twitter` = https://twitter.com/paymentprocessorguide  -> HTTP 404
 *     `socialLinks.linkedin` = https://www.linkedin.com/company/paymentprocessorguide -> HTTP 404
 *     These render in the footer of EVERY page, so all 78 pages carried two
 *     broken outbound links (Semrush: "external pages or resources with 403/404").
 *     Worse, `lib/engine/context.ts` feeds them into `Organization.sameAs`, which
 *     is how a search engine confirms an entity's identity — pointing it at two
 *     dead profiles is an active trust signal against the site. Removed rather
 *     than guessed at: an unverified sameAs is worth less than no sameAs. Put the
 *     real profile URLs back in /admin > Settings once the accounts exist.
 *
 *  2. `contactEmail` = hello@paymentprocessorguide.test  -> undeliverable
 *     `.test` is a reserved TLD that can never resolve (RFC 6761). It was rendered
 *     as a live `mailto:` on /contact AND used as the fallback destination for
 *     lead + submission notification email (app/api/leads/route.ts,
 *     app/api/submissions/route.ts), so every enquiry that wasn't caught by
 *     LEADS_NOTIFY_EMAIL was being sent into a black hole. Corrected to the
 *     site's real domain.
 *
 *  3. `footerText` described the site as a "Sample directory" on every page.
 *
 * Idempotent: each field is only written when it still holds the bad value.
 */

const DRY_RUN = process.argv.includes("--dry-run");

/** The live domain (NEXT_PUBLIC_SITE_URL is www.paymentprocessingguide.com). */
const CONTACT_EMAIL = "hello@paymentprocessingguide.com";

const FOOTER_TEXT =
  "© Payment Processor Guide. An independent directory. Fees and terms change often, " +
  "so confirm the current rate with each provider before you sign.";

const BROKEN_SOCIAL = [
  "https://twitter.com/paymentprocessorguide",
  "https://www.linkedin.com/company/paymentprocessorguide",
];

async function main() {
  await connectForScript();

  const settings = await SiteSettings.findOne({ key: "singleton" });
  if (!settings) {
    console.error("No SiteSettings singleton found. Run `npm run seed` first.");
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  const changes: string[] = [];

  if (settings.contactEmail?.endsWith(".test")) {
    changes.push(`contactEmail: ${settings.contactEmail} -> ${CONTACT_EMAIL}`);
    settings.contactEmail = CONTACT_EMAIL;
  }

  // `socialLinks` is a Mongoose subdocument, so `Object.entries` on the live doc
  // walks internal state, not the fields. Read it as a plain object first.
  const social = (settings.toObject().socialLinks ?? {}) as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(social)) {
    if (value && BROKEN_SOCIAL.includes(value)) {
      changes.push(`socialLinks.${key}: removed (${value} returns 404)`);
      settings.set(`socialLinks.${key}`, undefined);
    }
  }

  if (settings.footerText?.includes("Sample directory")) {
    changes.push(`footerText: "${settings.footerText}" -> "${FOOTER_TEXT}"`);
    settings.footerText = FOOTER_TEXT;
  }

  if (!changes.length) {
    console.log("Nothing to fix. SiteSettings is already clean.");
    await mongoose.disconnect();
    return;
  }

  for (const c of changes) console.log(`  ${c}`);

  if (DRY_RUN) {
    console.log("\nDRY RUN: nothing written.");
  } else {
    await settings.save();
    console.log(`\nWrote ${changes.length} change(s) to SiteSettings.`);
    console.log(
      "\nACTION NEEDED: confirm a mailbox exists at " +
        CONTACT_EMAIL +
        " (it is now shown on /contact and receives lead notifications), " +
        "and add real social profile URLs in /admin > Settings when the accounts exist.",
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
