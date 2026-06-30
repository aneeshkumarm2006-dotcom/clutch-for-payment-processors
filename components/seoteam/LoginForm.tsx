"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shared-password sign-in for the SEO dashboard. */
export function SeoLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fromParam = params.get("from") ?? "";
  // Only honor same-area redirects (avoid open-redirects).
  const dest = fromParam.startsWith("/seoteam") ? fromParam : "/seoteam";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/api/seoteam/login", { password });
      router.replace(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not sign in. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-small text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="seo-password">Password</Label>
        <div className="relative">
          <Input
            id="seo-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || !password}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default SeoLoginForm;
