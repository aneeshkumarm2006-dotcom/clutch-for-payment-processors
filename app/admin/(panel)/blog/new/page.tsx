import { BlogForm } from "@/components/admin/blog/BlogForm";
import { getProcessorOptions } from "@/app/admin/(panel)/blog/processor-options";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Create a new blog post (PRD §10.8). */
export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const [processorOptions, settings] = await Promise.all([
    getProcessorOptions(),
    getOrCreateSiteSettings().catch(() => null),
  ]);
  return (
    <div className="mx-auto max-w-content">
      <BlogForm processorOptions={processorOptions} engineCtx={toEngineContext(settings)} />
    </div>
  );
}
