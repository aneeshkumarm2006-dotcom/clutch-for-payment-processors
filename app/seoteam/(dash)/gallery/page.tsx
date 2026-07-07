import { MediaGallery } from "@/components/seoteam/MediaGallery";

/**
 * /seoteam/gallery — the blog media library. Browse every image, see which posts
 * it's attached to (cover / OG / inline), edit alt + tags, bulk upload/import, and
 * sync images already used in existing posts. All data is loaded client-side from
 * `/api/seoteam/media`, so this is a thin server wrapper inside the guarded (dash).
 */
export const dynamic = "force-dynamic";

export default function SeoGalleryPage() {
  return (
    <div className="mx-auto max-w-content">
      <MediaGallery />
    </div>
  );
}
