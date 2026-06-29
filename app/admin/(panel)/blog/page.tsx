import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { Button } from "@/components/ui/button";
import { BlogTable, type BlogRow } from "@/components/admin/blog/BlogTable";

/** Admin blog list (PRD §10.8). */
export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  await connectToDatabase();
  const posts = await BlogPost.find().sort({ updatedAt: -1 }).lean();

  const rows: BlogRow[] = posts.map((p) => ({
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    author: p.author,
    status: p.status,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
    updatedAt: new Date(p.updatedAt).toISOString(),
  }));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Blog</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {rows.length} total · guides and comparisons for the directory.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/admin/blog/new">
            <Plus className="size-4" />
            New post
          </Link>
        </Button>
      </div>

      <BlogTable rows={rows} />
    </div>
  );
}
