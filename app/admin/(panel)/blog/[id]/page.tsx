import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { BlogForm } from "@/components/admin/blog/BlogForm";
import { toBlogFormValues } from "@/components/admin/blog/serialize";
import { getProcessorOptions } from "@/app/admin/(panel)/blog/processor-options";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Edit an existing blog post (PRD §10.8). */
export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) notFound();

  await connectToDatabase();
  const [doc, processorOptions, settings] = await Promise.all([
    BlogPost.findById(params.id).lean(),
    getProcessorOptions(),
    getOrCreateSiteSettings().catch(() => null),
  ]);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-content">
      <BlogForm
        postId={String(doc._id)}
        defaultValues={toBlogFormValues(doc)}
        processorOptions={processorOptions}
        savedSlug={doc.slug}
        engineCtx={toEngineContext(settings)}
      />
    </div>
  );
}
