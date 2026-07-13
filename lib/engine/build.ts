import { contentTypes, type ContentTypeKey } from "@/config/content-engine";
import { faqJsonLd, itemListJsonLd } from "@/lib/seo";
import type {
  EngineContext,
  EngineEntity,
  EngineResult,
  EngineWarning,
  Jsonld,
  SchemaRule,
} from "./types";

/**
 * Structured-data engine — the builder.
 *
 * Pure. No mongoose, no DB, no `next/headers` (see the purity contract in
 * `./types.ts`). Takes a normalized `EngineEntity` plus the site context, reads
 * `config/content-engine.ts`, and returns the exact JSON-LD nodes the page will
 * render — plus warnings for the admin panel.
 *
 * The same call produces the page's schema and the admin's live preview. That's
 * the point: a preview that runs different code from production is a preview of
 * nothing.
 */

const typeOf = (node: Jsonld): string => String(node["@type"] ?? "");

/**
 * Recursively strip `undefined`/`null`/`""` and the empty containers left behind.
 * Google treats a key with a null value as a malformed node, so it is always
 * better to omit a field than to admit we don't have it.
 */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out = value.map(prune).filter((v) => v !== undefined);
    return out.length ? out : undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = prune(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

/**
 * Nodes derived from schema-aware blocks. This is how an editor gets structured
 * data "for free" simply by using the right block — an FAQ block is an FAQPage, a
 * comparison block is an ItemList. No schema knowledge required of them.
 */
function nodesFromBlocks<T>(entity: EngineEntity<T>): {
  nodes: Jsonld[];
  warnings: EngineWarning[];
} {
  const nodes: Jsonld[] = [];
  const warnings: EngineWarning[] = [];
  if (!entity.blocks?.length) return { nodes, warnings };

  // Multiple FAQ blocks on one page are legal content but must not become two
  // FAQPage nodes — Google wants one per URL. Concatenate their questions.
  const faqItems: { question: string; answer: string }[] = [];

  for (const block of entity.blocks) {
    const data = (block.data ?? {}) as Record<string, unknown>;

    if (block.type === "faq") {
      const items = Array.isArray(data.items) ? data.items : [];
      for (const it of items as { question?: string; answer?: string }[]) {
        if (it?.question?.trim() && it?.answer?.trim()) {
          faqItems.push({ question: it.question, answer: it.answer });
        }
      }
    }

    if (block.type === "comparison") {
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const items = (rows as { name?: string; url?: string }[])
        .filter((r) => r?.name?.trim())
        .map((r) => ({ name: r.name as string, path: r.url ?? entity.path }));
      if (items.length) {
        const node = itemListJsonLd(items);
        if (typeof data.title === "string" && data.title.trim()) node.name = data.title;
        nodes.push(node);
      } else {
        warnings.push({
          scope: "ItemList",
          severity: "warn",
          message: "A comparison block has no named rows, so it emits no ItemList schema.",
        });
      }
    }
  }

  if (faqItems.length) nodes.push(faqJsonLd(faqItems));
  return { nodes, warnings };
}

/** Apply admin field overrides, dropping any key the rule didn't whitelist. */
function applyOverrides(
  node: Jsonld,
  rule: SchemaRule<unknown> | undefined,
  overrides: Record<string, unknown> | undefined,
  warnings: EngineWarning[],
): Jsonld {
  if (!overrides) return node;
  const allowed = new Set(rule?.overridable ?? []);
  const out = { ...node };

  for (const [key, value] of Object.entries(overrides)) {
    if (!allowed.has(key)) {
      // Silently applying this could inject a key the builder never anticipated
      // and blow up the render, so it is dropped and reported instead.
      warnings.push({
        scope: typeOf(node),
        severity: "warn",
        message: `"${key}" is not an overridable field on ${typeOf(node)} — ignored.`,
      });
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Drop nodes that are missing a field schema.org requires, and say why. */
function enforceRequired(
  nodes: Jsonld[],
  rules: Map<string, SchemaRule<unknown>>,
  warnings: EngineWarning[],
): Jsonld[] {
  return nodes.filter((node) => {
    const rule = rules.get(typeOf(node));
    const required = rule?.required ?? [];
    const missing = required.filter((key) => {
      const v = node[key];
      return v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === "";
    });
    if (missing.length) {
      warnings.push({
        scope: typeOf(node),
        severity: "error",
        message: `${typeOf(node)} is missing required ${missing.length > 1 ? "fields" : "field"}: ${missing.join(", ")}. It won't be emitted.`,
      });
      return false;
    }
    return true;
  });
}

/**
 * Generic in the entity payload: the engine never looks inside `data` — only the
 * config's `build()` functions do, and those are typed against their own content
 * type. Constraining `T` here would force every caller to widen its DTO.
 */
export function buildStructuredData<T>(
  contentType: ContentTypeKey,
  entity: EngineEntity<T>,
  ctx: EngineContext,
): EngineResult {
  const warnings: EngineWarning[] = [];
  const def = contentTypes[contentType] as
    | { schema: readonly SchemaRule<unknown>[] }
    | undefined;

  if (!def) {
    return {
      nodes: [],
      warnings: [
        { scope: "config", severity: "error", message: `Unknown content type "${contentType}".` },
      ],
    };
  }

  const rules = new Map(def.schema.map((r) => [r.type, r]));
  const disabled = new Set(entity.structuredData?.disabledTypes ?? []);
  const overrides = entity.structuredData?.fieldOverrides ?? {};

  // 1. Nodes the config says this content type emits.
  const configNodes: Jsonld[] = [];
  for (const rule of def.schema) {
    if (disabled.has(rule.type)) continue;
    let node: Jsonld | null = null;
    try {
      node = rule.build(entity as EngineEntity<unknown>, ctx);
    } catch (err) {
      warnings.push({
        scope: rule.type,
        severity: "error",
        message: `Failed to build ${rule.type}: ${err instanceof Error ? err.message : "unknown error"}`,
      });
      continue;
    }
    if (node) configNodes.push(node);
  }

  // 2. Nodes derived from schema-aware blocks.
  const derived = nodesFromBlocks(entity);
  warnings.push(...derived.warnings);
  const blockNodes = derived.nodes.filter((n) => !disabled.has(typeOf(n)));

  // 3. One node per @type. Blocks win: if an editor built an FAQ block, that is a
  //    more deliberate statement of intent than a legacy `faqs` field, and two
  //    FAQPage nodes on one URL is invalid regardless.
  const byType = new Map<string, Jsonld>();
  for (const node of configNodes) byType.set(typeOf(node), node);
  for (const node of blockNodes) {
    if (byType.has(typeOf(node))) {
      warnings.push({
        scope: typeOf(node),
        severity: "warn",
        message: `Both a block and this page's own fields produce ${typeOf(node)}. The block wins — one node per type is emitted.`,
      });
    }
    byType.set(typeOf(node), node);
  }

  // 4. Admin overrides, whitelisted per type.
  let nodes = [...byType.values()].map((node) =>
    applyOverrides(node, rules.get(typeOf(node)), overrides[typeOf(node)], warnings),
  );

  // 5. Required-field enforcement.
  nodes = enforceRequired(nodes, rules, warnings);

  // 6. Hand-authored JSON-LD. Stored as a raw string, so it must be parsed into an
  //    object — handing the string itself downstream would double-encode it into a
  //    quoted JSON string and emit an invalid <script> body.
  const custom = entity.structuredData?.customJsonLd?.trim();
  if (custom) {
    try {
      const parsed: unknown = JSON.parse(custom);
      const customNodes = (Array.isArray(parsed) ? parsed : [parsed]).filter(
        (n): n is Jsonld => typeof n === "object" && n !== null,
      );
      if (entity.structuredData?.customMode === "replace") {
        nodes = customNodes;
      } else {
        nodes = [...nodes, ...customNodes];
      }
    } catch {
      // Saving invalid JSON is blocked by the validator, so reaching here means a
      // document predates that check or was written outside the API. Never emit it.
      warnings.push({
        scope: "custom",
        severity: "error",
        message: "Custom JSON-LD is not valid JSON and was not emitted.",
      });
    }
  }

  // 7. Prune, and drop anything that pruned away to nothing.
  const pruned = nodes
    .map((n) => prune(n) as Jsonld | undefined)
    .filter((n): n is Jsonld => Boolean(n && Object.keys(n).length));

  return { nodes: pruned, warnings };
}
