import { getServers, setServers } from "node:dns";
import { setServers as setServersPromise } from "node:dns/promises";
import { MongoClient } from "mongodb";

/**
 * Build-time `redirects()` source: every record carrying `seo.redirectTo`,
 * compiled into a real 308 in Next's routing layer.
 *
 * ## Why this exists alongside `applySeoRedirect`
 *
 * `redirect()` called inside a page Next is allowed to cache is NOT an HTTP
 * redirect — the cached render is served as `200 OK` with a
 * `<meta http-equiv="refresh">` body. Every route that reads `redirectTo`
 * declares `revalidate`, so on its own the feature could only ever produce a
 * meta refresh: a redirect Google honours, but a weak one, and not what the
 * admin field promises. Forcing the render dynamic with `unstable_noStore()`
 * does not work either — it throws `app-static-to-dynamic-error` on a route that
 * declares `revalidate`, turning the redirect into a 500.
 *
 * Reading the same field here, at build time, gives those URLs a genuine 308
 * resolved before any rendering happens. `applySeoRedirect` stays as the runtime
 * fallback for a redirect an editor adds between deploys. One field, two tiers,
 * no divergence.
 *
 * ## Guards
 *
 * The same rules as `lib/seo-redirect.ts`, restated because this runs in a plain
 * Node context that cannot import TypeScript: site-relative targets only (an
 * off-site value from an editor-controlled field is an open redirect that also
 * hands the page's authority to another domain), and never a self-redirect.
 *
 * Fails OPEN. A build must not break because Mongo is briefly unreachable: the
 * runtime fallback still covers every redirect, so an empty list costs a weaker
 * redirect, not a broken site.
 */

/** `collection → the path prefix its `slug` lives under`. PageSeo is separate. */
const SLUG_SOURCES = [
  { collection: "processors", prefix: "/processor" },
  { collection: "categories", prefix: "/category" },
  { collection: "blogposts", prefix: "/blog" },
];

/**
 * Point Node at a public resolver when the system one is loopback.
 *
 * A `mongodb+srv://` URI needs an SRV lookup, which some local resolvers refuse
 * (`querySrv ECONNREFUSED`). Mirrors `scripts/loadEnv.ts`, including its gotcha:
 * BOTH resolvers must be set, because the driver resolves SRV through the
 * PROMISE API and Node keeps those two resolver lists separate. Hosted builds
 * have a normal resolver and skip this entirely.
 */
function configureSrvDns() {
  try {
    if (!getServers().every((s) => s.startsWith("127.") || s === "::1")) return;
    const servers = (process.env.DNS_SERVERS ?? "8.8.8.8,1.1.1.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!servers.length) return;
    setServers(servers);
    setServersPromise(servers);
  } catch {
    // Non-fatal: fall back to the system resolver.
  }
}

export async function buildSeoRedirects() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return [];

  configureSrvDns();

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
  const rules = [];
  const add = (source, destination) => {
    if (typeof destination !== "string") return;
    const to = destination.trim();
    if (!to.startsWith("/") || to.startsWith("//")) return;
    if (to === source) return;
    rules.push({ source, destination: to, permanent: true });
  };

  try {
    await client.connect();
    const db = client.db();

    for (const { collection, prefix } of SLUG_SOURCES) {
      const docs = await db
        .collection(collection)
        .find(
          { "seo.redirectTo": { $nin: [null, ""] } },
          { projection: { slug: 1, "seo.redirectTo": 1 } },
        )
        .toArray();
      for (const doc of docs) {
        if (typeof doc.slug !== "string" || !doc.slug) continue;
        add(`${prefix}/${doc.slug}`, doc.seo?.redirectTo);
      }
    }

    // A landing page IS its record, so the record's own `path` is the source.
    const landings = await db
      .collection("pageseos")
      .find(
        { kind: "landing", "seo.redirectTo": { $nin: [null, ""] } },
        { projection: { path: 1, "seo.redirectTo": 1 } },
      )
      .toArray();
    for (const doc of landings) {
      if (typeof doc.path !== "string" || !doc.path.startsWith("/")) continue;
      add(doc.path, doc.seo?.redirectTo);
    }

    if (rules.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[redirects] compiled ${rules.length} seo.redirectTo rule(s) into the router`);
    }
    return rules;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[redirects] could not read seo.redirectTo at build time; the runtime fallback still applies:",
      err instanceof Error ? err.message : err,
    );
    return [];
  } finally {
    await client.close().catch(() => {});
  }
}
