# Structured Data Engine + Modular Content & SEO Layer

Two additive systems, driven by **one config file**:

1. **Structured-data engine** — every public page emits validated schema.org JSON-LD, generated from content, overridable per page in the admin.
2. **Modular content + per-page SEO** — editors compose pages from reusable blocks and control SEO without touching code. Blocks with structured meaning wire themselves into the engine.

Nothing was replaced. Existing pages, content, routes and admin screens work exactly as before; both systems are opt-in per page.

---

## The one file you edit — `config/content-engine.ts`

This is the only file that knows what this site is *about*. Every domain word (`processor`, `ratingAverage`, `/compare`) lives here and nowhere in `lib/engine/`. It holds four things:

| Section | What it controls |
|---|---|
| `siteConfig` | Fallback identity + the search path that drives the WebSite `SearchAction`. Anything an admin can edit (name, logo, socials) is read from **SiteSettings** at request time, not hardcoded. |
| `seoDefaults` | Twitter card default, ideal meta lengths, and `noindexRoutes` — routes no admin setting can make indexable. |
| `enabledBlocks` | Which block types editors can use. Remove one and it disappears from every picker; existing content is preserved, not destroyed. |
| `contentTypes` | **The core map.** Content type → the schema.org nodes it emits, plus the field mapping for each. |

A `contentTypes` entry looks like this — the `build()` function is where this site's field names get read:

```ts
processor: defineContentType<ProcessorEngineData>({
  label: "Processor",
  schema: [
    {
      type: "Product",
      required: ["name"],                 // node is DROPPED (with a warning) if missing
      overridable: ["name", "description", "image", "brand", "offers"],
      build: (e) => processorJsonLd({ name: e.data.name, ratingAverage: e.data.ratingAverage, … }),
    },
    { type: "BreadcrumbList", … },
    { type: "FAQPage", build: (e) => (e.faqs?.length ? faqJsonLd(e.faqs) : null) },
  ],
}),
```

## How it fits together

```
Mongo doc ──> lib/serialize.ts ──> EngineEntity ──> lib/engine/build.ts ──> JSON-LD
              (toXEngineEntity)    (normalized)     (reads the config)      <JsonLd>
```

- **`lib/engine/` is pure.** No mongoose, no DB, no `next/headers`. This is a hard contract, not a style preference — it's what lets the admin's live preview import `buildStructuredData` **directly into the browser** and run the *same function* the page runs. The preview isn't an approximation of the output; it *is* the output.
- **`lib/serialize.ts` is a whitelist wall.** Public pages never see a Mongo document. A field added to a model but not to the serializer is silently dropped before it reaches a page — the code compiles, the data saves, and the feature quietly does nothing. Add new SEO fields to `toSeoData()`, not to a call site.

## Engine rules

- **One node per `@type` per page.** An FAQ block *and* a legacy `faqs` field would otherwise emit two `FAQPage` nodes on one URL (invalid). The block wins; the page hides the legacy FAQ section to match.
- **Missing required field → node dropped + warning.** A malformed node is worse than an absent one.
- **`fieldOverrides` are whitelisted per type.** An override targeting an unexpected key would 500 the render; unknown keys are dropped and reported instead.
- **Custom JSON-LD must parse to save.** Invalid JSON blocks the save rather than shipping a broken `<script>`.
- **Site-wide `Organization` + `WebSite`** are emitted once, as an `@graph` with absolute `@id`s, by `app/(public)/layout.tsx`. Page-level nodes *reference* the organization (`publisher: {"@id": …}`) instead of restating it.

## Blocks

Ship: `richtext`, `faq`, `comparison`, `featureGrid`, `prosCons`, `cta`, `media`, `htmlEmbed`.

**Adding a block type is a three-line change:**
1. a member in the zod union — `lib/validators/blocks.ts`
2. an entry in the registry — `components/content/blocks/registry.tsx` (label, icon, blank value, edit form)
3. a case in the renderer — `components/public/Blocks.tsx`

Then add its key to `enabledBlocks`.

**Schema-aware blocks:** an `faq` block emits `FAQPage`; a `comparison` block emits `ItemList`. Editors get structured data for free by using the right block.

**Where blocks render:**
| Model | Behaviour |
|---|---|
| Processor | Blocks **replace** `longDescription` when present |
| Category | Blocks **replace** `introContent` when present |
| PageSeo | Blocks render in the page's editorial slot |
| BlogPost | Blocks render **around** `content`, which stays authoritative — `injectKeywordLinks`, `computeReadingTime` and the word-count SEO check all read it, and a block-only post would look empty to all three |

`richtext` and `htmlEmbed` HTML is sanitized **on save** (`lib/sanitize-html.ts`), the same as the blog body.

## Pages without an entity — `PageSeo`

`PageSeo` backs every page that has no Processor or Category of its own. One record, two `kind`s:

| kind | What it is | Who creates it | `path` |
|---|---|---|---|
| `route` | SEO + FAQs + an editorial block slot for a page that **exists in code** (`/`, `/processors`, `/compare`, `/glossary`, `/payment-processors/ach`) | seeded (`npm run seed:seo`, `npm run seed:doc-content`) | fixed at seed time, immutable in the admin |
| `landing` | A standalone page that **is** the record — heading, lede, blocks, SEO, nothing else | created in admin → Pages & SEO | editable, one root-level slug |

A `landing` page is served by `app/(public)/[landing]/page.tsx`, a root-level dynamic segment that Next.js only reaches after every static route and every other dynamic segment has failed to match. Unknown slug or unpublished record → `notFound()`. `RESERVED_LANDING_PATHS` (in `lib/validators/pageSeo.ts`) rejects a path a real route already owns, because such a record would save fine and then never render.

**Wiring an existing route up to a record is one call.** No new key needed — the route already knows its own path:

```ts
const page = await getPageSeoByPath("/glossary");   // lib/page-seo.ts
<Blocks blocks={toBlocks(page?.blocks)} />
// and in generateMetadata: pageSeoMetadata({ …fallbacks, path: "/glossary", byPath: true })
```

Both are optional at every step: with no record the page renders exactly as it did before. That is what makes deepening a page (the ACH facet, say) content work rather than an edit to a shared registry.

Deleting is allowed for `landing` only. Deleting a `route` record wouldn't remove its page, just strip the meta off a page that stays live, so the API refuses it — unpublish or clear the fields instead.

### Regional variants (hreflang)

A page that exists once per country carries `seo.localeGroup` (a shared key naming the set) and `seo.locale` (its BCP 47 tag). `getLocaleVariants` collects the set, `toHreflangMap` turns it into the `languages` map `buildMetadata` emits, and the landing route also renders a visible "Also available for" switcher so the variants link to each other in HTML, not just in `<head>`.

Both fields are required on **every** variant. hreflang is reciprocal: a set where one page omits itself, or points at a URL that doesn't point back, is discarded by Google in full. Requiring both fields is what makes the emitted set complete by construction. `x-default` is emitted only when a region-less variant (`en`, not `en-CA`) exists — with two regional pages and no neutral one, picking by sort order would quietly nominate whichever country sorts first as the world's default.

Only the landing route reads these, so the admin fields are hidden elsewhere (`showLocaleVariants`). Same reasoning hides `redirectTo` on pages that don't consult it: a control that silently does nothing is worse than no control.

## Per-page SEO

`SeoSchema` (in `models/shared.ts`) is shared by Processor, Category, BlogPost, PageSeo and SiteSettings — a field added there lands on all five. It now carries meta title/description/keywords, OG title/description/image, Twitter card, canonical, robots and a focus keyword.

Precedence, strongest first:

> **system noindex → page-level args → entity `seo` → site default → page's hardcoded copy**

Four traps are encoded deliberately; don't "simplify" them away:

- **`robotsIndex` is tri-state.** `undefined` (every pre-existing document) means *emit no robots directive*. `Boolean(seo.robotsIndex)` would resolve to `false` and **noindex the entire site on deploy**.
- **`canonicalUrl` must be same-origin.** A cross-origin canonical de-indexes the page that sets it, so a foreign origin is ignored rather than trusted.
- **`ogTitle` never falls back into `metaTitle`.** A custom meta title is treated as absolute (it drops the `· Payment Processor Guide` suffix), so leaking a social headline into it would silently rewrite every SERP title.
- **A `redirectTo` page must leave the sitemap.** `seo.redirectTo` retires a URL with a 308 (`applySeoRedirect`, honoured by the processor, category, blog and landing pages). It is the right way to consolidate a duplicate — a canonical is only a hint, a noindex passes nothing on — but a redirected URL is not a page, so `indexableFilter` in `lib/public-data.ts` drops it. That filter is SPREAD into `publishedFilter()`, which already owns `$or`, hence `{$in: [null, ""]}` rather than a second `$or` that would silently replace the publish-date clause.
- **`/compare` is NOT in `noindexRoutes`.** A prefix rule can't tell the three compare URLs apart, and they want opposite treatment: bare `/compare` is an indexable landing page with its own copy, `/compare/stripe-vs-square` is a curated pair in the sitemap, and only `/compare?ids=` is a combinatorial near-duplicate. The compare page sets `robots` itself when `ids` is present. Adding `/compare` back to the list silently noindexes the two curated surfaces while the sitemap keeps advertising them.

`blocks` and `structuredData` are in `PRESERVE_ON_OMIT` (`lib/api.ts`). A BlogPost has **two** full-replace writers — `/api/blog/[id]` and `/api/seoteam/posts/[id]` — and `diffSetUnset` maps `undefined → $unset`. Without the preserve list, saving a post from one panel would delete the fields the other panel owns. An explicit `[]` still clears them, so an editor can delete their last block.

## Migration

```bash
npm run migrate:blocks -- --up                    # dry run (default)
npm run migrate:blocks -- --up --commit           # wrap legacy HTML into a richtext block
npm run migrate:blocks -- --down --commit         # remove blocks + schema overrides
npm run migrate:blocks -- --up --commit --collection=processors --slug=stripe
```

`--up` **copies**; it never deletes the source field. That's what makes `--down` a true inverse — it drops `blocks`/`structuredData` and the page falls straight back to the legacy field it never stopped having. Nothing is reconstructed, so nothing can be lost in the round-trip. BlogPost is excluded from `--up` (see the table above).

## Seeding content

```bash
npm run seed:seo                       # the original keyword-mapped meta plan
npm run seed:doc-content -- --dry-run  # the editorial content plan, preview only
npm run seed:doc-content               # apply it
```

`seed.ts` and `seed-seo.ts` full-replace the fields they own, so re-running either resets admin edits made since. `seed-doc-content.ts` is surgical instead: it `$set`s only the dotted paths its source doc supplies, merges keyword lists rather than replacing them, never rewrites a `metaTitle` the doc has nothing to say about, and derives stable block ids from the page + position so a reseed is a genuine no-op rather than a churned document.

Two invariants it has to respect, and so does anything like it:

- **Blocks replace `longDescription` (processors) and `introContent` (categories)** on the public page. Every block list it writes to a record with existing prose therefore re-wraps that prose in a leading `richtext` block. Drop that and the guide silently deletes the page's opening paragraph.
- **`lib/sanitize-html.ts` imports `server-only`** and cannot run under `tsx`. Seed scripts can't call `sanitizeBlocks`, so `seed-doc-content.ts` checks its HTML against a tag allowlist and fails the run on anything outside it. Content written through the admin still goes through the real sanitizer.

---

## Porting this to another dashboard

Run a Phase-0 discovery on the target repo, then **rewrite `config/content-engine.ts` and change nothing else in the engine.** Point `siteConfig`/`EngineContext` at that site's settings record; replace the `contentTypes` map with that site's real content types, giving each one the schema.org nodes it should emit and a `build()` that reads its actual field names (a `listing` → `Product`, a `property` → `Accommodation`, a `lender` → `FinancialService`); trim `enabledBlocks` to the blocks that make sense there. Then write one `toXEngineEntity()` adapter per content type in that repo's serializer so the engine receives the normalized `EngineEntity` shape it expects, and mount `<BlockEditor>`, `<SeoPanel>` and `<StructuredDataPanel>` in its existing forms. Everything under `lib/engine/` — the merge, dedupe, override, validation and preview machinery — is domain-agnostic and ships unchanged.
