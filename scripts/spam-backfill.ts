import { loadEnv } from "./loadEnv";

// Populate process.env from .env.local BEFORE anything reads it.
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Lead, Review, Submission } from "@/models";
import { classifySubmission } from "@/lib/spam/classify";
import { fingerprintPayload } from "@/lib/spam/fingerprint";
import { FORM_SPECS, str, toSpamInput } from "@/lib/spam/fields";
import type { SpamFormKind } from "@/lib/spam/types";

/**
 * scripts/spam-backfill.ts — classify submissions that were already stored
 * before the filter existed, and print what the classifier makes of every one.
 *
 *   npx tsx scripts/spam-backfill.ts            # DRY RUN — writes nothing
 *   npx tsx scripts/spam-backfill.ts --apply    # writes spam metadata
 *   npx tsx scripts/spam-backfill.ts --verbose  # print the message text too
 *
 * Three rules this script obeys without exception:
 *
 *   1. It NEVER deletes anything. A stored row is evidence; the worst it will
 *      do is mark one `quarantine`, which hides it from the inbox but keeps it
 *      one click away under Spam.
 *   2. It NEVER hard-rejects. `reject` is capped to `quarantine` here — moving
 *      an existing row to the blocked bin would mean removing it from the
 *      collection, which is rule 1.
 *   3. It NEVER overrides a call a human already made. Any row whose
 *      `spam.clearedAt` is set (someone pressed "Not spam") is skipped and
 *      reported as such. A machine does not get to reverse a person.
 *
 * The browser-proof rules are switched off for this pass (`stampChecked:
 * false`): these rows were written before the form ever sent a render stamp,
 * and penalising them for a missing field would flag the entire archive.
 */

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

interface Row {
  form: SpamFormKind;
  id: string;
  who: string;
  when: string;
  doc: Record<string, unknown>;
  cleared: boolean;
  existing?: string;
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

async function main() {
  await connectToDatabase();

  const rows: Row[] = [];

  for (const doc of await Lead.find().sort({ createdAt: 1 }).lean()) {
    const d = doc as unknown as Record<string, unknown>;
    rows.push({
      form: "lead",
      id: String(d._id),
      who: `${str(d.name) ?? "?"} <${str(d.email) ?? "?"}>`,
      when: new Date(String(d.createdAt)).toISOString().slice(0, 10),
      doc: d,
      cleared: !!(d.spam as { clearedAt?: unknown } | undefined)?.clearedAt,
      existing: (d.spam as { verdict?: string } | undefined)?.verdict,
    });
  }
  for (const doc of await Submission.find().sort({ createdAt: 1 }).lean()) {
    const d = doc as unknown as Record<string, unknown>;
    rows.push({
      form: "submission",
      id: String(d._id),
      who: `${str(d.processorName) ?? "?"} <${str(d.contactEmail) ?? "?"}>`,
      when: new Date(String(d.createdAt)).toISOString().slice(0, 10),
      doc: d,
      cleared: !!(d.spam as { clearedAt?: unknown } | undefined)?.clearedAt,
      existing: (d.spam as { verdict?: string } | undefined)?.verdict,
    });
  }
  // Only reviews that came through the public form. Imported and admin-entered
  // reviews never passed the filter and must not be judged by it.
  for (const doc of await Review.find({ source: "web-form" }).sort({ createdAt: 1 }).lean()) {
    const d = doc as unknown as Record<string, unknown>;
    rows.push({
      form: "review",
      id: String(d._id),
      who: `${str(d.reviewerName) ?? "?"} <${str(d.reviewerEmail) ?? "?"}>`,
      when: new Date(String(d.createdAt)).toISOString().slice(0, 10),
      doc: d,
      cleared: !!(d.spam as { clearedAt?: unknown } | undefined)?.clearedAt,
      existing: (d.spam as { verdict?: string } | undefined)?.verdict,
    });
  }

  console.log(
    `\n${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} stored submission(s)` +
      `${APPLY ? "" : ". Nothing will be written."}\n`,
  );
  console.log(
    `${pad("FORM", 11)}${pad("DATE", 12)}${pad("WHO", 44)}${pad("VERDICT", 12)}${pad("SCORE", 7)}CATEGORY`,
  );
  console.log("-".repeat(110));

  const tally: Record<string, number> = { allow: 0, quarantine: 0, skipped: 0 };
  let writes = 0;

  for (const row of rows) {
    if (row.cleared) {
      tally.skipped! += 1;
      console.log(
        `${pad(row.form, 11)}${pad(row.when, 12)}${pad(row.who, 44)}${pad("SKIPPED", 12)}${pad("-", 7)}cleared by a human`,
      );
      continue;
    }

    const result = classifySubmission(
      toSpamInput(row.form, row.doc, { stampChecked: false }),
    );

    // Rule 2: a stored row is never hard-rejected by the backfill.
    const verdict = result.verdict === "reject" ? "quarantine" : result.verdict;
    tally[verdict] = (tally[verdict] ?? 0) + 1;

    const flagged = verdict !== "allow";
    console.log(
      `${pad(row.form, 11)}${pad(row.when, 12)}${pad(row.who, 44)}${pad(verdict.toUpperCase(), 12)}${pad(String(result.score), 7)}${result.category}` +
        (result.verdict === "reject" ? "  (capped from reject)" : ""),
    );
    if (flagged || VERBOSE) {
      for (const reason of result.reasons) {
        console.log(`${" ".repeat(23)}· ${reason.label}`);
      }
    }
    if (VERBOSE) {
      const spec = FORM_SPECS[row.form];
      for (const field of spec.text) {
        const value = str(row.doc[field]);
        if (value) console.log(`${" ".repeat(23)}  ${field}: ${value.replace(/\s+/g, " ").slice(0, 160)}`);
      }
    }

    if (!APPLY) continue;

    const spec = FORM_SPECS[row.form];
    const meta = {
      verdict,
      score: result.score,
      category: result.category,
      reasons: result.reasons.map((r) => r.label),
      codes: result.reasons.map((r) => r.code),
      fingerprint: fingerprintPayload(spec.fingerprintFields.map((f) => str(row.doc[f]))) ?? undefined,
      classifiedAt: new Date(),
    };

    // `$set` only, on rows without a human decision. Nothing is removed.
    const Model = row.form === "lead" ? Lead : row.form === "submission" ? Submission : Review;
    await (Model as unknown as {
      updateOne: (f: unknown, u: unknown) => Promise<unknown>;
    }).updateOne({ _id: row.id, "spam.clearedAt": { $exists: false } }, { $set: { spam: meta } });
    writes += 1;
  }

  console.log("-".repeat(110));
  console.log(
    `allow: ${tally.allow}   quarantine: ${tally.quarantine}   skipped (human call): ${tally.skipped}`,
  );
  console.log(
    APPLY
      ? `\nWrote spam metadata to ${writes} row(s). Nothing was deleted.`
      : "\nDry run — nothing written. Re-run with --apply once the verdicts above look right.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
