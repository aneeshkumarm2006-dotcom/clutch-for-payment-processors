import { loadEnv } from "./loadEnv";
loadEnv();

import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { connectForScript } from "./db";
import { BlogPost, Category, PageSeo } from "@/models";

/**
 * Apply reviewed title tags and meta descriptions from a JSON file.
 *
 *   npx tsx scripts/apply-meta-rewrites.ts <file.json> --dry-run
 *   npx tsx scripts/apply-meta-rewrites.ts <file.json>
 *
 * Semrush flagged 5 over-long titles, but it only crawled 78 of the site's 278
 * URLs. Auditing every entity found 56 titles over 60 characters and 12
 * descriptions over 160, plus one missing description and six under 70. This
 * applies the replacements for the blog posts, categories, and route PageSeo
 * records; the ~34 processor titles were a mechanical suffix strip and are
 * handled by `scripts/fix-processor-title-suffix.ts`.
 *
 * Every value is re-validated here before it is written, because the file is
 * generated: a string that violates the length or symbol rules is REJECTED
 * rather than stored. The symbol rule mirrors `scripts/meta-audit.ts` (pipe is
 * the only permitted symbol) so this script cannot introduce a violation that
 * the audit would then fail on.
 *
 * Expected JSON shape: { "<slug>": { kind, metaTitle, metaDescription }, ... }
 * where `kind` is "blog" | "category" | "pageseo", and for "pageseo" the key is
 * the route path.
 *
 * Idempotent: a field already holding the target value is skipped.
 */

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FILE = args.find((a) => !a.startsWith("--"));

if (!FILE) {
  console.error("Usage: npx tsx scripts/apply-meta-rewrites.ts <file.json> [--dry-run]");
  process.exit(1);
}

const MAX_TITLE = 60;
const MIN_TITLE = 40;
const MAX_DESC = 158;
const MIN_DESC = 120;
/** Everything meta-audit.ts rejects, plus the dashes the house style bans. */
const FORBIDDEN = /[()[\]{}&"'?!/+*#@;~<>—–―]/;

interface Rewrite {
  kind: "blog" | "category" | "pageseo";
  metaTitle: string;
  metaDescription: string;
}

function validate(slug: string, r: Rewrite): string[] {
  const problems: string[] = [];
  const t = r.metaTitle ?? "";
  const d = r.metaDescription ?? "";
  if (t.length > MAX_TITLE || t.length < MIN_TITLE) problems.push(`title is ${t.length} chars`);
  if (d.length > MAX_DESC || d.length < MIN_DESC) problems.push(`description is ${d.length} chars`);
  const tBad = t.match(FORBIDDEN);
  if (tBad) problems.push(`title contains "${tBad[0]}"`);
  const dBad = d.match(FORBIDDEN);
  if (dBad) problems.push(`description contains "${dBad[0]}"`);
  return problems;
}

async function main() {
  const raw = JSON.parse(readFileSync(join(process.cwd(), FILE!), "utf8")) as Record<string, Rewrite>;
  await connectForScript();

  let written = 0;
  let rejected = 0;
  let missing = 0;

  for (const [slug, rewrite] of Object.entries(raw)) {
    const problems = validate(slug, rewrite);
    if (problems.length) {
      console.error(`  REJECTED ${rewrite.kind}/${slug}: ${problems.join("; ")}`);
      rejected += 1;
      continue;
    }

    const doc =
      rewrite.kind === "blog"
        ? await BlogPost.findOne({ slug })
        : rewrite.kind === "category"
          ? await Category.findOne({ slug })
          : await PageSeo.findOne({ path: slug });

    if (!doc) {
      console.error(`  MISSING ${rewrite.kind}/${slug}`);
      missing += 1;
      continue;
    }

    const seo = (doc.seo ?? {}) as { metaTitle?: string; metaDescription?: string };
    const changes: string[] = [];
    if (seo.metaTitle !== rewrite.metaTitle) {
      changes.push(`title ${seo.metaTitle?.length ?? 0}->${rewrite.metaTitle.length}`);
      doc.set("seo.metaTitle", rewrite.metaTitle);
    }
    if (seo.metaDescription !== rewrite.metaDescription) {
      changes.push(`desc ${seo.metaDescription?.length ?? 0}->${rewrite.metaDescription.length}`);
      doc.set("seo.metaDescription", rewrite.metaDescription);
    }
    if (!changes.length) continue;

    console.log(`  ${rewrite.kind}/${slug} (${changes.join(", ")})`);
    console.log(`      T: ${rewrite.metaTitle}`);
    console.log(`      D: ${rewrite.metaDescription}`);
    written += 1;
    if (!DRY_RUN) await doc.save();
  }

  console.log(
    `\n${DRY_RUN ? "DRY RUN: " : ""}${written} document(s) ${DRY_RUN ? "would change" : "written"}` +
      `${rejected ? `, ${rejected} rejected` : ""}${missing ? `, ${missing} not found` : ""}.`,
  );

  await mongoose.disconnect();
  if (rejected || missing) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
