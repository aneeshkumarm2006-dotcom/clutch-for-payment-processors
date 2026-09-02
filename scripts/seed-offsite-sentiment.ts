import { loadEnv } from "./loadEnv";
loadEnv();

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { connectForScript } from "./db";
import { Processor } from "@/models";
import { googleReviewsOverviewSchema, redditOverviewSchema } from "@/lib/validators/sentiment";
import { hasSentimentContent } from "@/lib/sentiment";

/**
 * The off-site sentiment sections on `/processor/<slug>/reviews`: the processor's
 * Google listing and its Reddit discussion. One file per processor in
 * `scripts/data/offsite-sentiment/`.
 *
 *   npx tsx scripts/seed-offsite-sentiment.ts                 # write all
 *   npx tsx scripts/seed-offsite-sentiment.ts --dry-run       # validate + report
 *   npx tsx scripts/seed-offsite-sentiment.ts --only=stripe,square
 *   npx tsx scripts/seed-offsite-sentiment.ts --force         # overwrite hand edits
 *
 * WHY THIS IS NOT `seed-review-pages.ts`. That script owns
 * `reviewsPage.heading/intro/seo/faqs/blocks`; this one owns
 * `reviewsPage.googleReviews` and `reviewsPage.reddit` and touches nothing else.
 * Two scripts writing the same path is a last-writer-wins race, so the split is
 * along the paths each one `$set`s, not along the processor list. Both are safe to
 * run in either order.
 *
 * WHAT IT WILL NOT DO. It will not invent a Google listing. A great many of these
 * processors are software companies with no Business Profile a merchant would
 * ever find, and a fabricated rating on a review directory is the worst thing
 * this site could publish. A file may carry `google`, `reddit`, either or
 * neither; an absent section is written as `$unset`, so a section removed from
 * the file comes off the page.
 *
 * NOTHING HERE REACHES `AggregateRating`. See the header of `models/sentiment.ts`.
 * The Google rating is Google's aggregate, labelled as Google's, and the Product
 * node keeps computing its own from approved on-site reviews only.
 */

const DATA_DIR = join(process.cwd(), "scripts", "data", "offsite-sentiment");

const TONES = ["positive", "mixed", "negative"] as const;
type Tone = (typeof TONES)[number];

const EM_DASH = "—";
const EN_DASH = "–";
const DASHES = /[—–]/;

interface FileTheme {
  label: string;
  detail?: string;
  tone: Tone;
}

interface FileQuote {
  text: string;
  author?: string;
  context?: string;
  date?: string;
  rating?: number;
  url?: string;
}

interface FileThread {
  title: string;
  url: string;
  subreddit?: string;
  date?: string;
  takeaway?: string;
  upvotes?: number;
  comments?: number;
}

interface GoogleSection {
  heading?: string;
  summary: string;
  rating?: number;
  reviewCount?: number;
  breakdown?: { stars: number; count: number }[];
  profileUrl?: string;
  profileName?: string;
  themes?: FileTheme[];
  quotes?: FileQuote[];
  checkedOn: string;
}

interface RedditSection {
  heading?: string;
  summary: string;
  tone?: Tone;
  subreddits?: string[];
  volumeNote?: string;
  searchUrl?: string;
  threads?: FileThread[];
  themes?: FileTheme[];
  quotes?: FileQuote[];
  checkedOn: string;
}

interface SentimentFile {
  slug: string;
  /** Cross-checked against the stored document so a renamed processor is caught. */
  name: string;
  google?: GoogleSection;
  reddit?: RedditSection;
  /**
   * Why a section is absent, in one line. Required when either is missing, so the
   * next person to open the file knows it was checked and found nothing rather
   * than never checked at all.
   */
  noGoogleReason?: string;
  noRedditReason?: string;
  /** Research provenance. Kept in the file, never written to the database. */
  sources: string[];
}

// ---------------------------------------------------------------------------
// House rules
// ---------------------------------------------------------------------------

/** Every authored string in a file, flattened, so the copy checks ignore shape. */
function allCopy(f: SentimentFile): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  const section = (key: "google" | "reddit", s?: GoogleSection | RedditSection) => {
    if (!s) return;
    if (s.heading) out.push({ label: `${key}.heading`, text: s.heading });
    out.push({ label: `${key}.summary`, text: s.summary });
    (s.themes ?? []).forEach((t, i) => {
      out.push({ label: `${key}.themes[${i}].label`, text: t.label });
      if (t.detail) out.push({ label: `${key}.themes[${i}].detail`, text: t.detail });
    });
    if ("volumeNote" in s && s.volumeNote) {
      out.push({ label: `${key}.volumeNote`, text: s.volumeNote });
    }
    if ("threads" in s) {
      (s.threads ?? []).forEach((t, i) => {
        if (t.takeaway) out.push({ label: `${key}.threads[${i}].takeaway`, text: t.takeaway });
        // Thread titles are included for the dash check specifically. They are
        // transcribed from Reddit, and `audit:dashes --fix` walks every string in
        // the processors collection, so a title carrying an em dash would be
        // silently rewritten into something nobody posted. Same rule as a quote:
        // TRIM the title to an unaffected span rather than editing the
        // punctuation.
        out.push({ label: `${key}.threads[${i}].title`, text: t.title });
      });
    }
  };
  section("google", f.google);
  section("reddit", f.reddit);
  return out;
}

/**
 * Checks that run before the first write, so one bad file cannot leave half the
 * directory updated. The zod schemas already enforce lengths and enums; what is
 * here is everything zod cannot know: the site's copy rules, and the evidence
 * rules that keep these sections checkable by a reader.
 */
function houseRuleErrors(f: SentimentFile): string[] {
  const errs: string[] = [];

  // The site-wide dash rule. `audit:dashes --fix` would rewrite these later, and
  // on a quotation that means silently altering someone's words, so quotes are
  // checked separately below and must be SHORTENED rather than edited.
  for (const { label, text } of allCopy(f)) {
    if (text.includes(EM_DASH)) errs.push(`${label}: em dash`);
    if (text.includes(EN_DASH)) errs.push(`${label}: en dash`);
  }

  if (!f.google && !f.reddit) errs.push("file has neither section; delete it instead");
  if (!f.google && !f.noGoogleReason?.trim()) {
    errs.push("noGoogleReason: say why there is no Google section");
  }
  if (!f.reddit && !f.noRedditReason?.trim()) {
    errs.push("noRedditReason: say why there is no Reddit section");
  }
  if (!f.sources.some((s) => s.startsWith("http"))) {
    errs.push("sources: cite at least one URL the figures came from");
  }

  const checkQuotes = (key: string, quotes?: FileQuote[]) => {
    (quotes ?? []).forEach((q, i) => {
      const at = `${key}.quotes[${i}]`;
      if (!q.text?.trim()) errs.push(`${at}.text: empty`);
      if ((q.text ?? "").length > 400) errs.push(`${at}.text: over 400 chars, trim the excerpt`);
      if (DASHES.test(q.text ?? "")) {
        errs.push(`${at}.text: contains a dash. Trim the excerpt rather than rewriting the quote`);
      }
      // A quote a reader cannot trace to a source and a date is indistinguishable
      // from one we made up.
      // Research digests slice review and comment bodies at fixed lengths, and a
      // quote pasted straight out of one can stop mid-word, which reads as an
      // invented fragment rather than an excerpt. There is no reliable way to spot
      // a truncated word, so the rule is the one that removes the whole class:
      // an excerpt ENDS ON A SENTENCE. Trim back to the previous full stop rather
      // than stopping wherever the digest did.
      if (!/[.!?”’"')\]]$/.test((q.text ?? "").trim())) {
        errs.push(`${at}.text: must end on a sentence. Trim back to the previous full stop`);
      }
      if (!q.date?.trim()) errs.push(`${at}.date: say when it was published`);
      if (!/^https:\/\//.test(q.url ?? "")) errs.push(`${at}.url: absolute https URL required`);
      if (q.rating !== undefined && !(q.rating >= 1 && q.rating <= 5)) {
        errs.push(`${at}.rating: ${q.rating} is not a 1 to 5 star rating`);
      }
      // Attribution is a role, an industry, or a handle as the source displays it.
      // Never a real name: it adds no evidential weight and creates a privacy
      // problem the quote does not need.
      if (q.author && /\b(mr|mrs|ms|dr)\b\.?\s/i.test(q.author)) {
        errs.push(`${at}.author: use a role, industry or handle, never a person's name`);
      }
    });
  };

  const checkThemes = (key: string, themes?: FileTheme[]) => {
    (themes ?? []).forEach((t, i) => {
      if (!TONES.includes(t.tone)) errs.push(`${key}.themes[${i}].tone: "${t.tone}" is not a tone`);
    });
  };

  if (f.google) {
    const g = f.google;
    if (!g.summary?.trim()) errs.push("google.summary: empty");
    if (!g.checkedOn?.trim()) errs.push("google.checkedOn: stamp when the listing was read");
    // A rating with no listing behind it is unverifiable, and unverifiable is the
    // one failure mode that damages the site rather than just looking sloppy.
    if ((g.rating !== undefined || g.reviewCount !== undefined) && !g.profileUrl) {
      errs.push("google.profileUrl: a quoted rating or count needs the listing it came from");
    }
    if (g.profileUrl && !/^https:\/\//.test(g.profileUrl)) {
      errs.push("google.profileUrl: absolute https URL required");
    }
    if (g.rating !== undefined && !(g.rating >= 0 && g.rating <= 5)) {
      errs.push(`google.rating: ${g.rating} is not out of 5`);
    }
    if (g.breakdown?.length) {
      const seen = new Set<number>();
      for (const b of g.breakdown) {
        if (!(b.stars >= 1 && b.stars <= 5)) errs.push(`google.breakdown: ${b.stars} is not 1 to 5`);
        if (seen.has(b.stars)) errs.push(`google.breakdown: ${b.stars} stars listed twice`);
        seen.add(b.stars);
      }
      // The histogram is transcribed from the same listing as the count, so a
      // mismatch means one of the two was mistyped. Google rounds its own totals,
      // hence a tolerance rather than an equality check.
      const sum = g.breakdown.reduce((n, b) => n + b.count, 0);
      if (g.reviewCount !== undefined && Math.abs(sum - g.reviewCount) > 2) {
        errs.push(`google.breakdown: sums to ${sum}, but reviewCount is ${g.reviewCount}`);
      }
    }
    checkThemes("google", g.themes);
    checkQuotes("google", g.quotes);
    for (const [i, q] of (g.quotes ?? []).entries()) {
      if (!/^https:\/\/(maps\.google\.|www\.google\.|goo\.gl\/maps|share\.google)/.test(q.url ?? "")) {
        errs.push(`google.quotes[${i}].url: should point at the Google listing it was read on`);
      }
    }
  }

  if (f.reddit) {
    const r = f.reddit;
    if (!r.summary?.trim()) errs.push("reddit.summary: empty");
    if (!r.checkedOn?.trim()) errs.push("reddit.checkedOn: stamp when the discussion was read");
    if (r.tone && !TONES.includes(r.tone)) errs.push(`reddit.tone: "${r.tone}" is not a tone`);
    if (r.searchUrl && !/^https:\/\/(www\.)?reddit\.com\//.test(r.searchUrl)) {
      errs.push("reddit.searchUrl: should be a reddit.com URL");
    }
    // A Reddit section with no thread is an assertion about a discussion the
    // reader cannot go and read. The links are the whole point of the section.
    if (!r.threads?.length) errs.push("reddit.threads: link at least one thread");
    (r.threads ?? []).forEach((t, i) => {
      const at = `reddit.threads[${i}]`;
      if (!t.title?.trim()) errs.push(`${at}.title: empty`);
      if (!/^https:\/\/(www\.)?reddit\.com\/r\/[^/]+\/comments\//.test(t.url ?? "")) {
        errs.push(`${at}.url: must be an https reddit.com thread permalink`);
      }
      if (/\.json(\?|$)/.test(t.url ?? "")) errs.push(`${at}.url: strip the .json suffix`);
      if (!t.date?.trim()) errs.push(`${at}.date: say when the thread ran`);
    });
    checkThemes("reddit", r.themes);
    checkQuotes("reddit", r.quotes);
    for (const [i, q] of (r.quotes ?? []).entries()) {
      if (!/^https:\/\/(www\.)?reddit\.com\//.test(q.url ?? "")) {
        errs.push(`reddit.quotes[${i}].url: should point at the comment or thread it came from`);
      }
    }
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Read + validate
// ---------------------------------------------------------------------------

function readFiles(only: string[] | null): SentimentFile[] {
  let names: string[];
  try {
    names = readdirSync(DATA_DIR).filter((n) => n.endsWith(".json")).sort();
  } catch {
    throw new Error(`No data directory at ${DATA_DIR}`);
  }
  const files = names.map((n) => {
    const parsed = JSON.parse(readFileSync(join(DATA_DIR, n), "utf8")) as SentimentFile;
    const expected = `${parsed.slug}.json`;
    if (n !== expected) {
      throw new Error(`${n} declares slug "${parsed.slug}"; rename the file to ${expected}`);
    }
    return parsed;
  });
  if (!only) return files;
  const bySlug = new Map(files.map((f) => [f.slug, f]));
  const missing = only.filter((s) => !bySlug.has(s));
  if (missing.length) throw new Error(`No off-site sentiment file for: ${missing.join(", ")}`);
  return only.map((s) => bySlug.get(s)!);
}

/**
 * Run a section through the same zod schema the admin form posts through.
 *
 * Not belt and braces: the schemas normalize as well as validate (dropping blank
 * rows, collapsing an all-empty section to `undefined`), and a document written
 * around them would be a shape the form cannot round-trip.
 */
function parseSection<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
  value: unknown,
  label: string,
): T | undefined {
  const res = schema.safeParse(value);
  if (!res.success) {
    const err = res.error as { issues?: { path: (string | number)[]; message: string }[] };
    const issues = (err.issues ?? [])
      .map((i) => `${label}.${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(issues || `${label}: failed validation`);
  }
  return res.data;
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

  const problems = files.flatMap((f) => houseRuleErrors(f).map((e) => `${f.slug}: ${e}`));
  if (problems.length) {
    throw new Error(`House-rule violations:\n  ${problems.join("\n  ")}`);
  }

  const prepared = files.map((f) => {
    try {
      return {
        file: f,
        google: parseSection(googleReviewsOverviewSchema, f.google, "google"),
        reddit: parseSection(redditOverviewSchema, f.reddit, "reddit"),
      };
    } catch (err) {
      throw new Error(`${f.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // A section that survived the schemas but does not read as "said" would render
  // an empty card and put the URL in the sitemap. Catch it here, not in production.
  for (const p of prepared) {
    if (p.file.google && !hasSentimentContent(p.google)) {
      throw new Error(`${p.file.slug}: google section holds nothing hasSentimentContent counts`);
    }
    if (p.file.reddit && !hasSentimentContent(p.reddit)) {
      throw new Error(`${p.file.slug}: reddit section holds nothing hasSentimentContent counts`);
    }
  }

  await connectForScript();

  let written = 0;
  let skipped = 0;
  for (const p of prepared) {
    const doc = await Processor.findOne({ slug: p.file.slug })
      .select("name slug isPublished reviewsPage.googleReviews reviewsPage.reddit")
      .lean();
    if (!doc) {
      log(`  skipped ${p.file.slug} (no such processor). Run \`npm run seed\` first`);
      skipped += 1;
      continue;
    }
    if (doc.name !== p.file.name) {
      log(`  ! ${p.file.slug}: file says "${p.file.name}", DB says "${doc.name}"`);
    }

    // Non-destructive default, same reasoning as `seed-review-pages.ts`: a stored
    // section that differs from ours is an editor's work until told otherwise.
    const storedG = doc.reviewsPage?.googleReviews;
    const storedR = doc.reviewsPage?.reddit;
    const hadSomething = hasSentimentContent(storedG) || hasSentimentContent(storedR);
    const stored = JSON.stringify([storedG ?? null, storedR ?? null]);
    const ours = JSON.stringify([p.google ?? null, p.reddit ?? null]);
    if (hadSomething && stored !== ours && !force) {
      log(`  skipped ${p.file.slug} (stored sections differ; pass --force to overwrite)`);
      skipped += 1;
      continue;
    }
    if (hadSomething && stored === ours) {
      log(`  = ${p.file.slug} already current`);
      continue;
    }

    // `$unset` rather than omit: a section deleted from the file has to come off
    // the page, and `$set` of `undefined` is a no-op.
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    if (p.google) set["reviewsPage.googleReviews"] = p.google;
    else unset["reviewsPage.googleReviews"] = "";
    if (p.reddit) set["reviewsPage.reddit"] = p.reddit;
    else unset["reviewsPage.reddit"] = "";

    const parts = [
      p.google
        ? `google ${p.google.rating ?? "?"}/5 from ${p.google.reviewCount ?? "?"}`
        : "no google",
      p.reddit ? `reddit ${p.reddit.threads?.length ?? 0} threads` : "no reddit",
    ].join(", ");

    if (dryRun) {
      log(`  [dry-run] ${p.file.slug.padEnd(26)} ${parts}`);
      written += 1;
      continue;
    }

    await Processor.updateOne(
      { slug: p.file.slug },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
    );
    log(`  ${"✓"} ${p.file.slug.padEnd(26)} ${parts}`);
    written += 1;
  }

  log(
    `\n${dryRun ? "[dry-run] " : ""}${written} processor(s) ${dryRun ? "would be " : ""}updated` +
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
