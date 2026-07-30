import { loadEnv } from "./loadEnv";
loadEnv();

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, Processor } from "@/models";
import { processorPublishInput } from "@/lib/validators/processor";

/**
 * Idempotent upsert for researched processor listings.
 *
 * Deliberately NOT folded into `scripts/seed.ts`. That file is the sample-data
 * seed: it rewrites all ten demo processors from its own literals (clobbering any
 * admin edit) and attaches four fabricated reviews to each. Running it to add one
 * real listing silently reverts every edit made through /admin since the last
 * seed. This script touches only the documents named in `scripts/data/processors/`
 * and writes nothing else.
 *
 *   npx tsx scripts/add-processors.ts                     # write all
 *   npx tsx scripts/add-processors.ts --dry-run           # validate + report only
 *   npx tsx scripts/add-processors.ts --only=mollie,ebanx # subset
 *   npx tsx scripts/add-processors.ts --draft             # force every one to draft
 *
 * A listing goes live unless its own file says `"isPublished": false`, which is
 * how a researched-but-not-for-publication listing (a defunct vendor, say) stays
 * in version control without appearing in the directory. `--draft` forces the
 * whole batch down regardless.
 *
 * Listing data lives in `scripts/data/processors/<slug>.json`, one file per
 * listing, rather than as literals here: adding the next processor is dropping in
 * a file, and each file diffs on its own. `logo` is an inline base64 data URI
 * (the convention in this DB; `logo.clearbit.com`, which seed.ts still uses, is
 * dead). Regenerate one with `node scripts/fetch-logos.mjs`.
 *
 * `categorySlugs` is resolved to Category ObjectIds at write time, and every
 * record is validated through `processorPublishInput` first, the same zod schema
 * the admin form runs on Publish, so this script cannot write a document the UI
 * would reject.
 */

const DATA_DIR = join(process.cwd(), "scripts", "data", "processors");

/** The shape on disk: the publish payload, with categories still as slugs. */
type ListingFile = Record<string, unknown> & {
  slug: string;
  name: string;
  categorySlugs: string[];
  /** Defaults to true. Set false to keep a researched listing out of the directory. */
  isPublished?: boolean;
  /** Research provenance. Kept in the file, never written to the DB. */
  sources?: string[];
  logoDomain?: string;
  logoSource?: string;
};

function readListings(only: string[] | null): ListingFile[] {
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const listings = files.map((f) => {
    const parsed = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as ListingFile;
    const expected = `${parsed.slug}.json`;
    if (f !== expected) {
      throw new Error(`${f} declares slug "${parsed.slug}"; rename the file to ${expected}`);
    }
    return parsed;
  });
  if (!only) return listings;

  const bySlug = new Map(listings.map((l) => [l.slug, l]));
  const missing = only.filter((s) => !bySlug.has(s));
  if (missing.length) throw new Error(`No data file for: ${missing.join(", ")}`);
  return only.map((s) => bySlug.get(s)!);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const draft = process.argv.includes("--draft");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()) : null;

  const listings = readListings(only);

  await connectToDatabase();

  // Resolve every category slug in one query. A missing slug is fatal: publishing
  // without a category drops the listing out of every directory facet.
  const wanted = [...new Set(listings.flatMap((l) => l.categorySlugs))];
  const cats = await Category.find({ slug: { $in: wanted } }, { slug: 1 }).lean();
  const catId = new Map(cats.map((c) => [c.slug, String(c._id)]));
  const missing = wanted.filter((s) => !catId.has(s));
  if (missing.length) {
    throw new Error(`Missing categories: ${missing.join(", ")}. Run \`npm run seed\` first.`);
  }

  // Validate everything BEFORE the first write, so a bad record in the middle of
  // the batch cannot leave the DB half-updated.
  const prepared = listings.map((listing) => {
    const {
      categorySlugs,
      sources: _sources,
      logoDomain: _logoDomain,
      logoSource: _logoSource,
      ...rest
    } = listing;
    try {
      return {
        slug: listing.slug,
        name: listing.name,
        doc: processorPublishInput.parse({
          ...rest,
          categories: categorySlugs.map((s) => catId.get(s)!),
          isPublished: draft ? false : (listing.isPublished ?? true),
        }),
        categorySlugs,
      };
    } catch (err) {
      throw new Error(
        `${listing.slug}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 4000),
      );
    }
  });

  if (dryRun) {
    for (const p of prepared) {
      const existing = await Processor.exists({ slug: p.slug });
      const logo = p.doc.logo ?? "";
      // eslint-disable-next-line no-console
      console.log(
        `${existing ? "update" : "insert"}  ${p.slug.padEnd(18)} ${p.name.padEnd(20)} ` +
          `${p.doc.isPublished ? "live " : "DRAFT"}  logo ${String(logo.length).padStart(6)} chars  ` +
          `[${p.categorySlugs.join(", ")}]`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`\n✓ ${prepared.length} listing(s) valid. Dry run: nothing was written.`);
    return;
  }

  for (const p of prepared) {
    // `slug` lives in the filter + $setOnInsert; Mongo rejects the same path in
    // both $set and $setOnInsert (same reason as scripts/seed.ts).
    const { slug: _slug, ...set } = p.doc;
    const doc = await Processor.findOneAndUpdate(
      { slug: p.slug },
      { $set: set, $setOnInsert: { slug: p.slug } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    // eslint-disable-next-line no-console
    console.log(`✓ ${doc!.name.padEnd(20)} /processor/${doc!.slug}  (published: ${doc!.isPublished})`);
  }

  // eslint-disable-next-line no-console
  console.log(`\n${prepared.length} listing(s) written.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
