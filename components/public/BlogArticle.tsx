import Image from "next/image";
import { CalendarDays, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BlogCardData, BlogPostData, ProcessorCardData } from "@/lib/serialize";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { RichText } from "@/components/public/RichText";
import { Badge } from "@/components/ui/badge";
import { BlogCard } from "@/components/public/BlogCard";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { ShareButtons } from "@/components/public/ShareButtons";

/**
 * Presentational blog article (header + cover + body + related + more). Shared by
 * the public post page ([slug]) and the /seoteam full-page preview so both render
 * identically. `contentHtml` is passed in ALREADY processed (keyword backlinks
 * injected by the caller); non-visual concerns (JSON-LD, view ping) stay with the
 * public page.
 */
export function BlogArticle({
  post,
  relatedProcessors,
  morePosts,
  contentHtml,
  shareUrl,
}: {
  post: BlogPostData;
  relatedProcessors: ProcessorCardData[];
  morePosts: BlogCardData[];
  contentHtml: string;
  shareUrl: string;
}) {
  // Author layout controls (§10.8). The reading column drives the header, body and
  // related sections so they align; the cover can break out to a wider "hero".
  const readColumn = post.contentWidth === "wide" ? "max-w-[52rem]" : "max-w-prose";
  const coverColumn = post.coverLayout === "wide" ? "max-w-content" : "max-w-[52rem]";

  return (
    <article className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <Breadcrumb
        items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: post.title }]}
      />

      <header className={`mx-auto mt-6 ${readColumn}`}>
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
        {post.excerpt && <p className="mt-3 text-body-lg text-muted-foreground">{post.excerpt}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground">
            <span className="font-medium text-foreground">{post.author}</span>
            {post.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </span>
            )}
            {post.readingTimeMinutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {post.readingTimeMinutes} min read
              </span>
            ) : null}
          </div>
          <ShareButtons url={shareUrl} title={post.title} />
        </div>
      </header>

      {post.coverImage && (
        <div className={`mx-auto mt-8 ${coverColumn} overflow-hidden rounded-lg border`}>
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt?.trim() || `Cover image for ${post.title}`}
            width={1200}
            height={630}
            className="aspect-[1200/630] h-auto w-full object-cover"
            sizes="(max-width: 832px) 100vw, (max-width: 1200px) 100vw, 1200px"
            priority
            unoptimized
          />
        </div>
      )}

      <RichText html={contentHtml} className={`mx-auto mt-10 ${readColumn}`} />

      {relatedProcessors.length > 0 && (
        <section className={`mx-auto mt-14 ${readColumn} border-t pt-8`}>
          <h2 className="text-h3 tracking-tighter2 text-foreground">Processors mentioned</h2>
          <div className="mt-5 grid gap-4">
            {relatedProcessors.map((proc) => (
              <ProcessorCard key={proc.id} processor={proc} />
            ))}
          </div>
        </section>
      )}

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

export default BlogArticle;
