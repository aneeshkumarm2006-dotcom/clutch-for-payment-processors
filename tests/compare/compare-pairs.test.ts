import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POPULAR_COMPARE_PAIRS,
  compareHref,
  comparePairParams,
  comparePairToParam,
  parseComparePairParam,
  prettyComparePath,
} from "../../lib/compare-pairs";

/**
 * `POPULAR_COMPARE_PAIRS` is a hand-maintained list that grew from 20 to 65
 * entries, and every failure mode it has is silent:
 *
 *   - A reversed duplicate (`a-vs-b` and `b-vs-a`) gives one head-to-head two
 *     URLs. `PATH_BY_KEY` is a Map keyed on the sorted slugs, so the second entry
 *     overwrites the first and `prettyComparePath` starts returning a URL that
 *     disagrees with the one `generateStaticParams` prerendered.
 *   - A typo'd slug prerenders a page that 404s at request time, because
 *     `/compare/[pair]` calls `notFound()` when it cannot resolve two published
 *     processors. The sitemap would still advertise it.
 *   - A slug containing the `-vs-` delimiter would make the URL ambiguous.
 *
 * None of these show up in a build. They show up in Search Console weeks later,
 * which is exactly how 19 of the original 20 pairs ended up uncrawled.
 */

const key = (pair: readonly string[]) => [...pair].sort().join("|");

test("no head-to-head is listed twice, in either order", () => {
  const seen = new Map<string, string>();
  for (const pair of POPULAR_COMPARE_PAIRS) {
    const k = key(pair);
    const previous = seen.get(k);
    assert.equal(
      previous,
      undefined,
      `${comparePairToParam(pair)} duplicates ${previous} — one comparison, two URLs`,
    );
    seen.set(k, comparePairToParam(pair));
  }
  assert.equal(seen.size, POPULAR_COMPARE_PAIRS.length);
});

test("every pair is two distinct, url-safe slugs", () => {
  for (const pair of POPULAR_COMPARE_PAIRS) {
    assert.equal(pair.length, 2, `${pair.join(",")} must have exactly two slugs`);
    assert.notEqual(pair[0], pair[1], `${pair[0]} cannot be compared with itself`);
    for (const slug of pair) {
      assert.match(
        slug,
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `"${slug}" is not a lowercase hyphenated slug`,
      );
      // `-vs-` is the delimiter; a slug containing it makes the URL ambiguous.
      assert.ok(!slug.includes("-vs-"), `"${slug}" contains the -vs- delimiter`);
    }
  }
});

test("a route param round-trips back to the same two slugs", () => {
  for (const pair of POPULAR_COMPARE_PAIRS) {
    const param = comparePairToParam(pair);
    assert.deepEqual(
      parseComparePairParam(param),
      [...pair],
      `${param} does not parse back to its own slugs`,
    );
  }
});

test("prettyComparePath resolves every curated pair, in either slug order", () => {
  for (const pair of POPULAR_COMPARE_PAIRS) {
    const expected = `/compare/${comparePairToParam(pair)}`;
    assert.equal(prettyComparePath([...pair]), expected);
    // Order-independence is what lets `?ids=b,a` canonicalise to the one URL.
    assert.equal(prettyComparePath([pair[1], pair[0]]), expected);
  }
});

test("compareHref prefers the indexable route and falls back to the noindex tool", () => {
  const first = POPULAR_COMPARE_PAIRS[0];
  assert.ok(first, "the curated list must not be empty");
  const [a, b] = first;
  assert.equal(compareHref([a, b]), `/compare/${a}-vs-${b}`);
  // An uncurated pair keeps using `?ids=`, which is deliberately noindex.
  assert.equal(compareHref(["stripe", "not-a-processor"]), "/compare?ids=stripe,not-a-processor");
  // Three slugs is never a pretty pair, even if two of them are curated.
  assert.equal(prettyComparePath([a, b, "square"]), null);
});

test("generateStaticParams emits one unique param per curated pair", () => {
  const params = comparePairParams();
  assert.equal(params.length, POPULAR_COMPARE_PAIRS.length);
  assert.equal(new Set(params.map((p) => p.pair)).size, params.length);
});
