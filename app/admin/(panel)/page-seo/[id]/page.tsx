import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { PageSeo } from "@/models";
import { PageSeoForm } from "@/components/admin/page-seo/PageSeoForm";
import { toPageSeoFormValues } from "@/components/admin/page-seo/serialize";

/** Edit a static page's SEO + FAQs. */
export const dynamic = "force-dynamic";

export default async function EditPageSeoPage({ params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) notFound();

  await connectToDatabase();
  const doc = await PageSeo.findById(params.id).lean();
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-content">
      <PageSeoForm
        pageId={String(doc._id)}
        title={doc.title}
        path={doc.path}
        defaultValues={toPageSeoFormValues(doc)}
      />
    </div>
  );
}
