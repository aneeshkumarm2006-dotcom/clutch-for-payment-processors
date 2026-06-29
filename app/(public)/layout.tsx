import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CompareProvider } from "@/components/public/compare/CompareContext";
import { CompareBar } from "@/components/public/compare/CompareBar";
import { getPublishedCategories } from "@/lib/public-data";
import { getOrCreateSiteSettings } from "@/lib/settings";

/**
 * Public shell (PRD §9): navbar + footer with live categories/settings, wrapped
 * in the compare selection provider so the global CompareBar works site-wide.
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
      <div className="flex min-h-screen flex-col">
        <Navbar categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} settings={footerSettings} />
      </div>
      <CompareBar />
    </CompareProvider>
  );
}
