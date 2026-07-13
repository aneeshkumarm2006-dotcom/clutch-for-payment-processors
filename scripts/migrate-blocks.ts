import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BlogPost, Category, PageSeo, Processor } from "@/models";

/**
 * scripts/migrate-blocks.ts — move legacy rich-text content into `blocks[]`, and
 * back out again.
 *
 *   npm run migrate:blocks -- --up            # dry run (prints what it WOULD do)
 *   npm run migrate:blocks -- --up --commit
 *   npm run migrate:blocks -- --up --commit --collection=processors --slug=stripe
 *   npm run migrate:blocks -- --down --commit
 *
 * ── Why this is safe to run, and safe to un-run ──
 *
 * `--up` COPIES the legacy HTML into a `richtext` block. It never deletes the
 * source field. `Processor.longDescription`, `Category.introContent` and
 * `BlogPost.content` are left exactly as they are, which is what makes `--down` a
 * true inverse: it removes `blocks`/`structuredData` and the page falls straight
 * back to rendering the legacy field it never stopped having. No content is
 * reconstructed, so nothing can be lost in the round-trip.
 *
 * BlogPost is deliberately EXCLUDED from `--up`. A post's `content` must stay the
 * authoritative HTML body — `injectKeywordLinks`, `computeReadingTime` and the
 * word-count SEO check all read it, and a post whose body had been moved into a
 * block would look empty to all three. Posts can still gain blocks; they just
 * render around the body rather than replacing it.
 *
 * Dry-run by default. Nothing is written without `--commit`.
 */

type Target = "processors" | "categories" | "pages";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const value = (key: string): string | undefined =>
  args.find((a) => a.startsWith(`--${key}=`))?.split("=").slice(1).join("=");

const UP = has("--up");
const DOWN = has("--down");
const COMMIT = has("--commit");
const ONLY_SLUG = value("slug");
const ONLY_COLLECTION = value("collection") as Target | undefined;

/** The legacy HTML field each collection keeps its long-form content in. */
const LEGACY_FIELD: Record<Target, string> = {
  processors: "longDescription",
  categories: "introContent",
  pages: "", // PageSeo has no legacy long-form field — blocks only.
};

const MODELS = {
  processors: Processor,
  categories: Category,
  pages: PageSeo,
} as const;

const isBlank = (html: unknown) =>
  typeof html !== "string" || html.trim() === "" || html.trim() === "<p></p>";

async function up() {
  const targets: Target[] = ONLY_COLLECTION ? [ONLY_COLLECTION] : ["processors", "categories"];
  let touched = 0;

  for (const target of targets) {
    const field = LEGACY_FIELD[target];
    if (!field) {
      console.log(`[skip] ${target} has no legacy long-form field.`);
      continue;
    }

    const Model = MODELS[target] as unknown as mongoose.Model<Record<string, unknown>>;
    const filter: Record<string, unknown> = ONLY_SLUG ? { slug: ONLY_SLUG } : {};
    const docs = await Model.find(filter).lean();

    for (const doc of docs) {
      const html = doc[field];
      const existing = doc.blocks as unknown[] | undefined;

      if (existing?.length) {
        console.log(`  – ${target}/${String(doc.slug)}: already has blocks, skipping.`);
        continue;
      }
      if (isBlank(html)) continue;

      const blocks = [{ type: "richtext", id: randomUUID(), data: { html: String(html) } }];

      console.log(
        `  ✓ ${target}/${String(doc.slug)}: ${field} (${String(html).length} chars) → 1 richtext block`,
      );
      touched++;

      if (COMMIT) {
        // $set only `blocks`. The legacy field is deliberately left in place — it
        // is what `--down` falls back to.
        await Model.updateOne({ _id: doc._id }, { $set: { blocks } });
      }
    }
  }

  console.log(
    `\n${COMMIT ? "Migrated" : "Would migrate"} ${touched} document(s).` +
      (COMMIT ? "" : "  Re-run with --commit to apply."),
  );
}

async function down() {
  const targets: Target[] = ONLY_COLLECTION
    ? [ONLY_COLLECTION]
    : ["processors", "categories", "pages"];
  let touched = 0;

  for (const target of targets) {
    const Model = MODELS[target] as unknown as mongoose.Model<Record<string, unknown>>;
    const filter: Record<string, unknown> = ONLY_SLUG ? { slug: ONLY_SLUG } : {};
    const docs = await Model.find({
      ...filter,
      $or: [{ blocks: { $exists: true } }, { structuredData: { $exists: true } }],
    }).lean();

    for (const doc of docs) {
      const n = (doc.blocks as unknown[] | undefined)?.length ?? 0;
      console.log(`  ✓ ${target}/${String(doc.slug ?? doc.pageKey)}: dropping ${n} block(s) + schema overrides`);
      touched++;

      if (COMMIT) {
        await Model.updateOne({ _id: doc._id }, { $unset: { blocks: "", structuredData: "" } });
      }
    }
  }

  // BlogPost never gains blocks from --up, but an editor may have added some by
  // hand, so --down must be able to clear them too.
  if (!ONLY_COLLECTION) {
    const posts = await BlogPost.find({
      $or: [{ blocks: { $exists: true } }, { structuredData: { $exists: true } }],
    }).lean();
    for (const post of posts) {
      console.log(`  ✓ blog/${post.slug}: dropping ${post.blocks?.length ?? 0} block(s) + schema overrides`);
      touched++;
      if (COMMIT) {
        await BlogPost.updateOne({ _id: post._id }, { $unset: { blocks: "", structuredData: "" } });
      }
    }
  }

  console.log(
    `\n${COMMIT ? "Reverted" : "Would revert"} ${touched} document(s).` +
      (COMMIT ? "" : "  Re-run with --commit to apply.") +
      `\nLegacy content was never removed, so every page renders exactly as it did before the migration.`,
  );
}

async function main() {
  if (UP === DOWN) {
    console.error("Pass exactly one of --up or --down.\n");
    console.error("  npm run migrate:blocks -- --up                       (dry run)");
    console.error("  npm run migrate:blocks -- --up --commit");
    console.error("  npm run migrate:blocks -- --down --commit");
    console.error("\nOptional: --collection=processors|categories|pages  --slug=<slug>");
    process.exit(1);
  }

  await connectToDatabase();
  console.log(`\n${UP ? "UP" : "DOWN"} — ${COMMIT ? "COMMITTING" : "dry run"}\n`);

  if (UP) await up();
  else await down();

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[migrate-blocks] failed:", err);
  process.exit(1);
});
