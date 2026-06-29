"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Global error boundary (DESIGN §6.14). Must be a Client Component.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; wire to a logger in a later milestone.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <TriangleAlert className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-6 text-h2 text-foreground">Something went wrong</h1>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to the directory.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="secondary">
          <a href="/processors">Browse processors</a>
        </Button>
      </div>
    </div>
  );
}
