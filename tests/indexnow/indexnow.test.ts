import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE_URL, absoluteUrl } from "../../lib/seo";
import { submitIndexNow, toSubmittableUrl } from "../../lib/indexnow";

/**
 * IndexNow submissions are unauthenticated, irreversible and invisible: there is
 * no UI that shows what was sent, and a bad payload shows up weeks later as
 * Bing's "submitted URL marked noindex" or a run of 422s nobody is watching.
 *
 * The two things worth pinning are the two that silently do damage:
 *
 *   1. WHAT gets submitted. A noindexed, cross-origin or query-stringed URL
 *      contradicts what the page itself says, which is the same error the
 *      sitemap's indexable filters exist to prevent.
 *   2. WHEN nothing gets submitted. The gate is the only thing stopping a
 *      preview deployment from asking five engines to recrawl production off a
 *      build nobody shipped, and the only thing stopping a missing key from
 *      producing a run of 403s.
 *
 * EVERY test that could reach the endpoint runs inside `withStubbedFetch`. One
 * that did not would submit this repo's URLs under a made-up key on every
 * `npm test`, which is both wrong and a fast way to get the domain distrusted.
 * (Written after exactly that happened: "too-short" is nine characters, passed
 * the 8-to-128 rule the test meant to trip, and went out over the wire.)
 */

const origin = new URL(SITE_URL).origin;
const TEST_KEY = "a-valid-looking-key-1234";

async function withStubbedFetch<T>(
  opts: { status?: number; key?: string | null },
  fn: (calls: { url: string; body: Record<string, unknown> }[]) => Promise<T>,
): Promise<T> {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const realWarn = console.warn;
  const key = process.env.INDEXNOW_KEY;
  const calls: { url: string; body: Record<string, unknown> }[] = [];

  globalThis.fetch = (async (input: unknown, init?: { body?: string }) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(null, { status: opts.status ?? 200 });
  }) as unknown as typeof fetch;

  const testKey = opts.key === undefined ? TEST_KEY : opts.key;
  if (testKey === null) delete process.env.INDEXNOW_KEY;
  else process.env.INDEXNOW_KEY = testKey;

  // The rejection paths log loudly by design. That is the point in production
  // and pure noise in a 600-test run, so the expected shout is swallowed here.
  console.error = () => {};
  console.warn = () => {};

  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    console.warn = realWarn;
    if (key === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = key;
  }
}

test("a site-relative path becomes an absolute URL on this origin", () => {
  assert.equal(toSubmittableUrl("/blog/my-post"), `${origin}/blog/my-post`);
  assert.equal(toSubmittableUrl("blog/my-post"), `${origin}/blog/my-post`);
  assert.equal(toSubmittableUrl(absoluteUrl("/processor/stripe")), `${origin}/processor/stripe`);
});

test("a trailing slash does not create a second URL for one page", () => {
  assert.equal(toSubmittableUrl("/blog/"), toSubmittableUrl("/blog"));
  // The root is the one path whose trailing slash IS the path.
  assert.equal(toSubmittableUrl("/"), `${origin}/`);
});

test("another origin is never submitted", () => {
  // Submitting a URL we do not own is a 422, and on a key the engines trust it
  // is the shape of an abuse report.
  assert.equal(toSubmittableUrl("https://stripe.com/pricing"), null);
  assert.equal(toSubmittableUrl("https://evil.example/blog/my-post"), null);
});

test("a query string or fragment is not a canonical URL", () => {
  // `/compare?ids=a,b` is the combinatorial shape the page noindexes itself on.
  assert.equal(toSubmittableUrl("/compare?ids=stripe,paypal"), null);
  assert.equal(toSubmittableUrl("/search?q=stripe"), null);
  assert.equal(toSubmittableUrl("/blog/my-post#section"), null);
  // The bare landing page is indexable and stays submittable.
  assert.equal(toSubmittableUrl("/compare"), `${origin}/compare`);
  assert.equal(toSubmittableUrl("/compare/stripe-vs-paypal"), `${origin}/compare/stripe-vs-paypal`);
});

test("force-noindexed routes and private surfaces are dropped", () => {
  for (const path of [
    "/search",
    "/write-review",
    "/write-review/stripe",
    "/admin",
    "/admin/blog",
    "/seoteam",
    "/analyticshub",
    "/api/sitemap",
  ]) {
    assert.equal(toSubmittableUrl(path), null, `${path} must never be submitted`);
  }
});

test("empty, malformed and non-http values are dropped, not mangled", () => {
  for (const value of ["", "   ", "data:image/png;base64,abc", "mailto:a@b.co", "javascript:x"]) {
    assert.equal(toSubmittableUrl(value), null, `${JSON.stringify(value)} must not be submitted`);
  }
});

test("no key means no submission, and no throw", async () => {
  await withStubbedFetch({ key: null }, async (calls) => {
    const result = await submitIndexNow("/blog/my-post", { allowOutsideProduction: true });
    assert.equal(calls.length, 0);
    assert.equal(result.submitted, 0);
    assert.match(String(result.reason), /not set/i);
  });
});

test("a malformed key is refused before the request, not after a 403", async () => {
  // Too short, and the space and bang are outside the allowed alphabet. Any one
  // of those would 403 at the endpoint; none of them should get that far.
  for (const bad of ["short", "bad key!", "a".repeat(129)]) {
    await withStubbedFetch({ key: bad }, async (calls) => {
      const result = await submitIndexNow("/blog/my-post", { allowOutsideProduction: true });
      assert.equal(calls.length, 0, `${bad} must not be sent`);
      assert.equal(result.submitted, 0);
      assert.match(String(result.reason), /malformed/i);
    });
  }
});

test("nothing is submitted outside production", async () => {
  const env = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    await withStubbedFetch({}, async (calls) => {
      // Note: no `allowOutsideProduction`. This is the request path.
      const result = await submitIndexNow("/blog/my-post");
      assert.equal(calls.length, 0);
      assert.equal(result.submitted, 0);
      assert.match(String(result.reason), /production/i);
    });
  } finally {
    if (env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = env;
  }
});

test("a list of only unsubmittable URLs never reaches the network", async () => {
  await withStubbedFetch({}, async (calls) => {
    const result = await submitIndexNow(["/search", "https://stripe.com/x", "/admin"], {
      allowOutsideProduction: true,
    });
    assert.equal(calls.length, 0, "no request should have been made");
    assert.equal(result.batches.length, 0);
    assert.equal(result.skipped, 3);
    assert.match(String(result.reason), /no submittable/i);
  });
});

test("duplicates collapse into one URL in one request", async () => {
  await withStubbedFetch({}, async (calls) => {
    // All three live entries name the same page.
    const result = await submitIndexNow(["/search", "/blog", "/blog/", absoluteUrl("/blog")], {
      allowOutsideProduction: true,
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.body.urlList, [`${origin}/blog`]);
    assert.equal(result.submitted, 1);
    assert.equal(result.skipped, 3, "one noindex route plus two duplicates");
  });
});

test("the payload carries host, key and keyLocation, and 202 counts as accepted", async () => {
  await withStubbedFetch({ status: 202 }, async (calls) => {
    const result = await submitIndexNow("/blog/my-post", { allowOutsideProduction: true });
    const call = calls[0];
    assert.equal(call?.url, "https://api.indexnow.org/indexnow");
    assert.equal(call?.body.host, new URL(SITE_URL).hostname);
    assert.equal(call?.body.key, TEST_KEY);
    // The key file has to be reachable at exactly this URL or the engines 403.
    assert.equal(call?.body.keyLocation, `${origin}/${TEST_KEY}.txt`);
    assert.equal(result.submitted, 1);
  });
});

test("a 403 is reported, never thrown", async () => {
  await withStubbedFetch({ status: 403 }, async () => {
    // A publish must succeed even when the key file is missing. This is the
    // whole reason the helper returns a result instead of raising.
    const result = await submitIndexNow("/blog/my-post", { allowOutsideProduction: true });
    assert.equal(result.submitted, 0);
    assert.deepEqual(result.batches, [{ urls: 1, status: 403 }]);
  });
});
