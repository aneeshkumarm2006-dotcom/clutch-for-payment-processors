import { cache } from "react";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { PageSeo, type IPageSeo, type PageSeoKey, type ISeo } from "@/models";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

/**
 * SEO for the static, non-entity routes (homepage, `/processors`, `/compare`).
 * A `PageSeo` record — edited in admin, seeded by `scripts/seed-seo.ts` — supplies
 * the meta title/description/keywords/FAQs; when absent the page's hardcoded copy
 * is used. `cache()` dedupes the lookup between `generateMetadata` and the page
 * body within a single request.
 */
export const getPageSeo = cache(async (pageKey: PageSeoKey): Promise<IPageSeo | null> => {
  try {
    await connectToDatabase();
    return await PageSeo.findOne({ pageKey }).lean<IPageSeo>();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[page-seo] getPageSeo failed:", err);
    return null;
  }
});

/**
 * Build a page's `Metadata`, letting an admin-edited `PageSeo` override the
 * passed-in defaults. Precedence: PageSeo → global Default SEO (Settings) →
 * the hardcoded `title`/`description` args.
 */
export async function pageSeoMetadata(opts: {
  pageKey: PageSeoKey;
  title: string;
  description: string;
  path: string;
  image?: string;
  absoluteTitle?: boolean;
  ogType?: "website" | "article" | "profile";
  /** Fallback keywords used only when the PageSeo record sets none. */
  keywords?: string[];
}): Promise<Metadata> {
  const [page, settings] = await Promise.all([
    getPageSeo(opts.pageKey),
    getOrCreateSiteSettings().catch(() => null),
  ]);

  const defaultSeo = settings?.defaultSeo;
  const mergedSeo: Partial<ISeo> = {
    metaTitle: page?.seo?.metaTitle || defaultSeo?.metaTitle,
    metaDescription: page?.seo?.metaDescription || defaultSeo?.metaDescription,
    ogImage: page?.seo?.ogImage || defaultSeo?.ogImage,
  };

  return buildMetadata({
    title: opts.title,
    description: opts.description,
    path: opts.path,
    image: opts.image,
    absoluteTitle: opts.absoluteTitle,
    ogType: opts.ogType,
    seo: mergedSeo,
    keywords: page?.seo?.keywords?.length ? page.seo.keywords : opts.keywords,
  });
}
