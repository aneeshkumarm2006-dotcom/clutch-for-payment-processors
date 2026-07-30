import { permanentRedirect } from "next/navigation";
import type { ISeo } from "@/models";

/**
 * Honour an entity's `seo.redirectTo` with a 308.
 *
 * This is how a page is retired into another URL: a duplicate that has been
 * consolidated, a slug that changed, a category folded into a landing page. It
 * beats the alternatives on the two things that matter — a canonical is only a
 * hint search engines are free to ignore, and a `noindex` removes the page
 * without passing anything it had earned to its replacement.
 *
 * Call it as the FIRST thing a page does with its record, before any rendering
 * work: everything after it is thrown away.
 *
 * ```ts
 * const category = await getCategoryBySlug(params.slug);
 * if (!category) notFound();
 * applySeoRedirect(category.seo, `/category/${category.slug}`);
 * ```
 *
 * Two guards, both load-bearing:
 *
 * - **Site-relative only.** The validator already rejects absolute URLs, and
 *   this re-checks rather than trusting a document that may predate it. An
 *   off-site redirect from an editor-controlled field is an open redirect, and
 *   it hands the page's authority to another domain.
 * - **Never to itself.** A record whose `redirectTo` equals its own path would
 *   redirect forever, and the browser, not the server, is where that shows up.
 *
 * It cannot detect a longer cycle (A → B → A). Nothing short of walking the
 * chain can, and that would put a DB read on every render of every page; the
 * admin field description says as much.
 *
 * `permanentRedirect` signals by throwing, so this never returns when it fires.
 * Do not call it inside a `try` that swallows errors.
 *
 * ## This is the FALLBACK tier, not the 308
 *
 * A redirect thrown from a page Next is allowed to CACHE is not an HTTP redirect.
 * Every caller here sets `revalidate`, so the render is cached and Next answers
 * `200 OK` with a `<meta http-equiv="refresh">` in the body. Google honours a
 * zero-delay meta refresh as a permanent redirect, but treats it as a weaker
 * signal than a 308, and it is not what the admin field promises.
 *
 * The real 308 comes from `redirects()` in `next.config.mjs`, which reads the
 * same `seo.redirectTo` fields at build time. That covers every redirect that
 * existed when the site was built; this function covers the gap — a redirect an
 * editor sets between deploys, which takes effect on the next revalidation
 * instead of waiting for one. The two tiers agree because they read one field.
 *
 * Do NOT try to force a 308 here with `unstable_noStore()`. It throws
 * `app-static-to-dynamic-error` on a route that declares `revalidate`, turning
 * the redirect into a 500.
 */
export function applySeoRedirect(
  seo: Partial<ISeo> | null | undefined,
  selfPath: string,
): void {
  const target = seo?.redirectTo?.trim();
  if (!target) return;
  if (!target.startsWith("/") || target.startsWith("//")) return;
  if (target === selfPath) return;
  permanentRedirect(target);
}
