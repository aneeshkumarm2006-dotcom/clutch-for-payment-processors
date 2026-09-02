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
import { hasReviewContent, REVIEW_CONTENT_SELECT } from "../../lib/reviews-indexability";
import { formatSubreddit, groupThemes, hasSentimentContent } from "../../lib/sentiment";

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

// ---------------------------------------------------------------------------
// Indexability: the route and the sitemap must answer identically
// ---------------------------------------------------------------------------

/**
 * The bug these pin: the route counted blocks and FAQs as content, the sitemap
 * counted only `ratingCount`. A processor with a written reviews page and no
 * merchant submissions yet was therefore indexable but never listed.
 *
 * Both sides now call `hasReviewContent`, so the cases below are the contract.
 */
test("an empty reviews page is not worth indexing", () => {
  assert.equal(hasReviewContent(0, [], []), false);
  assert.equal(hasReviewContent(0, undefined, undefined), false);
  assert.equal(hasReviewContent(0, null, null), false);
});

test("editorial sections alone make the page indexable, with no reviews on it", () => {
  assert.equal(hasReviewContent(0, [{ type: "richtext" }], []), true);
  assert.equal(hasReviewContent(0, [], [{ question: "q", answer: "a" }]), true);
});

test("approved reviews alone make the page indexable, with no editorial", () => {
  assert.equal(hasReviewContent(4, [], []), true);
  assert.equal(hasReviewContent(1, undefined, undefined), true);
});

test("the sitemap projection covers every field the rule reads", () => {
  // `getSitemapEntries` evaluates the rule against a projected document. A field
  // the rule reads but the projection omits arrives as `undefined`, and the rule
  // then answers "no content" for every processor without erroring.
  const selected = new Set(REVIEW_CONTENT_SELECT.split(/\s+/));
  assert.ok(selected.has("ratingCount"));
  assert.ok(selected.has("reviewsPage.blocks"));
  assert.ok(selected.has("reviewsPage.faqs"));
  assert.ok(selected.has("reviewsPage.googleReviews"));
  assert.ok(selected.has("reviewsPage.reddit"));
});

// ---------------------------------------------------------------------------
// Off-site sentiment (the Google + Reddit overviews)
//
// These sections are optional on every processor and used by very few, so their
// failure mode is not a crash. It is a section that quietly renders an empty
// card, or one an editor cleared that will not go away. Both live in the gap
// between "the form always submits this object" and "the object means nothing".
// ---------------------------------------------------------------------------

test("a section is only present once it says something", () => {
  assert.equal(hasSentimentContent(undefined), false);
  assert.equal(hasSentimentContent({}), false);
  // Chrome around nothing. A heading and a date are not content.
  assert.equal(
    hasSentimentContent({ heading: "What Google says", checkedOn: "August 2026" }),
    false,
  );

  assert.equal(hasSentimentContent({ summary: "Reviews arrived in a burst." }), true);
  assert.equal(hasSentimentContent({ rating: 4.8 }), true);
  // A zero is a real transcribed figure, not an absence.
  assert.equal(hasSentimentContent({ reviewCount: 0 }), true);
  assert.equal(hasSentimentContent({ themes: [{ label: "Support", tone: "negative" }] }), true);
  assert.equal(hasSentimentContent({ threads: [{ title: "t", url: "u" }] }), true);
  assert.equal(hasSentimentContent({ themes: [] }), false);
});

test("an off-site overview alone makes the page indexable", () => {
  // The state most of these processors are actually in: the discussion is on
  // Google and Reddit, nobody has reviewed them here, and there is no block.
  assert.equal(
    hasReviewContent(0, [], [], { googleReviews: { summary: "Scores cluster in January." } }),
    true,
  );
  assert.equal(
    hasReviewContent(0, [], [], { reddit: { threads: [{ title: "t", url: "u" }] } }),
    true,
  );
  // ...but an empty shell of a section does not, or every processor whose tab an
  // editor merely opened would land in the sitemap.
  assert.equal(hasReviewContent(0, [], [], { googleReviews: {}, reddit: {} }), false);
  assert.equal(hasReviewContent(0, [], [], { googleReviews: { heading: "x" } }), false);
});

test("an all-blank section is dropped, not saved as an empty object", () => {
  // The form renders both sections, so it submits both on every save. Without
  // the collapse in `validators/sentiment.ts` this would store a shell that reads
  // as "present" forever and could never be cleared.
  const parsed = reviewsPageSchema.parse(
    toReviewsPagePayload({
      ...blankProcessorValues().reviewsPage,
      heading: "Corepay reviews",
    }),
  );
  assert.equal(parsed?.googleReviews, undefined);
  assert.equal(parsed?.reddit, undefined);
  assert.equal(parsed?.heading, "Corepay reviews");
});

test("a filled section survives form to zod to serialize", () => {
  const values = blankProcessorValues().reviewsPage;
  values.googleReviews.rating = "4.8";
  values.googleReviews.reviewCount = "27";
  values.googleReviews.profileUrl = "https://maps.google.com/?cid=1";
  values.googleReviews.summary = "Eleven of the thirteen arrived in the same fortnight.";
  values.googleReviews.themes = [
    { label: "Underwriting speed", detail: "Live in three days", tone: "positive" },
    { label: "Rate transparency", detail: "", tone: "negative" },
  ];
  values.googleReviews.quotes = [
    {
      text: "Approved when nobody else would.",
      author: "Marcus T.",
      context: "Google review",
      date: "Jan 2026",
      rating: "5",
      url: "",
    },
  ];
  // Only two of the five histogram rows filled in. The other three carry a
  // non-blank `stars`, so the blank-row filter cannot see them as empty and the
  // required `count` would reject the save if the form sent them.
  values.googleReviews.breakdown[0]!.count = "24";
  values.googleReviews.breakdown[4]!.count = "1";
  values.reddit.tone = "mixed";
  values.reddit.subreddits = ["smallbusiness", "r/stripe"];
  values.reddit.threads = [
    {
      title: "Anyone using Corepay?",
      url: "https://reddit.com/r/x/1",
      subreddit: "r/x",
      date: "",
      takeaway: "",
      upvotes: "42",
      comments: "",
    },
  ];

  const parsed = reviewsPageSchema.parse(toReviewsPagePayload(values));
  assert.equal(parsed?.googleReviews?.rating, 4.8);
  assert.equal(parsed?.googleReviews?.reviewCount, 27);
  assert.equal(parsed?.googleReviews?.breakdown?.length, 2);
  assert.deepEqual(parsed?.googleReviews?.breakdown?.[0], { stars: 5, count: 24 });
  assert.equal(parsed?.googleReviews?.themes?.length, 2);
  // A quote with no link is still a quote: a blank URL must not fail the row.
  assert.equal(parsed?.googleReviews?.quotes?.[0]?.url, undefined);
  assert.equal(parsed?.reddit?.tone, "mixed");
  assert.equal(parsed?.reddit?.threads?.[0]?.upvotes, 42);
  assert.equal(parsed?.reddit?.threads?.[0]?.comments, undefined);

  // ...and back out through the public serializer the page actually reads.
  const data = toReviewsPageData(parsed);
  assert.equal(data?.googleReviews?.rating, 4.8);
  assert.equal(data?.reddit?.subreddits?.length, 2);
});

test("hydrating the edit form restores every stored section", () => {
  const stored = {
    googleReviews: {
      rating: 4.8,
      breakdown: [{ stars: 3, count: 2 }],
      themes: [{ label: "Support", detail: "Slow", tone: "negative" }],
    },
    reddit: { tone: "negative", subreddits: ["smallbusiness"] },
  };
  const values = toReviewsPageFormValues(stored);
  assert.equal(values.googleReviews.rating, "4.8");
  assert.equal(values.reddit.tone, "negative");
  // The histogram is always five rows in 5..1 order, whatever the document held.
  assert.deepEqual(
    values.googleReviews.breakdown.map((b) => b.stars),
    ["5", "4", "3", "2", "1"],
  );
  assert.equal(values.googleReviews.breakdown[2]?.count, "2");
  assert.equal(values.googleReviews.breakdown[0]?.count, "");
  assert.equal(values.googleReviews.themes[0]?.tone, "negative");
});

test("a mixed theme is a caveat, not praise", () => {
  // The public card has two columns. Filing an unresolved theme under "what they
  // praise" is how a review page loses a reader.
  const { positive, negative } = groupThemes([
    { label: "a", tone: "positive" },
    { label: "b", tone: "mixed" },
    { label: "c", tone: "negative" },
  ]);
  assert.deepEqual(
    positive.map((t) => t.label),
    ["a"],
  );
  assert.deepEqual(
    negative.map((t) => t.label),
    ["b", "c"],
  );
});

test("subreddits render the same however they were typed", () => {
  assert.equal(formatSubreddit("smallbusiness"), "r/smallbusiness");
  assert.equal(formatSubreddit("r/smallbusiness"), "r/smallbusiness");
  assert.equal(formatSubreddit("/r/smallbusiness"), "r/smallbusiness");
  assert.equal(formatSubreddit("  "), "");
});
