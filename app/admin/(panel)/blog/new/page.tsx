import { BlogForm } from "@/components/admin/blog/BlogForm";
import { getProcessorOptions } from "@/app/admin/(panel)/blog/processor-options";

/** Create a new blog post (PRD §10.8). */
export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const processorOptions = await getProcessorOptions();
  return (
    <div className="mx-auto max-w-content">
      <BlogForm processorOptions={processorOptions} />
    </div>
  );
}
