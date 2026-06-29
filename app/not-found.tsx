import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Global 404 (DESIGN §6.14 — minimal, one CTA back to /processors).
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-6 text-h2 text-foreground">Page not found</h1>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Button asChild variant="primary" className="mt-8">
        <Link href="/processors">Browse processors</Link>
      </Button>
    </div>
  );
}
