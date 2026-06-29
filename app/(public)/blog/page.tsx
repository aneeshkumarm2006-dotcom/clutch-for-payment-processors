import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { BlogCard } from "@/components/public/BlogCard";
import { RevealGroup, RevealItem } from "@/components/public/Reveal";
import { JsonLd } from "@/components/public/JsonLd";
import { getPublishedBlogPosts } from "@/lib/public-data";
import { buildMetadata, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

/** Blog index (PRD §9.9). SSG/ISR; the bare URL is prerendered, pages hydrate on demand. */
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Blog — payment processing guides & comparisons",
    description:
      "Guides, comparisons, and explainers on payment processing fees, methods, and choosing the right provider.",
    path: "/blog",
  });
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { items, totalPages, total } = await getPublishedBlogPosts(page);

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
          itemListJsonLd(items.map((p) => ({ name: p.title, path: `/blog/${p.slug}` }))),
        ]}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Blog</h1>
        <p className="mt-2 text-body-lg text-muted-foreground">
          Guides and comparisons to help you understand payment processing and pick the right
          provider.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center rounded-lg border border-dashed py-16 text-center">
          <Newspaper className="size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-h4 text-ink-700 dark:text-ink-300">No posts yet</h2>
          <p className="mt-1 max-w-prose text-body text-muted-foreground">
            We’re working on guides and comparisons. Check back soon.
          </p>
          <Link href="/processors" className={cn(buttonVariants({ variant: "primary" }), "mt-6")}>
            Browse processors
          </Link>
        </div>
      ) : (
        <>
          <RevealGroup className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((post) => (
              <RevealItem key={post.id}>
                <BlogCard post={post} />
              </RevealItem>
            ))}
          </RevealGroup>

          {totalPages > 1 && (
            <nav
              aria-label="Blog pagination"
              className="mt-12 flex items-center justify-between border-t pt-6"
            >
              <PageLink page={page - 1} disabled={page <= 1}>
                ← Newer
              </PageLink>
              <span className="text-small tabular-nums text-muted-foreground">
                Page {page} of {totalPages} · {total} posts
              </span>
              <PageLink page={page + 1} disabled={page >= totalPages}>
                Older →
              </PageLink>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none opacity-50")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={page <= 1 ? "/blog" : `/blog?page=${page}`}
      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
    >
      {children}
    </Link>
  );
}
