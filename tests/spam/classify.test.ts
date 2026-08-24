import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySubmission, type SpamInput } from "../../lib/spam/classify";
import { fingerprintPayload } from "../../lib/spam/fingerprint";
import { networkKey } from "../../lib/rate-limit";

/**
 * =========================================================================
 *  THE GENUINE BLOCK MATTERS MORE THAN THE SPAM BLOCK.
 *
 *  A future rule that breaks a case in GENUINE is WRONG, however much junk it
 *  catches. Every case in there is either a real enquiry this business has
 *  actually received or a shape it demonstrably sells to. Letting a bot through
 *  costs a few seconds of an operator's attention; filtering one of these costs
 *  a customer, silently, with nobody ever finding out.
 *
 *  If you are here because you added a rule and a GENUINE case went red: the
 *  rule is the thing to change.
 * =========================================================================
 *
 * A NOTE ON THE CORPUS. This site had received no real public spam when the
 * filter was written — every stored row was seed data or an internal test — so
 * the SPAM block is built from the shapes catalogued on the sister site rather
 * than from verbatim messages captured here. The two entries drawn from this
 * site's own database are marked `[corpus]`. As real spam arrives, paste it in
 * verbatim and assert the verdict it should have got.
 */

/** Defaults that isolate a case from the browser-proof rules. */
const base = (over: Partial<SpamInput>): SpamInput => ({
  form: "lead",
  text: {},
  renderAgeMs: 45_000, // a normal human fill
  ...over,
});

const verdictOf = (input: Partial<SpamInput>) => classifySubmission(base(input));

// ===========================================================================
// GENUINE — these must survive every future rule change.
// ===========================================================================

test("GENUINE · real enquiries from the database are all allowed", () => {
  const real: { name: string; email: string; businessName?: string; message: string }[] = [
    {
      name: "Carla Jimenez",
      email: "carla@summitdental.com",
      businessName: "Summit Dental Group",
      message: "Higher ticket sizes. Does the subscription pricing actually save us vs flat-rate?",
    },
    {
      name: "Rohan Gupta",
      email: "rohan@quickkart.in",
      businessName: "QuickKart",
      message: "Need UPI + cards with fast settlement for an Indian D2C brand.",
    },
    {
      name: "James Porter",
      email: "james@porterlegal.com",
      message:
        "Do you offer guidance on switching processors without downtime? Happy to jump on a call.",
    },
    {
      name: "Werner Klein",
      email: "w.klein@altmark-retail.de",
      businessName: "Altmark Retail GmbH",
      message:
        "Enterprise unified commerce across EU + US. Want to discuss interchange++ and settlement.",
    },
    {
      name: "Priscilla Adeyemi",
      email: "priscilla@lagosthreads.com",
      businessName: "Lagos Threads",
      message:
        "Selling into multiple countries. Which processor handles local methods and multi-currency best?",
    },
    {
      name: "Tom Whitfield",
      email: "tom@harborcafe.com",
      businessName: "Harbor Cafe",
      message: "Need tap-to-pay and tipping for a small cafe. How fast are payouts?",
    },
    {
      name: "Daniel Brooks",
      email: "dan@brooksboards.co",
      businessName: "Brooks Boards",
      message:
        "Opening a second location and need a POS + payments setup that won't lock me into a long contract.",
    },
  ];

  for (const lead of real) {
    const result = verdictOf({
      email: lead.email,
      selfNames: [lead.businessName],
      text: { name: lead.name, businessName: lead.businessName, message: lead.message },
    });
    assert.equal(
      result.verdict,
      "allow",
      `real enquiry from ${lead.name} was ${result.verdict} (${result.score}): ${result.reasons
        .map((r) => r.label)
        .join("; ")}`,
    );
  }
});

test("GENUINE · TRAP 1 — a budget in dollars is never a spam signal", () => {
  // Real enquiries say this constantly. Scoring a bare dollar figure deletes
  // the business.
  for (const message of [
    "Our budget is around $8k a month in processing fees. Where should we look?",
    "We do about $250,000 a month and pay 2.9% + $0.30. Can we do better?",
    "Happy to spend $500 a month on the gateway if the rates come down.",
  ]) {
    const result = verdictOf({ email: "ops@northlinewholesale.com", text: { message } });
    assert.equal(result.verdict, "allow", `"${message}" → ${result.verdict}: ${result.score}`);
    assert.equal(result.score, 0);
  }
});

test("GENUINE · TRAP 2 — a prospect linking their OWN site is not link spam", () => {
  // Matched via the sender's email domain.
  const viaEmail = verdictOf({
    email: "alicia@brightcartshop.com",
    selfNames: ["BrightCart"],
    text: {
      message:
        "Our store is https://brightcartshop.com — we're moving off a tiered plan and want to compare effective rates.",
    },
  });
  assert.equal(viaEmail.verdict, "allow");
  assert.equal(viaEmail.score, 0, viaEmail.reasons.map((r) => r.label).join("; "));

  // Matched via the company name, because the prospect is on a free mailbox.
  const viaCompanyName = verdictOf({
    email: "daniel.brooks@gmail.com",
    selfNames: ["Brooks Boards"],
    text: { message: "Site is brooksboards.co if it helps. Opening a second location in March." },
  });
  assert.equal(viaCompanyName.verdict, "allow");
  assert.equal(viaCompanyName.score, 0, viaCompanyName.reasons.map((r) => r.label).join("; "));

  // A single genuinely foreign link is scored, but BELOW the quarantine line —
  // prospects name their platform all the time.
  const foreign = verdictOf({
    email: "priscilla@gmail.com",
    selfNames: ["Lagos Threads"],
    text: { message: "Our storefront runs on shopify.com and we need a gateway that plugs in." },
  });
  assert.equal(foreign.verdict, "allow");
  assert.ok(foreign.score > 0 && foreign.score < 3, `expected 0 < score < 3, got ${foreign.score}`);
});

test("GENUINE · TRAP 3 — ordinary words are not keyboard mash", () => {
  // A vowel-ratio test calls both of these gibberish. A consonant-run test does
  // not, and neither does anything else in English — "strengths" tops out at 5.
  const result = verdictOf({
    email: "hello@example-client.com",
    text: {
      message:
        "We're exploring a partnership and have several projects lined up. Our strengths are subscriptions and rhythm-based billing.",
    },
  });
  assert.equal(result.verdict, "allow");
  assert.equal(result.score, 0, result.reasons.map((r) => r.label).join("; "));
});

test("GENUINE · a buyer using the spammers' vocabulary is still the buyer", () => {
  // Direction, not topic. Every one of these is someone who wants to BUY.
  for (const message of [
    "We need help ranking on Google for payment terms — do you sell sponsored placements?",
    "Trying to increase our traffic from organic search. Is a listing on your directory worth it?",
    "Can you help us get on the first page for 'high risk merchant account'?",
  ]) {
    const result = verdictOf({ email: "growth@realmerchant.com", text: { message } });
    assert.equal(
      result.verdict,
      "allow",
      `"${message}" → ${result.verdict}: ${result.reasons.map((r) => r.label).join("; ")}`,
    );
  }
});

test("GENUINE · a merchant who runs discounts is not a discount spammer", () => {
  const result = verdictOf({
    email: "ops@harborcafe.com",
    text: {
      message:
        "We run 50% off flash sales twice a year and need a processor that survives the volume spike without holding funds.",
    },
  });
  assert.equal(result.verdict, "allow", result.reasons.map((r) => r.label).join("; "));
});

test("GENUINE · a cross-border merchant offering WhatsApp still gets through", () => {
  // The playbook treats an off-platform handle as always-safe to score. This
  // site sells to merchants in India, Nigeria and the Gulf who genuinely do
  // reach out this way, so it is weighted below the quarantine line here.
  const result = verdictOf({
    email: "rohan@quickkart.in",
    selfNames: ["QuickKart"],
    text: {
      message: "Need UPI + cards with fast settlement. Easiest to reach me on WhatsApp +91 98201 55512.",
    },
  });
  assert.equal(result.verdict, "allow", result.reasons.map((r) => r.label).join("; "));
});

test("GENUINE · someone reporting an error on one of our pages is a correction, not outreach", () => {
  // The contact form's own placeholder invites corrections. A deep link into
  // our site reads as one; a bare mail-merged domain does not.
  const result = verdictOf({
    email: "editor@fintechwatch.co",
    text: {
      message:
        "The fee table on https://paymentprocessingguide.com/payment-processors/stripe is out of date — Stripe changed its instant payout fee in June.",
    },
  });
  assert.equal(result.verdict, "allow", result.reasons.map((r) => r.label).join("; "));
});

test("GENUINE · a missing browser stamp alone never blocks a submission", () => {
  // Right after a deploy a browser can be holding a stale cached bundle that
  // doesn't send the stamp. That visitor must not lose their enquiry.
  const result = classifySubmission({
    form: "lead",
    email: "tom@harborcafe.com",
    text: { message: "Need tap-to-pay and tipping for a small cafe. How fast are payouts?" },
    // no renderAgeMs at all
  });
  assert.equal(result.verdict, "allow", result.reasons.map((r) => r.label).join("; "));
  assert.ok(result.score < 3, `a missing stamp must stay under the quarantine line, got ${result.score}`);
});

test("GENUINE · a vendor pitching on /for-processors is using the form correctly", () => {
  // Form-awareness: this exact copy would be an agency pitch on the contact
  // form. On the get-listed form it is the entire point of the page.
  const result = verdictOf({
    form: "submission",
    email: "partnerships@paddle.com",
    selfNames: ["Paddle"],
    declaredUrls: ["https://www.paddle.com"],
    text: {
      processorName: "Paddle",
      contactName: "Eleanor Voss",
      description:
        "We are a leading merchant of record for SaaS. We handle payments, sales tax, and subscription billing globally. We'd like a listing in Subscriptions & SaaS — would you be interested in featuring our service?",
    },
  });
  assert.equal(result.verdict, "allow", result.reasons.map((r) => r.label).join("; "));
});

test("GENUINE · [corpus] real get-listed submissions are allowed", () => {
  const submissions = [
    {
      processorName: "Mollie",
      website: "https://www.mollie.com",
      contactName: "Lieke de Vries",
      contactEmail: "lieke@mollie.com",
      description:
        "European PSP with local methods (iDEAL, Bancontact, SEPA) and simple pricing. Requesting an International & Cross-Border listing.",
    },
    {
      processorName: "GoCardless",
      website: "https://gocardless.com",
      contactName: "Owen Pryce",
      contactEmail: "owen.pryce@gocardless.com",
      description:
        "Bank debit / ACH-first recurring payments across the UK, EU, and US. Great fit for subscriptions and B2B.",
    },
    {
      processorName: "Checkout.com",
      website: "https://www.checkout.com",
      contactName: "Sophia Almeida",
      contactEmail: "sophia.almeida@checkout.com",
      description:
        "Enterprise-grade global payments with direct acquiring and granular data. Requesting a premier listing for the e-commerce and marketplaces categories.",
    },
  ];

  for (const sub of submissions) {
    const result = verdictOf({
      form: "submission",
      email: sub.contactEmail,
      selfNames: [sub.processorName],
      declaredUrls: [sub.website],
      text: {
        processorName: sub.processorName,
        contactName: sub.contactName,
        description: sub.description,
      },
    });
    assert.equal(
      result.verdict,
      "allow",
      `${sub.processorName} → ${result.verdict}: ${result.reasons.map((r) => r.label).join("; ")}`,
    );
  }
});

test("GENUINE · our own domain is whitelisted so internal tests always land", () => {
  // Deliberately spammy body. The whitelist must win: if an internal test
  // submission gets filtered, the first check anyone runs after a deploy looks
  // like a broken form.
  const result = verdictOf({
    email: "prem@davnoot.com",
    honeypot: true,
    text: { message: "50% OFF today only! Unsubscribe here http://spam.example.net/u" },
  });
  assert.equal(result.verdict, "allow");
  assert.equal(result.score, 0);
});

test("GENUINE · a short real review is allowed", () => {
  const result = verdictOf({
    form: "review",
    email: "meera@northlinewholesale.com",
    selfNames: ["Northline Wholesale"],
    text: {
      reviewerName: "Meera Krishnan",
      companyName: "Northline Wholesale",
      title: "Solid for B2B invoicing, support is slow",
      body: "Interchange-plus pricing has saved us about 0.4% versus our old flat-rate plan. Settlement is next-day. Support takes two days to answer anything complicated.",
      pros: "Transparent pricing, good API docs",
      cons: "Support response times",
    },
  });
  assert.equal(result.verdict, "allow", result.reasons.map((r) => r.label).join("; "));
});

// ===========================================================================
// SPAM — the shapes the filter exists to stop.
// ===========================================================================

test("SPAM · classic SEO agency outreach is rejected", () => {
  const result = verdictOf({
    email: "marketing@rankfast-agency.net",
    text: {
      name: "Steve",
      message:
        "Hi, I came across your website paymentprocessingguide.com and noticed it is not ranking for many keywords. We can get you ranking on the first page of Google within 90 days. Reply YES and I will send over our packages. Unsubscribe: http://mailer.rankfast-agency.net/u/123",
    },
  });
  assert.equal(result.verdict, "reject");
  assert.ok(
    result.reasons.some((r) => r.code === "own-domain-templated"),
    "should notice our own domain mail-merged into the body",
  );
  assert.ok(result.reasons.some((r) => r.category === "seo-outreach"));
});

test("SPAM · retail promo blast is rejected", () => {
  const result = verdictOf({
    email: "sales@dealsdaily.example",
    text: {
      message:
        "50% OFF today only! FREE shipping on all orders. Use discount code SAVE50 at checkout. Shop now before it ends!",
    },
  });
  assert.equal(result.verdict, "reject");
  assert.equal(result.category, "retail-promo");
});

test("SPAM · a link-building pitch is spam even on the get-listed form", () => {
  // Form-awareness suppresses the generic agency framing here, but a guest-post
  // pitch is not a processor listing under any reading of that page.
  const result = verdictOf({
    form: "submission",
    email: "outreach@linkfarm.example",
    text: {
      processorName: "Finance Blog Network",
      contactName: "Raj",
      description:
        "We provide high quality guest post and link building services on finance blogs. Do-follow link included in every placement.",
    },
  });
  assert.equal(result.verdict, "reject");
  assert.equal(result.category, "seo-outreach");
});

test("SPAM · a bulk-mail footer alone is enough to quarantine, two are enough to reject", () => {
  const one = verdictOf({
    email: "news@blast.example",
    text: { message: "Please find our latest catalogue attached. Unsubscribe at any time." },
  });
  assert.equal(one.verdict, "quarantine");
  assert.equal(one.category, "bulk-mail");

  const two = verdictOf({
    email: "news@blast.example",
    text: {
      message:
        "Please find our catalogue attached. You are receiving this email because you subscribed. Unsubscribe here.",
    },
  });
  assert.equal(two.verdict, "reject");
});

test("SPAM · the honeypot is a hard reject", () => {
  const result = verdictOf({
    email: "bot@example.net",
    honeypot: true,
    text: { name: "Bot", message: "Hello" },
  });
  assert.equal(result.verdict, "reject");
  assert.equal(result.category, "honeypot");
});

test("SPAM · a select value the form cannot emit is a hard reject", () => {
  const result = verdictOf({
    form: "submission",
    email: "someone@example.net",
    impossibleFields: ["requestedTier"],
    text: { processorName: "Acme", description: "Please list us." },
  });
  assert.equal(result.verdict, "reject");
  assert.equal(result.category, "impossible-field");
});

test("SPAM · sub-3-second submissions are flagged, and tip anything else over", () => {
  const fastOnly = verdictOf({
    renderAgeMs: 800,
    email: "bot@example.net",
    text: { message: "Interested in your service, please contact me back." },
  });
  assert.equal(fastOnly.verdict, "quarantine", "too-fast alone should not hard-reject");

  // Note the link host must be genuinely foreign to score: a URL on the
  // sender's own domain is discounted, subdomains included.
  const fastPlusLink = verdictOf({
    renderAgeMs: 400,
    email: "bot@example.net",
    text: { message: "Check out http://cheap-pills.pharma-deals.example for great deals." },
  });
  assert.equal(fastPlusLink.verdict, "reject");
});

test("SPAM · a replayed payload across harvested addresses is caught", () => {
  const dupeOnly = verdictOf({
    isDuplicate: true,
    email: "victim1@example.net",
    text: { message: "Hello, I would like to discuss a business opportunity with your team." },
  });
  assert.equal(dupeOnly.verdict, "quarantine");

  // The same replay from a direct POST (no browser stamp) crosses the line.
  const dupeNoStamp = classifySubmission({
    form: "lead",
    isDuplicate: true,
    email: "victim2@example.net",
    text: { message: "Hello, I would like to discuss a business opportunity with your team." },
  });
  assert.equal(dupeNoStamp.verdict, "reject");
});

test("SPAM · keyboard mash is caught by consonant runs", () => {
  const result = verdictOf({
    email: "asdf@example.net",
    text: { name: "asdfghjkl", message: "qwrtypsdfghjkl zxcvbnmqwrt" },
  });
  assert.equal(result.verdict, "quarantine");
  assert.equal(result.category, "gibberish");
});

test("SPAM · a request to be added to a mailing list is quarantined", () => {
  const result = verdictOf({
    email: "someone@example.net",
    text: { message: "Please add me to your mailing list and send me your offers every week." },
  });
  assert.equal(result.verdict, "quarantine");
  assert.equal(result.category, "mailing-list");
});

test("SPAM · [corpus] the unverifiable-claims submission is quarantined, not silently kept", () => {
  // From this site's own database — a get-listed submission a human rejected by
  // hand with the note "unverifiable claims, no public pricing, domain
  // registered recently. Possible spam." The classifier reaches the same place
  // the human did: suspicious enough to hold back, not certain enough to bin.
  const result = classifySubmission({
    form: "submission",
    email: "marcus@quickpay-solutions-pay.biz",
    selfNames: ["QuickPay Solutions"],
    declaredUrls: ["http://quickpay-solutions-pay.biz"],
    text: {
      processorName: "QuickPay Solutions",
      contactName: "Marcus Lane",
      description: "We guarantee the lowest rates anywhere, instant approval for any business!!!",
    },
    // No render stamp: this is what the same payload looks like arriving today
    // as a direct POST. Replayed through the backfill (which switches the
    // browser proof off for rows that predate it) it scores 2 and is allowed.
  });
  assert.equal(result.verdict, "quarantine", result.reasons.map((r) => r.label).join("; "));
});

// ===========================================================================
// Supporting units — the two pieces the classifier depends on but does not own.
// ===========================================================================

test("fingerprint ignores the email address, so a replay across addresses collides", () => {
  const message =
    "Hello, we would like to discuss a partnership opportunity with your company this quarter.";
  const a = fingerprintPayload(["Alice", "Acme", message]);
  const b = fingerprintPayload(["Alice", "Acme", message]);
  assert.equal(a, b);
  assert.ok(a);

  // Trivial reformatting must not mint a fresh fingerprint.
  const reformatted = fingerprintPayload(["alice", "acme", message.toUpperCase() + "  "]);
  assert.equal(reformatted, a);

  // Too little text to be evidence of anything.
  assert.equal(fingerprintPayload(["Bob", "call me"]), null);
});

test("networkKey collapses an address to its neighbourhood", () => {
  assert.equal(networkKey("203.0.113.44"), "203.0.113.0/24");
  assert.equal(networkKey("203.0.113.201"), "203.0.113.0/24");
  assert.notEqual(networkKey("203.0.114.44"), networkKey("203.0.113.44"));
  assert.equal(networkKey("::ffff:203.0.113.7"), "203.0.113.0/24");
  assert.equal(networkKey("2001:db8:1234:5678::1"), "2001:db8:1234::/48");
  assert.equal(networkKey("unknown"), null);
  assert.equal(networkKey(""), null);
});
