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
- **Product name:** `Payment Processor Guide` (placeholder kept).
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
- **`lib/email.ts`** — optional notifications, sent over SMTP from our own mailbox
  via nodemailer (Resend was dropped; no third-party sending service). No-op
  (resolves cleanly, never throws) when `SMTP_USER`/`SMTP_PASS` are unset;
  leads/submissions persist first, then notify best-effort. Defaults to Gmail
  (`smtp.gmail.com:465`, implicit TLS) with a Google **App Password** — the normal
  account password is rejected. `EMAIL_FROM` must match `SMTP_USER` or a verified
  "send mail as" alias, otherwise Gmail silently rewrites the From header.
  Recipients = `notifyRecipients()`: `LEADS_NOTIFY_EMAIL` (comma-separated, so both
  owners get copied) → `SiteSettings.contactEmail`; the DB fallback is only read
  when the env var is empty. The transporter is module-level so a warm lambda
  reuses the connection. Notifications are admin-only — the person who submitted
  never receives anything.
- **Notifications are `await`ed, never `void`ed.** The original fire-and-forget
  `void notifyNewLead(...)` worked in dev and silently dropped every mail on
  Vercel: a serverless function is frozen the instant the response is returned,
  killing the SMTP handshake mid-flight. Both POSTs now await the notify helper
  (which swallows its own errors, so it still can't fail a submission) and carry
  `maxDuration = 30` for the extra round-trip. SMTP timeouts are bounded in
  `lib/email.ts` so blocked egress fails fast rather than burning the budget.
- **Every public capture notifies the owners.** `POST /api/leads` is the single
  `Lead.create` in the codebase — contact form, profile "get a quote" and "get
  matched" all post there — so one notify call covers all of /admin/leads; the
  body adapts to whichever optional fields that source captured. `POST
  /api/submissions` covers "get listed", and a public `POST /api/reviews` now
  pings the moderation queue (an admin's own `admin-entry` review does not).
- **`GET /api/admin/email-test`** (admin session required) reports which SMTP env
  vars landed and runs `transporter.verify()` without sending; `POST` sends a real
  test. Because delivery failures are swallowed by design, this is the only way to
  tell a misconfigured deploy from a working one.
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

## Post-launch — Image host swap: Vercel Blob → Cloudinary

### Decision (supersedes the Stage 0 / Stage 2 "Image host: Vercel Blob" note)
- **Cloudinary is now the configured image host**, per operator request. The swap
  is fully contained to `lib/upload.ts` (the whole point of the §6/§10.3 provider
  abstraction) — the `/api/upload` route, `api-client.ts#uploadImageFile`, and the
  admin image fields are unchanged; they still POST multipart and read `{ url }`.
- **No SDK dependency.** Uploads use Cloudinary's **signed REST endpoint**
  (`POST /v1_1/<cloud>/image/upload`) built from `FormData` + `fetch`, with the
  SHA-1 signature computed via Web Crypto (`crypto.subtle`) — no `cloudinary` npm
  package, so nothing new to bundle on Vercel. `@vercel/blob` was removed from
  `package.json` (and the lockfile) since no code imports it anymore.
- **Config:** `CLOUDINARY_URL` (`cloudinary://<key>:<secret>@<cloud>`), or the
  three discrete `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET` vars. `public_id`
  is `<slug>-<uuid8>` (no extension — Cloudinary infers the format); `folder`
  ("logos"/"screenshots"/"blog"/…) is a separate signed param. Returns
  `{ url: secure_url, pathname: public_id }`.
- **Unchanged behaviour:** the DEV-only local-disk fallback (`public/uploads/`) and
  the production 503 (now naming `CLOUDINARY_URL`) still stand, and every image
  field still accepts a pasted URL — so content entry never hard-depends on uploads.
- **Operator action:** set `CLOUDINARY_URL` in Vercel → Project → Environment
  Variables (Production + Preview), then **redeploy** (env vars only bake into
  deployments created afterwards). The old `BLOB_*` vars can be deleted. A Cloudinary
  account setting may need "Allow delivery of SVG" enabled if SVG logos are used.

### Verification
- `tsc --noEmit` passes. End-to-end upload needs live Cloudinary creds — set
  `CLOUDINARY_URL` in `.env.local` + `npm run dev`, then upload a blog cover / inline
  editor image and confirm it returns a `res.cloudinary.com` URL.

---

## Post-launch — Editable landing page (`/admin/homepage`)

### The problem
Only three homepage values were editable (`homepageHeroTitle`,
`homepageHeroSubtitle`, `featuredCategorySlugs`, all on Settings). Every section
heading, eyebrow, step, CTA card, item count, and the section order itself was
hardcoded in `app/(public)/page.tsx`, and the "home" PageSeo record's `blocks[]`
were editable in admin but **rendered nowhere**.

### New data (reflected in PRD §8.8)
- `SiteSettings.homepage` — a sub-document holding the whole landing-page config:
  `hero` (eyebrow, search on/off + placeholder, both CTA buttons, stat row +
  per-stat labels), one entry per section (`categories`, `featured`, `howItWorks`
  incl. `steps[]`, `compare`, `blog`, `ctaBand` incl. `cards[]`, `content`, `faq`)
  with `enabled` / `eyebrow` / `title` / `actionLabel` / `actionHref` / `limit`,
  and `sectionOrder[]`.
- **Every field is optional and no `enabled` has a schema default.** `undefined`
  must stay distinguishable from `false` so "never configured" can mean "use the
  built-in default" — a `default: true` would rewrite history the first time any
  unrelated settings field is saved, and blank-means-inherit would break.
- The hero **headline/sub-headline stay on the existing top-level fields**. One
  source of truth beats a nested duplicate; the new editor writes those same two.

### `lib/homepage.ts` is the only place the default copy lives
`HOMEPAGE_DEFAULTS` + `resolveHomepage(settings)` merge config over defaults.
`app/(public)/page.tsx` renders the resolved object and holds **no fallback
strings of its own**, and the admin form seeds its placeholders from the same
constant. A default written anywhere else will drift.

### Decisions taken
- **Its own route, not `PUT /api/settings`.** That handler full-replaces the
  singleton and `$unset`s omitted keys, so a landing-page save posted there would
  wipe siteName / contactEmail / socialLinks / defaultSeo. `/api/settings/homepage`
  touches only the four landing-page keys. Admin-only, like `/api/settings`; also
  added to `middleware.ts#ADMIN_ONLY`.
- **One form, two endpoints.** The editor also owns the page's meta, so it saves
  the SEO/FAQ/blocks half to `/api/page-seo/[id]` (the same "home" record
  `/admin/page-seo` edits — not a copy). Both payloads are validated before either
  request fires, so a failure in one leaves both untouched. The form's
  `seo`/`faqs`/`blocks`/`structuredData` keys mirror `PageSeoFormValues` exactly so
  `SeoPanel` / `FaqField` / `BlockEditor` / `StructuredDataPanel` mount unchanged.
- **The admin page upserts the "home" PageSeo record** (`$setOnInsert`) so the SEO
  tab works on an install where `npm run seed:seo` never ran, without touching an
  existing one.
- **Inputs are seeded from the STORED value with the default as placeholder.**
  Pre-filling with defaults would bake today's copy into the document on first
  save and make "clear to restore the default" unreachable.
- **Content blocks now render.** The homepage gained an editorial slot for the
  "home" PageSeo `blocks[]`, positioned like any other section. (`/processors` and
  `/compare` still don't render theirs — same latent gap, out of scope here.)
- **FAQPage schema is tied to the FAQ section being visible**, not to FAQs merely
  existing. Google only accepts FAQ markup for Q&As the visitor can see.
- **`limit` is clamped and guarded with `> 0`.** Mongo reads `.limit(0)` as *no
  limit*, so passing a zero/disabled count straight through would have fetched an
  entire collection for a section that renders nothing.
- Settings keeps its hero values in the payload (hidden) and links to the new page
  — `siteSettingsInput` requires them, so dropping them would `$unset` the hero on
  every settings save.
- Alternating section tints are computed over the sections that **actually
  render**, not over the config, so reordering or emptying one can't leave two
  tinted bands touching.

### Verification
- `tsc --noEmit`, `next lint`, and `npm test` (now `tests/index.test.ts`, which
  aggregates analyticshub + the new `tests/homepage/homepage.test.ts`) all pass.
- Manual: signed into `/admin/homepage`, edited a section heading + item count,
  saved (both PUTs 200), confirmed the change on `/`, then cleared both fields and
  confirmed the built-in default came back.

---

## Post-launch — Navbar search yields to in-page search

### The problem
The homepage hero and `/search` both put a large search box in `main`, while the
navbar carried its own inline copy 200px above it. Two search inputs on screen at
once, both doing exactly the same thing.

### Decisions taken
- **Detected, not routed.** `components/public/PageSearchContext.tsx` holds the
  state; a page-level `SearchBox` registers itself and reports viewport visibility
  via `IntersectionObserver`, and the navbar hides its own box while any are on
  screen. No route allowlist to keep in sync — a new page that renders a
  `SearchBox` in `main` gets the behaviour for free.
- **It comes back on scroll.** Once the page's box scrolls under the sticky header
  (`rootMargin: -64px` = navbar height) the navbar's returns, so search is never
  more than a glance away. That's the "dynamic" half; a plain per-route hide would
  have left long pages with no search at all below the fold.
- **`chrome` prop marks the navbar/mobile-menu boxes** so they stay out of the
  registry and can't suppress themselves.
- **The nav box unmounts rather than hiding** (keeps it out of the tab order) but
  its `w-64` slot always reserves the space, so the "Write a review" CTA never
  shifts as it comes and goes.
- **Pre-hydration is handled in CSS, not JS.** The server can't know whether a page
  renders its own search, so SSR would paint the duplicate and drop it a frame
  later. A `html:not(.page-search-live) body:has(main [data-page-search])` rule in
  `globals.css` hides it in the SSR markup; `PageSearchProvider` adds
  `page-search-live` in a layout effect (before the first post-hydration paint) to
  hand the decision to React, and each box takes one synchronous
  `getBoundingClientRect` measurement in the same pass because the observer's first
  callback is async.
- Unmount reports `false`, so a client-side route change away from the homepage
  can't leave the navbar search permanently hidden.

### Verification
- `tsc --noEmit` and `next lint` pass.
- Manual (1440×900): `/` and `/search?q=stripe` load with no navbar search and the
  CTA in place; scrolling past the hero fades it in; `/processors` shows it from
  the top; client-side nav both directions flips it correctly; no hydration
  warnings in the console.

## Post-launch — Semrush site audit remediation (2026-08-02)

Source: `site_audit/www.paymentprocessingguide.com_*_20260801.xlsx`. Semrush crawled
78 of the site's 278 URLs, so several of its findings turned out to be the visible
edge of a defect that was present on pages it never reached. Where that happened,
the fix is applied site-wide rather than to the flagged pages only.

### Root causes behind multiple reported issues

- **Logos stored as inline `data:` URIs.** All 45 processor logos (203 KB of
  base64) plus one blog cover. This alone produced three separate audit failures:
  an invalid `Product.image` (`absoluteUrl()` resolved the data URI against the
  site origin, producing `https://…/data:image/jpeg;base64,…`), an equally invalid
  `og:image`/`twitter:image`, and ~200 KB of HTML on every listing page feeding
  "low text to HTML ratio" on 76 of 78 pages. Migrated to Cloudinary via
  `scripts/migrate-logos-to-cdn.ts`. `/processor/stripe` went 446 KB → 315 KB.
  Guards added so it cannot regress: `absoluteUrl()` now passes ANY URI scheme
  through instead of mangling it, the new `httpImageUrl()` drops non-http images
  before they reach schema or OG tags, `scripts/add-processors.ts` rejects a
  `data:` logo, and the seed literals hold CDN URLs.

- **`Product.offers` with no price.** The real cause of "structured data that
  contains markup errors" (2 per profile, 10 profiles). `price` is Offer's one
  required property, and emitting `offers` at all promotes the node from a product
  snippet to a merchant listing, whose stricter rules the node cannot satisfy.
  Confirmed by the control case: `/processor/<slug>/reviews` carries the same
  Product node with the same broken image and is NOT flagged. Its only structural
  difference is the absence of `offers`. The pricing text now ships as an
  `additionalProperty` (same string, no Offer contract), and `offers` was removed
  from the rule's `overridable` list so it cannot be reinstated from the admin.

- **A DB blip during ISR regeneration was being cached as a 404.** Not in the
  Semrush report; found by crawling all 278 sitemap URLs. 34 of them served
  `HTTP 404` with `X-Vercel-Cache: HIT` while every corresponding document was
  present and `isPublished: true`. Every single-entity lookup caught its own
  connection error and returned `null`, which the route read as "does not exist"
  and Next cached for the full 30-minute revalidate window. Detail lookups now
  re-throw (`rethrowLookupFailure` in `lib/public-data.ts`, plus `getLandingPage`),
  so a failure is an uncached 500 rather than a cached 404. Listing helpers still
  fail open, which is correct for them.

### Content and metadata

- **Titles and descriptions.** Semrush flagged 5 over-long titles; auditing all 240
  built pages found 73 over 66 characters and 39 descriptions over 160. Now 0 and 0,
  with no duplicates. Most were template problems, not data problems: the compare
  pair title appended " | side-by-side comparison" before the brand suffix, the
  glossary title used two pipes, and ~34 stored processor `metaTitle`s had
  " | Payment Processing Guide" baked in (also the wrong brand: the site name is
  "Payment Processor Guide"; the other string is the domain). Scripts:
  `fix-meta-lengths.ts`, `fix-processor-title-suffix.ts`, `apply-meta-rewrites.ts`.

- **Glossary depth.** All 50 term pages were ~80 words. Each now carries `detail`
  ("How it works"), `example` (a worked example with real numbers), and `faqs`
  (also emitted as FAQPage JSON-LD), taking them to ~580 words. New optional fields
  on `GlossaryTerm`; the FAQ node is emitted only when the section actually renders.

- **`/contact`** gained a "what we can help with / what we cannot" section: it was
  ~90 words, and a comparison site's contact page is where a reader judges whether
  it is accountable.

### Identity and linking

- **`SiteSettings` held placeholder production data**: `socialLinks` pointed at two
  404 URLs (rendered in the footer of all 240 pages AND fed into
  `Organization.sameAs`), `contactEmail` was `hello@paymentprocessorguide.test` on a
  reserved TLD that can never resolve, while being shown as a live `mailto:` and
  used as the lead-notification fallback, and `footerText` called the site a
  "Sample directory". Fixed by `scripts/fix-site-identity.ts` and in the seed. The
  social links were REMOVED rather than guessed: an unverified `sameAs` is worth
  less than no `sameAs`.

- **Internal links.** Footer categories were `slice(0, 5)` against 11 published
  categories, so `/category/restaurants` had zero inbound links anywhere and one
  admin-created category had silently evicted a commercial one from every page; now
  `slice(0, 12)` plus a glossary column. This matters more than it looks: the header
  MegaMenu and mobile Sheet render inside Radix portals, so they contribute ZERO
  crawlable links and the footer is the only site-wide link source. Processor cards
  now link `/processor/<slug>/reviews` (those pages went from 1 inbound link to
  12-65), profiles render linked category chips, and 23 glossary `related` arrays
  gained entries so no term sits below 3 inbound contextual links (`bnpl` and
  `surcharge` had zero, and Semrush caught neither).

- `getPublishedCategories` now excludes `seo.redirectTo` records, which had put a
  308 hop in the site-wide footer.

### Deliberately NOT done

- **"Low text to HTML ratio" is not fully fixable and was not chased.** Measured
  after the logo migration, every page still lands at 2-9% against Semrush's 10%
  threshold, because the RSC flight payload is a second serialization of the
  rendered tree and is 50-55% of every response. No config flag removes it, and
  rewriting off the App Router to satisfy a notice would be a bad trade. The
  correlation across measured pages is with text VOLUME, not with bloat, which is
  why the glossary and contact expansions were the right lever.
- **Vendor sites returning 403 to crawlers** (helcim.com, staxpayments.com,
  easypaydirect.com, dharmamerchantservices.com, durangomerchantservices.com) are
  live sites behind bot protection, not broken links. They already carry
  `rel="sponsored noopener"`. No change.
- **`/write-review/*` and `/compare?ids=` "blocked from crawling"** are the intended
  `noindex` behaviour, not a defect.

---

## Spam protection on the public forms

Every public POST — `/api/leads` (contact, get-a-quote, get-matched, home hero),
`/api/submissions` (get listed), `/api/reviews` (write a review) — now runs
through one shared guard before anything is persisted.

### What replaced what

The old arrangement was a `companyWebsite` honeypot plus a 5/min per-IP limiter,
and the honeypot was **a hard reject with nothing behind it**: a tripped form got
a fake `201` and the submission was discarded, unrecoverably. A password manager
filling that field silently destroyed a real enquiry and nobody could ever find
out. That is the specific hole this work closes.

### Three verdicts

| Verdict | Stored? | Emailed? | Where it shows |
|---|---|---|---|
| `allow` | yes | yes | the normal inbox |
| `quarantine` | yes, flagged | **no** | `/admin/spam` → Spam |
| `reject` | in the bin only | no | `/admin/spam` → Blocked |

A rejection **always** lands in `BlockedSubmission` (30-day TTL) and can be
restored into its real collection through the normal validator. If that bin write
fails, the verdict is **downgraded to quarantine** rather than dropped — hard
rejection is conditional on the bin existing, because a filter with no bin is one
bad rule away from destroying a customer.

Rejected callers get the SAME success status a real submission gets, so the bot
sees success and neither retries nor adapts.

### Where the code lives

- `lib/spam/classify.ts` — the rules. Pure, no I/O, form-aware.
- `lib/spam/fields.ts` — which field of which form means what. Shared by the live
  guard and the backfill so the two cannot disagree about the same row.
- `lib/spam/fingerprint.ts` — 24h duplicate hash over the human-written fields,
  **excluding the email** (floods replay one payload across harvested addresses).
- `lib/spam/guard.ts` — the I/O half: rate limits, dedup, Turnstile, the bin.
- `lib/spam/turnstile.ts` — env-var-only captcha, the one check that does not
  fail open.
- `components/public/useSpamGuard.tsx` — render stamp + widget, used by all four
  forms.

### Rules deliberately NOT written

Each of these looks reasonable and eats real leads:

1. **No rule scores a bare dollar figure.** Real enquiries say "our budget is $8k
   a month" constantly. Only retail boilerplate counts, and one phrase alone
   scores below the quarantine line.
2. **No rule scores a link to the sender's own site.** Any host echoing their
   email domain, their company name, or a URL the form asked for is discounted to
   zero. A single genuinely foreign link scores 2, below the quarantine line of 3.
3. **No vowel-ratio gibberish test.** It calls "partnership" and "projects"
   keyboard mash. Runs of 6+ consecutive consonants are used instead — English
   tops out at 5 ("strengths").

Two local deviations from the playbook, both because of who this site sells to:

- **Off-platform handles (WhatsApp/Telegram) are weighted 2, not 3.** Cross-border
  merchants in India, Nigeria and the Gulf genuinely do say "reach me on
  WhatsApp". It tips other signals over without quarantining on its own.
- **`agency-pitch` patterns are suppressed on `/for-processors`.** Vendors
  pitching us is the entire purpose of that page. Link-building and guest-post
  pitches are still scored there, because those are not a processor listing under
  any reading.

### Rate limiting

`rateLimit` is unchanged (5/min per IP) and joined by a per-**neighbourhood**
limit — /24 for IPv4, /48 for IPv6 — at 40/hour. A per-address cap is free to
evade with a rented subnet; capping the neighbourhood is what makes rotation cost
money. Both still share the in-memory `Map` caveat above: per-instance,
best-effort, and a shared store is the production upgrade.

### Turnstile

Inert until `TURNSTILE_SECRET_KEY` exists. The site key is served from
`/api/spam/config` rather than page markup, so switching it on needs no code edit
and no regeneration of any DB-rendered page. Appearance is `interaction-only`.

**This site sends no Content-Security-Policy at all** (`next.config.mjs` sets only
`X-Robots-Tag`; middleware sets none), so there is nothing to add
`https://challenges.cloudflare.com` to. If a CSP is ever introduced, it must
allow that host in `script-src`, `connect-src` and `frame-src`, or the widget is
silently blocked and every submission fails verification with no visible cause.

### One footgun worth knowing about

`OWN_HOSTS` in `lib/spam/classify.ts` drives both the internal-sender whitelist
and the "our own domain was mail-merged into the body" signal. The live domain is
**paymentprocessingguide.com** (processING, not processOR) — the two read almost
identically and the first draft of this work had the wrong one, which silently
disables both rules. The guard widens the list at runtime with whatever
`NEXT_PUBLIC_SITE_URL` points at, so a preview deployment still recognises
itself.

### Backfill

`npm run spam:backfill` — dry run by default, `--apply` to write, `--verbose` to
print message text. It never deletes, never hard-rejects (a stored row can only
be capped to `quarantine`), and skips any row a human has already cleared. The
browser-proof rules are switched off for that pass, since those rows predate the
render stamp.

### Tests

`tests/spam/classify.test.ts`, wired into the aggregator. Two blocks, and the
GENUINE block matters more: **a future rule that breaks a case in it is wrong,
however much junk it catches.**

The SPAM block is built from catalogued shapes, not from this site's own history:
when the filter was written the database held 14 leads (10 seed fixtures, 4
internal tests), 6 submissions (all seed fixtures) and 40 reviews (all
`source: "import"`). There had been no real public spam to learn from. As real
spam arrives, paste it in verbatim.

## Fee-sheet slide-in (content offer + `OfferSignup`)

A scroll-triggered, non-modal slide-in on comparison pages and blog posts,
offering the processor fee comparison sheet for an email plus an optional volume
bucket. Bottom-right card on desktop, bottom sheet on mobile, once per 21 days.

### Why it is not a `Lead`

The obvious move was `source: "fee-sheet"` on the existing Lead pipeline, which
already has the guard, the notification, the inbox and the CSV. It was rejected:

- `Lead.name` is **required**, and this form has no name field. Reusing it means
  fabricating a name for every row.
- The Leads inbox is a sales queue — sorted and searched by name, per-processor,
  `new → contacted → closed`, and its CSV is a hand-off to a person who will call
  someone. A mailing list arriving at ten times the volume buries the quote
  requests inside a week.
- The offer needs a **three-bucket** volume answer, not `MONTHLY_VOLUMES`' five.
  Every extra option on a three-second ask costs conversions, and widening the
  shared enum would put an overlapping `$50k+` bucket on the review form and the
  quote dialog, where it does not belong.

So: `models/OfferSignup.ts`, its own admin page, and a unique `(offer, email)`
index. `offer` is a key rather than prose so a second magnet later shares the
collection and gains a filter tab instead of a migration.

### Repeat signups upsert, they do not duplicate

Same address twice means "send it again", not a second subscriber. The route
upserts on `(offer, email)` and `$inc`s `submissions`. `status` is deliberately
**not** reset on a repeat: an operator who already marked the row contacted
should not have it jump back into New because the visitor lost the email.

### Spam: a form with nothing to read

`offer` is a fourth `SpamFormKind`, with `text: []` — the form has no free-text
field at all, so every content rule in the classifier scores zero. What still
protects it is everything that does not need prose: the honeypot, the render
stamp, both rate limits, Turnstile, and the impossible-value check on the one
enum. `fingerprintFields` is empty for the same reason and that is correct, not a
gap: the duplicate hash excludes the email by design, so there would be nothing
left to hash. Duplicate **addresses** are handled by the unique index instead.

This is why the widget **mounts at page load and only becomes visible at 60%**.
`useSpamGuard` stamps on mount, and a submission under three seconds after the
stamp scores 4 — straight to quarantine, never emailed. The form is one field.
Lazy-mounting it at the trigger, the obvious optimisation, would put every fast
typist in the spam bin.

### No operator notification, on purpose

Unlike `/api/leads` and `/api/submissions`, a signup here emails **nobody on the
team**. A download is not an enquiry: nobody has to answer it, and at lead-magnet
volume a mail per signup trains people to filter the very address that also
carries real quote requests. The list is read in `/admin/offer-signups`.

### Delivery, and the promise the widget makes

`SiteSettings.feeSheetUrl` holds the link. With it set, the sheet is emailed to
the visitor automatically on a clean verdict and the row records whether that
send actually succeeded. With it blank, capture still works, the confirmation
says a human will send it, and `/admin/offer-signups` carries a banner saying so
— an offer that takes an address and delivers nothing is worse than no offer.
Quarantined signups are never auto-mailed.

### Frequency, and the two-step trigger

Cooldown is spent on **impression**, not dismissal: "once per 21 days" has to
mean once seen, or a visitor who ignores it meets it again on the next page. A
visitor who converted is left alone for a year instead — they have the sheet.

The trigger is two steps (`armedFor` then `mountedFor`) because `CompareBar`
owns the same bottom edge on `/compare*`. Crossing 60% with the compare tray open
**defers** the offer rather than consuming it, and it lands when the tray clears.
Both are scoped to a pathname rather than being booleans: the component survives
client-side navigation, and a stale boolean is read by effects one render before
any reset can clear it — which showed the panel at the top of the next page and
spent a cooldown nobody earned.

### Where the knobs are

`config/offer-slidein.ts` — copy, 60% threshold, pixel floor, delays, both
cooldowns, and the route matcher. Deliberately no admin UI: a site-wide
interruption is a design decision, not a setting, and nobody has yet asked to
change it twice. Tests: `tests/offer/offer-slidein.test.ts`.

## Stage 7.x — Off-site sentiment on the reviews page (Google + Reddit overviews)

`/processor/<slug>/reviews` used to carry exactly one population of opinion:
merchants who wrote a review here. On most of these listings that is the smallest
of the three places a buyer looks, and on a high-risk processor with four on-site
reviews it is not the one that answers their question. Two new sections summarise
the other two: the processor's **Google listing** and its **Reddit discussion**.

### Not a scraper, and it never will be one

Nothing is fetched. Every field is typed by an editor who read the source, which
is why each section carries a `checkedOn` free-text stamp and the page prints it
under the numbers. A `Date` there would imply the figures above it refresh with
it; they do not.

### The rule that must not be broken

**Nothing in these sections may reach `AggregateRating`.** A Google rating is
Google's aggregate of reviews Google collected, and marking it up as this page's
own is the third-party-review markup Google issues manual actions over. The
Product node still reads `ratingAverage` / `ratingCount`, computed from approved
on-site reviews only, and `config/content-engine.ts` is unchanged by this work.
The public card says so in its footnote, in words, for the reader.

### Where the data lives

`reviewsPage.googleReviews` and `reviewsPage.reddit` — sub-documents on the
existing editorial layer, not blocks. Blocks would have been the cheaper change
(the block library already exists and reorders itself), but blocks render *below*
the review list and these belong *above* it, and the public card draws a
histogram, splits themes into two columns and links every thread and quote back
to its source, none of which survives a `Mixed` payload.

Shapes: `models/sentiment.ts`. Zod: `lib/validators/sentiment.ts`. The rules that
read them, with no mongoose behind them: `lib/sentiment.ts` (split for the same
reason `lib/reviews-indexability.ts` is).

### Three states, and why the empty one needed its own predicate

The admin form renders both sections, so it submits both on every save — it has
to, or `PRESERVE_ON_OMIT` would make a cleared section impossible to clear. A
section an editor opened and abandoned therefore arrives as a shell of empty
strings. So:

- `googleReviewsOverviewSchema` / `redditOverviewSchema` collapse an all-blank
  section to `undefined`, which is what lets `diffSetUnset` `$unset` it.
- `hasSentimentContent` (`lib/sentiment.ts`) decides what counts as *said*: a
  summary, a theme, a quote, a thread, or a number. A lone heading or `checkedOn`
  is chrome around nothing. The renderer, the admin "In use" badge and
  `hasReviewContent` all call it, so they cannot disagree about whether a section
  exists.

Without the second one an empty shell would render an empty card **and** put the
URL in the sitemap.

### Indexability

`hasReviewContent` now counts a written overview alongside blocks and FAQs, and
`REVIEW_CONTENT_SELECT` grew the two paths to match. This is the state most of
these processors are actually in: the discussion is on Google and Reddit, nobody
has reviewed them here, and there is no block. That page is worth indexing.

### The star histogram is five fixed rows

Not a repeatable list. The rows are the same five every time and an editor
transcribing a listing reads them off top to bottom. Blank rows are dropped by
`toGoogleOverviewPayload` **before** the payload is sent, and that filter is
load-bearing: a blank row still carries a non-blank `stars`, so the generic
blank-row filter in the validator cannot see it as empty and the required `count`
would reject the save on any listing that publishes fewer than five bars.

### Copy that had to change with it

Two rating populations on one page need saying apart in words. `defaultCopy` now
branches on which sources exist: a processor with a full Google and Reddit
writeup used to open with "No merchant has reviewed this yet" directly above two
screens of merchant opinion, and generated a meta description promising on-site
reviews that were not there. The review list also carries a line saying it is the
on-site set, and `RatingSources` names all three scores side by side at the top —
a reader who sees 4.8 in one place and 4.2 in another, unlabelled, concludes the
site cannot count.

### Nothing here is HTML

Every field reaches the DOM as a text node and there is no sanitizer in the write
path. Paragraphs in `summary` come from blank lines, not markup. Adding a
rich-text field to this panel means adding it to `sanitizeBlocks` first.

### Tests

`tests/reviews/reviews-page.test.ts` — the empty/present boundary, the all-blank
collapse, a filled section surviving form → zod → serialize → form, the partial
histogram, and "mixed is a caveat, not praise".

## Stage 7.y — Filling the off-site sections: `seed:offsite-sentiment`

The two sub-documents above shipped empty. `scripts/seed-offsite-sentiment.ts`
fills them from `scripts/data/offsite-sentiment/<slug>.json`, one file per
processor, the same shape as `seed:review-pages`:

```
npm run seed:offsite-sentiment -- --dry-run          # validate + report
npm run seed:offsite-sentiment -- --only=stripe
npm run seed:offsite-sentiment                       # write
npm run seed:offsite-sentiment -- --force            # overwrite admin edits
```

**It owns `reviewsPage.googleReviews` and `reviewsPage.reddit` and nothing else.**
`seed:review-pages` owns `heading/intro/seo/faqs/blocks`. The split is along the
paths each script `$set`s, not along the processor list, so the two never race
and can run in either order. Same non-destructive default as the other seeds: a
stored section that differs from the file is treated as an editor's work and
skipped unless `--force`.

### What it refuses to write

`houseRuleErrors()` runs over the whole batch before the first write:

- **Em and en dashes anywhere**, including in thread titles. This matters more
  here than elsewhere because `audit:dashes --fix` walks every string in the
  `processors` collection and would silently rewrite a transcribed Reddit title
  into something nobody posted. The fix for a title or a quote is always to TRIM
  it to an unaffected span, never to repunctuate it.
- **A quote that does not end on a sentence.** Research digests slice review and
  comment bodies at fixed lengths, and a quote pasted straight out of one stops
  mid-word, which reads as invented. Trim back to the previous full stop.
- **A rating or review count with no `profileUrl`**, a Reddit section with no
  thread, a thread URL that is not a `reddit.com` permalink, a quote with no date
  or no absolute https URL, and a star histogram that does not sum to the review
  count within two.
- **A missing section with no reason.** `noGoogleReason` / `noRedditReason` are
  required when a section is absent, so the next person knows it was checked and
  found nothing rather than never checked.

Every file then goes through `googleReviewsOverviewSchema` and
`redditOverviewSchema` (the same zod the admin form posts through, so the write
is a shape the form can round-trip) and finally through `hasSentimentContent`,
which catches a section that survived validation but would render an empty card.

### Editorial rules that produced the 2026-09-01 pass

45 of the 57 published processors were filled that day: 32 Google sections, 30
Reddit sections. The rest got a stated reason instead, and the reasons are the
interesting part:

- **A Google section needs about 13+ reviews AND written reviews about the
  company as a payments provider.** Adyen's only listing is its Amsterdam office
  and the reviews are about the building and a security guard. Paddle's and
  BlueSnap's one-star reviews are largely cardholders who found the name on a
  statement, which is the merchant-of-record model seen from the buyer's side and
  not a verdict on the processor. Both facts belong in the summary, not hidden.
- **Bimodal is the norm, so say so.** Almost every listing here splits into
  five-star and one-star with nothing between. Publishing the average without the
  histogram describes almost none of the people who wrote a review.
- **Say when the praise was solicited.** Stax has 1,120 five-star reviews that
  each name one support agent, which is what a review request at the end of a
  call produces. Banquest has 98 five-star and nothing below four. Corepay's
  reviews all landed inside one year. None of that is dishonest; leaving it
  unsaid would be.
- **An ISO's reviews rate the placement, not the terms.** PaymentCloud's
  five-stars thank a rep for an approval and its one-stars are about the acquirer
  it placed them with holding money. Same for Soar and Stax.
- **A thin or absent record is a finding.** Adyen is absent from Reddit because
  small merchants cannot buy it. RevenueCat is absent from argument because it is
  assumed. Both are worth a sentence.

### Getting the data (all four sources refuse the obvious route)

- **Google Maps:** WebFetch cannot see it. The Playwright browser can. Navigate
  `google.com/maps/search/<query>`, wait for the URL to become `/maps/place/`
  before reading `!1s0x…:0x<hex>` (it lags the panel render, which is why cids
  came back null at first), click the `Reviews` button, scroll the pane, click
  every `More`, read `.MyEned`, and drop any node containing "Translated by
  Google" because a machine translation is not the reviewer's words.
- **Reddit:** refuses everything. www and old 403 curl and Jina, the `.json`
  endpoints are blocked, and the real browser gets a "Prove your humanity"
  challenge. PullPush answers but rate-limits hard and its archive stops in May
  2025. What works is a **Redlib mirror** (`redlib.kylrth.com`, `safereddit.com`)
  with a plain `curl/8.5.0` user agent: sending a browser UA triggers their bot
  check, and several instances return a challenge page with HTTP 200, so the
  fetch must validate the body rather than the status. It renders absolute UTC
  dates, scores, comment counts and permalinks.
- Reddit ORs a multi-word query, so searching "square held funds merchant" returns
  the whole of r/pics. Filter results on a brand token, and for common words
  ("square", "toast", "orb") search inside the subreddits merchants use.
- The harness that did this lives in the session scratchpad, not in the repo. It
  is research tooling, and the JSON files are the durable artefact.

## Editorial layer on the curated compare pairs (`seed:new-compare-pages`)

The 2026-09-02 writer delivery (`New Comparison Pages .md`) supplied four
head-to-heads: Stripe vs Square, PayPal vs Square, Stripe vs Braintree, PayPal vs
Braintree. **No new pages were created.** All four pairs were already curated in
`lib/compare-pairs.ts`, so `/compare/stripe-vs-square` and its siblings had been
live, prerendered, indexable and in the sitemap since Stage 7.3, and
`keyword-page-map.csv` already assigned each of the four target keywords to those
exact URLs, marked `programmatic`. The doc was the editorial layer those
generated pages were missing, not a request for new URLs.

Landing pages at `/stripe-vs-square` were the alternative and would have put two
indexable pages on one query. That is the cannibalisation the `clover vs square`
note in `compare-pairs.ts` documents avoiding: Clover got a `landing` record only
because it had no published processor listing, so the compare route would have
404'd. All four processors here are published, so the exception did not apply.

### `/compare/[pair]` was the last dynamic route with no editorial slot

It read no `PageSeo` at all. It is now wired exactly as `/alternatives/[slug]`
and `/payment-processors/[facet]` already were: `pageSeoMetadata({ byPath: true })`
in `generateMetadata`, `getPageSeoByPath` in the body, `<Blocks>` below the
matrix, `FaqSection` under that, and the `hasFaqBlock` guard so a FAQ block and
the record's `faqs` never emit two `FAQPage` blobs on one URL. Purely additive:
the ~110 curated pairs with no record render as before.

`relatedComparePairs()` was added at the same time. Every curated pair used to be
a leaf — reachable from the `?ids=` builder, the profiles and the sitemap, but
never from another compare page, which is the shape `/alternatives/[slug]` was in
before its siblings section and produced the same "Discovered - currently not
indexed" result. Pairs sharing a slug now link each other, ordered so the left
(primary) slug's pairs come first and capped at 8. Links are dropped when either
side is unpublished, because that pair's page 404s.

### Why the doc's "Quick comparison" tables were not shipped

Each section opened with a 6-8 row table of online rate, in-person rate, monthly
fee and payout speed. `CompareTable` already renders every one of those rows for
both columns, straight from `processors.fees`, a few hundred pixels above where
the prose sits. Shipping them would have created a second, hand-maintained fee
card that drifts the moment an admin edits a listing. Each page instead gets one
`comparison` block carrying only the rows the matrix has no field for: "Best
for", "Setup complexity", "POS hardware", "Consumer recognition", "Owned by",
"Checkout experience". The doc's table structure and cell text survive.

### Two doc claims that contradicted the site's own numbers

Every headline ONLINE rate in the doc matched `seed.ts` exactly. Two in-person
claims did not, and both would have sat directly above a table saying otherwise:

- Square in person — doc "2.6% + $0.10", site `inPersonCardRate` "2.6% + $0.15".
  Only appeared in the dropped tables, so moot.
- "Square is usually cheaper in person" is false against both counterparties on
  the site's data. PayPal Zettle (2.29% + $0.09) is lower on both the percentage
  and the fixed fee, so it wins at every ticket size. Stripe Terminal
  (2.7% + $0.05) crosses Square at exactly $100, so Stripe is cheaper below it.
  Both sentences were rewritten to the site's numbers while keeping the doc's
  point: Square's in-person case is the hardware and software, not the rate.

Meta titles shipped as "X vs Y | Payment Processing Guide", which is a baked-in
brand suffix (stripped site-wide 2026-08-01) naming the domain rather than
`SITE_NAME` ("Payment Processor Guide"). All four got a descriptive tail instead,
each differentiated from the route's own generated fallback. Descriptions ship
verbatim except PayPal vs Braintree's, which opened "PayPal and Braintree are
both owned by PayPal".

### Gotcha: `loadEnv` forces public DNS, which this network now blocks

`scripts/loadEnv.ts` points Node's resolver at 8.8.8.8/1.1.1.1 to get around
local resolvers that refuse SRV. On this machine that is now backwards: the
system resolver answers the Atlas SRV query fine and all three public resolvers
time out, so every seed script fails with `querySrv ETIMEOUT` before it starts.
Run them as `DNS_SERVERS="" npm run seed:...` — the empty value filters to an
empty server list and `loadEnv` falls through to the system resolver.

## Free tools section (`/tools`) — 7 calculators

Shipped 2026-09-03. Research and keyword data behind it: `Tools Pages - research.md`
and `tools-keywords-full.csv` in the repo root, plus the two Semrush exports there.

`/tools` (hub) plus seven prerendered calculators:

| URL | Widget | Primary keyword | Vol | KD |
|---|---|---|---|---|
| `/tools/stripe-fee-calculator` | brand-fee | stripe fee calculator | 1,300 | 11 |
| `/tools/paypal-fee-calculator` | brand-fee | paypal fee calculator | 12,100 | 46 |
| `/tools/square-fee-calculator` | brand-fee | square fee calculator | 1,000 | 18 |
| `/tools/credit-card-processing-fee-calculator` | processing-fee | credit card processing fee calculator | 590 | 24 |
| `/tools/effective-rate-calculator` | effective-rate | effective rate calculator | 140 | 38 |
| `/tools/interchange-plus-vs-flat-rate-calculator` | pricing-model | what is interchange plus pricing | 170 | 12 |
| `/tools/ach-vs-credit-card-fee-calculator` | ach-vs-card | ach calculator | 170 | 8 |

Five widget components serve seven tools: the three brand calculators are one
component driven by a rate card in `lib/tools.ts`.

### Why the copy lives in a registry, not in Mongo

`lib/tools.ts` follows `lib/glossary.ts` and `lib/facet-pages.ts`: client-safe
static TS, no `@/models` import, so the sitemap reads `TOOL_SLUGS` and a
`"use client"` calculator reads a rate card without pulling Mongoose into the
browser bundle. The explainer copy is bound tightly to the arithmetic beside it,
so version control is the right place for it.

The PageSeo editorial slot is still wired exactly as on `/payment-processors/[facet]`
(`pageSeoMetadata({ byPath: true })` + `getPageSeoByPath` -> `<Blocks>` + FAQs), so
a tool that earns real editorial investment gets a record without a deploy. No
`seed:tools` script exists yet; nothing needs one until an editor wants to deepen
a page.

### The anti-cannibalisation rule, written into the registry

A tool owns the CALCULATION modifier and nothing else: calculator, how much,
estimator, lookup, checker. Brand fee terms stay on `/processor/<slug>`,
"best x processors" stays on the facet, definitions stay in the glossary, and
"x vs y" stays on `/compare/<pair>`. Every tool ends by linking INTO those pages.
Same shape as the rule `lib/facet-pages.ts:13-17` states for facets.

`keyword-page-map.csv` had exactly one row matching /calculat/ across all 575
rows before this change: line 349, "stripe fee calculator", pointed at
`/processor/stripe`, a page with no input field on it. That is a 1,300 a month
term at KD 11, so it was the most valuable mis-assignment in the file. It is now
re-pointed, and 32 tool-intent rows were added.

### Rate cards are the maintenance liability, not the arithmetic

The maths never goes stale. The published rate cards do, and a wrong number
renders identically to a right one. Every `RateCard` in `lib/tools.ts` carries
`checked` and `sources`, both rendered on the page in the assumptions block.

Verified for this ship:

- Stripe, from `stripe.com/pricing`, 1 September 2026. Online 2.9% + $0.30,
  Terminal 2.7% + $0.05, keyed +0.5%, international +1.5%, FX +1%,
  ACH 0.8% capped $5.00, dispute received $15.00, instant payouts 1.5% min $0.50.
- PayPal, from the US business fees page (which states last updated 15 July 2026),
  read 27 August 2026. Checkout 3.49% + $0.49, standard cards 2.99% + $0.49,
  advanced 2.89% + $0.49, QR 2.29% + $0.09, Virtual Terminal 3.39% + $0.49,
  micropayments 4.99% + $0.09, international +1.50%, chargeback $20.00,
  standard dispute $15.00.
- Square, from `squareup.com/us/en/pricing`, 12 August 2026. In person
  2.6/2.5/2.4% + $0.15 across Free/Plus/Premium, online and invoices
  3.3/2.9/2.9% + $0.30, Online API 2.9% + $0.30 on all plans, keyed 3.5% + $0.15,
  Afterpay 6% + $0.30, international +1.5%, plan fees $0/$49/$149 per location.

NOTE ON FETCHING THESE: `stripe.com` and `paypal.com` geo-redirect this machine
to India pricing, so a direct fetch returns rupee rates. All three cards were
read off Wayback captures of the US pages instead, which is why `checked` is the
capture date rather than today. Re-verify the same way, and do not move `checked`
without re-reading a source.

### What the calculators do that the ranking competitors do not

Each tool exists because of a specific, checkable gap in the current SERP:

- **Processing fee** models fixed monthly fees and the card-present/online/keyed
  split. Every page-one competitor excludes monthly fees, and Novo says so on its
  own page. The monthly minimum is applied as a floor on the processing charge,
  not an extra line, which is how an agreement applies it.
- **Effective rate** splits pass-through (interchange + assessments, not
  negotiable) from processor markup (the only negotiable part). Not one ranking
  calculator does this. It also runs entirely in the browser: every incumbent
  statement-analysis service requires a PDF upload and a phone number, to a
  company that sells payment processing. Do not add a network call here.
- **Interchange-plus vs flat-rate** returns a break-even volume, so it can answer
  "stay where you are". Every ranking page on that query is published by someone
  who sells interchange-plus, and none of them computes the crossover.
- **ACH vs card** models percentage, fixed fee, minimum and cap in the right
  order. Modelling ACH as a flat percentage is fine at $50 and badly wrong at
  $10,000, which is the size where the decision matters.
- **Brand calculators** are current. Square raised US rates in 2026 and the
  pages ranking first, third and fifth for "square fee calculator" all still
  compute the old schedule; one page dated July 2026 carries a PayPal rate inside
  a Square calculator.

### Page shape, and why

Widget above the fold, 1,250 to 1,480 words of explainer beneath it. Both halves
are load-bearing: KoronaPOS has a working effective-rate calculator with thin copy
that never cracks the top ten, and uschamber.com ranks top five for an explicit
"calculator" query with a 3,500 word article and no calculator at all.

Everything except the widget is server rendered, including a worked numeric
example, so the crawler gets a concrete answer and an answer engine gets an
extractable passage. The widget is a client island that also renders its default
state on the server, so the raw HTML already contains computed dollar figures.

Calculator state lives in React state and never in the query string. No
parameterised calculator URL ranked in any SERP sampled, and keeping state in
memory means the route cannot mint near-duplicate URLs, so it needs no
`NOINDEX_ROUTES` entry.

Schema: `BreadcrumbList` + `WebApplication` + `FAQPage`. `webApplicationJsonLd`
is new in `lib/seo.ts` and is deliberately NOT rich-result bait: the software-app
rich result needs `offers.price` AND an `aggregateRating`, and a site cannot
legitimately star-rate its own free tool. It is there for machine identification,
because answer engines refer to third-party calculators by product name. Never
ship `HowTo` (no surface since 2023). `FAQPage` rich results were deprecated in
May 2026 and produce no SERP lift, but the markup is harmless and the visible
text still earns the ranking.

### Wiring that had to ship in the same commit

- `"/tools"` added to `RESERVED_LANDING_PATHS` (`lib/validators/pageSeo.ts`).
  Without it an admin can create a `landing` PageSeo at `/tools`, which saves
  fine and then never renders because Next resolves the static segment first.
- `app/sitemap.ts`: `/tools` in `STATIC_PATHS`, plus `TOOL_SLUGS` mapped through
  `withDate` so a tool with a PageSeo record gets an honest edit date and one
  without gets none.
- Navbar `NAV_LINKS` and Footer `POPULAR_LINKS`. A brand-new section has no
  external links, so nav placement is its only source of internal PageRank. This
  site has a documented orphan-cluster problem; the fix ships up front.

### Two arithmetic bugs caught before shipping, both worth remembering

1. The ACH crossover was first solved in closed form on the capped branch only.
   On the default inputs (card 2.9% + $0.30 against ACH 0.8% with no fixed fee)
   it reported a crossover of $162 when ACH is in fact cheaper from the first
   cent. The ACH fee is piecewise (percentage, then minimum floor, then cap), so
   it is now solved by bisection, and "ACH is cheaper at every amount" is a
   rendered answer rather than a failure case. Verified against Square-style
   pricing (1%, $1 minimum, $10 cap), where the crossover is a real $24.14.
2. The interchange-plus worked example claimed a break-even near $6,400 while the
   widget on the same page computed $2,769. The widget was right. Any hand-written
   number in `lib/tools.ts` that the widget also computes has to be checked
   against the widget, not against intuition.

Also: the verdict band was dropped from the brand calculators' single-payment
mode. The bands score a merchant's blended monthly rate, and judging one payment
against them labelled a perfectly standard Square rate on a $100 sale "High",
which is a property of the fixed fee rather than of the deal.

### The dash audit does not cover this code

`npm run audit:dashes` walks Mongo documents, not source string literals, so an
em dash typed into a calculator label, tooltip, result string or assumption note
passes both audits and still ships. `components/public/tools/*` and `lib/tools.ts`
are all rendered copy in source. Grep them directly when you touch the wording.

### What was deliberately NOT built

From the research, and the reasons are in `Tools Pages - research.md`:

- **EMI calculator.** No US analogue. The payments-native equivalents are an MCA
  factor-rate-to-APR converter and a terminal lease-vs-buy calculator.
- **Tax calculators.** A 1099-K threshold checker is built on a false premise:
  the de minimis threshold applies only to third-party settlement organizations,
  so a merchant with a merchant account gets a 1099-K from the first dollar. A
  general sales tax calculator belongs to Avalara and TaxJar.
- **Cash discount / dual pricing calculators.** Google Trends US shows
  "dual pricing calculator" at literally zero every week for twelve months. The
  topic is real, the calculator is not: it belongs in the glossary and in
  `/blog/how-to-lower-payment-processing-fees`, which currently does not mention
  surcharging at all.
- **Surcharge calculator.** The calculator term is 20 a month. The editorial terms
  ("credit card surcharge laws by state", "is it legal to charge a credit card
  fee") are 590 each. That is a cited, dated state-law page with a calculator
  attached, not the reverse, and it carries a standing legal-review cost.
- **Chargeback ratio calculator.** Everything in the cluster is 40 a month or
  below and the proposed primary keyword returns zero.
- **MCC code lookup.** Real (480 at KD 24) and still wanted, but it needs a
  maintained MCC dataset, which is a separate piece of work.
- **Restaurant and involuntary churn calculators.** Their keyword clusters were
  in the Semrush request and did not come back, so they are unscored. 64 keywords
  are still outstanding; the list is in section 13 of the research doc.

## Free tools, batch two: 10 more calculators (17 total)

Shipped 2026-09-04. `/tools` now carries 17 calculators plus the hub, 18 URLs.

New: `/tools/merchant-cash-advance-calculator`, `/tools/mcc-code-lookup`,
`/tools/restaurant-credit-card-fee-calculator`, `/tools/credit-card-surcharge-calculator`,
`/tools/reverse-fee-calculator`, `/tools/chargeback-ratio-calculator`,
`/tools/rolling-reserve-calculator`, `/tools/payout-date-calculator`,
`/tools/involuntary-churn-calculator`, `/tools/pos-terminal-lease-vs-buy-calculator`.

That covers the whole shortlist in `Tools Pages - research.md` except the PCI SAQ
selector, which the research rated the worst intent-to-money match in the set and
the highest liability per unit of traffic. Two of the ten came from section 7
rather than the shortlist: the MCA factor-rate-to-APR converter and the terminal
lease-vs-buy calculator are the genuine US answers to the "EMI calculator" idea,
and both are about instalment contracts merchants actually get trapped by.

### Where the code lives now

- `lib/tools.ts` keeps the shared types, the hub copy and the first seven tools.
- `lib/tools-more.ts` holds the ten new `ToolDef` entries. Split for file size
  only. It imports `ToolDef` as a TYPE, so there is no runtime cycle.
- `lib/tools-rates.ts` holds the rate cards and the effective-rate bands. See
  the bundling note below: this split is load-bearing, not cosmetic.
- `lib/tools-data/*.ts`, one module per tool, holds the reference datasets.
- `lib/tools-math.ts` holds every non-trivial formula.
- `tests/tools/tools-math.test.ts` asserts the reference values.

### Why the maths is a separate, tested module

Every failure mode in these calculators is SILENT. Three that were caught by
writing the reference cases down first:

1. **The MCA APR solver.** NPV is decreasing in the rate, so when NPV(mid) is
   positive the root lies above mid. Invert that branch and the bisection
   converges on r = 1.0 and reports about 25,200 percent APR. It does not throw
   and it does not look obviously wrong on a page whose subject is high rates.
   The Federal Reserve's own illustration is asserted: $50,000 at a 1.30 factor
   with a 10 percent holdback on $100,000 of monthly volume is 111.19 percent
   APR, 221.07 percent at a 20 percent holdback, 55.76 percent at 5 percent.
2. **Annualising churn.** At a 4 percent decline rate and 53 percent recovery the
   monthly involuntary churn rate is 1.88 percent. Compounded that is 20.37
   percent a year. Multiplied by twelve it is 22.56 percent, which is what most
   competing calculators print. Both numbers look plausible.
3. **Gross-up rounding.** Rounding the gross half up can still land a cent short,
   because the processor rounds its fee independently of your rounding. The
   implementation computes in integer cents, then recomputes the fee on the
   rounded gross and bumps a cent at a time until the net clears. A sweep over
   252 combinations asserts it never lands short and never overshoots by more
   than a cent.

Also asserted: the Federal Reserve closure set. Saturday-dated holidays are
DROPPED rather than shifted, because the Reserve Banks are open the preceding
Friday, and the one Sunday holiday is pre-resolved to its observed Monday in the
data so shifting it again would move it twice. 22 entries, 19 actual closures.

### Bundle size, measured rather than assumed

`/tools/[tool]` is ONE route serving all seventeen calculators, so it has ONE
client reference manifest and every tool page downloads the same chunk set. That
was verified directly: the prerendered HTML for the Stripe page and the MCC page
reference an identical list of 22 chunks.

**`next/dynamic` does not change this in the App Router.** It was tried first and
moved the reported numbers by nothing. It is still in `ToolWidget.tsx` because it
costs nothing, but do not expect it to split anything.

What actually took the first load from 295 kB to 208 kB, in order of impact:

1. `ToolKit` and `BrandFeeCalculator` imported `lib/tools.ts` for the rate bands
   and rate cards, which pulled the ENTIRE registry, `lib/tools-more.ts`
   included, into the chunk every tool page loads. Moving those to
   `lib/tools-rates.ts` was the single biggest win, 295 kB to 220 kB.
2. `lib/tools-data.ts` became `lib/tools-data/*.ts`, one module per tool, so a
   widget imports only its own constants instead of a 112 kB module.
3. The 290 row MCC table and the 52 row state surcharge table are passed as
   PROPS from `ToolWidget` rather than imported by the client modules, so they
   ride only their own page's payload. 220 kB to 208 kB.

**The rule this leaves:** a `"use client"` module under `components/public/tools/`
must never import `@/lib/tools` or the `@/lib/tools-data` barrel. Import the
narrow module, or take the data as a prop from `ToolWidget`. The barrel's own doc
comment says so, and `lib/tools.ts` re-exports `lib/tools-rates.ts` so server
code is unaffected.

The remaining 208 kB against 182 to 185 kB on the other heavy routes is the
seventeen widgets themselves, and removing it would mean seventeen separate route
folders. Not worth it at this size.

### Datasets that expire or drift

`lib/tools-data/index.ts` states the contract. The ones with a clock on them:

- **`FED_HOLIDAYS`** covers 2026 and 2027 only. A test fails once the last entry
  falls into the past, so this cannot rot silently, but extend it before January
  2027.
- **`CHARGEBACK_PROGRAMS`** tracks card network monitoring rules, which the
  networks have revised recently: VDMP no longer exists separately, it was folded
  into VAMP and Visa changed its own formula. Each row carries its own
  denominator and its own source because the ranking pages contradict each other
  on exactly that point.
- **`SURCHARGE_STATES`** is 52 rows with a per-row source and checked date, and a
  deliberate "Unclear" status so an unverified state is shown as unverified
  rather than guessed. State law here moves, and several 2026 competitor pages
  wrongly describe California SB 478 as a surcharge ban.
- **`RESERVE_CARRY_RATE`** is a published reference rate with its release date
  beside it.
- **`LEASE_DEVICE_PRICES`** and the rate cards are vendor pricing.

### Two scoping decisions worth keeping

**The surcharge tool does not output a maximum legal surcharge.** It computes
dollar math on numbers the merchant supplies, and the state table sits beside it
as cited reference. Whether you may surcharge and at what ceiling turns on the
state, the network rules, your cost of acceptance and your acquirer agreement.
A computed answer would read as legal advice. It does surface the break-even
surcharge, which is arithmetic, and flags anything above the 3 percent network
cap.

**The restaurant tool excludes third party delivery volume from the input** and
says so on the field label. On marketplace orders the platform is usually the
merchant of record, so that volume is not the restaurant's processing cost and
including it would overstate the answer. The tool also does not answer whether
processing fees may be deducted from tipped employees, which is a wage and hour
question rather than a payments one.

### Smaller things

- The MCC page's meta title carries the code count ("290 Verified US MCCs"). If
  the dataset changes, change the title. It is in `lib/tools-more.ts`.
- `keyword-page-map.csv` was extended with the batch one tool rows already. The
  batch two keywords are not mapped yet, and 64 of the requested Semrush pulls
  are still outstanding: the restaurant and involuntary churn clusters have no
  volume data at all, so those two tiers are unscored placeholders.
- The dash audit still does not read source string literals, and all the new
  calculator copy is source. 33 files were grepped clean at ship time.

## Free tools, batch three: compound and simple interest (19 total)

Requested directly, with J.P. Morgan Personal Investing's compound interest
calculator as the reference. Two pages:

- `/tools/compound-interest-calculator`
- `/tools/simple-interest-calculator`

### These are the only two tools that are not about payments

Every other calculator in the registry answers a question a merchant has about
their processor. These answer a question about interest, which is adjacent
rather than native, so they live in their own module, `lib/tools-money.ts`,
rather than being buried in the middle of `tools-more.ts`. **If the section is
ever pruned back to payments-only, that file is the thing to delete.** `TOOLS` is
now `[...CORE_TOOLS, ...MORE_TOOLS, ...MONEY_TOOLS]`: the second split is by file
size, the third is by subject.

They still obey the anti-cannibalisation rule. Neither page reaches for a
definition, a comparison or a processor's pricing, and both link into the pages
that own those. Where they touch this site's actual subject they touch it
honestly, and one of the two things they say about it is a warning:

- A **rolling reserve** genuinely is a lump sum sitting still for a fixed term,
  so the arithmetic applies. Both pages publish the forgone-interest figure
  ($155.34 on $50,000 held 180 days at the FDIC money market average) precisely
  to show it is NOT the cost of a reserve. The cost is that the cash is not
  available; the reserve tool already models that properly with a borrowing rate
  from the Fed H.15 release. Treating forgone deposit interest as the damage
  understates it by an order of magnitude, and saying so on the page stops the
  number being used as a rhetorical stand-in.
- A **merchant cash advance** is the trap. It is priced with a factor rate, which
  contains no time, so there is no rate to enter and no term to divide by.
  Feeding a factor rate to either calculator produces a confident and meaningless
  number. Both pages say so and point at `merchant-cash-advance-calculator`.
  `related` on the MCA page now points back at the simple interest page, and the
  rolling reserve page back at the compound one, so neither new page is a
  sitemap-only orphan.

### What was taken from the reference, and what was added

The J.P. Morgan page has four inputs (initial investment, timeframe, annualised
return rate, contribution plus a period select) and four outputs (initial
investment, total additional contributions, total returns, final value). Those
four outputs are the right four and are reproduced exactly. What it does not have
was added, because it is the part that decides whether the answer is right:

- **A compounding frequency selector**, including continuous. Without one, "5%"
  is not yet a number.
- **Contribution timing.** Start of period versus end. Worth $161.75 on the
  defaults, which will not change a decision but decides whether this agrees with
  a bank statement, and that is usually why someone is checking.
- **The APY**, which is what makes two differently-compounded rates comparable.
- **Exact doubling time next to the Rule of 72**, rather than quoting the
  shortcut as fact.
- **A year-by-year table.**
- **The comparison against simple interest**, which is the output the whole
  category omits and the reason both pages exist as a pair.

### The output that matters most, and the claim it kills

A total interest figure tells you nothing about compounding, because most of it
would have been earned anyway. On the defaults ($10,000 opening, $250 a month, 5%
compounded monthly, ten years) the account earns **$15,290.66** of interest, and
compounding accounts for **$2,853.16** of that. Every page that presents the
first number as the compounding effect overstates it roughly fivefold.

The simple-interest twin is computed in the SAME loop as the compound figure, not
as a separate closed form, so it is guaranteed to describe the same deposits over
the same timeline. Its value is independently derivable and is asserted in the
tests from a hand-computed arithmetic series, not from what the code returned.

### The day count is why the simple interest page is a page

`I = P x R x T` is one multiplication. The reason it needs a tool is `T`: a term
in days has to be divided by an assumed year length, and US commercial lending
routinely assumes 360. That turns a 9.00% note into a 9.125% one without touching
the rate on the paper (365/360 = 1.0139). On $100,000 at 8% for a year it is
$8,111.11 rather than $8,000.00.

**The basis selector only appears when the term is counted in days.** That is not
a UI shortcut. A term stated in months or years is the same fraction of a year
under either convention, so offering the choice there would imply a difference
that does not exist.

**The Reg DD APY exponent always divides by actual days, never 360, even when the
accrual used 360.** The accrual convention decides how many dollars were earned;
the APY formula then annualises those dollars over real elapsed time. Putting 360
in the exponent counts the convention twice. There is a test pinning this.

### The strongest test in the file

`simpleInterest` reproduces Regulation DD's own published example. Appendix A to
12 CFR Part 1030 states that $30.37 of interest on a $1,000 six-month certificate
over a 182 day period is an annual percentage yield of **6.18%**. The test feeds
those numbers in and asserts `apy.toFixed(2) === "6.18"`. That reference sits
outside both this module and the closed form it implements, which is worth more
than any number of self-consistent assertions.

The rest of `tests/tools/tools-math.test.ts` follows the same discipline: the
annuity checks are against the closed form worked separately, the annuity-due
premium against the algebraic identity `annuity x i`, and the doubling checks
against the property that the Rule of 72 crosses over at 8% (overstating below,
understating above, exact to within a week at 8% itself). 154 tests pass.

### Findings from the arithmetic that shaped the copy

All computed by this code and re-derivable with the widgets:

- **Compounding frequency barely matters.** $10,000 at 4.50% for one year: annual
  $450.00, quarterly $457.65, monthly $459.40, daily $460.25, continuous $460.28.
  The whole annual-to-daily range is $10.25, and daily is within three cents of
  the theoretical ceiling. Moving the rate to 5.00% is worth $50.00, nearly five
  times as much. The pages say to take the extra tenth of a point over the better
  compounding schedule.
- **The effect is heavily back-loaded.** On the defaults, interest is 16.2% of
  the balance at five years and 60.4% at thirty.
- **Simple versus compound is a rounding error under a year.** $25,000 at 9%:
  identical to the cent over 30 days (simple is $0.01 ahead, because 30 days does
  not contain a full monthly compounding period), $4.09 apart at 90 days, $95.17
  at a year, $966.13 at three.
- **APY equals the stated rate at exactly 365 days and nowhere else.** Above it
  under a year, below it over.

### Dataset with a clock on it

`FDIC_NATIONAL_RATES` in `lib/tools-data/interest.ts` is the only perishable
thing in that module. National deposit averages effective **17 August 2026**,
read 5 September 2026. The FDIC republishes monthly. The rest of the module,
the compounding options and the Regulation DD formula, does not expire.

The derived columns beside the FDIC rates in the compound page's rate table
(APY, $10,000 after ten years, years to double) are computed by this site, not
published by the FDIC, and the caption says so. If you refresh the rates, those
columns have to be recomputed, and they were checked to the cent before shipping.

### Smaller things

- The dash audit still does not read source string literals, so the new copy was
  scanned directly for em dashes, en dashes and curly quotes. Clean.
- `npm run audit:meta` reports three pre-existing source violations
  (`tools-more.ts:389`, `tools-more.ts:735`, `seed-braintree-profile.ts:133`).
  The two new pages add none.
- No keyword data was pulled for either page. The titles and descriptions are
  written against the head terms and are unscored, so treat both as placeholders
  in `keyword-page-map.csv` until volume is available.
- Both pages carry a rate table, five explainer sections, six or seven
  assumptions and six FAQs, matching the batch two shape. Wiring into the hub,
  the sitemap and `generateStaticParams` is automatic off `TOOLS`, so nothing
  else had to change.

## Free tools, batch four: 25 more calculators (44 total)

Shipped 2026-09-05. `/tools` now carries 44 calculators plus the hub, 45 URLs.
Requested as a list of 25, built one agent per tool, then a second pass per page
against the `human` skill checklist.

Eight brand fee pages: `shopify-payments-fee-calculator`, `clover-fee-calculator`,
`toast-fee-calculator`, `helcim-fee-calculator`, `adyen-fee-calculator`,
`braintree-fee-calculator`, `authorize-net-fee-calculator` and
`venmo-cash-app-zelle-business-fee-calculator`.

Eleven cost-of-acceptance pages: `interchange-fee-lookup`,
`interchange-downgrade-calculator`, `chargeback-cost-calculator`,
`refund-cost-calculator`, `cross-border-fee-calculator`,
`credit-card-processing-savings-calculator`,
`merchant-account-junk-fee-calculator`, `pci-saq-level-finder`,
`bnpl-fee-calculator`, `false-decline-cost-calculator`,
`high-risk-merchant-account-cost-calculator`.

Six business finance pages: `apr-vs-apy-calculator`,
`business-loan-amortization-calculator`, `invoice-factoring-calculator`,
`early-payment-discount-calculator`, `cash-conversion-cycle-calculator`,
`break-even-and-margin-calculator`.

That includes the PCI SAQ selector batch two deliberately skipped. It is built as
an INDICATOR, never a determination: the assumptions block says your acquirer
sets your obligations and a QSA validates them. It also separates the two things
every competing page conflates, merchant level (1 to 4, set by annual transaction
count, decides how you validate) from SAQ type (A, A-EP, B, B-IP, C, C-VT, P2PE,
D, set by how you accept, decides which questionnaire).

### The registry is now a directory, and the rate cards moved

- `lib/tools-defs/*.ts`, ONE FILE PER TOOL, barrelled by `lib/tools-defs/index.ts`
  into `BATCH_FOUR_TOOLS`. Twenty five entries in a fourth flat module would have
  been roughly 5,000 lines nobody can review, and every edit would conflict.
  `TOOLS` is now `[...CORE_TOOLS, ...MORE_TOOLS, ...MONEY_TOOLS, ...BATCH_FOUR_TOOLS]`.
- `lib/rate-cards/*.ts`, one module per processor, plus a barrel. **This split is
  load-bearing, not cosmetic**, and it is the same lesson `lib/tools-data/` learned.
  Ten cards inline in `lib/tools-rates.ts` would ship all ten to every calculator
  page, because `BrandFeeCalculator` imports that module. `lib/tools-rates.ts` now
  holds only types, the effective-rate bands and the pure lookups.
- **`BrandFeeCalculator` takes `card: RateCard` as a PROP, not `cardKey`.**
  `ToolWidget` is a Server Component and resolves the card. Same technique as the
  MCC and surcharge tables. `RateCardKey` is a union in `lib/tools-rates.ts` and
  the barrel is a `Record<RateCardKey, RateCard>`, so adding a key without adding
  the module fails to compile. The two cannot drift apart silently.
- `lib/calc/<slug>.ts` holds each new tool's maths. `lib/tools-math.ts` was left
  alone: it is already 739 lines, and twenty five agents editing one module is a
  guaranteed conflict.
- Batch four's data modules are **not** re-exported from `lib/tools-data/index.ts`.
  Several hundred more names through one `export *` makes a single duplicated
  export a build break unrelated to the tool that caused it. They are imported
  narrowly by the widget, the server component or the test that needs them.
- `tests/tools/batch-four/<slug>.test.ts`, aggregated by
  `tests/tools/batch-four.test.ts`, registered in `tests/index.test.ts`.
  **632 tests pass**, up from 154.

### Helcim and Adyen do not use the shared brand widget

Both are interchange-plus, and Adyen is interchange plus plus: interchange, then
card scheme fees, then Adyen's own fixed processing fee and payment method fee.
A flat-rate widget cannot express either without inventing an interchange number
and hiding it. Both got their own widget with the interchange assumption as a
VISIBLE, editable input, defaulted from the published network rate sheets and
labelled an estimate. Interchange is published as rate tables rather than a feed,
so a point value stated as fact would be the exact dishonesty these pages exist
to correct.

### The chargeback boundary, written down because it will come up again

`/tools/chargeback-ratio-calculator` (batch two) owns the RATIO and THRESHOLD
intent and keeps the network programme table. `/tools/chargeback-cost-calculator`
(batch four) owns the FINANCIAL intent: representment economics, the annual P&L
line, the escalation ladder once a programme picks you up, and the break-even
expressed in extra sales AT MARGIN rather than at revenue, which is the
denominator almost every competing page gets wrong. The cost page does not
restate the threshold table and links to the ratio page for it. If either page
starts answering the other's question, that is the thing to fix.

### noUncheckedIndexedAccess caught 111 real defects

Every one was an indexed read typed `T | undefined`. Worth recording because the
fixes differ by context and the wrong fix hides a real case:

- In `lib/calc/junk-fees.ts`, two parallel arrays were read back by index. Fixed
  by carrying the line and its cents together as pairs, so the value is never
  absent rather than being asserted present.
- `FACTORING_FEE_STRUCTURES[0]`, `REPRESENTMENT_WIN_RATES[0]` and
  `CHARGEBACK_MONITORING_ESCALATION[0]` were used as `??` fallbacks, which does
  not narrow: `array[0]` is itself possibly undefined. Fixed with the `WORST_BAND`
  pattern already in `lib/tools-rates.ts`: hoist the row into a named const and
  export it as the default, so the fallback is total.
- `JunkFeeCalculator` read both ends of a computed ladder. The honest reading of
  an empty ladder is that there is no sentence to write, so the callout renders
  off a narrowed pair instead of asserting rows exist.
- In tests, `!` is the house convention (`tools-math.test.ts:564`) and was applied
  mechanically.

### Bundle size regressed, and it is now the open question

`/tools/[tool]` first load JS went from the 208 kB batch two got it down to
**327 kB**. Measured the same way as before: every prerendered tool page
references an identical 24 chunks totalling 787 kB uncompressed, because ONE
route serves all 44 calculators and therefore has ONE client reference manifest.
`next/dynamic` still does not split it, exactly as batch two found.

Everything cheap has already been done: the data is passed as props, the rate
cards are per module, the registry is server side. The remaining weight is 37
widget components, and the only real fix left is separate route folders. Batch
two judged that not worth it at seventeen widgets. At thirty seven it probably
is, and it should be decided before batch five rather than after.

### What still needs doing

- **`INTERCHANGE_RATES` has no Discover rows.** 196 rows, Visa 119 and Mastercard
  77, every one carrying its own source. Discover publishes a US rate sheet and
  the page promises three networks in places. Either add the rows or narrow the
  claim.
- **No keyword volume data.** 52 rows were added to `keyword-page-map.csv` against
  head terms, all unscored. The titles and descriptions are written against
  observed query shapes, not against Semrush numbers, so treat the tiering
  (10 tier one, 22 tier two, 12 tier three) as a placeholder.
- **The hub is now 44 cards in three tier groups.** It works, but topical grouping
  would serve both the reader and the internal linking better.
- **Every rate card and dataset in this batch is a standing maintenance
  commitment**, same as batches one to three. Each carries its own `checked` date
  and sources, rendered on the page. Do not move a `checked` date without
  re-reading the source.

### The dash audit still does not read source, and this batch is all source

`npm run audit:dashes` walks Mongo, not string literals. All 90-odd new files were
grepped directly for em dash, en dash, horizontal bar and curly quotes: clean, and
clean of non-ASCII generally outside the HTML entities the widgets already use.
`npm run audit:meta` reports the same 3 pre-existing source violations
(`tools-more.ts:389`, `tools-more.ts:735`, `seed-braintree-profile.ts:133`) and 5
pre-existing database ones. **The 25 new pages add none**, after seven titles and
descriptions were rewritten to drop the banned `%`, `$` and `+` symbols.
