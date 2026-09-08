import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStructuredData } from "../../lib/engine";
import { processorInput } from "../../lib/validators/processor";
import {
  blankProcessorValues,
  toProcessorPayload,
} from "../../components/admin/processors/serialize";
import { absoluteUrl, webPageJsonLd } from "../../lib/seo";
import { resolveFreshness } from "../../components/public/LastVerified";

/**
 * The "last verified" freshness stamp.
 *
 * The thing worth pinning here is not that a date renders — it is the DISTINCTION
 * between the two dates. `dateModified` says the document was written to;
 * `lastReviewed` says a human checked the fees. If a refactor ever lets the second
 * fall back to the first, every listing on the site starts claiming a verification
 * pass that nobody performed, and nothing about the page would look wrong. That is
 * the same failure the seeded 4.5-star reviews were, one field over.
 */

const ctx = { siteName: "Test", siteUrl: "https://example.com" };

const entity = (data: Record<string, unknown>) => ({
  contentType: "processor",
  path: "/processor/stripe",
  data: { name: "Stripe", slug: "stripe", ...data },
});

const webPage = (data: Record<string, unknown>) =>
  buildStructuredData("processor", entity(data) as never, ctx).nodes.find(
    (n) => n["@type"] === "WebPage",
  ) as Record<string, unknown> | undefined;

// ---------------------------------------------------------------------------
// The two dates are not interchangeable
// ---------------------------------------------------------------------------

test("an edit date alone emits dateModified and NEVER lastReviewed", () => {
  const node = webPage({ dateModified: "2026-09-01T12:30:00.000Z" });
  assert.ok(node, "the WebPage node should be emitted");
  assert.equal(node!.dateModified, "2026-09-01");
  assert.equal(node!.lastReviewed, undefined);
});

test("a verification stamp emits lastReviewed alongside dateModified", () => {
  const node = webPage({
    dateModified: "2026-09-08T09:00:00.000Z",
    lastReviewed: "2026-08-14T00:00:00.000Z",
  });
  assert.equal(node!.dateModified, "2026-09-08");
  assert.equal(node!.lastReviewed, "2026-08-14");
});

test("dates are days, not timestamps (schema.org types both as Date)", () => {
  const node = webPage({ lastReviewed: "2026-08-14T23:59:59.999Z" });
  assert.equal(node!.lastReviewed, "2026-08-14");
  assert.ok(!String(node!.lastReviewed).includes("T"));
});

test("a listing with neither date still emits a valid WebPage, with no date keys", () => {
  const node = webPage({});
  assert.ok(node, "url alone satisfies the node's required fields");
  assert.equal(node!.url, absoluteUrl("/processor/stripe"));
  assert.ok(!("dateModified" in node!));
  assert.ok(!("lastReviewed" in node!));
});

// ---------------------------------------------------------------------------
// Node shape
// ---------------------------------------------------------------------------

test("freshness rides a WebPage, never the Product", () => {
  const { nodes } = buildStructuredData(
    "processor",
    entity({ ratingAverage: 4.2, ratingCount: 9, dateModified: "2026-09-01", lastReviewed: "2026-09-01" }) as never,
    ctx,
  );
  const product = nodes.find((n) => n["@type"] === "Product")!;
  // `dateModified`/`lastReviewed` are CreativeWork properties. On a Product they
  // are out-of-domain, which is the markup-error class this site already had to
  // clean up once (the priceless Offer).
  assert.equal(product.dateModified, undefined);
  assert.equal(product.lastReviewed, undefined);
});

test("the WebPage points at the Product it describes, by the profile's stable @id", () => {
  const node = webPage({ dateModified: "2026-09-01" })!;
  assert.deepEqual(node.mainEntity, { "@id": `${absoluteUrl("/processor/stripe")}#product` });
  assert.equal(node["@id"], `${absoluteUrl("/processor/stripe")}#webpage`);
});

test("a reviews page with no rating does not point mainEntity at an absent Product", () => {
  const { nodes } = buildStructuredData(
    "processorReviews",
    {
      contentType: "processorReviews",
      path: "/processor/stripe/reviews",
      data: { name: "Stripe", slug: "stripe", ratingCount: 0, dateModified: "2026-09-01" },
    } as never,
    ctx,
  );
  assert.equal(nodes.find((n) => n["@type"] === "Product"), undefined);
  const node = nodes.find((n) => n["@type"] === "WebPage")!;
  assert.equal(node.mainEntity, undefined);
  assert.equal(node["@id"], `${absoluteUrl("/processor/stripe/reviews")}#webpage`);
});

test("the builder tolerates an absent mainEntity target without emitting a null", () => {
  const node = webPageJsonLd({ path: "/processor/stripe" });
  assert.equal(node.mainEntity, undefined);
});

// ---------------------------------------------------------------------------
// Form → zod round trip
// ---------------------------------------------------------------------------

test("a blank date clears the stamp instead of becoming 1970", () => {
  const payload = toProcessorPayload(
    { ...blankProcessorValues(), name: "Stripe", website: "https://stripe.com" },
    false,
  );
  assert.equal(payload.lastVerifiedAt, "");
  // `emptyToUndefined` runs before `z.coerce.date()`, which would otherwise read
  // "" as the epoch and stamp every unverified listing 1 Jan 1970.
  const parsed = processorInput.parse(payload);
  assert.equal(parsed.lastVerifiedAt, undefined);
});

test("a date input value survives to a Date", () => {
  const payload = toProcessorPayload(
    {
      ...blankProcessorValues(),
      name: "Stripe",
      website: "https://stripe.com",
      lastVerifiedAt: "2026-08-14",
    },
    false,
  );
  const parsed = processorInput.parse(payload);
  assert.ok(parsed.lastVerifiedAt instanceof Date);
  assert.equal(parsed.lastVerifiedAt!.toISOString().slice(0, 10), "2026-08-14");
});

test("a future verification date is rejected", () => {
  const payload = toProcessorPayload(
    {
      ...blankProcessorValues(),
      name: "Stripe",
      website: "https://stripe.com",
      lastVerifiedAt: "2999-01-01",
    },
    false,
  );
  assert.throws(() => processorInput.parse(payload), /future/i);
});

test("today is accepted however long the server has been up", () => {
  // The bound is computed at validation time, not module load. A `.max(new Date())`
  // frozen at import would start rejecting "today" the day after a deploy.
  const today = new Date().toISOString().slice(0, 10);
  const payload = toProcessorPayload(
    { ...blankProcessorValues(), name: "Stripe", website: "https://stripe.com", lastVerifiedAt: today },
    false,
  );
  assert.doesNotThrow(() => processorInput.parse(payload));
});

// ---------------------------------------------------------------------------
// What the page actually claims
// ---------------------------------------------------------------------------

test("an unverified listing says 'Listing updated', never 'verified'", () => {
  const f = resolveFreshness(undefined, "2026-09-08T19:00:00.000Z")!;
  assert.equal(f.verified, false);
  assert.equal(f.label, "Listing updated");
  assert.doesNotMatch(f.title, /checked/);
});

test("a stamped listing makes the stronger claim, and the stamp wins the date", () => {
  const f = resolveFreshness("2026-08-14T00:00:00.000Z", "2026-09-08T19:00:00.000Z")!;
  assert.equal(f.verified, true);
  assert.equal(f.label, "Fees verified");
  // Showing the later edit date under a "verified" label would quietly upgrade
  // "edited on the 8th" into "verified on the 8th".
  assert.equal(f.day, "2026-08-14");
});

test("the machine-readable day and the visible date name the same day", () => {
  // A timestamp late in a UTC day formatted in the render machine's local zone
  // used to ship `<time datetime="2026-09-08">Sep 9, 2026</time>` from UTC+5:30.
  const f = resolveFreshness(undefined, "2026-09-08T19:00:00.000Z")!;
  assert.equal(f.day, "2026-09-08");
  assert.equal(f.display, "Sep 8, 2026");
});

test("no date, and an unparseable one, both render nothing", () => {
  assert.equal(resolveFreshness(undefined, undefined), null);
  assert.equal(resolveFreshness("", ""), null);
  assert.equal(resolveFreshness(undefined, "not a date"), null);
});
