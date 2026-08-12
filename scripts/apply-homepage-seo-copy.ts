import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { PageSeo, SiteSettings } from "@/models";
import { HOMEPAGE_DEFAULTS } from "@/lib/homepage";
import { HOMEPAGE_FAQS } from "./data/homepage-faqs";

/**
 * Push the homepage's SEO copy revision into an already-seeded database.
 *
 *   npx tsx scripts/apply-homepage-seo-copy.ts --dry-run
 *   npx tsx scripts/apply-homepage-seo-copy.ts
 *
 * Editing `lib/homepage.ts` is not enough on a live site. `resolveHomepage()`
 * reads a stored value in preference to the built-in default, so any field the
 * admin panel has ever saved shadows the code — and saving the landing-page form
 * once writes the whole `homepage` sub-document, steps included. This script
 * closes that gap for the fields the revision actually changed:
 *
 *  - Hero sub-headline. Stored on `SiteSettings.homepageHeroSubtitle` (a
 *    required top-level field, so it is always set and always shadows the
 *    default). Taken from `HOMEPAGE_DEFAULTS` so the two can't drift.
 *
 *  - "Compare" step body. Only rewritten when it still holds the previous copy;
 *    a body an editor has since rewritten by hand is left alone.
 *
 *  - Homepage FAQs. Five Q&As on the "home" PageSeo record, replacing the four
 *    that were there. They render in the FAQ section AND as FAQPage schema, so
 *    they change together or not at all.
 *
 * The new section intro paragraphs need no write: `description` is a new field,
 * nothing has stored one, and blank inherits the default. The script still
 * reports a stored heading that would shadow the new copy rather than silently
 * overwriting an editor's wording.
 *
 * Idempotent: every field is compared before it is written.
 */

const DRY_RUN = process.argv.includes("--dry-run");

const changes: string[] = [];
const note = (s: string) => {
  changes.push(s);
  console.log(`  ${s}`);
};

/** What the "Compare" step said before this revision. Anything else is an editor's own words. */
const PREVIOUS_COMPARE_STEP_BODY =
  "Put 2 to 4 processors side by side on pricing, features, and verified merchant reviews.";

const SECTIONS_WITH_NEW_INTRO = ["categories", "featured", "compare"] as const;

async function main() {
  await connectForScript();

  // --- SiteSettings: hero sub-headline + the "Compare" step -----------------
  const settings = await SiteSettings.findOne({ key: "singleton" });
  if (!settings) {
    console.error("  MISSING SiteSettings singleton. Run `npm run seed` first.");
    process.exitCode = 1;
  } else {
    const subtitle = HOMEPAGE_DEFAULTS.hero.subtitle;
    if (settings.homepageHeroSubtitle !== subtitle) {
      note(`homepageHeroSubtitle -> "${subtitle}"`);
      settings.homepageHeroSubtitle = subtitle;
    }

    // Stored steps shadow the defaults wholesale, so the new step copy only
    // reaches the page through this write.
    const steps = settings.homepage?.howItWorks?.steps;
    if (Array.isArray(steps)) {
      const target = HOMEPAGE_DEFAULTS.howItWorks.steps[1]!;
      const i = steps.findIndex((s) => (s?.body ?? "").trim() === PREVIOUS_COMPARE_STEP_BODY);
      if (i >= 0) {
        note(`homepage.howItWorks.steps.${i}.body -> "${target.body}"`);
        settings.set(`homepage.howItWorks.steps.${i}.body`, target.body);
      } else if (!steps.some((s) => (s?.body ?? "").trim() === target.body)) {
        console.log(
          "  (homepage.howItWorks.steps: stored, but no step matches the previous or the new " +
            "copy. Left alone — check /admin/homepage → Sections → How it works.)",
        );
      }
    }

    // The intro paragraphs are a new field, so they can only be shadowed by a
    // heading an editor typed over. Report, don't overwrite.
    for (const key of SECTIONS_WITH_NEW_INTRO) {
      const stored = (settings.homepage?.[key]?.title ?? "").trim();
      const fallback = HOMEPAGE_DEFAULTS[key].title;
      if (stored && stored !== fallback) {
        console.log(
          `  (homepage.${key}.title is overridden as "${stored}"; the built-in "${fallback}" ` +
            "and its new intro paragraph still apply.)",
        );
      }
    }

    if (!DRY_RUN && settings.isModified()) await settings.save();
  }

  // --- PageSeo "home": the FAQ set ------------------------------------------
  const page = await PageSeo.findOne({ pageKey: "home" });
  if (!page) {
    console.error('  MISSING PageSeo record for pageKey "home". Run `npm run seed:seo` first.');
    process.exitCode = 1;
  } else {
    const current = (page.faqs ?? []).map((f) => `${f.question}|${f.answer}`).join("\n");
    const next = HOMEPAGE_FAQS.map((f) => `${f.question}|${f.answer}`).join("\n");
    if (current !== next) {
      note(`page-seo/home faqs: ${page.faqs?.length ?? 0} -> ${HOMEPAGE_FAQS.length} Q&As`);
      page.set("faqs", HOMEPAGE_FAQS);
      if (!DRY_RUN) await page.save();
    }
  }

  console.log(
    changes.length === 0
      ? "\nNothing to change."
      : DRY_RUN
        ? `\nDRY RUN: ${changes.length} change(s) pending.`
        : `\nWrote ${changes.length} change(s). The homepage is ISR (revalidate 3600) — redeploy or wait for the window.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
