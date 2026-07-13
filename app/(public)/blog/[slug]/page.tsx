import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPublishedBlogSlugs, getBlogPostBySlug } from "@/lib/public-data";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { buildStructuredData } from "@/lib/engine";
import { toEngineContext } from "@/lib/engine/context";
import { toBlogEngineEntity } from "@/lib/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { injectKeywordLinks } from "@/lib/keyword-links";
import { BlogArticle } from "@/components/public/BlogArticle";
import { ViewPing } from "@/components/public/ViewPing";
import { JsonLd } from "@/components/public/JsonLd";

/** Blog post (PRD §9.9). SSG/ISR + generateStaticParams. */
export const revalidate = 1800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllPublishedBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getBlogPostBySlug(params.slug);
  if (!data) return { title: "Post not found" };
  const { post } = data;
  return buildMetadata({
    title: post.title,
    description:
      post.excerpt || `${post.title} — a guide from the PayCompare blog on payment processing.`,
    path: `/blog/${post.slug}`,
    image: post.coverImage,
    seo: post.seo,
    // Previously omitted: posts stored `seo.keywords` in the admin but never
    // rendered them, unlike the processor and category routes.
    keywords: post.seo?.keywords,
    ogType: "article",
  });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const data = await getBlogPostBySlug(params.slug);
  if (!data) notFound();
  const { post, relatedProcessors, morePosts } = data;
  const settings = await getOrCreateSiteSettings().catch(() => null);

  const canonical = absoluteUrl(`/blog/${post.slug}`);
  // Turn keyword occurrences in the body into backlinks at render time (kept out
  // of the stored body, so editing keywords reflects without re-saving content).
  const content = injectKeywordLinks(post.content, post.keywords, {
    firstOnly: post.linkFirstOccurrenceOnly,
  });

  // BlogPosting + BreadcrumbList, plus an FAQPage if the post uses an FAQ block —
  // a post has no `faqs` field of its own, so blocks are how it earns FAQ schema.
  const { nodes } = buildStructuredData(
    "blogPost",
    toBlogEngineEntity(post),
    toEngineContext(settings),
  );

  return (
    <>
      <ViewPing id={post.id} />
      <JsonLd data={nodes} />
      <BlogArticle
        post={post}
        relatedProcessors={relatedProcessors}
        morePosts={morePosts}
        contentHtml={content}
        shareUrl={canonical}
      />
    </>
  );
}
