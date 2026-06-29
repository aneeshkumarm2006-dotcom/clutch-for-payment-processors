import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, SearchX } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { SearchBox } from "@/components/public/SearchBox";
import { ProcessorCard } from "@/components/public/ProcessorCard";
import { CategoryCard } from "@/components/public/CategoryCard";
import { Button } from "@/components/ui/button";
import { searchAll } from "@/lib/search";
import { buildMetadata } from "@/lib/seo";

/**
 * Search `/search?q=` (PRD §9.5). SSR cross-collection results grouped into
 * Processors (cards), Categories (links), and Blog (links), with an empty state
 * and a refine box. Results come from `lib/search.ts` — the same helper behind
 * `GET /api/search`. Query-driven, so it's dynamic and kept out of the index.
 */
export const dynamic = "force-dynamic";

export function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Metadata {
  const q = (searchParams.q ?? "").trim();
  return {
    ...buildMetadata({
      title: q ? `Search results for “${q}”` : "Search",
      description: "Search payment processors, categories, and articles on PayCompare.",
      path: "/search",
    }),
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const results = q ? await searchAll(q, 12) : null;

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-6 lg:py-10">
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Search" }]} />

      <div className="mt-4">
        <h1 className="text-h1 tracking-tighter2 text-foreground">
          {q ? <>Results for “{q}”</> : "Search"}
        </h1>
        {results && (
          <p className="mt-2 text-body text-muted-foreground tabular-nums">
            {results.total} {results.total === 1 ? "result" : "results"} across processors,
            categories, and articles.
          </p>
        )}
      </div>

      <div className="mt-6 max-w-xl">
        <SearchBox defaultValue={q} placeholder="Search processors, categories, articles…" />
      </div>

      {/* No query yet */}
      {!results && (
        <EmptyState
          title="What are you looking for?"
          body="Search by processor name, a payment method or feature, an industry, or a category."
        />
      )}

      {/* Query, but nothing matched */}
      {results && results.total === 0 && (
        <EmptyState
          title={`No results for “${q}”`}
          body="Try a shorter or different term — a processor name, payment method, or industry."
          action
        />
      )}

      {results && results.total > 0 && (
        <div className="mt-10 space-y-12">
          {results.processors.length > 0 && (
            <section>
              <GroupHeading
                title="Processors"
                count={results.processors.length}
                href={`/processors?q=${encodeURIComponent(q)}`}
                hrefLabel="See all in directory"
              />
              <div className="mt-5 grid gap-4">
                {results.processors.map((p) => (
                  <ProcessorCard key={p.id} processor={p} />
                ))}
              </div>
            </section>
          )}

          {results.categories.length > 0 && (
            <section>
              <GroupHeading title="Categories" count={results.categories.length} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.categories.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </div>
            </section>
          )}

          {results.blog.length > 0 && (
            <section>
              <GroupHeading title="Articles" count={results.blog.length} />
              <ul className="mt-5 divide-y divide-ink-150 rounded-lg border border-border dark:divide-ink-800">
                {results.blog.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/blog/${b.slug}`}
                      className="flex items-start gap-3 p-4 transition-colors hover:bg-ink-50 dark:hover:bg-ink-900"
                    >
                      <FileText className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{b.title}</span>
                        {b.excerpt && (
                          <span className="mt-0.5 block line-clamp-1 text-small text-muted-foreground">
                            {b.excerpt}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function GroupHeading({
  title,
  count,
  href,
  hrefLabel,
}: {
  title: string;
  count: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
      <h2 className="text-h3 tracking-tighter2 text-foreground">
        {title} <span className="text-muted-foreground tabular-nums">({count})</span>
      </h2>
      {href && hrefLabel && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-small text-accent hover:underline"
        >
          {hrefLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: boolean }) {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <SearchX className="mx-auto size-9 text-ink-300" aria-hidden />
      <h2 className="mt-4 text-h4 text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-small text-muted-foreground">{body}</p>
      {action && (
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/processors">Browse all processors</Link>
        </Button>
      )}
    </div>
  );
}
