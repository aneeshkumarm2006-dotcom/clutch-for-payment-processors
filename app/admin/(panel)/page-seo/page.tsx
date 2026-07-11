import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
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
 * Admin list of static-page SEO records (homepage, /processors, /compare).
 * The set is fixed and seeded; admins edit but don't create/delete here.
 */
export const dynamic = "force-dynamic";

export default async function AdminPageSeoPage() {
  await connectToDatabase();
  const pages = await PageSeo.find().sort({ title: 1 }).lean();

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div>
        <h1 className="text-h1 tracking-tighter2">Page SEO</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Meta title, description, keywords, and FAQs for static pages that aren&apos;t
          processors or categories.
        </p>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-body text-muted-foreground">
            No page-SEO records yet. Run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-small">npm run seed:seo</code> to
            create them.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Meta title</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={String(p._id)}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">{p.path}</TableCell>
                  <TableCell className="max-w-[24rem] truncate text-muted-foreground">
                    {p.seo?.metaTitle || <span className="italic">— default —</span>}
                  </TableCell>
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
      )}
    </div>
  );
}
