import { loadEnv } from "./loadEnv";

loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import "@/models";

/**
 * Body-copy dash audit.
 *
 * `audit:meta` enforces the no-dash house rule on meta titles and descriptions
 * only. It passes happily while the visible copy is full of them, which is where
 * they actually get read: block bodies, buyers-guide sections, category intros,
 * processor descriptions, FAQ answers, settings strings. Editors paste from Word
 * and Google Docs, so this recurs; a one-off find-and-replace does not hold.
 *
 * This walks EVERY document in EVERY registered collection, to arbitrary depth,
 * and reports every string containing an em dash, en dash or horizontal bar. No
 * field list to maintain: a new model, or a new key inside a `Mixed` block
 * payload, is covered the day it appears.
 *
 *   npm run audit:dashes                    # report (exit 1 if any found)
 *   npm run audit:dashes -- --fix --dry-run # preview every rewrite
 *   npm run audit:dashes -- --fix           # apply
 *
 * `--fix` is deliberately conservative. A dash between numbers is a range and
 * becomes "to" ("2–4" → "2 to 4"); everywhere else it is punctuation standing in
 * for a comma. Both rewrites are mechanical and safe to apply unread, which is
 * the same bar `audit:meta --fix` sets for DB copy.
 *
 * Source-code strings are NOT covered here — `scripts/meta-audit.ts` parses those
 * for meta copy, and a dash in a comment is allowed. Grep for them directly.
 */

const FIX = process.argv.includes("--fix");
const DRY_RUN = process.argv.includes("--dry-run");

const BANNED = /[—–―]/;
const BANNED_G = /[—–―]/g;

/** Keys whose values are never prose. Skipping them keeps the report readable. */
const SKIP_KEYS = new Set(["_id", "__v", "passwordHash", "logo", "url", "href", "slug", "id"]);

/**
 * The audit log is an immutable record of what was actually saved and by whom.
 * Rewriting it would falsify history to make a report go green, and nothing in
 * it is ever rendered to a visitor.
 */
const SKIP_COLLECTIONS = new Set(["auditlogs"]);

/**
 * User-authored content: reported so it's visible, never rewritten. The house
 * rule exists to keep the site's own editorial voice consistent; silently
 * editing the words a reviewer or a lead actually typed is a different thing
 * entirely, and not ours to do.
 */
const REPORT_ONLY_COLLECTIONS = new Set(["reviews", "leads", "submissions"]);

const rewrite = (s: string): string =>
  s
    // A dash between two numbers is a range: "2–4" is "2 to 4", not "2, 4". The
    // character classes allow the unit to sit against the dash, so "2% – 3%" and
    // "$25 – $99" are caught too, which a bare `\d–\d` misses.
    .replace(/([\d%])\s*[—–―]\s*([$\d])/g, "$1 to $2")
    // Otherwise it stands in for a comma. Collapse the space it leaves behind.
    .replace(/\s*[—–―]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",");

interface Hit {
  collection: string;
  id: string;
  path: string;
  before: string;
  after: string;
}

/**
 * Walk a value, collecting hits and (when fixing) returning a rewritten copy.
 * Returns the value unchanged when nothing below it matched, so an untouched
 * document is detectable by identity and never written back.
 */
function walk(
  value: unknown,
  path: string,
  ctx: { collection: string; id: string; hits: Hit[] },
): unknown {
  if (typeof value === "string") {
    if (!BANNED.test(value)) return value;
    const after = rewrite(value);
    ctx.hits.push({ collection: ctx.collection, id: ctx.id, path, before: value, after });
    return after;
  }

  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v, i) => {
      const next = walk(v, `${path}[${i}]`, ctx);
      if (next !== v) changed = true;
      return next;
    });
    return changed ? out : value;
  }

  // Dates, ObjectIds and Buffers are objects but not records to descend into.
  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value) &&
    !(value as { _bsontype?: string })._bsontype
  ) {
    let changed = false;
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const [k, v] of Object.entries(out)) {
      if (SKIP_KEYS.has(k)) continue;
      const next = walk(v, path ? `${path}.${k}` : k, ctx);
      if (next !== v) {
        out[k] = next;
        changed = true;
      }
    }
    return changed ? out : value;
  }

  return value;
}

/**
 * A window around the FIRST offending dash, not the first N characters. On a
 * long blog body the dash is usually thousands of characters in, and a head-of
 * string excerpt shows an editor nothing they can act on.
 *
 * Both the before and after lines are cut at the SAME offset, taken from the
 * before string — the after string has no dash left to centre on, and two
 * excerpts from different parts of the text can't be read as a diff.
 */
function excerpt(s: string, anchor: number, radius = 55): string {
  const start = Math.max(0, anchor - radius);
  const end = Math.min(s.length, anchor + radius);
  return `${start > 0 ? "..." : ""}${s.slice(start, end).replace(/\s+/g, " ")}${end < s.length ? "..." : ""}`;
}

async function main() {
  await connectToDatabase();

  const hits: Hit[] = [];
  let fixedDocs = 0;

  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    const collection = Model.collection.name;
    if (SKIP_COLLECTIONS.has(collection)) continue;
    const docs = await Model.find({}).lean();

    for (const doc of docs as Record<string, unknown>[]) {
      const id = String(doc._id);
      const before = hits.length;
      const next = walk(doc, "", { collection, id, hits });
      if (next === doc || hits.length === before) continue;

      if (FIX && !DRY_RUN && !REPORT_ONLY_COLLECTIONS.has(collection)) {
        const { _id: _drop, ...set } = next as Record<string, unknown>;
        void _drop;
        await Model.collection.updateOne({ _id: doc._id as never }, { $set: set });
        fixedDocs += 1;
      }
    }
  }

  if (hits.length === 0) {
    // eslint-disable-next-line no-console
    console.log("PASS: no em dash, en dash or horizontal bar in any stored copy.");
    return;
  }

  const byCollection = new Map<string, Hit[]>();
  for (const h of hits) {
    const list = byCollection.get(h.collection) ?? [];
    list.push(h);
    byCollection.set(h.collection, list);
  }

  for (const [collection, list] of byCollection) {
    const reportOnly = REPORT_ONLY_COLLECTIONS.has(collection);
    // eslint-disable-next-line no-console
    console.log(`\n${collection} (${list.length})${reportOnly ? "  [user-authored, never rewritten]" : ""}`);
    for (const h of list) {
      const dash = (h.before.match(BANNED_G) ?? []).length;
      const anchor = Math.max(0, h.before.search(BANNED));
      // eslint-disable-next-line no-console
      console.log(`  ${h.id} ${h.path} (${dash})`);
      // eslint-disable-next-line no-console
      console.log(`    - ${excerpt(h.before, anchor)}`);
      if (!reportOnly) {
        // eslint-disable-next-line no-console
        console.log(`    + ${excerpt(h.after, anchor)}`);
      }
    }
  }

  const fixable = hits.filter((h) => !REPORT_ONLY_COLLECTIONS.has(h.collection)).length;

  // eslint-disable-next-line no-console
  console.log(
    FIX && !DRY_RUN
      ? `\nFixed ${fixable} strings across ${fixedDocs} documents.${
          hits.length > fixable ? ` ${hits.length - fixable} left alone (user-authored).` : ""
        }`
      : `\n${fixable} strings need fixing. Re-run with --fix to apply${DRY_RUN ? " (drop --dry-run)" : ""}.`,
  );

  // A clean run means nothing left that this tool is willing to change.
  if (!FIX || DRY_RUN ? hits.length > 0 : fixable > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Dash audit failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
