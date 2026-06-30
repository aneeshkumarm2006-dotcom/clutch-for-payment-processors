# NOTES — deviations & decisions log

> Per PRD §0 hard rule #1: any field/route/page not specified in the PRD, and any
> deliberate deviation from it, is logged here. Empty sections mean "no deviations yet".

## Stage 0 — Project Foundation (M0)

### Stack versions pinned
- Next.js **14.2.15** (App Router), React 18.3, TypeScript 5.6 (strict).
- Tailwind CSS **v3.4** (not v4) — the DESIGN §10 config is authored in the v3 `tailwind.config.ts`
  format, and shadcn/ui targets v3. CSS variables use raw hex (modern Tailwind accepts hex
  directly, per DESIGN §10.1 note), so shadcn classes resolve to `var(--token)` without `hsl()`.
- shadcn/ui **New York** style, `baseColor: neutral`, components hand-added under `components/ui`.

### Decisions taken (defaults — confirm with operator, PRD §19)
- **Product name:** `PayCompare` (placeholder kept).
- **Image host:** Vercel Blob (`@vercel/blob`) wired as the default; `lib/upload.ts` will abstract it
  so Cloudinary remains a drop-in alternative (Stage 2).
- **Dark mode:** tokens are defined for `.dark` (DESIGN §10.1) and `darkMode: "class"` is enabled,
  but no theme toggle ships in MVP — light is the default. (PRD §19 open question; revisit.)
- **Rich text:** Tiptap chosen over MDX for the blog/editorial long-description editor.
- **tsconfig:** `noUncheckedIndexedAccess` enabled on top of `strict` for extra safety.

### Additions beyond the literal PRD
- Added typography scale tokens (`text-display/h1/h2/...`) to `tailwind.config.ts` to implement
  DESIGN §3.1 as utilities. This is an implementation detail of the design system, not a new field.
- `lib/utils.ts` exports helpers beyond `cn`/`slugify` (formatters: `formatRating`, `formatCount`,
  `orDash`, `formatDate`, `toQueryString`) as called for by TODO §0.3.

## Stage 1 — Data Layer + Admin Auth (M1)

### Implementation details (not new data fields)
- **`lib/enums.ts`** — single source of truth for every §8 enum, as `as const`
  arrays with derived union types. Mongoose models, Zod validators, and (later)
  admin form multi-selects all import from here so the DB, API, and UI never
  drift. This is an implementation detail of the §8 models, not a new field.
- **`models/shared.ts`** — reusable `SeoSchema` (the §8 SEO block) embedded on
  Processor/Category/BlogPost/SiteSettings.
- **`models/slug.ts`** — implements the §8 "unique lowercase slug with uniqueness
  check": `autoSlugFrom()` pre-validate hook auto-fills a blank slug from
  name/title; `ensureUniqueSlug()` (used by the admin API in Stage 2) appends
  `-2`, `-3`, … on collision. The unique index is the hard guarantee.
- **`models/index.ts`** — barrel that imports all models so schemas are
  registered before any `populate()`/`ref` lookup (avoids `MissingSchemaError`).
- **Validators** expose `*Input` (create) + `*Update` (PATCH `.partial()`) per
  model, plus `reviewAdminInput` / `reviewModeration` variants. Processor input
  **omits** `ratingAverage`/`ratingCount`/`subRatings` (read-only, computed by
  `lib/ratings.ts` in Stage 2) per PRD §10.3.

### Additions beyond the literal PRD (per hard rule #1)
- **`SiteSettings.key: 'singleton'`** — an extra immutable, unique field added to
  enforce the §8.8 singleton at the DB level (only one settings doc can exist).
- **`ADMIN_SEED_NAME`** — optional env var for the seed admin's display name
  (defaults to `"Admin"`). Added to `.env.example`/`.env.local` as a comment.
- **Draft-friendly required fields:** on `Processor`, only `name`, `slug`, and
  `website` are required at the model layer; §8 lists `logo`/`tagline`/
  `shortDescription`/`longDescription` without `?`, but the "Save draft vs
  Publish" flow (PRD §10.3) needs to persist incomplete drafts. Completeness is
  enforced at publish time (Stage 2 form), not on every write.

### Decisions taken
- **Region list** fixed to the PRD §8.1/§9.2 examples (`US, CA, EU, UK, IN,
  Global`); `supportedRegions` itself stays `string[]` so operators can add more.
- **Admin route grouping:** authenticated pages live under the `app/admin/(panel)`
  route group (URL-invisible) so `AdminShell` wraps `/admin` + `/admin/*` but NOT
  `/admin/login`. `middleware.ts` (`withAuth`) gates `/admin/:path*`, explicitly
  allowing `/admin/login`; the panel layout re-checks the session server-side
  (defense-in-depth) and feeds the user to the shell.
- **NextAuth:** Credentials provider, bcrypt compare, JWT sessions. `id` + `role`
  threaded through the jwt/session callbacks and typed via `types/next-auth.d.ts`.
- **`lib/db.ts`** now reads `MONGODB_URI` lazily (inside `connectToDatabase`)
  instead of at module load, so `scripts/loadEnv.ts` can populate `process.env`
  for `tsx` CLI scripts (which don't auto-load `.env.local`) before connecting.
- **Dark admin sidebar** (DESIGN §9): `ink-950` sidebar, `ink-300` items, active
  item = `violet-300` text on `violet-950`; content area on `ink-50`.

## Stage 2 — Admin CRUD (M2)

### Additions beyond the literal PRD (per hard rule #1)
- **`GET/PUT /api/settings`** — not in the §12 route table, but §10.9 requires
  editing the SiteSettings singleton. Added; GET creates defaults on first read,
  PUT upserts. Shared reader `lib/settings.ts#getOrCreateSiteSettings` (reused by
  the public layout in Stage 3).
- **`GET /api/processors/[id]` accepts an ObjectId *or* a slug.** Next can't host
  sibling `[id]` + `[slug]` dynamic segments, so Stage 3's public "by slug"
  lookup will reuse this route. Mutations (PUT/PATCH/DELETE) still require an id.
- **`lib/labels.ts#humanizeEnum`** — display labels for §8 enum tokens (e.g.
  `apple-pay` → "Apple Pay"). Implementation detail of the admin multi-selects;
  reused by the public UI in Stage 3. Not a new data field.
- **`lib/upload.ts` local-disk dev fallback.** Vercel Blob is the configured
  provider (`BLOB_READ_WRITE_TOKEN`); when it's absent in development, uploads
  write to `public/uploads/` (git-ignored) so an operator can add content with no
  cloud creds. In production with no provider it returns a clear 503 — and every
  image field also accepts a pasted URL, so content entry never hard-depends on
  uploads. Cloudinary remains a drop-in (swap the provider branch).
- **`PATCH` quick-toggle endpoints.** The PRD lists PUT/PATCH for updates; the
  admin list rows use a sparse `PATCH` (e.g. `{ isPublished }`) for fast publish
  toggles, distinct from the full-form save (see below).

### Decisions taken
- **PUT = full replace, PATCH = partial.** The tabbed forms submit the *entire*
  record via **PUT**; the handler `$set`s present fields and `$unset`s the ones
  the editor cleared (`lib/api.ts#diffSetUnset`/`buildUpdateDoc`). A sparse PATCH
  can't clear a field because JSON drops `undefined` keys, so list quick-toggles
  use PATCH while the forms use PUT. Settings PUT clears the same way.
- **Publish completeness lives in the form, API stays permissive** (continues the
  M1 decision). "Save draft" validates with `processorInput`; "Publish" validates
  with `processorPublishInput` (a `superRefine` requiring logo/tagline/short+long
  description and ≥1 category) and jumps to the first offending tab. The API
  validates types only (`processorInput`/`processorUpdate`) so incomplete drafts
  still persist, and the list "Publish" toggle is an explicit admin override.
- **Empty optional numbers.** Form number inputs are kept as strings; the
  validators preprocess `"" → undefined` (`lib/validators/common.ts#emptyToUndefined`)
  so a blank `foundedYear`/`editorScore`/`sponsorRank` stays unset instead of
  coercing to `0`.
- **Cascade on delete.** Deleting a processor also deletes its reviews; deleting a
  category `$pull`s it from every processor's `categories`. Keeps the data
  consistent without orphans.
- **Admin lists read the DB directly** (server components) and render client
  tables; mutations go through the API + `router.refresh()`. The faceted public
  `GET /api/processors` (sponsored→tier→score sort) is intentionally deferred to
  Stage 3 — this M2 GET covers admin listing (search + tier/published/category).
- **Dashboard quick actions** are "Add processor / Add category / Site settings"
  (all M2-live) instead of the PRD's "New blog post" — the blog admin arrives in
  Stage 6. The pending-reviews stat is shown now; its link target (`/admin/reviews`)
  is built in Stage 4.

### Implementation details (not new data fields)
- **Reusable form fields** in `components/admin/fields/` (`CheckboxGroup`,
  `TagInput`, `RepeatableList`, `ImageUploadField`, `MultiImageField`,
  `CategoryMultiSelect`) + generic RHF helpers in `fields/form-fields.tsx`
  (`TextField`/`TextareaField`/`EnumSelectField`/`SwitchField`/`MultiSelectField`/
  `Section`) shared by every admin form.
- **`components/admin/RichTextEditor.tsx`** — Tiptap StarterKit (H2/H3, bold,
  italic, strike, lists, blockquote, undo/redo), `immediatelyRender:false` for the
  App Router; emits HTML. No extra Tiptap extensions added (no link/placeholder
  packages) to keep deps as pinned in M0.
- **Image previews** use `next/image` with `unoptimized` (admin-only previews,
  also lets SVG logos through without optimizer config).
- **Verification:** `tsc --noEmit`, `next lint`, and `next build` all pass; a
  pure-logic smoke test (serialize ↔ Zod round-trip, publish gate, empty-number
  handling, freeTrial tri-state) passed 19/19. DB-backed click-through needs a
  running MongoDB (none in this build env) — run `npm run seed:admin` + `npm run
  dev` against your Mongo to exercise it end-to-end.

## Stage 3 — Public Core (M3)

### Architecture decisions
- **One query path for the directory.** `lib/processors-query.ts` builds the
  faceted filter + ranking and is used by BOTH `GET /api/processors` and the
  SSR `/processors` + `/category/[slug]` pages, so the API and the pages can
  never disagree. The public pages read the DB directly (server components) for
  SSR/SEO; the API exists for client use (the M5 compare picker, etc.).
- **Default "Recommended" sort** is implemented as a single aggregation
  (`$addFields` → `$sort`), with the exact formula commented in
  `processors-query.ts#ADD_FIELDS`: sponsored (by `sponsorRank` asc) → tier
  (premier>verified>free) → `rankScore = 0.60·(rating/5) + 0.25·min(1, log10(reviews+1)/log10(1001)) + 0.15·(editorScore/5)`.
  The other sort options (Highest rated / Most reviewed / Lowest fees / Newest)
  are pure field sorts and do **not** pin sponsored, since the user has actively
  chosen an order. Logged as a deliberate reading of PRD §9.2.
- **Rate/fee buckets** parse a number out of the free-text fee strings
  (`fees.onlineCardRate`, `fees.monthlyFee`) inside the aggregation
  (`$regexFind`) — best-effort; a row with no parseable rate is treated as
  "custom/varies" and sorts last under "Lowest fees".
- **Facet semantics:** capability facets (payment methods / integrations /
  features) are **AND** (`$all` — "must have all of these"); classification
  facets (pricing model / region / business size) are **OR** (`$in`). Not
  specified by the PRD; chosen as the most useful default for a comparison tool.
- **Resilient public reads.** `lib/public-data.ts` + `queryDirectory` catch a
  Mongo outage and return empty results so SSG/ISR pages render their empty
  state and `next build` doesn't fail without a live DB. `lib/db.ts` now sets
  `serverSelectionTimeoutMS: 5000` (was the 30s default) so the fallback is fast.

### Rendering / SEO
- **Profile** (`/processor/[slug]`) is true SSG/ISR (`revalidate: 1800`) +
  `generateStaticParams`. **Homepage** is SSG/ISR (`revalidate: 3600`).
- **Directory + category** read `searchParams` (filters live in the URL for
  shareable/indexable links), which makes the rendered page dynamic per request
  even though `revalidate` + `generateStaticParams` (category) are set — the
  static prerender covers the unfiltered canonical URL. Documented per hard rule.
- `lib/seo.ts` provides `buildMetadata` (entity `seo` block → Next metadata with
  canonical/OG/Twitter) + JSON-LD builders (Organization+WebSite/SearchAction on
  home, Product+aggregateRating on profile, BreadcrumbList + ItemList on
  directory/category), rendered by `components/public/JsonLd`. Profile JSON-LD is
  ready to receive the `Review[]` array once reviews ship in M4.

### Cross-milestone seams (built minimal now, completed later)
- **`GET /api/processors/[slug]`** (§3.2) is served by the existing
  `/api/processors/[id]` route, which already accepts an ObjectId **or** a slug
  and is published-only for anonymous callers (decided in M2). No new route.
- **Add to Compare** (§3.1) is wired: a localStorage-backed `CompareProvider`
  (`components/public/compare/`) + per-card checkbox + a global `CompareBar` that
  links to `/compare?ids=…`. The Compare **page**/tray is M5 (§5.1).
- **Get a Quote** (§3.5) renders the dialog shell now; its body points to the
  provider + contact. The real lead form + `POST /api/leads` is M5 (§5.3).
- **Search:** the hero/nav search and the homepage point at `/processors?q=`
  (the directory's `q` facet) for M3. The dedicated cross-collection `/search`
  page is M5 (§5.2).
- **Forward links** to not-yet-built pages (`/write-review/[slug]` M4,
  `/compare` M5, `/blog` `/methodology` `/about` `/contact` `/for-processors`
  `/privacy` `/terms` M5/M6) are intentional — consistent with the navbar/footer
  shells from M0–M2. They resolve as those milestones land.

### Additions beyond the literal PRD (per hard rule #1)
- **Directory query params beyond the §3.2 list:** `rate`, `fee`, `size`,
  `highRisk` — the §9.2 FilterRail explicitly calls for online-card-rate buckets,
  monthly-fee buckets, business size, and a high-risk toggle, so these facets
  needed their own params. Multi-value facets are comma-separated single params
  (`?methods=visa,ach`) for cleaner URLs.
- **`lib/analytics.ts`** — `trackEvent` no-ops gracefully until Vercel Analytics
  is wired in M6; "Visit Website" affiliate clicks + Get-a-Quote already fire it.
- **`lib/icon-maps.ts`** — token→lucide maps for method glyphs / feature lists.
  lucide has no brand icons, so these are semantic stand-ins (a card for Visa, a
  bag for Shopify, etc.).
- **Quick-filter tabs** (the "All / Best for X" row in §3.4) were folded into the
  FilterRail facets + removable active-filter chips rather than shipped as a
  separate, redundant tab row. `bestFor` is free-text on the model, so it isn't a
  fixed facet; it surfaces as card chips instead.

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass. The build prerenders
  the homepage + (empty) static params and renders the rest on demand; the
  `[public-data]`/`[processors-query]` connection errors in the build log are the
  **intended** resilient fallbacks firing because no MongoDB is running in this
  env. Run `npm run seed:admin` (+ a future `npm run seed`) and `npm run dev`
  against a real Mongo to populate and click through end-to-end.

---

## Stage 4 — Reviews End-to-End (M4)

### Architecture decisions
- **`lib/ratings.ts` is the only writer of the aggregate.** Every mutation that
  changes the *approved* review set re-runs `recomputeProcessorRatings`:
  `POST /api/reviews` (admin-entry → approved), `PATCH /api/reviews/[id]` (status
  change), and `DELETE` (when the deleted review was approved). A verified-only
  PATCH skips recompute — it can't change the average. Public submissions land as
  `pending`, so they never touch the aggregate until approved.
- **Profile reviews = SSR page 1 + client filter/sort/paginate.** The profile
  (SSG/ISR) server-renders the first page of approved reviews into
  `ReviewsSection` (good for SEO + no-JS) and hydrates it; subsequent filter/sort/
  page changes call `GET /api/reviews`. `getApprovedReviews` is the single query
  builder shared by the page and the route, so they can't disagree.
- **Reviewer email is server-only (PRD §8.3).** `toReviewCardData` (public) omits
  it entirely; only `toAdminReviewData` (admin queue) includes it. The public
  `GET /api/reviews` always forces `status: approved` regardless of the request.
- **Admin moderation reads the DB directly** (like the other admin lists) and
  passes fully-serialized rows to `ReviewsTable`, which does the Pending/Approved/
  Rejected/All tabs + search/sort/paginate client-side. Only the public profile
  uses `GET /api/reviews`; the admin actions use `PATCH`/`DELETE /api/reviews/[id]`.

### Additions beyond the literal PRD (per hard rule #1)
- **`lib/rate-limit.ts`** — fixed-window, in-memory IP limiter + honeypot helper
  for the public POSTs (PRD §11 explicitly asks for rate-limit + honeypot but
  names no library). CAVEAT: module-memory, so per-instance / best-effort on
  serverless; swap the `Map` for Redis/Upstash in production without touching
  callers. The honeypot field is `companyWebsite` (a hidden, off-screen input);
  tripped submissions return a fake `201` so bots aren't tipped off, and nothing
  is persisted.
- **`POST /api/reviews/[id]/helpful`** — backs the "Helpful (N)" button (PRD §9.3
  lists the button but no endpoint). Public + approved-only; one-vote-per-browser
  is enforced in `localStorage`, with a light IP rate-limit as a floor.
- **Admin "Add review" is approved on submit.** PRD §10.5 says the admin-entry
  form mirrors the public one "with a verified toggle"; since its purpose is
  seeding/import of known-good reviews, the route sets `status: approved` (and
  recomputes) rather than dropping admin entries into the moderation queue. The
  verified toggle defaults **on**.
- **`/write-review/[slug]` is `noindex, follow`** — it's a utility form, not
  ranking content, so it carries a canonical but is kept out of the index to avoid
  diluting the profile page.
- **Star inputs** use a new accessible `StarRatingInput` (radiogroup, arrow-key
  support) matching the read-only `RatingStars` amber visual.

### Cross-milestone seams
- The profile's reviews summary already used `RatingBreakdown` in M3; M4 moves it
  inside `ReviewsSection` alongside the live list, filters, and pagination. The
  `Get a Quote` lead form and the dedicated `/search` page remain M5 as before.

---

## Stage 5 — Compare, Search, Leads, Submissions (M5)

### Architecture decisions
- **Compare URL is the source of truth.** `/compare?ids=<slugs>` (server) resolves
  2–4 slugs to full detail via `getProcessorsBySlugs` (published-only, returned in
  the requested order) and renders the client `CompareView`. Add/remove just
  `router.push` a new `?ids=`; the server re-fetches, so there's no parallel
  column state to drift. `CompareView` mirrors the current columns into the shared
  `CompareProvider` (new `setAll`) so the floating `CompareBar` stays in sync.
- **The existing `CompareBar` IS the "CompareTray" (TODO §5.1).** The M3 global
  slide-in selection bar already holds the selected ids and links to `/compare`;
  M5 adds the page + matrix rather than a second tray. Logged per hard rule #1.
- **Compare matrices show the *union* of items present** across the compared
  columns (not every enum value), so payment-method / integration / feature rows
  stay relevant. ✓ = `violet-600 Check`, absent = `ink-300` dash, each with an
  `sr-only` "Yes/No" so the matrix isn't conveyed by color/icon alone (DESIGN §6.9
  / §11). First (label) column is `sticky left-0`; the table scrolls horizontally
  on mobile. "Editor's pick" column pill (DESIGN §6.9) is **not** shown — it would
  need `isFeatured` threaded into the detail projection; deferred as cosmetic.
- **Search = one helper, two surfaces.** `lib/search.ts#searchAll` runs a ranked
  `$text` pass then tops up with a `$regex` pass (merged, de-duped) per collection
  so partial queries ("strip" → "Stripe") still match — `$text` alone is
  whole-word. Backs BOTH the SSR `/search` page and `GET /api/search`, so they
  can't disagree. Scope is published/approved only; resilient (Mongo outage →
  empty groups). Blog results wire up now but stay empty until the M6 blog ships.
- **Convert-to-processor is server-side** (`POST /api/submissions/[id]/convert`):
  creates a Processor **draft** (`isPublished:false`) pre-filled from the
  submission (name → name, website, description → shortDescription, requestedTier
  → listingTier), unique-slugged, marks the submission `approved`, and returns the
  new id so the admin UI redirects to `/admin/processors/[id]` to finish. It does
  **not** block re-conversion of an already-approved submission — the admin decides.

### Additions beyond the literal PRD (per hard rule #1)
- **Global search now targets `/search`, not `/processors?q=`.** `SearchBox`
  defaults to the cross-collection `/search` page (PRD §9.5); pass
  `target="/processors"` for the directory `q` facet. The homepage "See all in
  directory" link on the Processors group keeps the `/processors?q=` path alive.
  The `WebSite` `SearchAction` JSON-LD target was updated to `/search` to match.
- **`/compare` and `/search` are `noindex, follow`.** Both are query-param-driven
  with combinatorial URLs; the canonical points at the bare path. Pretty compare
  routes (`/compare/stripe-vs-paypal`) are Phase 2 (PRD §9.4).
- **`lib/email.ts`** — optional Resend notifications. No-op (resolves cleanly,
  never throws) when `RESEND_API_KEY` is unset; leads/submissions persist first,
  then notify best-effort. Recipient = `LEADS_NOTIFY_EMAIL` → `SiteSettings.contactEmail`.
  Added `EMAIL_FROM` + `LEADS_NOTIFY_EMAIL` to `.env.example`.
- **`POST /api/leads` + `POST /api/submissions` reuse the M4 anti-spam primitives**
  (`lib/rate-limit.ts`): the `companyWebsite` honeypot (tripped → silent fake 201,
  nothing persisted) + a 5/min per-IP limiter; admins (logged-in) bypass the limit.
- **`LeadDialog` replaces the M3 `GetQuoteDialog` shell** (deleted). One component
  serves both "Get a quote" (processor-specific, passes `processorId`) and the
  homepage "Get matched" (generic, no processor) via the `processorName` presence.
  Profile + mobile action bar now pass `processorId` (needed for the Lead ref).
- **Leads CSV export** (PRD §10.6 `[Optional]`) — client-side blob download of the
  current tab's rows. **Submissions "Convert to processor"** is exposed both in the
  row menu and the detail dialog.
- **Analytics events** `lead_submit` + `submission_submit` added to the
  `lib/analytics.ts` union (no-op sink until M6, same as the others).

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass (19/19 static pages). New
  routes: `/compare`, `/search`, `/for-processors`, `/api/search`, `/api/leads(+/[id])`,
  `/api/submissions(+/[id], +/[id]/convert)`, `/admin/leads`, `/admin/submissions`.
  DB-backed click-through (submit lead/submission, moderate, convert, search) needs
  a running MongoDB — run `npm run seed:admin` + `npm run dev` against your Mongo.

---

## Stage 6 — Content, SEO & Polish (M6)

### Architecture decisions
- **Blog `GET /api/blog/[slug]` is served by `/api/blog/[id]`** — same id-or-slug
  pattern the processor route uses (Next can't host sibling `[id]` + `[slug]`
  segments). Admin + valid ObjectId → the post at any status (powers the edit
  form); otherwise published-only by slug (the PRD §12 public read). Mutations
  (PUT/PATCH/DELETE) still require an id.
- **One blog read path, resilient.** `lib/public-data.ts` gains
  `getPublishedBlogPosts` (paginated index), `getBlogPostBySlug` (post +
  published `relatedProcessors` cards + 3 recent siblings), `getRecentBlogPosts`
  (home teaser), and `getAllPublishedBlogSlugs` (`generateStaticParams`) — all
  Mongo-outage-safe (→ empty) like the M3 helpers. `/blog` + `/blog/[slug]` read
  the DB directly (SSR/ISR `revalidate: 1800`); the API exists for parity/clients.
- **`publishedAt` is stamped, never required from the client.** Publishing a post
  without an explicit date stamps `now` (in POST, PUT, and the PATCH quick
  toggle), preserving an existing date on re-save; moving back to draft leaves it.
- **Blog `relatedProcessors` populate uses `match: { isPublished: true }`** so a
  draft/parked processor linked on a post never leaks onto the public page.

### Additions beyond the literal PRD (per hard rule #1)
- **`PATCH /api/blog/[id]`** — the admin list's quick publish/draft toggle (the
  §12 table lists POST/PUT/DELETE only), mirroring the M2 categories PATCH.
- **`/write-review` (no-slug) index page.** The Navbar + homepage CTA always
  linked to `/write-review`, but only `/write-review/[slug]` existed — a broken
  primary CTA (404). Added a `noindex, follow` processor-picker page
  (`getPublishedProcessorOptions` + a small client filter) that routes to
  `/write-review/[slug]`. Logged as a real gap fixed during M6 polish.
- **Homepage "From the blog" teaser** (3 recent posts) + a `BlogCard` grid for
  internal linking (TODO §6.3). The Footer/Navbar already linked `/blog`.
- **`CategoryMultiSelect` generalized** with optional `placeholder`/`emptyText`
  props so it backs both a processor's categories (M2) and a post's related
  processors (M6) without a second component. Defaults preserve M2 behaviour.
- **`components/public/Prose.tsx`** — JSX sibling of `RichText` (same Mono Minimal
  descendant selectors) for hand-written static pages (no `dangerouslySetInnerHTML`).
- **`Reveal` / `RevealGroup` / `RevealItem`** (`components/public/Reveal.tsx`) —
  Framer Motion scroll reveal (opacity+8px translate, 300ms, `once`, 50ms
  stagger) per DESIGN §5.4, gated by `useReducedMotion` (renders plain divs with
  no transform when reduced). Applied to the homepage + blog-index card grids;
  card hover-lift stays CSS (`motion-reduce` already handled); accordion/tabs/
  sheet keep their Radix + `tailwindcss-animate` transitions.

### SEO (PRD §13)
- **`articleJsonLd`** (BlogPosting) added to `lib/seo.ts`; emitted on `/blog/[slug]`
  alongside BreadcrumbList. JSON-LD coverage is now complete: Home
  Organization+WebSite/SearchAction · directory/category BreadcrumbList+ItemList ·
  profile Product+aggregateRating+Review · blog index ItemList+Breadcrumb · post
  Article+Breadcrumb · methodology/about/contact/privacy/terms Breadcrumb.
- **`app/sitemap.ts`** lists the indexable static pages + every published
  processor/category/blog post (`getSitemapEntries`, resilient). `noindex`
  utility pages (`/compare`, `/search`, `/write-review*`) are intentionally
  omitted. **`app/robots.ts`** allows all, points at the sitemap, and disallows
  `/admin` + `/api/`.
- Every public page has `generateMetadata` (canonical via `buildMetadata`);
  static-page titles/descriptions are unique. `next/image` used for all blog
  imagery (cover `width/height` + `priority`; card `fill` + `sizes`).

### Analytics (TODO §6.4)
- **Vercel Analytics wired** — `@vercel/analytics@^1.3.1` added; `<Analytics />`
  mounted in `app/layout.tsx`. It defines `window.va`, which the existing
  `lib/analytics.ts#trackEvent` already targets — so the affiliate "Visit
  website", get-a-quote, lead/submission, and search events from M3–M5 now flow
  to a real sink. `trackEvent` still no-ops gracefully when the script is absent.

### Loading / empty states (DESIGN §6.14)
- `components/public/Skeletons.tsx` (`ProcessorCardSkeleton`, `BlogCardSkeleton`)
  + route `loading.tsx` for `/blog`, `/blog/[slug]`, `/processors`. Empty states
  for the blog index and write-review picker; 404 + error boundary already shipped.

### Seed data (PRD §17) — `scripts/seed.ts`
- **Idempotent, upsert-by-slug.** 10 processors (Stripe, PayPal, Square, Adyen,
  Braintree, Authorize.net, Helcim, Stax, Razorpay, PayU) fully populated; 2
  sponsored (Stripe rank 1, Razorpay rank 2), 2 premier + 5 verified-tier, 6
  `isVerified`, 3 featured (Stripe, Square, Helcim). 10 categories across all five
  §8.2 types. 4 approved reviews per processor (40 total, `source: "import"`,
  replaced wholesale each run) with ratings recomputed **only** via
  `lib/ratings.ts`. 3 published blog posts with related processors. Admin user
  (from `ADMIN_SEED_*`, defaults applied) + default SiteSettings (featured
  categories, socials, footer).
- **All factual figures are clearly marked illustrative sample data** in a header
  comment (PRD §17). Logos are fetched live from Clearbit for major brands; the
  card/profile degrade to a letter placeholder if a logo 404s.
- Uses `Date.now()` for relative `publishedAt` — fine in a `tsx` CLI script
  (the no-`Date.now()` rule is specific to Workflow scripts).

### Not machine-verifiable in this env
- **Lighthouse ≥ 90** (TODO §6.4) needs a running server + headless browser
  (neither present here). The prerequisites are in place — SSG/ISR, `next/image`
  with dimensions, minimal client JS (see the build's per-route First-Load JS),
  semantic HTML, and focus/ARIA from M3–M5 — so run Lighthouse against a deployed
  profile + directory page to confirm the score.

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass. New routes: `/blog`,
  `/blog/[slug]`, `/methodology`, `/about`, `/contact`, `/privacy`, `/terms`,
  `/write-review`, `/admin/blog(+/new, +/[id])`, `/api/blog(+/[id])`,
  `/sitemap.xml`, `/robots.txt`. The `[public-data]` ECONNREFUSED lines in the
  build log are the **intended** resilient fallbacks (no MongoDB in this env).
  Run `npm run seed` against a real Mongo, then `npm run dev`, to populate a
  demoable site and click through end-to-end.

---

## Stage 7.1 — Multi-role admin: Editor role + Users admin + Audit log (Phase 2 / M7)

### New data-model fields & collections (reflected in PRD §8)
- **`User.isActive: boolean` (default true)** — PRD §8.7. The Users admin
  "Deactivate" action flips this instead of deleting the account; `lib/auth.ts`
  refuses sign-in when `isActive === false`. `toAdminUserData` treats a missing
  value (pre-Phase-2 accounts) as active.
- **`AuditLog` collection** — new PRD §8.9 (Phase 2). `{ actor(ref User),
  actorName?, action, entity, entityId, entityLabel?, before?, after?,
  createdAt }`; indexes `{ createdAt: -1 }` and `{ entity: 1, entityId: 1 }`.
  Append-only; `updatedAt` is disabled. `before`/`after` are loose `Mixed`
  snapshots and are **secret-free** — the caller sanitizes (see `redactUser`,
  which drops `passwordHash`).

### Role enforcement (PRD §11 Phase 2 / §10.10)
- **`lib/api.ts#requireAdminRole()`** — stricter sibling of `requireAdmin()`:
  throws `ApiError(403)` for an authenticated `editor`. `handleApiError` already
  passes the 403 through, so no new branch was needed. `requireAdmin()` stays the
  editor-allowed guard on processors/categories/reviews/blog mutations.
- **Boundary enforcement is layered (defense-in-depth):**
  1. `middleware.ts` redirects an `editor` who reaches `/admin/users`,
     `/admin/settings`, or `/admin/audit` back to `/admin` (a logged-in editor
     gets the dashboard, not the login page). Driven by `req.nextauth.token.role`.
  2. The `users`/`audit`/`settings` server pages re-check `session.user.role`
     and `redirect("/admin")`.
  3. The APIs (`/api/users*`, settings `PUT`) call `requireAdminRole()` → 403.
  4. `AdminShell` hides the Users / Audit log / Settings nav items for editors
     (new `adminOnly` flag on `NAV`; the panel layout now passes `role`).

### Users admin (PRD §10.10) — `/admin/users` (admin-only)
- **`POST /api/users`** hashes a temp password (bcrypt, cost 12) → `passwordHash`
  and creates the account active. **`PATCH /api/users/[id]`** sets role,
  (de)activates, renames, or resets the password (`userUpdate` partial validator).
  **`DELETE`** removes it.
- **Last-admin guard (PRD §10.10):** an "effective admin" = `role:'admin'` **and**
  `isActive !== false`. PATCH (demote/deactivate) and DELETE refuse the operation
  with `ApiError(400)` when it would leave **zero** other effective admins — this
  also covers self-demotion / self-deletion of the only admin. Counted live with
  `countDocuments({ _id: { $ne }, role:'admin', isActive: { $ne:false } })`.
- **`toAdminUserData` / `redactUser`** (serialize) deliberately omit
  `passwordHash`. The table (`UsersTable`) does Create / Edit-role / Activate-
  Deactivate / Delete via plain controlled dialogs (not RHF — the forms are tiny),
  flags the current user as "(you)", and reuses `DataTable`.
- **`scripts/seed-admin.ts`** now takes a role via `--role=editor` CLI flag or
  `ADMIN_SEED_ROLE` env var (default `admin`), and stamps `isActive:true`, so an
  editor can be seeded alongside the admin.

### Audit log (PRD §11) — `/admin/audit` (read-only, admin-only)
- **`lib/audit.ts#logAudit()`** is **best-effort & fire-and-forget**
  (`void logAudit(...)` after a successful write): it connects defensively, never
  throws (catches + `console.error`), so an auditing hiccup can't break a
  mutation. Called from **every** admin mutation handler so the §7.1 Exit bar
  ("every admin mutation appears in the audit log") holds — processors
  (POST/PUT/PATCH/DELETE), categories (POST/PUT/PATCH/DELETE), reviews
  (admin-entry POST, moderate PATCH, DELETE), users (POST/PATCH/DELETE), settings
  (PUT), blog (POST/PUT/PATCH/DELETE), leads (PATCH/DELETE), submissions
  (PATCH/DELETE, and the convert POST → logged as a processor `create`). Captures
  `entityLabel` always and `before`/`after` only where already in hand (users;
  settings; review/lead/submission status) — "where cheap" per the task.
  - **Scope note:** §7.1c's task line names processors/categories/reviews/users/
    settings, but the Exit criteria says *every* admin mutation, so blog/leads/
    submissions are instrumented too (their `blog`/`lead`/`submission` values were
    already in the `AuditEntity` enum). Deliberately un-audited: the **public**
    writes (lead capture `POST /api/leads`, public review submit, "helpful" vote,
    processor submission `POST /api/submissions`) — not admin mutations — and the
    transient `POST /api/upload` blob helper, since the processor/blog save that
    references the returned URL is itself audited.
- **`/admin/audit`** server-renders the newest 500 entries (the `createdAt: -1`
  index), populating `actor` (name/email) with the denormalized `actorName` as a
  fallback for deleted actors; `AuditTable` is a read-only `DataTable`
  (search/sort/paginate, no row actions).

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass. New routes:
  `/admin/users`, `/admin/audit`, `/api/users`, `/api/users/[id]`. DB-backed
  click-through (seed an editor, sign in, confirm content edits work but
  Users/Settings 403 + nav hidden, watch entries accrue in the audit log) needs a
  running MongoDB — run `npm run seed:admin -- --role=editor` + `npm run dev`
  against your Mongo.

## Stage 7.2 — Leaders Matrix 2×2 quadrant (Phase 2 / M7 — PRD §5, §16)

### Decisions taken (resolves PRD §19 open question "Leaders Matrix default axes")
- **Default axes:** X = **adoption** (review volume, log-scaled), Y =
  **satisfaction** (average rating); **editor score** is the third toggle option.
  This makes the **top-right quadrant the "Leaders"** corner (well-reviewed *and*
  well-liked). Both axes are user-toggleable among the three metrics; picking the
  metric already on the other axis **swaps** them (X and Y must differ or every
  dot collapses onto the diagonal).
- **No new data fields.** The matrix is a pure projection of existing
  `Processor` fields (`ratingAverage` / `ratingCount` / `editorScore` /
  `listingTier`) — nothing added to PRD §8.

### Implementation details (not new data fields)
- **`lib/leaders.ts`** projects every published processor to three metrics
  **normalized 0..1**, reusing the *exact* per-term normalization of the
  "Recommended" `_rankScore` blend (`processors-query.ts#ADD_FIELDS`): `rating =
  ratingAverage/5`, `reviews = min(1, log10(ratingCount+1)/log10(1001))`, `editor
  = editorScore/5`. To guarantee one scale with no drift, `REVIEW_LOG_CAP =
  log10(1001)` is now **exported** from `processors-query.ts` and imported here.
  Returning all three normalized metrics (plus raw values for the tooltip) lets
  the client re-axis without refetching. `LEADER_AXES` + `DEFAULT_X/Y_AXIS` live
  in this file (single source for the labels/hints). Resilient → `[]`.
- **`components/public/LeadersMatrix.tsx`** is a client component: inline **SVG**
  scatter (no chart dependency), quadrant dividers at the 50% mark with
  corner labels ("Leaders" top-right, "Emerging" bottom-left, "Strong {axis}" on
  the off-diagonals), axis titles, and a tier-colored dot per processor
  (premier=accent, verified=success, free=ink-400) with a matching legend. Each
  dot is a **focusable SVG `<a>`** linking to the profile (keyboard tab-through;
  `[&:focus-visible_circle]:stroke-ring`); the tooltip is an HTML overlay
  positioned by the active dot's fractional coords. Hover grows the dot radius via
  a `transition-[r]` that's dropped under `motion-reduce:`. An `sr-only` mirror
  list of links covers AT/crawlers.
- **`app/(public)/leaders/page.tsx`** — ISR (`revalidate=1800`), breadcrumb +
  intro copy, `generateMetadata` (reuses `settings.defaultSeo`), and
  Breadcrumb + ItemList JSON-LD. Wired into the **Navbar** (link after Compare)
  and **`app/sitemap.ts`** (static `/leaders` entry, priority 0.7).

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass; `/leaders` prerenders
  as static content. Plotting needs a running MongoDB — `npm run seed:admin` (+
  `npm run seed`) and `npm run dev` against your Mongo to see real dots.

## Stage 7.3 — Pretty compare URLs (Phase 2 / M7 — PRD §9.4, §13)

### Decisions taken (resolves PRD §19 "which compare pairs are popular")
- **Curated pair list, not arbitrary combos.** `lib/compare-pairs.ts` holds a
  fixed 8-pair seed list (`POPULAR_COMPARE_PAIRS`) of high-intent head-to-heads —
  the household-name gateways merchants actually cross-shop (Stripe/PayPal/Square/
  Adyen/Braintree/Authorize.net, plus same-segment Square-vs-Stax and
  Razorpay-vs-PayU). The **selection rule is documented in a code comment** (per
  the §9.2 formula-comment convention) so the list isn't arbitrary. Left/right
  order is **fixed** in the list so each head-to-head has exactly ONE canonical
  URL (no `stripe-vs-paypal` *and* `paypal-vs-stripe`).
- **No new data fields.** Pretty compare is a pure routing/SEO layer over the
  existing compare data path — nothing added to PRD §8.

### Implementation details (not new data fields)
- **`app/(public)/compare/[pair]/page.tsx`** — splits the `[pair]` param on the
  literal `-vs-` delimiter (safe for hyphenated slugs like `authorize-net`, since
  `-vs-` never occurs inside a slug), resolves via the existing order-preserving
  `getProcessorsBySlugs`, caps at `COMPARE_MAX`, and reuses `CompareView`. ISR
  (`revalidate=1800`). **`dynamicParams = false`** + `generateStaticParams` over
  the curated list means only curated pairs exist — every other `[pair]` 404s,
  and a curated pair whose processor went unpublished/missing (`<2` resolved)
  calls `notFound()` (no half-matrix). These pages are **indexable** —
  `buildMetadata` emits `index:true` by default (the `?ids=` page is the one that
  opts out), with a per-pair title/description built from the resolved names, a
  BreadcrumbList, and `comparePairJsonLd` (named `ItemList` of the compared
  profiles, new in `lib/seo.ts`).
- **Canonicalization (`prettyComparePath`).** The query-param `/compare?ids=`
  page stays `noindex` + a working fallback/builder, but when its selected slugs
  match a curated pair (matched **order-independently** via a sorted-slug key) it
  overrides its canonical to the pretty `/compare/<a>-vs-<b>` URL so link equity
  lands on the indexable page. Editing columns on a pretty page (`CompareView`
  add/remove) still drops back to the `?ids=` builder by design.
- **Sitemap.** `getSitemapEntries` (`lib/public-data.ts`) now emits the curated
  pretty-compare URLs, reusing the already-fetched published-processor set: a
  pair is emitted only when **both** its processors are published (mirrors the
  page's `dynamicParams=false`), dated to the newer of the two `updatedAt`s — so
  the sitemap can never list a pretty URL that would 404. `app/sitemap.ts` is
  unchanged (the new `/compare/...` entries fall through its generic
  weekly / priority-0.6 branch).

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass. `/compare/[pair]`
  builds as `●` (SSG) and prerenders the curated pairs; `/compare` stays `ƒ`
  (dynamic). DB-backed click-through (open `/compare/stripe-vs-paypal`, confirm
  the matrix + `index` robots, confirm `?ids=stripe,paypal` canonicalizes to it,
  and the pair appears in `/sitemap.xml`) needs a running MongoDB — `npm run seed`
  + `npm run dev` against your Mongo. (In this env the curated pages prerender to
  a 404 because no DB is reachable at build; ISR regenerates them once a DB is up.)

## Stage 7.4 — Top mentions: review keyword extraction (Phase 2 / M7 — PRD §9.3, DESIGN §6.4)

### New data-model field (reflected in PRD §8.1)
- **`Processor.topMentions: { keyword: string; count: number }[]` (default `[]`)** —
  PRD §8.1. Denormalized neutral keyword chips, **recomputed only by
  `lib/ratings.ts`** from approved review text — never hand-edited (same
  treatment as `ratingAverage`/`subRatings`). `processorInput`/`processorUpdate`
  already strip unknown keys, so the admin form's PUT/PATCH never touch it (no
  validator change). The admin form shows no input for it.

### Extraction approach (resolves PRD §19 "top-mentions approach": curated dictionary, not external NLP)
- **`lib/top-mentions.ts` — a curated payment-domain dictionary (allowlist), no
  NLP dependency.** `KEYWORDS` maps ~22 neutral topic labels (Ease of use,
  Customer support, Pricing, Transaction fees, Payouts, Integrations, API &
  developer tools, Chargebacks, Account holds, …) to lowercase aliases. Because
  it's an allowlist of *neutral topics*, the chips can never surface an opinion
  or random noise the way a raw term-frequency extractor would — the chips stay
  "neutral" per DESIGN §6.4.
  - **Matching:** each review's `title`+`body`+`pros`+`cons` is normalised
    (lowercase, punctuation → spaces, collapsed, space-padded). Multi-word
    aliases match against that string; single-word aliases match against its
    **stop-word-filtered** (`STOP_WORDS`) token set, so common function words
    can't create spurious single-token hits. Phrase aliases keep their stop words
    on purpose (e.g. "easy **to** use"). A keyword is counted **once per review**,
    so `count` = "how many approved reviews mention this topic".
  - **Output:** sorted by count desc (then label asc for stable order), filtered
    to `count ≥ MIN_MENTIONS` (1), capped at `TOP_MENTIONS_LIMIT` (8).
  - `computeTopMentions(reviews[])` is pure/synchronous (testable);
    `computeTopMentionsForProcessor(id)` loads the approved set and is called by
    `recomputeProcessorRatings` — so chips fire on the **same** approve / reject /
    delete / admin-add / seed triggers as the rating aggregate and clear to `[]`
    when the last approved review leaves (guaranteed in lockstep, single source).

### UI + optional chip filter (DESIGN §6.4)
- **`ReviewsSection`** renders a "Top mentions" row of neutral pill chips (label +
  count) inside the rating-summary card, below `RatingBreakdown`. Chips are
  **interactive** (the §7.4 optional): clicking one sets a `mention` filter that
  re-queries `GET /api/reviews?mention=<label>` from page 1 (with a "Clear"
  affordance + `aria-pressed`).
- **`buildMentionFilter(label)`** (same `lib/top-mentions.ts` dictionary) turns a
  chip label into a Mongo `$or` regex over `title/body/pros/cons`; threaded
  through `getApprovedReviews` (`mention?` param) and the public GET route. Using
  the one dictionary for both extraction and filtering keeps the chip's count and
  the filtered list in sync. Unknown labels are ignored (filter = null).

### Verification
- `tsc --noEmit`, `next lint`, and `next build` all pass. Chips populate +
  recompute only against a running MongoDB — `npm run seed` (re-seeds reviews and
  recomputes, now including `topMentions`) + `npm run dev`, then approve/reject a
  review in `/admin/reviews` and watch the profile chips change.
