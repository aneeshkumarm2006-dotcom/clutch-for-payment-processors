import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { JsonLd } from "@/components/public/JsonLd";
import { CompareProvider } from "@/components/public/compare/CompareContext";
import { CompareBar } from "@/components/public/compare/CompareBar";
import { getPublishedCategories } from "@/lib/public-data";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";
import { baseGraph } from "@/config/content-engine";

/**
 * Public shell (PRD §9): navbar + footer with live categories/settings, wrapped
 * in the compare selection provider so the global CompareBar works site-wide.
 *
 * Also the home of the site-wide base schema. Organization + WebSite used to be
 * emitted by the homepage alone, which meant every other page's JSON-LD referred
 * to a publisher that page never declared. Emitting them here — as one `@graph`
 * with absolute `@id`s — gives every public page a resolvable Organization to
 * point at, and page-level nodes reference it by id instead of restating it.
 *
 * No extra query: `getOrCreateSiteSettings` is `cache()`d, so the layout and the
 * page body share one read per request.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([
    getPublishedCategories(),
    getOrCreateSiteSettings().catch(() => null),
  ]);

  const footerSettings = {
    siteName: settings?.siteName ?? "PayCompare",
    socialLinks: settings?.socialLinks ?? {},
    footerText: settings?.footerText,
  };

  return (
    <CompareProvider>
      <JsonLd data={baseGraph(toEngineContext(settings))} />
      <div className="flex min-h-screen flex-col">
        <Navbar categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} settings={footerSettings} />
      </div>
      <CompareBar />
    </CompareProvider>
  );
}
