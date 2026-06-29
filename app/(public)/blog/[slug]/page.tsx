import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getAllPublishedBlogSlugs, getBlogPostBySlug } from "@/lib/public-data";
import { absoluteUrl, buildMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RichText } from "@/components/public/RichText";
import { Badge } from "@/components/ui/badge";
import { BlogCard } from "@/components/public/BlogCard";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { ShareButtons } from "@/components/public/ShareButtons";
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

  return (
    <article className="mx-auto max-w-content px-4 py-10 lg:px-6">
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
          }),
        ]}
      />

      <Breadcrumb
        items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: post.title }]}
      />

      <header className="mx-auto mt-6 max-w-prose">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <h1 className="mt-3 text-display text-foreground">{post.title}</h1>
        {post.excerpt && (
          <p className="mt-3 text-body-lg text-muted-foreground">{post.excerpt}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground">
            <span className="font-medium text-foreground">{post.author}</span>
            {post.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </span>
            )}
          </div>
          <ShareButtons url={canonical} title={post.title} />
        </div>
      </header>

      {post.coverImage && (
        <div className="mx-auto mt-8 max-w-content overflow-hidden rounded-lg border">
          <Image
            src={post.coverImage}
            alt={`Cover image for ${post.title}`}
            width={1200}
            height={630}
            className="h-auto w-full object-cover"
            sizes="(max-width: 1200px) 100vw, 1200px"
            priority
            unoptimized
          />
        </div>
      )}

      <RichText html={post.content} className="mx-auto mt-10 max-w-prose" />

      {/* Related processors */}
      {relatedProcessors.length > 0 && (
        <section className="mx-auto mt-14 max-w-prose border-t pt-8">
          <h2 className="text-h3 tracking-tighter2 text-foreground">Processors mentioned</h2>
          <div className="mt-5 grid gap-4">
            {relatedProcessors.map((proc) => (
              <ProcessorCard key={proc.id} processor={proc} />
            ))}
          </div>
        </section>
      )}

      {/* More posts */}
      {morePosts.length > 0 && (
        <section className="mt-16 border-t pt-10">
          <h2 className="text-h2 tracking-tighter2 text-foreground">More from the blog</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {morePosts.map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
