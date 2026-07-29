import { NewLandingPageForm } from "@/components/admin/page-seo/NewLandingPageForm";

/** Create a standalone SEO landing page (`kind: "landing"`). */
export const dynamic = "force-dynamic";

export default function NewPageSeoPage() {
  return (
    <div className="mx-auto max-w-content">
      <NewLandingPageForm />
    </div>
  );
}
