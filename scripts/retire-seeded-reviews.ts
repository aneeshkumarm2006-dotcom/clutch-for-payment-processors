import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { Processor, Review } from "@/models";
import { recomputeProcessorRatings } from "@/lib/ratings";

/**
 * Take the seeded demo reviews off the public site.
 *
 *   npx tsx scripts/retire-seeded-reviews.ts --dry-run   # report only (START HERE)
 *   npx tsx scripts/retire-seeded-reviews.ts             # reject + recompute
 *   npx tsx scripts/retire-seeded-reviews.ts --delete    # hard-delete instead
 *   npx tsx scripts/retire-seeded-reviews.ts --restore   # undo a reject run
 *
 * WHAT THIS IS FOR
 *
 * `scripts/seed.ts` attaches four reviews to each of its ten demo processors from
 * a pool of six templates, tagged `source: "import"`. Its own header calls them
 * fictional demo data. They reached production anyway, and on 18 August 2026 the
 * live database held 40 of them: six reviewer names, two body templates with the
 * processor's name substituted in, 27 flagged `isVerified`, every processor landing
 * on exactly 4.5 stars.
 *
 * They are not a cosmetic problem. They render as merchant reviews on ten profiles,
 * and `lib/engine` marks them up as `Review` plus `AggregateRating` in the JSON-LD,
 * which is what puts a star rating in the search result. Fabricated review markup
 * is against Google's review-snippet policy, and in the US the FTC's rule on
 * consumer reviews (16 CFR Part 465, effective October 2024) covers exactly this:
 * reviews that misrepresent themselves as the experience of a real customer.
 *
 * WHY REJECT RATHER THAN DELETE, BY DEFAULT
 *
 * `status: "rejected"` takes them out of every public query (`getApprovedReviews`
 * filters on `approved`) and out of the aggregates, while leaving the rows in place.
 * That makes the change reversible with `--restore`. `--delete` is available for
 * when you want them gone for good, and cannot be undone from here.
 *
 * EITHER WAY, EDIT `scripts/seed.ts` TOO
 *
 * This script does not touch `seed.ts`, so a later `npm run seed` reinserts all 40
 * and reapproves them. The seed's review block is around the
 * "--- Reviews: replace seeded set" marker. Removing it is the durable fix; see the
 * note printed at the end of a successful run.
 */

const SOURCE = "import" as const;

const log = (m: string) => {
  // eslint-disable-next-line no-console
  console.log(m);
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const hardDelete = process.argv.includes("--delete");
  const restore = process.argv.includes("--restore");

  if (hardDelete && restore) throw new Error("Pick one of --delete or --restore, not both");

  await connectForScript();

  // `--restore` is the only mode that looks at rejected rows; every other mode
  // works on what is currently public.
  const filter = restore
    ? { source: SOURCE, status: "rejected" as const }
    : { source: SOURCE, status: "approved" as const };

  const reviews = await Review.find(filter).select("processor reviewerName title status").lean();

  if (!reviews.length) {
    log(`No ${restore ? "rejected" : "approved"} reviews with source "${SOURCE}". Nothing to do.`);
    return;
  }

  const processorIds = [...new Set(reviews.map((r) => String(r.processor)))];
  const procs = await Processor.find({ _id: { $in: processorIds } })
    .select("slug name ratingAverage ratingCount")
    .lean();
  const bySlug = new Map(procs.map((p) => [String(p._id), p]));

  log(
    `${reviews.length} seeded review(s) across ${processorIds.length} processor(s):\n` +
      procs
        .map(
          (p) =>
            `  ${String(p.slug).padEnd(16)} ${String(p.ratingCount).padStart(2)} reviews ` +
            `@ ${p.ratingAverage} stars`,
        )
        .join("\n"),
  );

  const names = [...new Set(reviews.map((r) => r.reviewerName))];
  log(`\nDistinct reviewer names across all ${reviews.length}: ${names.length} (${names.join(", ")})`);

  if (dryRun) {
    const verb = restore ? "re-approve" : hardDelete ? "DELETE" : "reject";
    log(
      `\n[dry-run] Would ${verb} ${reviews.length} review(s) and recompute ratings for ` +
        `${processorIds.length} processor(s). Nothing was written.`,
    );
    return;
  }

  if (hardDelete) {
    const res = await Review.deleteMany(filter);
    log(`\nDeleted ${res.deletedCount} review(s).`);
  } else {
    const res = await Review.updateMany(filter, {
      $set: { status: restore ? "approved" : "rejected" },
    });
    log(`\n${restore ? "Re-approved" : "Rejected"} ${res.modifiedCount} review(s).`);
  }

  // Aggregates are written ONLY through lib/ratings.ts (PRD §15). With no approved
  // reviews left it resets ratingAverage, ratingCount, subRatings and topMentions
  // to zero, which is what clears the stars from the profile and from the JSON-LD.
  for (const id of processorIds) {
    const r = await recomputeProcessorRatings(id);
    const p = bySlug.get(id);
    log(
      `  ${String(p?.slug ?? id).padEnd(16)} now ${r.ratingCount} reviews @ ${r.ratingAverage} stars`,
    );
  }

  if (!restore) {
    log(
      `\nNEXT: remove the review block from scripts/seed.ts (search for\n` +
        `"--- Reviews: replace seeded") or the next \`npm run seed\` puts all of\n` +
        `them back and reapproves them.`,
    );
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
