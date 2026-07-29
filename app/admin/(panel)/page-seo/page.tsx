import Link from "next/link";
import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Admin list of page records, split by `kind`:
 *
 *   Built-in pages  — SEO, FAQs and an editorial block slot for routes that
 *                     exist in code. Seeded; edited but not created or deleted.
 *   Landing pages   — standalone SEO pages that are nothing but their record.
 *                     Created and deleted here, served by `/[landing]`.
 */
export const dynamic = "force-dynamic";

export default async function AdminPageSeoPage() {
  await connectToDatabase();
  const pages = await PageSeo.find().sort({ title: 1 }).lean();
  const landings = pages.filter((p) => p.kind === "landing");
  const routes = pages.filter((p) => p.kind !== "landing");

  const table = (rows: typeof pages, opts: { showStatus?: boolean } = {}) => (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Meta title</TableHead>
            {opts.showStatus && <TableHead>Status</TableHead>}
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={String(p._id)}>
              <TableCell className="font-medium">{p.title}</TableCell>
              <TableCell className="text-muted-foreground">{p.path}</TableCell>
              <TableCell className="max-w-[24rem] truncate text-muted-foreground">
                {p.seo?.metaTitle || <span className="italic">Default</span>}
              </TableCell>
              {opts.showStatus && (
                <TableCell>
                  <Badge variant={p.isPublished === false ? "neutral" : "success"}>
                    {p.isPublished === false ? "Draft" : "Published"}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="text-right">
                <Link
                  href={`/admin/page-seo/${String(p._id)}`}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                >
                  Edit
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="mx-auto max-w-content space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 tracking-tighter2">Pages</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Meta, FAQs and content blocks for pages that aren&apos;t processors or categories,
            plus standalone SEO landing pages.
          </p>
        </div>
        <Link
          href="/admin/page-seo/new"
          className={cn(buttonVariants({ variant: "accent" }), "gap-1.5")}
        >
          <Plus className="size-4" aria-hidden />
          New landing page
        </Link>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3 tracking-tighter2">Landing pages</h2>
          <p className="mt-0.5 text-small text-muted-foreground">
            Standalone pages built entirely from content blocks. No deploy needed.
          </p>
        </div>
        {landings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-body text-muted-foreground">
              No landing pages yet. Create one to publish a new URL without a code change.
            </p>
          </div>
        ) : (
          table(landings, { showStatus: true })
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3 tracking-tighter2">Built-in pages</h2>
          <p className="mt-0.5 text-small text-muted-foreground">
            These routes exist in code. Edit their meta, FAQs and editorial blocks here.
          </p>
        </div>
        {routes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-body text-muted-foreground">
              No page records yet. Run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-small">npm run seed:seo</code> to
              create them.
            </p>
          </div>
        ) : (
          table(routes)
        )}
      </section>
    </div>
  );
}
