import { test } from "node:test";
import assert from "node:assert/strict";
import { HOMEPAGE_DEFAULTS, HOME_SECTION_KEYS, resolveHomepage } from "../../lib/homepage";
import { homepageInput } from "../../lib/validators/homepage";
import {
  toHomepageFormValues,
  toHomepagePayload,
} from "../../components/admin/homepage/serialize";

/**
 * The landing-page editor's contract, which is easy to break silently:
 * "blank means inherit the default" has to survive the form → zod → Mongo →
 * `resolveHomepage` round-trip, and a settings document written before this
 * feature existed has to keep rendering the page it rendered yesterday.
 */

// Mongoose sub-documents arrive as plain objects; `as never` stands in for the
// full ISiteSettings shape these tests deliberately supply only a slice of.
const settings = (homepage: unknown, rest: Record<string, unknown> = {}) =>
  ({ ...rest, homepage }) as never;

test("no settings at all resolves to the built-in defaults", () => {
  const r = resolveHomepage(null);
  assert.equal(r.hero.title, HOMEPAGE_DEFAULTS.hero.title);
  assert.equal(r.hero.primaryCtaLabel, "Get matched");
  assert.equal(r.featured.limit, 6);
  assert.equal(r.howItWorks.steps.length, 3);
  assert.equal(r.ctaBand.cards.length, 2);
  assert.deepEqual(r.sectionOrder, [...HOME_SECTION_KEYS]);
});

test("a pre-existing settings doc with no `homepage` key still renders", () => {
  const r = resolveHomepage({
    homepageHeroTitle: "Legacy title",
    homepageHeroSubtitle: "Legacy subtitle",
  } as never);
  assert.equal(r.hero.title, "Legacy title");
  assert.equal(r.hero.subtitle, "Legacy subtitle");
  // Every section must default to visible — an upgrade can't blank the homepage.
  for (const key of ["categories", "featured", "howItWorks", "compare", "blog"] as const) {
    assert.equal(r[key].enabled, true, `${key} should default to visible`);
  }
  assert.equal(r.ctaBand.enabled, true);
  assert.equal(r.faq.enabled, true);
});

test("blank strings inherit the default; `false` is preserved, not coerced", () => {
  const r = resolveHomepage(
    settings({
      hero: { primaryCtaLabel: "   ", searchEnabled: false },
      featured: { enabled: false, title: "" },
    }),
  );
  assert.equal(r.hero.primaryCtaLabel, "Get matched");
  assert.equal(r.hero.searchEnabled, false);
  assert.equal(r.featured.enabled, false);
  assert.equal(r.featured.title, "Featured processors");
});

test("section intros survive a settings doc written before the field existed", () => {
  // The intro paragraphs are the sections' only body copy. A document saved by
  // the old form has no `description` key at all, and must still render them.
  const r = resolveHomepage(settings({ categories: { title: "" }, compare: {} }));
  for (const key of ["categories", "featured", "compare"] as const) {
    assert.equal(r[key].description, HOMEPAGE_DEFAULTS[key].description);
    assert.ok(r[key].description.length > 0, `${key} should ship an intro paragraph`);
  }
});

test("a stored intro overrides the default, and a blank one restores it", () => {
  assert.equal(resolveHomepage(settings({ featured: { description: "Mine." } })).featured.description, "Mine.");
  assert.equal(
    resolveHomepage(settings({ featured: { description: "  " } })).featured.description,
    HOMEPAGE_DEFAULTS.featured.description,
  );
});

test("an emptied steps list stays empty; a missing one falls back", () => {
  assert.equal(resolveHomepage(settings({ howItWorks: { steps: [] } })).howItWorks.steps.length, 0);
  assert.equal(resolveHomepage(settings({ howItWorks: {} })).howItWorks.steps.length, 3);
});

test("sectionOrder drops unknown keys, de-dupes, and appends missing ones", () => {
  const r = resolveHomepage(settings({ sectionOrder: ["blog", "nope", "blog", "featured"] }));
  assert.deepEqual(r.sectionOrder.slice(0, 2), ["blog", "featured"]);
  assert.equal(r.sectionOrder.length, HOME_SECTION_KEYS.length);
  assert.equal(new Set(r.sectionOrder).size, HOME_SECTION_KEYS.length);
});

test("limits are clamped, so a bad value can't fetch the whole collection", () => {
  const r = resolveHomepage(settings({ featured: { limit: 999 }, blog: { limit: -4 } }));
  assert.equal(r.featured.limit, 24);
  assert.equal(r.blog.limit, 0);
});

test("a CTA card with no target is dropped rather than rendered as a dead link", () => {
  const r = resolveHomepage(settings({ ctaBand: { cards: [{ title: "No link", cta: "Go" }] } }));
  assert.equal(r.ctaBand.cards.length, 0);
});

test("saving an untouched form does not change what the page renders", () => {
  const values = toHomepageFormValues(null, null);
  const parsed = homepageInput.safeParse(toHomepagePayload(values));
  assert.ok(parsed.success, "default form values must validate");
  assert.deepEqual(resolveHomepage(parsed.data as never), resolveHomepage(null));
});

test("blank text fields are stripped from the payload, not persisted as empty", () => {
  const parsed = homepageInput.parse(toHomepagePayload(toHomepageFormValues(null, null)));
  assert.equal(parsed.homepage.featured.title, undefined);
  assert.equal(parsed.homepage.featured.limit, undefined);
});

test("edits survive the form → validator → resolver round-trip", () => {
  const values = toHomepageFormValues(null, null);
  values.homepageHeroTitle = "Custom hero";
  values.hero.primaryCtaLabel = "Talk to us";
  values.featured.enabled = false;
  values.blog.limit = "6";
  values.sectionOrder = ["blog", "featured", "categories", "howItWorks", "compare", "content", "ctaBand", "faq"];

  const parsed = homepageInput.parse(toHomepagePayload(values));
  const r = resolveHomepage(parsed as never);
  assert.equal(r.hero.title, "Custom hero");
  assert.equal(r.hero.primaryCtaLabel, "Talk to us");
  assert.equal(r.featured.enabled, false);
  assert.equal(r.blog.limit, 6);
  assert.equal(r.sectionOrder[0], "blog");
});

test("the hero title is required and cannot be blanked", () => {
  const values = toHomepageFormValues(null, null);
  values.homepageHeroTitle = "   ";
  assert.equal(homepageInput.safeParse(toHomepagePayload(values)).success, false);
});

test("link targets must be a path, an anchor, or an absolute URL", () => {
  const values = toHomepageFormValues(null, null);
  for (const [href, ok] of [
    ["processors", false],
    ["/processors", true],
    ["#how-it-works", true],
    ["https://example.com/x", true],
  ] as const) {
    values.featured.actionHref = href;
    assert.equal(
      homepageInput.safeParse(toHomepagePayload(values)).success,
      ok,
      `${href} should ${ok ? "" : "not "}be accepted`,
    );
  }
});

test("all-blank repeatable rows are dropped on save", () => {
  const values = toHomepageFormValues(null, null);
  values.howItWorks.steps.push({ icon: "", title: "", body: "" });
  values.ctaBand.cards.push({ icon: "", title: "", body: "", href: "", cta: "" });
  const parsed = homepageInput.parse(toHomepagePayload(values));
  assert.equal(parsed.homepage.howItWorks.steps.length, 3);
  assert.equal(parsed.homepage.ctaBand.cards.length, 2);
});

test("stored values seed the form, not the resolved defaults", () => {
  // Otherwise the first save bakes today's default copy into the document and
  // "clear this field to restore the default" stops working.
  const values = toHomepageFormValues(
    { homepageHeroTitle: "T", homepageHeroSubtitle: "S", homepage: { featured: { title: "Mine" } } } as never,
    null,
  );
  assert.equal(values.featured.title, "Mine");
  assert.equal(values.blog.title, "", "an unset heading must stay blank in the form");
});
