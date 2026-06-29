import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Already authenticated → straight to the dashboard.
  const session = await getServerSession(authOptions);
  if (session) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-h3 tracking-tighter2 text-foreground">
            PayCompare<span className="text-accent">.</span>
          </span>
          <h1 className="mt-4 text-h2 tracking-tighter2">Admin sign in</h1>
          <p className="mt-1 text-small text-muted-foreground">
            Manage processors, reviews, and content.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
