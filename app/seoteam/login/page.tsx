import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSeoTeamAuthed } from "@/lib/seoteam-guard";
import { SeoLoginForm } from "@/components/seoteam/LoginForm";

export const metadata: Metadata = {
  title: "SEO team sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SeoTeamLoginPage() {
  if (await isSeoTeamAuthed()) redirect("/seoteam");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-h3 tracking-tighter2 text-foreground">
            PayCompare<span className="text-accent">.</span>
          </span>
          <h1 className="mt-4 text-h2 tracking-tighter2">SEO dashboard</h1>
          <p className="mt-1 text-small text-muted-foreground">
            Sign in to publish and manage blog posts.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <SeoLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
