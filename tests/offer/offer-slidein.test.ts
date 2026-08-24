import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COOLDOWN_DAYS,
  CONVERTED_COOLDOWN_DAYS,
  MIN_SCROLL_PX,
  OFFER_COPY,
  SCROLL_TRIGGER,
  isSuppressed,
  offerPageType,
} from "../../config/offer-slidein";
import { classifySubmission } from "../../lib/spam/classify";
import { toSpamInput } from "../../lib/spam/fields";
import { fingerprintPayload } from "../../lib/spam/fingerprint";
import { FORM_SPECS } from "../../lib/spam/fields";

/**
 * =========================================================================
 *  The fee-sheet slide-in.
 *
 *  Two things here are load-bearing and neither is visible from the markup:
 *
 *  1. A one-field form has NO text for the spam classifier to read. Every
 *     content rule scores zero, so the only thing standing between this form
 *     and the quarantine bin is the structural checks. If a future rule starts
 *     penalising an empty payload, every real signup goes to spam silently.
 *
 *  2. The frequency policy is the entire ethical case for firing this on every
 *     comparison page and every blog post. If the cooldown regresses, the site
 *     starts nagging its own readers.
 * =========================================================================
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

// ===========================================================================
// Targeting
// ===========================================================================

test("targeting · fires on comparison pages and blog posts", () => {
  assert.equal(offerPageType("/compare"), "compare");
  assert.equal(offerPageType("/compare/stripe-vs-square"), "compare");
  assert.equal(offerPageType("/alternatives/stripe"), "alternatives");
  assert.equal(offerPageType("/blog/how-interchange-plus-pricing-works"), "blog");
});

test("targeting · the blog INDEX is not a blog post", () => {
  // Someone scanning a list of headlines has not read anything yet. An offer
  // there is interruption without earned attention.
  assert.equal(offerPageType("/blog"), null);
});

test("targeting · leaves the rest of the site alone", () => {
  for (const path of [
    "/",
    "/processors",
    "/payment-processors",
    "/processor/stripe",
    "/category/ecommerce",
    "/contact",
    "/write-review",
    "/for-processors",
    "/admin/leads",
  ]) {
    assert.equal(offerPageType(path), null, `${path} should not arm the slide-in`);
  }
});

test("targeting · a path that merely starts with the same letters is not a match", () => {
  // `/comparex` and `/blogroll` must not slip through a naive prefix test.
  assert.equal(offerPageType("/comparex"), null);
  assert.equal(offerPageType("/blogroll"), null);
});

// ===========================================================================
// Frequency — the promise the widget makes to the reader.
// ===========================================================================

test("frequency · a first-time visitor sees it", () => {
  assert.equal(isSuppressed({}, NOW), false);
});

test("frequency · once seen, silent for 21 days, then eligible again", () => {
  assert.equal(COOLDOWN_DAYS, 21);
  assert.equal(isSuppressed({ shownAt: NOW - 1 * DAY }, NOW), true);
  assert.equal(isSuppressed({ shownAt: NOW - 20.9 * DAY }, NOW), true);
  assert.equal(isSuppressed({ shownAt: NOW - 21.1 * DAY }, NOW), false);
});

test("frequency · someone who already signed up is left alone far longer", () => {
  // They HAVE the sheet. Re-offering it three weeks later is the fastest way to
  // make a returning reader resent the site.
  assert.ok(CONVERTED_COOLDOWN_DAYS > COOLDOWN_DAYS * 4);
  assert.equal(isSuppressed({ convertedAt: NOW - 30 * DAY }, NOW), true);
  assert.equal(isSuppressed({ convertedAt: NOW - 200 * DAY }, NOW), true);
  assert.equal(isSuppressed({ convertedAt: NOW - 366 * DAY }, NOW), false);
});

test("frequency · a conversion outranks a stale impression", () => {
  // Seen a month ago (cooldown expired) but converted last week: still silent.
  const rec = { shownAt: NOW - 40 * DAY, convertedAt: NOW - 7 * DAY };
  assert.equal(isSuppressed(rec, NOW), true);
});

test("frequency · junk in storage never suppresses", () => {
  // A visitor whose stored record is garbage must still be offered the sheet
  // rather than silently opted out forever.
  assert.equal(isSuppressed({ shownAt: undefined, convertedAt: undefined }, NOW), false);
  assert.equal(isSuppressed({ shownAt: NaN }, NOW), false);
});

// ===========================================================================
// Trigger thresholds
// ===========================================================================

test("trigger · 60% scroll depth, with an absolute floor underneath it", () => {
  assert.equal(SCROLL_TRIGGER, 0.6);
  // The percentage alone would fire 180px into a barely-scrollable page, which
  // reads as a pop-up rather than an offer.
  assert.ok(MIN_SCROLL_PX >= 400);
});

// ===========================================================================
// Spam — the part with no text in it.
// ===========================================================================

const offerInput = (raw: Record<string, unknown>, extras = {}) =>
  toSpamInput("offer", raw, { renderAgeMs: 45_000, ...extras });

test("GENUINE · a plain email-only signup is allowed", () => {
  const result = classifySubmission(offerInput({ email: "ops@northlanecoffee.com" }));
  assert.equal(result.verdict, "allow");
  assert.equal(result.score, 0);
});

test("GENUINE · a signup with a volume answer is allowed", () => {
  const result = classifySubmission(
    offerInput({ email: "finance@meridianretail.co.uk", volume: "$50k+" }),
  );
  assert.equal(result.verdict, "allow");
});

test("GENUINE · a free-mail address is not suspicious on a download form", () => {
  // Most people grabbing a fee sheet are not doing it from a corporate domain.
  for (const email of ["jodie.marsh91@gmail.com", "s.okafor@outlook.com", "kev@yahoo.co.uk"]) {
    assert.equal(classifySubmission(offerInput({ email })).verdict, "allow", email);
  }
});

test("GENUINE · a slow reader is never penalised for a long dwell", () => {
  // The widget mounts at page load, so the stamp measures time on the page.
  // Twenty minutes of reading before signing up is the normal case, not a flag.
  const result = classifySubmission(
    offerInput({ email: "hello@bramblebakery.com" }, { renderAgeMs: 20 * 60_000 }),
  );
  assert.equal(result.verdict, "allow");
});

test("SPAM · the honeypot is still a hard reject with no text to read", () => {
  const result = classifySubmission(
    offerInput({ email: "x@spam.example" }, { honeypot: true }),
  );
  assert.equal(result.verdict, "reject");
});

test("SPAM · a volume the dropdown cannot emit is a hard reject", () => {
  // Three options are rendered. Anything else means the payload was assembled,
  // not filled in.
  const result = classifySubmission(offerInput({ email: "x@spam.example", volume: "$900M+" }));
  assert.equal(result.verdict, "reject");
  assert.ok(result.reasons.some((r) => r.code === "impossible-field"));
});

test("SPAM · a scripted post that never loaded the form is flagged", () => {
  const result = classifySubmission(
    offerInput({ email: "x@spam.example" }, { renderAgeMs: undefined }),
  );
  assert.ok(result.score > 0);
});

test("spam · the offer form deliberately fingerprints nothing", () => {
  // The duplicate-payload hash excludes the email by design, which would leave
  // this form with nothing to hash. Duplicate ADDRESSES are handled by the
  // unique index on the collection instead, which upserts rather than inserts.
  assert.deepEqual(FORM_SPECS.offer.fingerprintFields, []);
  assert.equal(fingerprintPayload(FORM_SPECS.offer.fingerprintFields), null);
});

// ===========================================================================
// Copy
// ===========================================================================

test("copy · the offer carries the brief verbatim, split at the dash", () => {
  // The house rule forbids em dashes in visitor-facing copy, so the brief's one
  // sentence becomes a headline and a supporting line. Both halves must survive.
  assert.equal(OFFER_COPY.heading, "Get the processor fee comparison sheet");
  assert.equal(OFFER_COPY.body, "Effective rates for the top 20 providers, updated monthly.");
});

test("copy · no visitor-facing string contains a dash character", () => {
  const dashes = /[—–―]/;
  for (const [key, value] of Object.entries(OFFER_COPY)) {
    assert.equal(dashes.test(value), false, `OFFER_COPY.${key} contains a dash: ${value}`);
  }
});
