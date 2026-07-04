import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPublishedBlogSlugs, getBlogPostBySlug } from "@/lib/public-data";
import { absoluteUrl, buildMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo";
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
    ogType: "article",
  });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const data = await getBlogPostBySlug(params.slug);
  if (!data) notFound();
  const { post, relatedProcessors, morePosts } = data;

  const canonical = absoluteUrl(`/blog/${post.slug}`);
  // Turn keyword occurrences in the body into backlinks at render time (kept out
  // of the stored body, so editing keywords reflects without re-saving content).
  const content = injectKeywordLinks(post.content, post.keywords, {
    firstOnly: post.linkFirstOccurrenceOnly,
  });

  return (
    <>
      <ViewPing id={post.id} />
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          articleJsonLd({
            title: post.title,
            slug: post.slug,
            description: post.excerpt,
            image: post.coverImage,
            author: post.author,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
          }),
        ]}
      />
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
