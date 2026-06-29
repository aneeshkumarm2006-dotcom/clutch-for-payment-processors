import { CategoryForm } from "@/components/admin/categories/CategoryForm";

/** Create a new category (PRD §10.4). */
export const dynamic = "force-dynamic";

export default function NewCategoryPage() {
  return (
    <div className="mx-auto max-w-content">
      <CategoryForm />
    </div>
  );
}
