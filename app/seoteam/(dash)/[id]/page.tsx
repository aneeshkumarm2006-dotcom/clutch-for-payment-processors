import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BlogPost } from "@/models";
import { SeoPostForm } from "@/components/seoteam/SeoPostForm";
import { toSeoFormValues } from "@/components/seoteam/serialize";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Edit an existing blog post from the SEO dashboard. */
export const dynamic = "force-dynamic";

export default async function EditSeoPostPage({ params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) notFound();

  await connectToDatabase();
  const [doc, settings] = await Promise.all([
    BlogPost.findById(params.id).lean(),
    getOrCreateSiteSettings().catch(() => null),
  ]);
  if (!doc) notFound();

  return (
    <SeoPostForm
      postId={String(doc._id)}
      defaultValues={toSeoFormValues(doc)}
      savedSlug={doc.slug}
      engineCtx={toEngineContext(settings)}
    />
  );
}
