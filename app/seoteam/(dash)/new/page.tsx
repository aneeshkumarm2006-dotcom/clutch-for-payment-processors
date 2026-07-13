import { SeoPostForm } from "@/components/seoteam/SeoPostForm";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { toEngineContext } from "@/lib/engine/context";

/** Create a new SEO blog post. */
export const dynamic = "force-dynamic";

export default async function NewSeoPostPage() {
  const settings = await getOrCreateSiteSettings().catch(() => null);
  return <SeoPostForm engineCtx={toEngineContext(settings)} />;
}
