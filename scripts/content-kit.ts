import { createHash } from "node:crypto";
import { PageSeo } from "@/models";
import { blocksSchema, seoSchema, faqsSchema, pageSeoCreate } from "@/lib/validators";

/**
 * scripts/content-kit.ts — shared plumbing for the "writer delivered a content
 * doc, put it on the pages it targets" scripts (`seed-doc-content.ts`,
 * `seed-lowkd-content.ts`).
 *
 * These scripts are deliberately NOT `seed.ts` / `seed-seo.ts`: those full-replace
 * the fields they own, so re-running either resets admin edits made since. The
 * ones built on this kit are surgical instead — they `$set` only the paths the
 * doc supplies and never touch a field it has nothing to say about, so they are
 * safe to re-run.
 *
 * Two invariants the kit exists to hold:
 *
 * 1. **Every HTML string is checked against `ALLOWED_TAGS` before it is written.**
 *    `lib/sanitize-html.ts` is the real sanitizer, but it imports `server-only`
 *    and so cannot run under tsx. The copy here is hand-authored, so anything
 *    outside the allowlist is a typo rather than an attack, and failing the run
 *    is the right response to it. One copy of that rule, not one per script.
 * 2. **Block ids are STABLE across runs.** They are the React key, and a random
 *    id per run would churn the document on every reseed and defeat idempotency.
 *    `blockId()` derives one from the page scope + block position instead.
 */

/** Both scripts take the same flag, so the kit reads it once. */
export const DRY_RUN = process.argv.includes("--dry-run");

export const log = (msg: string) => {
  // eslint-disable-next-line no-console
  console.log(msg);
};

// ---------------------------------------------------------------------------
// Block authoring
// ---------------------------------------------------------------------------

/**
 * A stable, readable block id. `randomUUID()` (what seed-seo uses) would give
 * every block a new key on every run, so a reseed would look like "all content
 * replaced" to anything diffing the document.
 */
export const blockId = (scope: string, index: number): string =>
  `seed-${createHash("sha1").update(`${scope}:${index}`).digest("hex").slice(0, 12)}`;

export interface GuideSection {
  heading: string;
  /** Safe HTML: `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<a>`. Sanitized on write. */
  body: string;
}

export interface BlockSpec {
  type: string;
  data: Record<string, unknown>;
}

/** A Capterra-style buyers guide block: a TOC, key takeaways, slugged sections. */
export const guide = (opts: {
  title: string;
  intro?: string;
  layout?: "tabs" | "stacked";
  keyTakeaways?: string[];
  sections: GuideSection[];
}): BlockSpec => ({
  type: "buyersGuide",
  data: {
    title: opts.title,
    ...(opts.intro ? { intro: opts.intro } : {}),
    layout: opts.layout ?? "stacked",
    showToc: true,
    keyTakeaways: opts.keyTakeaways ?? [],
    sections: opts.sections,
  },
});

export const richtext = (html: string): BlockSpec => ({ type: "richtext", data: { html } });

export const comparison = (opts: {
  title: string;
  headers: string[];
  rows: { name: string; url?: string; cells: string[] }[];
}): BlockSpec => ({
  type: "comparison",
  data: { title: opts.title, headers: opts.headers, rows: opts.rows },
});

export const cta = (opts: {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
}): BlockSpec => ({ type: "cta", data: opts });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Tags these scripts are allowed to write. See the header note on why. */
const ALLOWED_TAGS = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "h2",
  "h3",
  "h4",
  "br",
]);

export function assertSafeHtml(scope: string, html: string) {
  for (const match of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g)) {
    const tag = match[1] ?? "";
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) {
      throw new Error(
        `Disallowed tag <${tag}> in "${scope}". Allowed: ${[...ALLOWED_TAGS].join(", ")}`,
      );
    }
  }
  if (/\son[a-z]+\s*=/i.test(html) || /javascript:/i.test(html)) {
    throw new Error(`Inline handler or javascript: URL in "${scope}"`);
  }
}

/** Walk a block's HTML-bearing fields: `richtext.html`, guide `intro` + section bodies. */
export function checkBlockHtml(scope: string, block: BlockSpec) {
  const d = block.data;
  if (typeof d.html === "string") assertSafeHtml(scope, d.html);
  if (typeof d.intro === "string") assertSafeHtml(scope, d.intro);
  if (Array.isArray(d.sections)) {
    for (const s of d.sections as GuideSection[]) assertSafeHtml(scope, s.body);
  }
}

/**
 * Validate through the same zod schema the admin form runs on save. A block these
 * scripts could write but the UI would reject is a trap for whoever opens the
 * page next.
 */
export function prepareBlocks(scope: string, specs: BlockSpec[]) {
  for (const spec of specs) checkBlockHtml(scope, spec);
  const withIds = specs.map((b, i) => ({ ...b, id: blockId(scope, i) }));
  const parsed = blocksSchema.safeParse(withIds);
  if (!parsed.success) {
    throw new Error(
      `Invalid blocks for "${scope}": ${JSON.stringify(parsed.error.flatten(), null, 2)}`,
    );
  }
  return parsed.data;
}

/**
 * Like `prepareBlocks`, but for a list that ALREADY has ids — the blocks read
 * back off an existing document, edited in place.
 *
 * `prepareBlocks` regenerates every id from the block's position, which on an
 * existing document would rewrite the React key of every block an editor created
 * and make a one-paragraph append look like a full replacement. The whole list
 * still goes through the schema: blocks that were already stored have to survive
 * the round trip too.
 */
export function prepareExistingBlocks(
  scope: string,
  blocks: { type: string; id: string; data?: Record<string, unknown> }[],
) {
  for (const b of blocks) checkBlockHtml(scope, { type: b.type, data: b.data ?? {} });
  const parsed = blocksSchema.safeParse(blocks);
  if (!parsed.success) {
    throw new Error(
      `Invalid blocks for "${scope}": ${JSON.stringify(parsed.error.flatten(), null, 2)}`,
    );
  }
  return parsed.data;
}

export interface SeoSpec {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  focusKeyword?: string;
  /** Site-relative path. Retires this URL with a 308. */
  redirectTo?: string;
  /** hreflang: shared key naming the variant set, plus this variant's BCP 47 tag. */
  localeGroup?: string;
  locale?: string;
}

/**
 * Flatten an SEO spec into dotted `$set` paths, so untouched SEO fields survive.
 *
 * `prefix` exists for the one SEO block that is not at `seo.*`: a processor's
 * reviews archive keeps its own at `reviewsPage.seo.*`, because the profile and
 * the archive target different queries and one `metaTitle` cannot serve both.
 */
export function seoSet(scope: string, spec: SeoSpec, prefix = "seo"): Record<string, unknown> {
  const parsed = seoSchema.safeParse(spec);
  if (!parsed.success) {
    throw new Error(`Invalid SEO for "${scope}": ${JSON.stringify(parsed.error.flatten())}`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) out[`${prefix}.${key}`] = value;
  }
  return out;
}

export function checkFaqs(scope: string, faqs: { question: string; answer: string }[]) {
  const parsed = faqsSchema.safeParse(faqs);
  if (!parsed.success) {
    throw new Error(`Invalid FAQs for "${scope}": ${JSON.stringify(parsed.error.flatten())}`);
  }
  return parsed.data;
}

/** Union of existing + new keywords, capped at the schema's limit of 20. */
export const mergeKeywords = (existing: unknown, added: string[]): string[] =>
  Array.from(
    new Set([...(Array.isArray(existing) ? existing.map(String) : []), ...added]),
  ).slice(0, 20);

// ---------------------------------------------------------------------------
// PageSeo writers
// ---------------------------------------------------------------------------

export async function upsertPageSeoRoute(opts: {
  pageKey: string;
  title: string;
  path: string;
  seo?: SeoSpec;
  faqs?: { question: string; answer: string }[];
  blocks?: BlockSpec[];
  /** Merge into whatever keywords the record already carries instead of replacing. */
  mergeKeywordsInto?: boolean;
}) {
  const existing = await PageSeo.findOne({ pageKey: opts.pageKey }).lean();

  const seoSpec: SeoSpec = { ...opts.seo };
  if (opts.mergeKeywordsInto && seoSpec.keywords) {
    seoSpec.keywords = mergeKeywords(existing?.seo?.keywords, seoSpec.keywords);
  }

  const set: Record<string, unknown> = {
    path: opts.path,
    kind: "route",
    ...(opts.seo ? seoSet(opts.pageKey, seoSpec) : {}),
    ...(opts.faqs ? { faqs: checkFaqs(opts.pageKey, opts.faqs) } : {}),
    ...(opts.blocks ? { blocks: prepareBlocks(opts.pageKey, opts.blocks) } : {}),
  };

  if (DRY_RUN) {
    log(
      `  [dry-run] PageSeo ${opts.pageKey} (${opts.path}) ${existing ? "update" : "insert"}: ${Object.keys(set).join(", ")}`,
    );
    return;
  }

  await PageSeo.updateOne(
    { pageKey: opts.pageKey },
    // `title` is the admin's own label for the record, so it is set once at
    // creation and never rewritten by a reseed.
    { $set: set, $setOnInsert: { title: opts.title, isPublished: true } },
    { upsert: true },
  );
  log(`  ${existing ? "updated" : "created"} PageSeo ${opts.pageKey} (${opts.path})`);
}

export interface LandingSpec {
  pageKey: string;
  path: string;
  /** Admin label and breadcrumb leaf. */
  title: string;
  heading: string;
  subheading: string;
  seo: SeoSpec;
  faqs: { question: string; answer: string }[];
  blocks: BlockSpec[];
}

export async function upsertLanding(spec: LandingSpec) {
  // Validate the identity half through the same schema the admin's create form
  // uses, so a path this script writes is one the UI would also accept.
  const identity = pageSeoCreate.parse({
    title: spec.title,
    path: spec.path,
    heading: spec.heading,
    subheading: spec.subheading,
    isPublished: true,
  });

  const set: Record<string, unknown> = {
    title: identity.title,
    path: identity.path,
    pageKey: identity.pageKey,
    kind: "landing",
    heading: identity.heading,
    subheading: identity.subheading,
    isPublished: true,
    ...seoSet(spec.pageKey, spec.seo),
    faqs: checkFaqs(spec.pageKey, spec.faqs),
    blocks: prepareBlocks(spec.pageKey, spec.blocks),
  };

  const existing = await PageSeo.findOne({ pageKey: identity.pageKey }).lean();

  if (DRY_RUN) {
    log(
      `  [dry-run] landing ${identity.path} ${existing ? "update" : "insert"}: ${(set.blocks as unknown[]).length} blocks, ${spec.faqs.length} FAQs`,
    );
    return;
  }

  await PageSeo.updateOne({ pageKey: identity.pageKey }, { $set: set }, { upsert: true });
  log(`  ${existing ? "updated" : "created"} landing page ${identity.path}`);
}
