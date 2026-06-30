import Link from "next/link";
import Image from "next/image";
import { Newspaper } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BlogCardData } from "@/lib/serialize";

/**
 * BlogCard — index grid + related-post tile (PRD §9.9). Cover image (or a
 * monochrome placeholder), title, excerpt, author + date meta, and up to two
 * tags. Whole card links to the post via the stretched-link pattern so inner
 * tag chips stay non-interactive text (no nested anchors here).
 */
export function BlogCard({ post, className }: { post: BlogCardData; className?: string }) {
  const href = `/blog/${post.slug}`;
  const tags = post.tags.slice(0, 2);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b bg-ink-100 dark:bg-ink-900">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Newspaper className="size-8 text-ink-300 dark:text-ink-700" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {tags.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <h3 className="text-h3 text-foreground">
          <Link
            href={href}
            className="rounded-sm outline-none transition-colors before:absolute before:inset-0 before:content-[''] hover:text-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            {post.title}
          </Link>
        </h3>

        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-small text-muted-foreground">{post.excerpt}</p>
        )}

        <div className="mt-4 flex items-center gap-2 text-micro text-muted-foreground">
          <span className="font-medium text-ink-700 dark:text-ink-300">{post.author}</span>
          {post.publishedAt && (
            <>
              <span aria-hidden>·</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </>
          )}
          {post.readingTimeMinutes ? (
            <>
              <span aria-hidden>·</span>
              <span>{post.readingTimeMinutes} min read</span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default BlogCard;
