import { loadEnv } from "./loadEnv";
loadEnv();

import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";

/**
 * One-off content repairs for the Search Console "Page indexing" report.
 *
 * A targeted script rather than a seed edit, for the reason the processor
 * listings use one: `npm run seed` rewrites whole documents from the seed file
 * and would clobber every admin edit made since. This touches two fields on the
 * posts that need them and nothing else.
 *
 * Dry-run by default; pass `--apply` to write.
 *
 *   npx tsx scripts/fix-blog-indexing.ts          # show the diff
 *   npx tsx scripts/fix-blog-indexing.ts --apply  # write it
 *
 * --- 1. Stray " ?" suffix -------------------------------------------------
 *
 * 13 posts carry a trailing space + question mark ("Why Payment Security Should
 * Be a Priority for Every Business ?"), which renders in both the <title> and the
 * H1. No correct English title has a space before its question mark, so this is
 * unambiguously an artifact rather than a stylistic choice — most likely fallout
 * from an earlier punctuation sweep.
 *
 * The match REQUIRES the whitespace. Titles that end in a question mark with no
 * space ("...for Your Business?") are left alone: whether a headline should be
 * phrased as a question is an editorial call, not a defect, and "What Is a
 * Chargeback? A Complete Guide" is correct as written.
 *
 * --- 2. Duplicate checkout post ------------------------------------------
 *
 * `how-faster-checkout-experiences-improve-customer-satisfaction` (416 words) and
 * `how-businesses-can-create-a-faster-and-safer-checkout-experience` (1,009
 * words, with FAQs) cover the same topic. Google clustered them and filed the
 * short one under "Duplicate without user-selected canonical" — it is not
 * indexed and never will be while the pair exists.
 *
 * `seo.redirectTo` (a 308) rather than a canonical or a noindex: a canonical is
 * a hint Google is free to ignore — and it already is ignoring the self-canonical
 * this page serves — while a noindex removes the page without passing on what it
 * earned. See `lib/seo-redirect.ts`.
 */

/** Trailing whitespace + "?" — the artifact. A bare "?" is left alone. */
const STRAY_QUESTION_MARK = /\s+\?\s*$/;

/** The consolidations to apply, as `from slug → to path`. */
const REDIRECTS: { slug: string; to: string }[] = [
  {
    slug: "how-faster-checkout-experiences-improve-customer-satisfaction",
    to: "/blog/how-businesses-can-create-a-faster-and-safer-checkout-experience",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  await connectToDatabase();

  const posts = await BlogPost.find({}).select("slug title seo").lean();
  let titleFixes = 0;
  let redirectFixes = 0;

  console.log(`\n--- stray " ?" in titles ---`);
  for (const post of posts as { _id: unknown; slug: string; title: string; seo?: { metaTitle?: string } }[]) {
    const set: Record<string, string> = {};

    if (STRAY_QUESTION_MARK.test(post.title)) {
      set.title = post.title.replace(STRAY_QUESTION_MARK, "");
    }
    const metaTitle = post.seo?.metaTitle;
    if (metaTitle && STRAY_QUESTION_MARK.test(metaTitle)) {
      set["seo.metaTitle"] = metaTitle.replace(STRAY_QUESTION_MARK, "");
    }
    if (Object.keys(set).length === 0) continue;

    titleFixes += 1;
    console.log(`  ${post.slug}`);
    for (const [field, value] of Object.entries(set)) {
      const before = field === "title" ? post.title : metaTitle;
      console.log(`    ${field}: "${before}" -> "${value}"`);
    }
    if (apply) await BlogPost.updateOne({ _id: post._id }, { $set: set });
  }

  console.log(`\n--- duplicate consolidation (308) ---`);
  for (const { slug, to } of REDIRECTS) {
    const post = posts.find((p) => (p as { slug: string }).slug === slug) as
      | { _id: unknown; slug: string; seo?: { redirectTo?: string } }
      | undefined;
    if (!post) {
      console.log(`  SKIP ${slug} — no such post`);
      continue;
    }
    // The target must exist and be published, or the 308 lands on a 404.
    const target = posts.find((p) => `/blog/${(p as { slug: string }).slug}` === to);
    if (!target) {
      console.log(`  SKIP ${slug} — redirect target ${to} does not exist`);
      continue;
    }
    if (post.seo?.redirectTo === to) {
      console.log(`  OK   ${slug} — already redirects to ${to}`);
      continue;
    }
    redirectFixes += 1;
    console.log(`  /blog/${slug} -> ${to}`);
    if (apply) await BlogPost.updateOne({ _id: post._id }, { $set: { "seo.redirectTo": to } });
  }

  console.log(
    `\n${apply ? "Applied" : "Would apply"}: ${titleFixes} title fix(es), ${redirectFixes} redirect(s).`,
  );
  if (!apply) console.log("Re-run with --apply to write.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
