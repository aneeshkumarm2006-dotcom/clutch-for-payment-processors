import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFilteredQuery,
  parseReviewQuery,
  reviewsHref,
  DEFAULT_REVIEW_QUERY,
} from "../../components/public/reviews/params";
import { toReviewsPageData } from "../../lib/serialize";
import { processorInput, reviewsPageSchema } from "../../lib/validators/processor";
import {
  blankProcessorValues,
  toProcessorReviewsEnginePreview,
  toReviewsPageFormValues,
  toReviewsPagePayload,
} from "../../components/admin/processors/serialize";
import { buildStructuredData } from "../../lib/engine";
import { absoluteUrl } from "../../lib/seo";

/**
 * The per-processor reviews page (`/processor/<slug>/reviews`).
 *
 * Three contracts here fail silently rather than loudly, which is why they are
 * pinned:
 *
 *  - the URL contract shared by the server page and the client filter bar,
 *  - "filtered = noindex, paginated = indexable", the rule that keeps a
 *    combinatorial filter space out of the index without also hiding page 2,
 *  - the blocks tri-state surviving form → zod → Mongo, so an editor can both
 *    add sections and delete their last one.
 */

const ctx = { siteName: "Test", siteUrl: "https://example.com" };

// ---------------------------------------------------------------------------
// URL contract
// ---------------------------------------------------------------------------

test("an empty query is the plain, unfiltered first page", () => {
  const q = parseReviewQuery({});
  assert.equal(q.page, DEFAULT_REVIEW_QUERY.page);
  assert.equal(q.sort, DEFAULT_REVIEW_QUERY.sort);
  assert.equal(q.minRating, DEFAULT_REVIEW_QUERY.minRating);
  assert.equal(q.verifiedOnly, DEFAULT_REVIEW_QUERY.verifiedOnly);
  assert.equal(q.industry, undefined);
  assert.equal(q.mention, undefined);
  assert.equal(isFilteredQuery(q), false);
  assert.equal(reviewsHref("/processor/stripe/reviews", q), "/processor/stripe/reviews");
});

test("unknown sorts and off-menu ratings fall back instead of minting URLs", () => {
  const q = parseReviewQuery({ sort: "worst", rating: "3.7", page: "0" });
  assert.equal(q.sort, "newest");
  assert.equal(q.minRating, 0);
  assert.equal(q.page, 1);
  assert.equal(isFilteredQuery(q), false);
});

test("pagination alone is NOT a filtered view (page 2 must stay indexable)", () => {
  const q = parseReviewQuery({ page: "2" });
  assert.equal(q.page, 2);
  assert.equal(isFilteredQuery(q), false);
  assert.equal(reviewsHref("/processor/stripe/reviews", q), "/processor/stripe/reviews?page=2");
});

test("every real filter marks the view filtered", () => {
  const cases = [
    { sort: "highest" },
    { rating: "4" },
    { industry: "Retail" },
    { verified: "1" },
    { mention: "support" },
  ];
  for (const raw of cases) {
    assert.equal(
      isFilteredQuery(parseReviewQuery(raw)),
      true,
      `${JSON.stringify(raw)} should count as filtered`,
    );
  }
});

test("href → parse round-trips, and changing a filter resets to page 1", () => {
  const q = parseReviewQuery({ sort: "highest", rating: "4", industry: "Retail", page: "3" });
  const href = reviewsHref("/processor/stripe/reviews", q);
  const parsedBack = parseReviewQuery(
    Object.fromEntries(new URL(href, "https://example.com").searchParams),
  );
  assert.deepEqual(parsedBack, q);

  // What ReviewFilters does on every change.
  const reset = reviewsHref("/processor/stripe/reviews", { ...q, verifiedOnly: true, page: 1 });
  assert.equal(reset.includes("page="), false);
  assert.equal(reset.includes("verified=1"), true);
});

// ---------------------------------------------------------------------------
// The serialize whitelist wall
// ---------------------------------------------------------------------------

test("a processor with no reviewsPage has no editorial layer at all", () => {
  assert.equal(toReviewsPageData(undefined), undefined);
  assert.equal(toReviewsPageData({}), undefined);
  // `toSeoData` always returns an object, so an empty seo must not read as content.
  assert.equal(toReviewsPageData({ seo: {} }), undefined);
});

test("robotsIndex stays tri-state through the reviews page's own seo block", () => {
  assert.equal(toReviewsPageData({ seo: { metaTitle: "x" } })?.seo.robotsIndex, undefined);
  assert.equal(toReviewsPageData({ seo: { robotsIndex: false } })?.seo.robotsIndex, false);
  assert.equal(toReviewsPageData({ seo: { robotsIndex: true } })?.seo.robotsIndex, true);
});

test("heading, intro, faqs and blocks all survive the wall", () => {
  const data = toReviewsPageData({
    heading: "Stripe reviews",
    intro: "What merchants say.",
    faqs: [{ question: "Q", answer: "A" }],
    blocks: [{ type: "faq", id: "b1", data: { items: [] } }],
  });
  assert.equal(data?.heading, "Stripe reviews");
  assert.equal(data?.intro, "What merchants say.");
  assert.equal(data?.faqs?.length, 1);
  assert.equal(data?.blocks?.[0]?.type, "faq");
});

// ---------------------------------------------------------------------------
// Validation + the omission rules
// ---------------------------------------------------------------------------

test("reviewsPage is optional, so a form that omits it parses clean", () => {
  assert.equal(reviewsPageSchema.parse(undefined), undefined);
  const parsed = processorInput.parse({ name: "Stripe", website: "https://stripe.com" });
  // Undefined, NOT `{}` — the write route turns that omission into "leave the
  // stored reviews page alone" via PRESERVE_ON_OMIT.
  assert.equal(parsed.reviewsPage, undefined);
});

test("blocks keep their tri-state inside reviewsPage", () => {
  assert.equal(reviewsPageSchema.parse({})?.blocks, undefined, "absent = preserve");
  assert.deepEqual(reviewsPageSchema.parse({ blocks: [] })?.blocks, [], "[] = clear");
  const set = reviewsPageSchema.parse({
    blocks: [{ type: "richtext", id: "b1", data: { html: "<p>Hi</p>" } }],
  });
  assert.equal(set?.blocks?.length, 1);
});

test("an invalid block payload is rejected rather than reaching Mixed", () => {
  // `data` is Schema.Types.Mixed; zod is the only gate it gets.
  assert.throws(() =>
    reviewsPageSchema.parse({ blocks: [{ type: "richtext", id: "b1", data: { html: "" } }] }),
  );
});

test("the form always states the reviews page, so a cleared field can be cleared", () => {
  const payload = toReviewsPagePayload(toReviewsPageFormValues({ heading: "Old heading" }));
  assert.notEqual(payload, undefined);
  // Blank tab → an object of undefineds, which `$set`s over the old value rather
  // than being mistaken for "this form doesn't manage the reviews page".
  const cleared = toReviewsPagePayload(toReviewsPageFormValues({}));
  assert.equal(cleared.heading, undefined);
  assert.deepEqual(cleared.blocks, []);
});

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

const previewValues = (overrides: Record<string, unknown> = {}) => ({
  ...blankProcessorValues(),
  name: "Stripe",
  slug: "stripe",
  ...overrides,
});

test("no approved reviews means no Product node claiming a rating", () => {
  const entity = toProcessorReviewsEnginePreview(previewValues() as never, { ratingCount: 0 });
  const { nodes } = buildStructuredData("processorReviews", entity, ctx);
  assert.equal(nodes.some((n) => n["@type"] === "Product"), false);
  assert.equal(nodes.some((n) => n["@type"] === "BreadcrumbList"), true);
});

test("with reviews, Product carries the aggregate and shares the profile's @id", () => {
  const entity = toProcessorReviewsEnginePreview(previewValues() as never, {
    ratingAverage: 4.4,
    ratingCount: 128,
  });
  const { nodes } = buildStructuredData("processorReviews", entity, ctx);
  const product = nodes.find((n) => n["@type"] === "Product") as Record<string, unknown>;
  assert.ok(product);
  assert.deepEqual(product.aggregateRating, {
    "@type": "AggregateRating",
    ratingValue: 4.4,
    reviewCount: 128,
    bestRating: 5,
    worstRating: 1,
  });
  // One product entity described by two URLs, not two products with identical
  // ratings.
  assert.equal(product["@id"], `${absoluteUrl("/processor/stripe")}#product`);
});

test("the breadcrumb ends at Reviews, under the profile", () => {
  const entity = toProcessorReviewsEnginePreview(previewValues() as never, {
    primaryCategory: { name: "Online payments", slug: "online-payments" },
  });
  const { nodes } = buildStructuredData("processorReviews", entity, ctx);
  const crumbs = (
    nodes.find((n) => n["@type"] === "BreadcrumbList") as {
      itemListElement: { name: string; item: string }[];
    }
  ).itemListElement;
  assert.deepEqual(
    crumbs.map((c) => c.name),
    ["Home", "Processors", "Online payments", "Stripe", "Reviews"],
  );
  assert.equal(crumbs.at(-1)?.item, absoluteUrl("/processor/stripe/reviews"));
});

test("the reviews page's FAQs feed its own FAQPage, and a block supersedes them", () => {
  const withFaqs = toProcessorReviewsEnginePreview(
    previewValues({
      reviewsPage: {
        ...blankProcessorValues().reviewsPage,
        faqs: [{ question: "Is Stripe worth it?", answer: "Depends on your volume." }],
      },
    }) as never,
  );
  const faqNode = buildStructuredData("processorReviews", withFaqs, ctx).nodes.find(
    (n) => n["@type"] === "FAQPage",
  ) as { mainEntity: { name: string }[] };
  assert.equal(faqNode.mainEntity[0]?.name, "Is Stripe worth it?");

  // A block and the `faqs` field both produce FAQPage; one node per type, block wins.
  const both = toProcessorReviewsEnginePreview(
    previewValues({
      reviewsPage: {
        ...blankProcessorValues().reviewsPage,
        faqs: [{ question: "From the field", answer: "A" }],
        blocks: [
          {
            type: "faq",
            id: "b1",
            data: { items: [{ question: "From the block", answer: "A" }] },
          },
        ],
      },
    }) as never,
  );
  const result = buildStructuredData("processorReviews", both, ctx);
  const faqNodes = result.nodes.filter((n) => n["@type"] === "FAQPage");
  assert.equal(faqNodes.length, 1);
  assert.equal(
    ((faqNodes[0] as { mainEntity: { name: string }[] }).mainEntity[0] as { name: string }).name,
    "From the block",
  );
});
