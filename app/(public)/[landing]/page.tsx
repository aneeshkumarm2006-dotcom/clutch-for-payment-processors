import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Blocks } from "@/components/public/Blocks";
import { FaqSection } from "@/components/public/FaqSection";
import { JsonLd } from "@/components/public/JsonLd";
import {
  getLandingPage,
  getLocaleVariants,
  getPublishedLandingPages,
  pageSeoMetadata,
  toHreflangMap,
} from "@/lib/page-seo";
import { applySeoRedirect } from "@/lib/seo-redirect";
import { buildStructuredData } from "@/lib/engine";
import { toEngineContext } from "@/lib/engine/context";
import { toPageEngineEntity, toBlocks, toFaqs } from "@/lib/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * Standalone SEO landing pages (`/ecommerce-pos-reviews-usa`, …).
 *
 * There is no code behind these: the whole page is a `PageSeo` record of
 * `kind: "landing"`, composed in admin → Pages & SEO out of the same content
 * blocks every other page uses. Adding one is content work, not a deploy, which
 * is the entire reason this route exists.
 *
 * Being a root-level dynamic segment, it is the LAST thing Next.js tries — every
 * static route (`/about`, `/glossary`, …) and every other dynamic segment wins
 * first, so this can only ever answer for a slug nothing else claims. An
 * unmatched slug (or an unpublished record) falls through to `notFound()` and
 * renders the normal 404 rather than an empty page.
 *
 * `dynamicParams` stays on so a landing page created after the last build is
 * served immediately and folded into the static set on the next revalidate.
 */
export const revalidate = 1800;
export const dynamicParams = true;

export async function generateStaticParams() {
  // `excludeRedirected`: a prerendered page can't serve a 308 — see the note on
  // `getPublishedLandingPages`. A retired landing page renders on demand instead.
  const pages = await getPublishedLandingPages({ excludeRedirected: true });
  return pages.map((p) => ({ landing: p.path.replace(/^\//, "") }));
}

export async function generateMetadata({
  params,
}: {
  params: { landing: string };
}): Promise<Metadata> {
  const path = `/${params.landing}`;
  const page = await getLandingPage(path);
  if (!page) return { title: "Page not found" };

  const variants = await getLocaleVariants(page.seo?.localeGroup);

  return pageSeoMetadata({
    // The record IS the page, so its own copy is the only fallback there is.
    title: page.heading || page.title,
    description: page.subheading || page.seo?.metaDescription || "",
    path,
    byPath: true,
    languages: toHreflangMap(variants),
  });
}

export default async function LandingPage({ params }: { params: { landing: string } }) {
  const path = `/${params.landing}`;
  const page = await getLandingPage(path);
  if (!page) notFound();
  // Before any other work: a retired landing page hands its URL to its successor.
  applySeoRedirect(page.seo, path);

  const [settings, variants] = await Promise.all([
    getOrCreateSiteSettings().catch(() => null),
    getLocaleVariants(page.seo?.localeGroup),
  ]);

  const blocks = toBlocks(page.blocks);
  const faqs = toFaqs(page.faqs);
  // An FAQ block renders (and schemas) its own questions. Rendering `faqs` as
  // well would show the reader the same list twice, and the engine has already
  // resolved the duplicate in the JSON-LD by letting the block win — keep the
  // page and the schema agreeing.
  const hasFaqBlock = Boolean(blocks?.some((b) => b.type === "faq"));

  // Sibling regions, minus this one. The hreflang tags tell crawlers these pages
  // are variants; this tells readers, and gives each variant a real crawlable
  // link to the others rather than a header they never see.
  const otherRegions = variants.filter((v) => v.path !== path);

  const { nodes } = buildStructuredData(
    "page",
    toPageEngineEntity({
      title: page.heading || page.title,
      path,
      description: page.subheading || page.seo?.metaDescription,
      dateModified: page.updatedAt,
      page,
    }),
    toEngineContext(settings),
  );

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd data={nodes} />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: page.title }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">{page.heading || page.title}</h1>
        {page.subheading && (
          <p className="mt-3 text-body-lg text-muted-foreground">{page.subheading}</p>
        )}
        {otherRegions.length > 0 && (
          <p className="mt-4 text-small text-muted-foreground">
            Also available for{" "}
            {otherRegions.map((v, i) => (
              <span key={v.path}>
                {i > 0 && ", "}
                <Link href={v.path} hrefLang={v.locale} className="font-medium text-accent hover:underline">
                  {v.title}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
      </header>

      <div className="mt-8">
        <Blocks blocks={blocks} />
      </div>

      {!hasFaqBlock && <FaqSection faqs={faqs} />}
    </div>
  );
}
