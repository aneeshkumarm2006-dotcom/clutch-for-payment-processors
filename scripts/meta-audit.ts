/**
 * Meta-tag character audit.
 *
 * Enforces two house rules across EVERY page's meta title / description:
 *
 *   1. No em dash (—). En dash (–) and horizontal bar (―) are reported too:
 *      they render almost identically and are the usual way an em dash sneaks
 *      back in after a find-and-replace.
 *   2. The pipe (|) is the only separator symbol allowed. Beyond it, meta copy
 *      may use just enough punctuation to form sentences (, . ' ? ! : - /) and
 *      nothing else. Ampersands, parentheses, plus signs, semicolons, quotes
 *      and every non-ASCII glyph (· • » → ★) are violations: an ampersand reads
 *      as "and", a parenthetical reads as a comma clause.
 *
 * Nothing here is keyed to a specific page. All three sources of meta copy are
 * discovered rather than listed:
 *
 *   - DB `seo` blocks: every mongoose model whose schema embeds an `seo` (or
 *     `defaultSeo`) sub-document is found by walking the model registry, so a
 *     new SEO-bearing model is covered with no change to this file.
 *   - DB fallback copy: when a document has no `seo.metaTitle` /
 *     `metaDescription` — which is most of them — the meta tag is built from the
 *     entity's own `name` / `title` / `tagline` / `shortDescription` / `excerpt`.
 *     Those fields are checked wherever the schema declares them, so they are
 *     audited on the same footing as the SEO block.
 *   - Source fallbacks: every `buildMetadata(...)` / `pageSeoMetadata(...)` call
 *     site and every `export const metadata` object under `app/`, parsed with
 *     the TypeScript compiler API. These strings render whenever a page has no
 *     DB record at all — including the root layout's site-wide title template,
 *     which reaches every page on the site.
 *   - Content registries: routes like `/payment-processors/[facet]` and
 *     `/glossary/[term]` take their meta copy from a hand-maintained array in
 *     `lib/` rather than from the DB, so the call site reads `facet.description`
 *     and the literal lives elsewhere. Rather than naming those files, the scan
 *     records which properties each call site reads off its source object and
 *     then audits the object literals that declare that exact property set — so
 *     a new registry wired up the same way is covered automatically.
 *
 * Source violations are always reported rather than rewritten: the right
 * replacement for a dash is a judgement call (a title separator wants a pipe, a
 * parenthetical wants commas) and a bad guess would land in a git diff unread.
 * `--fix` applies the mechanical rewrite to DB copy only, which has no diff to
 * review — pair it with `--dry-run` first.
 *
 * Usage:
 *   npm run audit:meta                    # report only (exit 1 if violations)
 *   npm run audit:meta -- --fix --dry-run # preview every DB rewrite, write nothing
 *   npm run audit:meta -- --fix           # apply the DB rewrites
 *   npm run audit:meta -- --json          # machine-readable
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import mongoose from "mongoose";
import { loadEnv } from "./loadEnv";

loadEnv();

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Dash characters rule 1 bans. */
const BANNED_DASHES: Record<string, string> = {
  "—": "em dash",
  "–": "en dash",
  "―": "horizontal bar",
};

/**
 * The complete set of non-alphanumeric characters permitted in meta copy.
 * `|` is the one separator; the rest is the minimum needed to write a sentence.
 * The hyphen is here because it is a word-former ("flat-rate", "developer-first")
 * rather than a symbol.
 */
const ALLOWED_PUNCTUATION = new Set(["|", ".", ",", "'", "?", "!", ":", "-", "/"]);

/**
 * How `--fix` rewrites a banned character. A symbol that carries meaning is
 * spelled out rather than deleted, so "fees & features" becomes "fees and
 * features" and not "fees  features". Anything absent from this table is
 * replaced with a space and the surrounding whitespace collapsed.
 */
const REPLACEMENTS: Record<string, string> = {
  // Symbols with a word meaning.
  "&": " and ",
  "+": " plus ",
  ";": ".",
  // Parentheses read as a comma clause: "a gateway (a PayPal company) with…"
  // becomes "a gateway, a PayPal company, with…".
  "(": ", ",
  ")": ", ",
  // Dashes. A dash between digits is a range ("2–4"), where a hyphen is the
  // right ASCII form; elsewhere it is punctuation standing in for a comma.
  // `fixMetaString` handles the digit case before consulting this table.
  "—": ", ",
  "–": ", ",
  "―": ", ",
  // Typographic look-alikes fold to their ASCII equivalent, so "don’t" stays
  // "don't" rather than losing its apostrophe.
  "‘": "'",
  "’": "'",
  "“": "'",
  "”": "'",
  "«": "'",
  "»": "'",
  "…": "...",
  " ": " ",
  "−": "-",
  "‐": "-",
  "‑": "-",
  // Separator glyphs become the one permitted separator.
  "·": " | ",
  "•": " | ",
};

const isAllowedChar = (ch: string): boolean =>
  /[\p{L}\p{N}\s]/u.test(ch) || ALLOWED_PUNCTUATION.has(ch);

/**
 * `%s` in a Next `title.template` is the slot the page title is substituted
 * into, not copy — it never reaches the rendered tag. Drop it before checking so
 * the template is judged on its literal text (its separator, in practice).
 */
const stripTitlePlaceholders = (value: string) => value.replace(/%s/g, "");

export interface Violation {
  rule: "em-dash" | "symbol";
  char: string;
  codepoint: string;
  name: string;
  count: number;
}

/** Pure: the violations in one meta string. Shared by the DB and source passes. */
export function checkMetaString(value: string): Violation[] {
  const found = new Map<string, Violation>();
  for (const ch of value) {
    const dash = BANNED_DASHES[ch];
    if (dash) {
      bump(found, "em-dash", ch, dash);
      continue;
    }
    if (!isAllowedChar(ch)) bump(found, "symbol", ch, describeChar(ch));
  }
  return [...found.values()];
}

function bump(map: Map<string, Violation>, rule: Violation["rule"], ch: string, name: string) {
  const existing = map.get(ch);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(ch, { rule, char: ch, codepoint: codepointOf(ch), name, count: 1 });
}

const codepointOf = (ch: string) =>
  `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;

const CHAR_NAMES: Record<string, string> = {
  "&": "ampersand",
  "(": "left parenthesis",
  ")": "right parenthesis",
  "+": "plus sign",
  ";": "semicolon",
  '"': "double quote",
  "*": "asterisk",
  "~": "tilde",
  "^": "caret",
  "=": "equals sign",
  "<": "less-than sign",
  ">": "greater-than sign",
  "[": "left square bracket",
  "]": "right square bracket",
  "{": "left curly bracket",
  "}": "right curly bracket",
  _: "underscore",
  "\\": "backslash",
  "`": "backtick",
  "%": "percent sign",
  $: "dollar sign",
  "#": "number sign",
  "@": "commercial at",
  "·": "middle dot",
  "•": "bullet",
  "‘": "left single quote",
  "’": "right single quote",
  "“": "left double quote",
  "”": "right double quote",
  "…": "ellipsis",
  " ": "non-breaking space",
  "→": "right arrow",
  "«": "left guillemet",
  "»": "right guillemet",
  "−": "minus sign",
  "®": "registered sign",
  "™": "trade mark sign",
  "©": "copyright sign",
  "★": "black star",
  "✓": "check mark",
};

const describeChar = (ch: string) => CHAR_NAMES[ch] ?? "disallowed symbol";

/**
 * Mechanical clean-up used by `--fix`. Deterministic and conservative: it
 * produces compliant copy, but a title whose em dash was acting as a separator
 * reads better with a pipe than the comma this inserts, so review the diff.
 */
export function fixMetaString(value: string): string {
  // A dash between digits is a numeric range ("2–4 providers"), where the ASCII
  // hyphen is the correct replacement rather than a comma.
  let working = value.replace(/(\d)\s*[—–―]\s*(\d)/g, "$1-$2");

  let out = "";
  for (const ch of working) {
    const replacement = REPLACEMENTS[ch];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    out += isAllowedChar(ch) ? ch : " ";
  }

  return (
    out
      // A dropped symbol or a spelled-out "&" leaves doubled whitespace behind.
      .replace(/\s+/g, " ")
      // "), " from a closing parenthesis mid-sentence, and ", ." from one that
      // ended the sentence.
      .replace(/,\s*([.,;:!?])/g, "$1")
      .replace(/\s+([.,:!?])/g, "$1")
      // A semicolon became a full stop, so the next word starts a sentence.
      .replace(/\.\s+([a-z])/g, (_m, c: string) => `. ${c.toUpperCase()}`)
      .replace(/[\s,]+$/, "")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Source pass — hardcoded fallbacks at every metadata call site under app/
// ---------------------------------------------------------------------------

/** Property names inside a metadata object whose value reaches a meta tag. */
const META_PROPS = new Set([
  "title",
  "description",
  "template",
  "default",
  "metaTitle",
  "metaDescription",
  "ogTitle",
  "ogDescription",
]);
const META_CALLEES = new Set(["buildMetadata", "pageSeoMetadata"]);

export interface SourceFinding {
  file: string;
  line: number;
  prop: string;
  value: string;
  violations: Violation[];
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Pull the literal `title` / `description` (and Next's `title.template` /
 * `title.default`) strings out of every metadata call site, plus any
 * `export const metadata` object literal — Next's own metadata export, which
 * bypasses `buildMetadata` entirely.
 */
function scanSource(roots: string[], repoRoot: string): SourceFinding[] {
  const findings: SourceFinding[] = [];
  /**
   * Property sets read off a source object at a metadata call site, e.g.
   * `{title, description}` from `title: facet.title, description: facet.description`.
   * Pass two audits the object literals that declare a whole set — see
   * `scanRegistries`.
   */
  const metaShapes: Set<string>[] = [];

  for (const root of roots) {
    for (const file of walkFiles(root)) {
      const text = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const record = (node: ts.Node, prop: string, value: string) => {
        const violations = checkMetaString(
          prop.endsWith("template") ? stripTitlePlaceholders(value) : value,
        );
        if (!violations.length) return;
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        findings.push({
          file: relative(repoRoot, file).split(sep).join("/"),
          line: line + 1,
          prop,
          value,
          violations,
        });
      };

      /** A property's literal text; template literals keep their static spans. */
      const literalOf = (node: ts.Node): string | null => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
        if (ts.isTemplateExpression(node)) {
          // `${expr}` spans are runtime values (a processor name, a facet
          // label); keeping the static text still catches a stray symbol that
          // the template itself contributes to every generated title.
          return node.head.text + node.templateSpans.map((s) => s.literal.text).join(" ");
        }
        return null;
      };

      /**
       * Every `obj.prop` read inside a metadata property's value, grouped by
       * `obj`. `description: p.shortDescription || p.tagline` contributes both
       * names under `p`; a `${t.term}` inside a template contributes `term`.
       */
      const collectMemberReads = (node: ts.Node, into: Map<string, Set<string>>) => {
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ts.isIdentifier(node.name)
        ) {
          const bucket = into.get(node.expression.text) ?? new Set<string>();
          bucket.add(node.name.text);
          into.set(node.expression.text, bucket);
        }
        ts.forEachChild(node, (child) => collectMemberReads(child, into));
      };

      const scanObject = (obj: ts.ObjectLiteralExpression, prefix = "", isMetaArg = false) => {
        const memberReads = new Map<string, Set<string>>();

        for (const p of obj.properties) {
          if (!ts.isPropertyAssignment(p) || !p.name) continue;
          const name = p.name.getText(sf).replace(/['"]/g, "");
          if (ts.isObjectLiteralExpression(p.initializer)) {
            scanObject(p.initializer, `${prefix}${name}.`, isMetaArg);
            continue;
          }
          if (!META_PROPS.has(name)) continue;

          const value = literalOf(p.initializer);
          if (value !== null) record(p.initializer, `${prefix}${name}`, value);
          // Even when a literal was found, a template's `${…}` spans may point
          // at a registry, so always collect the reads.
          if (isMetaArg) collectMemberReads(p.initializer, memberReads);
        }

        for (const props of memberReads.values()) {
          if (props.size) metaShapes.push(props);
        }
      };

      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          META_CALLEES.has(node.expression.text) &&
          node.arguments[0] &&
          ts.isObjectLiteralExpression(node.arguments[0])
        ) {
          scanObject(node.arguments[0] as ts.ObjectLiteralExpression, "", true);
        }
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === "metadata" &&
          node.initializer &&
          ts.isObjectLiteralExpression(node.initializer)
        ) {
          scanObject(node.initializer);
        }
        // `generateMetadata` early-returns — `if (!p) return { title: "Not
        // found" }` — build a Metadata object by hand and never touch
        // `buildMetadata`, so nothing above would see them.
        if (
          (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
          node.name &&
          ts.isIdentifier(node.name) &&
          node.name.text === "generateMetadata"
        ) {
          const scanReturns = (n: ts.Node) => {
            if (ts.isReturnStatement(n) && n.expression) {
              const returned = ts.isParenthesizedExpression(n.expression)
                ? n.expression.expression
                : n.expression;
              if (ts.isObjectLiteralExpression(returned)) scanObject(returned);
            }
            ts.forEachChild(n, scanReturns);
          };
          scanReturns(node);
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
    }
  }

  findings.push(...scanContentLiterals(roots, repoRoot, metaShapes));
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** Property names that mean SEO copy wherever they appear — no context needed. */
const UNAMBIGUOUS_SEO_KEYS = ["metaTitle", "metaDescription", "ogTitle", "ogDescription"];

/**
 * Audit the object literals that supply meta copy without being a metadata call
 * site themselves. Three kinds qualify:
 *
 *  1. A literal declaring EVERY property in one of the shapes observed at a call
 *     site (`{title, description}` from `title: facet.title`). Requiring the
 *     whole set is what keeps this generic without flooding the report — a
 *     common property name on its own is never enough to match.
 *  2. A literal declaring `metaTitle` / `metaDescription` / `ogTitle` /
 *     `ogDescription`. Those names mean one thing anywhere, which is what the
 *     seed scripts use to write SEO copy into the DB.
 *  3. A seed record: a literal with a `slug` plus one of the entity fields that
 *     becomes meta copy (`name`, `tagline`, `shortDescription`, `excerpt`).
 *
 * Cases 2 and 3 matter because re-running a seed would otherwise reintroduce
 * every violation this audit just cleared out of the database.
 *
 * Only the properties that reach a meta tag are checked; a sibling like `h1` or
 * `intro` is untouched.
 */
function scanContentLiterals(
  roots: string[],
  repoRoot: string,
  shapes: Set<string>[],
): SourceFinding[] {
  const findings: SourceFinding[] = [];
  // Drop shapes subsumed by another so a literal is not reported twice.
  const unique = shapes.filter(
    (s, i) => !shapes.some((o, j) => j !== i && s.size < o.size && [...s].every((p) => o.has(p))),
  );
  const fallbackNames = FALLBACK_FIELDS.map((f) => f.field);

  for (const root of roots) {
    for (const file of walkFiles(root)) {
      // The audit's own rule tables are full of the characters it bans.
      if (file.includes("meta-audit")) continue;

      const text = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const visit = (node: ts.Node) => {
        if (ts.isObjectLiteralExpression(node)) {
          const declared = new Map<string, ts.Expression>();
          for (const p of node.properties) {
            if (ts.isPropertyAssignment(p) && p.name) {
              declared.set(p.name.getText(sf).replace(/['"]/g, ""), p.initializer);
            }
          }

          const toCheck = new Set<string>();
          const shape = unique.find((s) => [...s].every((prop) => declared.has(prop)));
          if (shape) for (const p of shape) toCheck.add(p);
          for (const key of UNAMBIGUOUS_SEO_KEYS) if (declared.has(key)) toCheck.add(key);
          if (declared.has("slug")) {
            for (const f of fallbackNames) if (declared.has(f)) toCheck.add(f);
          }

          for (const prop of toCheck) {
            const init = declared.get(prop);
            if (!init || !(ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
              continue;
            }
            const violations = checkMetaString(init.text);
            if (!violations.length) continue;
            const { line } = sf.getLineAndCharacterOfPosition(init.getStart(sf));
            findings.push({
              file: relative(repoRoot, file).split(sep).join("/"),
              line: line + 1,
              prop,
              value: init.text,
              violations,
            });
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// DB pass — every model that embeds an `seo` block
// ---------------------------------------------------------------------------

/** SEO string paths checked on every document. `keywords` is handled separately. */
const SEO_STRING_FIELDS = ["metaTitle", "metaDescription", "ogTitle", "ogDescription"] as const;

/**
 * Entity fields that become the meta title/description when the `seo` block
 * leaves the corresponding slot unset — which is the case for most documents.
 * Checked on whichever of them the model's schema actually declares, so this is
 * field-driven rather than page-driven.
 *
 * Each is tagged with the slot it feeds. A field is only audited when that slot
 * is genuinely empty: once `seo.metaTitle` is set, `name` never reaches a meta
 * tag, and flagging a visible entity name for a meta rule it no longer affects
 * would be a false positive.
 */
const FALLBACK_FIELDS: { field: string; slot: "metaTitle" | "metaDescription" }[] = [
  { field: "name", slot: "metaTitle" },
  { field: "title", slot: "metaTitle" },
  { field: "tagline", slot: "metaDescription" },
  { field: "shortDescription", slot: "metaDescription" },
  { field: "excerpt", slot: "metaDescription" },
];

export interface DbFinding {
  model: string;
  id: string;
  label: string;
  field: string;
  value: string;
  fixed: string;
  violations: Violation[];
}

/** Models whose schema declares an `seo` (or `defaultSeo`) sub-document. */
function seoBearingModels(): { model: mongoose.Model<unknown>; seoPath: string }[] {
  const out: { model: mongoose.Model<unknown>; seoPath: string }[] = [];
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name) as mongoose.Model<unknown>;
    for (const path of ["seo", "defaultSeo"]) {
      if (model.schema.path(path) || model.schema.path(`${path}.metaTitle`)) {
        out.push({ model, seoPath: path });
      }
    }
  }
  return out;
}

const labelOf = (doc: Record<string, unknown>): string =>
  String(doc.slug ?? doc.pageKey ?? doc.title ?? doc.name ?? doc._id ?? "");

async function scanDb(fix: boolean, dryRun: boolean): Promise<DbFinding[]> {
  const findings: DbFinding[] = [];

  for (const { model, seoPath } of seoBearingModels()) {
    const fallbackFields = FALLBACK_FIELDS.filter((f) => model.schema.path(f.field));
    const docs = await model.find({}).lean<Record<string, unknown>[]>();

    for (const doc of docs) {
      const updates: Record<string, unknown> = {};

      const consider = (field: string, value: unknown) => {
        if (typeof value !== "string" || !value) return;
        const violations = checkMetaString(value);
        if (!violations.length) return;
        const fixed = fixMetaString(value);
        findings.push({
          model: model.modelName,
          id: String(doc._id),
          label: labelOf(doc),
          field,
          value,
          fixed,
          violations,
        });
        if (fix) updates[field] = fixed;
      };

      const seo = doc[seoPath] as Record<string, unknown> | undefined;
      if (seo) {
        for (const field of SEO_STRING_FIELDS) consider(`${seoPath}.${field}`, seo[field]);

        const keywords = seo.keywords;
        if (Array.isArray(keywords)) {
          keywords.forEach((k, i) => consider(`${seoPath}.keywords.${i}`, k));
        }
      }

      // The copy that renders when the SEO block is silent. A slot the SEO block
      // fills is authoritative, so its fallback field no longer reaches a tag.
      for (const { field, slot } of fallbackFields) {
        const override = seo?.[slot];
        if (typeof override === "string" && override.trim()) continue;
        consider(field, doc[field]);
      }

      if (fix && !dryRun && Object.keys(updates).length) {
        await model.updateOne({ _id: doc._id }, { $set: updates });
      }
    }
  }

  return findings.sort(
    (a, b) => a.model.localeCompare(b.model) || a.label.localeCompare(b.label),
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const describeViolations = (vs: Violation[]) =>
  vs
    .map(
      (v) =>
        `${v.rule === "em-dash" ? "em-dash rule" : "symbol rule"}: "${v.char}" (${v.codepoint} ${v.name})${
          v.count > 1 ? ` x${v.count}` : ""
        }`,
    )
    .join(", ");

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");
  const dryRun = args.includes("--dry-run");
  const json = args.includes("--json");
  const repoRoot = process.cwd();

  // `scripts` is in scope because the seeders hold the canonical copy that gets
  // written into the DB — leaving them out would let `npm run seed:seo` put
  // every violation straight back.
  const sourceFindings = scanSource(
    [join(repoRoot, "app"), join(repoRoot, "lib"), join(repoRoot, "scripts")],
    repoRoot,
  );

  let dbFindings: DbFinding[] = [];
  let dbError: string | null = null;
  try {
    const { connectToDatabase } = await import("../lib/db");
    await import("../models");
    await connectToDatabase();
    dbFindings = await scanDb(fix, dryRun);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }

  /* eslint-disable no-console */
  if (json) {
    console.log(JSON.stringify({ sourceFindings, dbFindings, dbError }, null, 2));
    process.exit(sourceFindings.length + dbFindings.length > 0 ? 1 : 0);
  }

  const log = (s = "") => console.log(s);

  log(c.bold("\nMeta tag character audit"));
  log(c.dim("Rule 1: no em dash.  Rule 2: no symbol other than | (pipe).\n"));

  log(
    c.bold(
      `Source fallbacks (${sourceFindings.length} violation${sourceFindings.length === 1 ? "" : "s"})`,
    ),
  );
  if (!sourceFindings.length) log(c.green("  clean"));
  for (const f of sourceFindings) {
    log(`  ${c.red("x")} ${f.file}:${f.line}  ${c.dim(f.prop)}`);
    log(`      ${f.value}`);
    log(`      ${c.yellow(describeViolations(f.violations))}`);
  }

  log("");
  if (dbError) {
    log(c.bold("Database copy"));
    log(c.yellow(`  skipped, could not connect: ${dbError}`));
  } else {
    log(
      c.bold(`Database copy (${dbFindings.length} violation${dbFindings.length === 1 ? "" : "s"})`),
    );
    if (!dbFindings.length) log(c.green("  clean"));
    if (dryRun && dbFindings.length) log(c.yellow("  dry run: nothing was written\n"));
    for (const f of dbFindings) {
      const marker = !fix ? c.red("x") : dryRun ? c.yellow("would fix") : c.green("fixed");
      log(`  ${marker} ${f.model} ${c.dim(f.label)}  ${c.dim(f.field)}`);
      log(`      ${f.value}`);
      if (fix) log(`   -> ${c.green(f.fixed)}`);
      log(`      ${c.yellow(describeViolations(f.violations))}`);
    }
  }

  const remaining = sourceFindings.length + (fix && !dryRun ? 0 : dbFindings.length);
  log("");
  log(
    remaining === 0
      ? c.green("PASS: all meta copy is clean.")
      : c.red(`FAIL: ${remaining} violation(s) remaining.`),
  );
  /* eslint-enable no-console */
  process.exit(remaining === 0 ? 0 : 1);
}

if (process.argv[1]?.includes("meta-audit")) {
  main().catch((err) => {
    console.error(err); // eslint-disable-line no-console
    process.exit(1);
  });
}
