import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { getBlogPostForPreview, getPublishedCategories } from "@/lib/public-data";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { isSeoTeamAuthed } from "@/lib/seoteam-guard";
import { injectKeywordLinks } from "@/lib/keyword-links";
import { absoluteUrl } from "@/lib/seo";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CompareProvider } from "@/components/public/compare/CompareContext";
import { CompareBar } from "@/components/public/compare/CompareBar";
import { BlogArticle } from "@/components/public/BlogArticle";

/**
 * Full-page /seoteam preview — renders a post of ANY status (draft / scheduled /
 * published) in the real public site chrome, exactly like the live article, so an
 * author can see it before publishing (Shopify's Preview). Lives OUTSIDE the
 * (dash) group so it uses the public chrome, not the admin shell; still gated by
 * `middleware.ts` (seoteamGuard) + this server auth check.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post preview",
  robots: { index: false, follow: false },
};

export default async function SeoPostPreviewPage({ params }: { params: { id: string } }) {
  if (!(await isSeoTeamAuthed())) {
    redirect(`/seoteam/login?from=/seoteam/preview/${params.id}`);
  }

  const data = await getBlogPostForPreview(params.id);
  if (!data) notFound();
  const { post, relatedProcessors, morePosts } = data;

  // Match the public page: inject keyword backlinks at render time.
  const content = injectKeywordLinks(post.content, post.keywords, {
    firstOnly: post.linkFirstOccurrenceOnly,
  });

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
        <div className="flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-small text-foreground">
          <span className="inline-flex items-center gap-2 font-medium">
            <Eye className="size-4" aria-hidden />
            Preview — this post is not published yet.
          </span>
          <Link href={`/seoteam/${post.id}`} className="underline underline-offset-2 hover:text-accent">
            Back to editor
          </Link>
        </div>
        <Navbar categories={categories} />
        <main className="flex-1">
          <BlogArticle
            post={post}
            relatedProcessors={relatedProcessors}
            morePosts={morePosts}
            contentHtml={content}
            shareUrl={absoluteUrl(`/blog/${post.slug}`)}
          />
        </main>
        <Footer categories={categories} settings={footerSettings} />
      </div>
      <CompareBar />
    </CompareProvider>
  );
}
