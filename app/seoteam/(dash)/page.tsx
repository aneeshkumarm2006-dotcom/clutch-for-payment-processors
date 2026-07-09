import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { analyzeHtmlForSeo } from "@/lib/html-analyze";
import { evaluateSeo, isSeoReady, keywordInText, type SeoSignals } from "@/lib/seo-checks";
import { toSeoPostRow } from "@/lib/serialize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeoPostTable, type SeoTableRow } from "@/components/seoteam/SeoPostTable";

/** /seoteam dashboard — stat cards + the post table with live SEO-ready badges. */
export const dynamic = "force-dynamic";

type LeanDoc = Record<string, unknown> & {
  seo?: { metaTitle?: string; metaDescription?: string };
  keywords?: Array<{ keyword?: unknown }>;
  seoOverrides?: unknown;
};

function computeSeoReady(doc: LeanDoc): boolean {
  const stats = analyzeHtmlForSeo(String(doc.content ?? ""));
  const metaTitle = String(doc.seo?.metaTitle ?? "").trim() || String(doc.title ?? "");
  const metaDesc = String(doc.seo?.metaDescription ?? "").trim() || String(doc.excerpt ?? "");
  const keywords = Array.isArray(doc.keywords) ? doc.keywords : [];

  const signals: SeoSignals = {
    metaTitleLength: metaTitle.length,
    metaDescriptionLength: metaDesc.length,
    wordCount: stats.wordCount,
    hasCoverImage: Boolean(String(doc.coverImage ?? "").trim()),
    internalLinks: stats.internalLinks,
    externalLinks: stats.externalLinks,
    imagesTotal: stats.imagesTotal,
    imagesMissingAlt: stats.imagesMissingAlt,
    keywords: keywords
      .filter((k) => k?.keyword)
      .map((k) => ({
        keyword: String(k.keyword),
        present: keywordInText(stats.plainText, String(k.keyword)),
      })),
  };
  const overrides = Array.isArray(doc.seoOverrides) ? doc.seoOverrides.map(String) : [];
  return isSeoReady(evaluateSeo(signals, overrides));
}

export default async function SeoDashboardPage() {
  await connectToDatabase();
  const posts = await BlogPost.find().sort({ updatedAt: -1 }).lean();

  const now = Date.now();
  const rows: SeoTableRow[] = posts.map((p) => {
    const row = toSeoPostRow(p);
    // A published post with a future publish date is scheduled (hidden until then).
    const scheduled =
      row.status === "published" &&
      !!row.publishedAt &&
      new Date(row.publishedAt).getTime() > now;
    return { ...row, seoReady: computeSeoReady(p as LeanDoc), scheduled };
  });

  const publishedLive = rows.filter((r) => r.status === "published" && !r.scheduled).length;
  const scheduled = rows.filter((r) => r.scheduled).length;
  const stats = [
    { label: "Published", value: publishedLive },
    { label: "Scheduled", value: scheduled },
    { label: "Drafts", value: rows.filter((r) => r.status === "draft").length },
    { label: "Total views", value: rows.reduce((sum, r) => sum + r.views, 0) },
  ];

  return (
    <div className="mx-auto max-w-content space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">SEO dashboard</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Publish and manage SEO-optimized blog posts.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/seoteam/new">
            <Plus className="size-4" />
            New post
          </Link>
        </Button>
      </div>

      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-label uppercase text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-h1 tabular-nums text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <SeoPostTable rows={rows} />
    </div>
  );
}
