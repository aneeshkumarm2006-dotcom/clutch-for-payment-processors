import { loadEnv } from "./loadEnv";
loadEnv();

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { connectForScript } from "./db";
import { Processor } from "@/models";
import { checkFaqs, prepareBlocks, seoSet, type BlockSpec, type SeoSpec } from "./content-kit";

/**
 * Editorial content for `/processor/<slug>/reviews`, one file per processor.
 *
 *   npx tsx scripts/seed-review-pages.ts                    # write all
 *   npx tsx scripts/seed-review-pages.ts --dry-run          # validate + report only
 *   npx tsx scripts/seed-review-pages.ts --only=stripe,square
 *   npx tsx scripts/seed-review-pages.ts --force            # overwrite hand edits
 *
 * WHY A SEPARATE SCRIPT, given `scripts/add-processors.ts` already writes listings
 * from `scripts/data/processors/*.json`:
 *
 * 1. That script `$set`s the whole listing document from its file, so it can only
 *    reach the 44 processors that have a file. The other 11 came from `seed.ts`
 *    (Stripe, Square, PayPal, Adyen and the rest of the original set) and have no
 *    file to add a `reviewsPage` key to. Writing one for each of them would mean
 *    transcribing 11 complete listings just to attach a reviews page.
 * 2. `reviewsPage` is a different editorial layer with its own target query. It
 *    changes on its own cadence: rating figures quoted from Capterra or G2 go stale
 *    and get refreshed without the listing's pricing being touched.
 *
 * So this one is surgical in the `scripts/content-kit.ts` sense: it `$set`s only
 * `reviewsPage.*` paths and never reads or writes a field outside that subtree,
 * which makes it safe to re-run against a database that has had admin edits since.
 *
 * IDEMPOTENT AND NON-DESTRUCTIVE BY DEFAULT. A processor whose stored
 * `reviewsPage.blocks` differ from what the file would write is SKIPPED with a
 * notice, on the assumption that an editor changed them in /admin. `--force`
 * overrides that. Block ids come from `blockId()` and are derived from position,
 * so re-running with unchanged copy is a genuine no-op rather than a rewrite.
 */

const DATA_DIR = join(process.cwd(), "scripts", "data", "review-pages");

/**
 * Published processor slugs, loaded from the database before validation runs.
 *
 * Empty until then, and `houseRuleErrors` reads an empty set as "cannot check"
 * rather than "nothing is valid", so the link check is skipped in the one case
 * where it has no data instead of failing every file.
 */
const KNOWN_SLUGS = new Set<string>();

type FileBlock =
  | { type: "richtext"; html: string }
  | { type: "prosCons"; title?: string; pros: string[]; cons: string[] };

/**
 * One verbatim excerpt from a review published on a third-party platform.
 *
 * These are QUOTED, not republished. They render as an attributed block inside
 * `reviewsPage.blocks` and are deliberately NOT written into the `reviews`
 * collection, because that collection is what the page presents as reviews
 * merchants submitted here and had moderated. Copying someone else's review into
 * it would make that claim false, would put third-party text inside this site's
 * `Review` and `AggregateRating` JSON-LD (which Google's review-snippet policy
 * prohibits and the FTC's 16 CFR Part 465 covers), and would recreate at scale
 * exactly the problem `scripts/retire-seeded-reviews.ts` exists to undo.
 *
 * Every field is required for a reason: a quote a reader cannot trace to a named
 * platform and a date is indistinguishable from one we made up.
 */
interface ReviewQuote {
  /** Verbatim excerpt. Short, and never paraphrased into something not written. */
  text: string;
  /** Platform it was published on, e.g. "Capterra", "G2", "Trustpilot". */
  source: string;
  /** Absolute URL a reader can check it against. */
  sourceUrl: string;
  /** When it was observed or published, e.g. "August 2026". */
  date: string;
  /** The reviewer's own star rating out of 5, where the platform showed one. */
  rating?: number;
  /** Reviewer role/industry where published, e.g. "restaurant owner". Never a name. */
  attribution?: string;
}

interface ReviewPageFile {
  slug: string;
  /** Cross-checked against the stored document so a renamed processor is caught. */
  name: string;
  heading: string;
  intro: string;
  seo: SeoSpec;
  faqs: { question: string; answer: string }[];
  blocks: FileBlock[];
  /**
   * Verbatim third-party review excerpts. Optional: a processor with no quotable
   * public reviews gets no quote block rather than an invented one.
   */
  quotes?: ReviewQuote[];
  /**
   * One sentence naming where the excerpts came from and which way that venue
   * skews. Required whenever `quotes` is present.
   *
   * Without it a quote block is quietly misleading: the Better Business Bureau
   * collects complaints, so four one-star BBB excerpts under a product rated 4.7 on
   * Capterra would read as the review record rather than as its unhappy tail. The
   * note is what stops a set of genuine quotes adding up to a false impression.
   */
  quotesNote?: string;
  /** Research provenance. Kept in the file, never written to the DB. */
  sources: string[];
}

/** Escape text destined for generated HTML. Quotes are data, not authored markup. */
const esc = (v: string): string =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Build the attributed quotes block.
 *
 * The HTML is generated here rather than authored in the JSON so the attribution
 * cannot be omitted or detached from the quote: every excerpt renders with its
 * platform, its date, and a link to where it was published. `<blockquote>` is not
 * in the block sanitizer's allowlist, so this uses a list with the excerpt in
 * `<em>` and the attribution after it.
 */
function quotesBlock(name: string, quotes: ReviewQuote[], note: string): BlockSpec {
  const items = quotes
    .map((q) => {
      const stars = q.rating ? `${q.rating} out of 5, ` : "";
      const who = q.attribution ? `${esc(q.attribution)}, ` : "";
      return (
        `<li><em>"${esc(q.text)}"</em><br />${who}${stars}` +
        `<a href="${esc(q.sourceUrl)}">${esc(q.source)}</a>, ${esc(q.date)}</li>`
      );
    })
    .join("");
  return {
    type: "richtext",
    data: {
      html:
        `<h2>What reviewers say in their own words</h2>` +
        `<p>Excerpts below are quoted from reviews published on third-party platforms, ` +
        `with a link to each source. They are not reviews submitted to this site, and ` +
        `they do not count toward the ${esc(name)} rating shown above. ${esc(note)}</p>` +
        `<ul>${items}</ul>`,
    },
  };
}

// ---------------------------------------------------------------------------
// House rules
// ---------------------------------------------------------------------------

/**
 * Every string this script would write, flattened, so the checks below can run
 * over the copy without caring which field it came from.
 */
function allCopy(f: ReviewPageFile): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [
    { label: "heading", text: f.heading },
    { label: "intro", text: f.intro },
    { label: "seo.metaTitle", text: f.seo.metaTitle ?? "" },
    { label: "seo.metaDescription", text: f.seo.metaDescription ?? "" },
  ];
  f.faqs.forEach((q, i) => {
    out.push({ label: `faqs[${i}].question`, text: q.question });
    out.push({ label: `faqs[${i}].answer`, text: q.answer });
  });
  f.blocks.forEach((b, i) => {
    if (b.type === "richtext") out.push({ label: `blocks[${i}].html`, text: b.html });
    else {
      if (b.title) out.push({ label: `blocks[${i}].title`, text: b.title });
      b.pros.forEach((p, j) => out.push({ label: `blocks[${i}].pros[${j}]`, text: p }));
      b.cons.forEach((c, j) => out.push({ label: `blocks[${i}].cons[${j}]`, text: c }));
    }
  });
  return out;
}

/**
 * The site's copy rules, enforced at write time rather than by an audit after the
 * fact. `npm run audit:dashes` would catch the dash later, but a run that writes
 * 50 documents and then reports 50 violations is worse than one that refuses.
 *
 * Em dash and en dash: see the house rule. They read as an AI-writing tell, and
 * the directory's credibility rests on the copy reading as human-written.
 *
 * `metaTitle` at 60 characters: `buildMetadata` renders a stored title VERBATIM,
 * so this string IS the SERP title, with no brand suffix appended and none to be
 * written in by hand (see `lib/seo.ts` and the meta-title audit).
 */
function houseRuleErrors(f: ReviewPageFile): string[] {
  const errs: string[] = [];

  for (const { label, text } of allCopy(f)) {
    if (text.includes("—")) errs.push(`${label}: em dash`);
    if (text.includes("–")) errs.push(`${label}: en dash`);
    if (/\bAI\b.*\bgenerated\b/i.test(text)) errs.push(`${label}: says the copy is generated`);
  }

  const title = f.seo.metaTitle ?? "";
  if (!title) errs.push("seo.metaTitle: missing");
  if (title.length > 60) errs.push(`seo.metaTitle: ${title.length} chars, keep it under 60`);
  if (/payment processor guide|payment processing guide/i.test(title)) {
    errs.push("seo.metaTitle: brand suffix baked in, it is not appended to a stored title");
  }

  const desc = f.seo.metaDescription ?? "";
  if (!desc) errs.push("seo.metaDescription: missing");
  if (desc.length > 160) errs.push(`seo.metaDescription: ${desc.length} chars, keep it under 160`);

  if (f.intro.length > 600) errs.push(`intro: ${f.intro.length} chars, schema caps it at 600`);
  if (f.faqs.length < 3) errs.push(`faqs: ${f.faqs.length}, write at least 3`);
  for (const [i, q] of f.faqs.entries()) {
    if (q.answer.length > 1200) errs.push(`faqs[${i}].answer: over the 1200-char block cap`);
  }
  if (!f.blocks.some((b) => b.type === "richtext")) errs.push("blocks: no richtext block");
  if (!f.sources.length) errs.push("sources: cite where the review figures came from");

  /**
   * Every internal link must point at a processor that exists.
   *
   * Worth a hard check rather than a review pass: a plausible-looking
   * `/processor/flutterwave` costs nothing at write time and 404s in production,
   * and it is exactly the mistake you make while writing about competitors from
   * memory. `KNOWN_SLUGS` is filled from the database at run time, so this also
   * catches a link to a processor that has since been unpublished or renamed.
   */
  for (const { label, text } of allCopy(f)) {
    for (const m of text.matchAll(/href="([^"]*)"/g)) {
      const href = m[1] ?? "";
      const slug = href.startsWith("/processor/") ? href.slice("/processor/".length) : null;
      if (!slug || slug.includes("/")) {
        errs.push(`${label}: href "${href}" is not /processor/<slug>`);
      } else if (slug === f.slug) {
        errs.push(`${label}: links to its own page`);
      } else if (KNOWN_SLUGS.size && !KNOWN_SLUGS.has(slug)) {
        errs.push(`${label}: href "${href}" names no published processor`);
      }
    }
  }

  /**
   * Quotes are the highest-risk content on the page, so they are checked hardest.
   *
   * A quote with no traceable platform, date and URL is indistinguishable from an
   * invented one, and an invented one is the single worst thing this directory could
   * publish. There is no way to verify from here that a quote is genuine, so the rule
   * is that it must at least be CHECKABLE by a reader.
   */
  if (f.quotes?.length && !f.quotesNote?.trim()) {
    errs.push("quotesNote: required with quotes, to say where they came from and how that venue skews");
  }
  (f.quotes ?? []).forEach((q, i) => {
    const at = `quotes[${i}]`;
    if (!q.text?.trim()) errs.push(`${at}.text: empty`);
    if (q.text && q.text.length > 400) {
      errs.push(`${at}.text: ${q.text.length} chars, keep the excerpt short`);
    }
    if (!q.source?.trim()) errs.push(`${at}.source: name the platform it was published on`);
    if (!q.date?.trim()) errs.push(`${at}.date: say when it was published or observed`);
    if (!/^https:\/\//.test(q.sourceUrl ?? "")) {
      errs.push(`${at}.sourceUrl: must be an absolute https URL a reader can check`);
    }
    if (q.rating !== undefined && !(q.rating >= 1 && q.rating <= 5)) {
      errs.push(`${at}.rating: ${q.rating} is not a 1 to 5 star rating`);
    }
    /**
     * Dashes in a quote are a trap rather than a style slip. The site-wide rule bans
     * them, and `npm run audit:dashes --fix` rewrites them wherever it finds them,
     * which on a quotation means silently altering someone's words. So a quote
     * containing one must be SHORTENED to an unaffected span, never edited.
     */
    if (/[—–]/.test(q.text ?? "")) {
      errs.push(`${at}.text: contains a dash. Trim the excerpt rather than rewriting the quote`);
    }
    // Attribution is a role or industry, never an identity. Quoting a named
    // individual onto a commercial directory is a privacy problem the quote does
    // not need: "a restaurant owner" carries the same evidential weight.
    // Word-bounded so it does not fire on "ms" inside "systems".
    if (q.attribution && /\b(mr|mrs|ms|dr)\b|@/i.test(q.attribution)) {
      errs.push(`${at}.attribution: use a role or industry, never a person's name or handle`);
    }
  });

  /**
   * A quoted rating or review count with no source is the one failure mode that
   * damages the site rather than just looking sloppy, so a numeric claim about the
   * review record has to arrive with at least one URL behind it.
   */
  const quotesFigures = allCopy(f).some(({ text }) =>
    /\b\d(?:\.\d)?\s*(?:out of|\/)\s*5\b/i.test(text) ||
    /\b\d[\d,]*\s+(?:verified\s+)?reviews\b/i.test(text),
  );
  if (quotesFigures && !f.sources.some((s) => s.startsWith("http"))) {
    errs.push("sources: copy quotes a rating or review count with no URL to back it");
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Read + validate
// ---------------------------------------------------------------------------

function toBlockSpecs(blocks: FileBlock[]): BlockSpec[] {
  return blocks.map((b) =>
    b.type === "richtext"
      ? { type: "richtext", data: { html: b.html } }
      : {
          type: "prosCons",
          data: { ...(b.title ? { title: b.title } : {}), pros: b.pros, cons: b.cons },
        },
  );
}

function readFiles(only: string[] | null): ReviewPageFile[] {
  let names: string[];
  try {
    names = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  } catch {
    throw new Error(`No data directory at ${DATA_DIR}`);
  }
  const files = names.map((n) => {
    const parsed = JSON.parse(readFileSync(join(DATA_DIR, n), "utf8")) as ReviewPageFile;
    const expected = `${parsed.slug}.json`;
    if (n !== expected) {
      throw new Error(`${n} declares slug "${parsed.slug}"; rename the file to ${expected}`);
    }
    return parsed;
  });
  if (!only) return files;
  const bySlug = new Map(files.map((f) => [f.slug, f]));
  const missing = only.filter((s) => !bySlug.has(s));
  if (missing.length) throw new Error(`No review-page file for: ${missing.join(", ")}`);
  return only.map((s) => bySlug.get(s)!);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const log = (m: string) => {
  // eslint-disable-next-line no-console
  console.log(m);
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg
    ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const files = readFiles(only);

  await connectForScript();

  // Internal links are checked against what is actually published, so the slug list
  // has to come from the database rather than being hardcoded here: a link to a
  // processor that was later unpublished should fail too, not just a typo.
  const published = await Processor.find({ isPublished: true }).select("slug").lean();
  for (const p of published) KNOWN_SLUGS.add(String(p.slug));

  // Validate the whole batch BEFORE the first write, so one bad file cannot leave
  // half the directory updated and the other half not.
  const problems = files.flatMap((f) => houseRuleErrors(f).map((e) => `${f.slug}: ${e}`));
  if (problems.length) {
    throw new Error(`House-rule violations:\n  ${problems.join("\n  ")}`);
  }

  const prepared = files.map((f) => {
    const scope = `processor:${f.slug}:reviewsPage`;
    try {
      /**
       * `blocksSchema` and `faqsSchema` are both optional, so their parsed type is
       * `T[] | undefined`. The house rules above already require a block and three
       * FAQs, so `undefined` here would mean the schema dropped content we thought
       * we had. Throwing is the only safe reading: `?? []` would quietly turn that
       * into "the editor deleted everything" and write an empty list.
       */
      // The quotes block goes LAST, after the authored sections, so a reader meets
      // our analysis of the review record before the raw excerpts behind it.
      const specs = [
        ...toBlockSpecs(f.blocks),
        ...(f.quotes?.length ? [quotesBlock(f.name, f.quotes, f.quotesNote ?? "")] : []),
      ];
      const blocks = prepareBlocks(scope, specs);
      const faqs = checkFaqs(scope, f.faqs);
      if (!blocks?.length || !faqs?.length) {
        throw new Error("blocks or FAQs vanished in validation; refusing to write an empty page");
      }
      return { file: f, scope, blocks, faqs, seo: seoSet(scope, f.seo, "reviewsPage.seo") };
    } catch (err) {
      throw new Error(`${f.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  let written = 0;
  let skipped = 0;
  for (const p of prepared) {
    const doc = await Processor.findOne({ slug: p.file.slug })
      .select("name slug reviewsPage")
      .lean();
    if (!doc) {
      log(`  skipped ${p.file.slug} (no such processor). Run \`npm run seed\` first`);
      skipped += 1;
      continue;
    }
    if (doc.name !== p.file.name) {
      log(`  ! ${p.file.slug}: file says "${p.file.name}", DB says "${doc.name}"`);
    }

    // Non-destructive default: stored blocks that differ from ours are treated as
    // an editor's work, not as stale output of an earlier run.
    const stored = doc.reviewsPage?.blocks ?? [];
    const ours = JSON.stringify(p.blocks);
    if (stored.length && JSON.stringify(stored) !== ours && !force) {
      log(`  skipped ${p.file.slug} (stored blocks differ; pass --force to overwrite)`);
      skipped += 1;
      continue;
    }
    if (stored.length && JSON.stringify(stored) === ours) {
      log(`  = ${p.file.slug} already current`);
      continue;
    }

    const set: Record<string, unknown> = {
      "reviewsPage.heading": p.file.heading,
      "reviewsPage.intro": p.file.intro,
      "reviewsPage.faqs": p.faqs,
      "reviewsPage.blocks": p.blocks,
      ...p.seo,
    };

    if (dryRun) {
      log(
        `  [dry-run] ${p.file.slug.padEnd(26)} ${p.blocks.length} blocks, ` +
          `${p.faqs.length} FAQs, title ${(p.file.seo.metaTitle ?? "").length} chars`,
      );
      written += 1;
      continue;
    }

    await Processor.updateOne({ slug: p.file.slug }, { $set: set });
    log(`  ✓ ${p.file.slug.padEnd(26)} /processor/${p.file.slug}/reviews`);
    written += 1;
  }

  log(
    `\n${dryRun ? "[dry-run] " : ""}${written} reviews page(s) ${dryRun ? "would be " : ""}written` +
      (skipped ? `, ${skipped} skipped` : "") +
      `, ${files.length} file(s) checked.`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("✗ Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
