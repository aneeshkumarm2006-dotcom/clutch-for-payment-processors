"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { buttonVariants } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

/**
 * Affiliate-aware "Visit Website" link (PRD §9.2/§9.3 + §15). Uses
 * `affiliateUrl || website`, opens a new tab with `rel="sponsored noopener"`,
 * and fires the `visit_website` analytics event. Rendered as a styled <a> so it
 * carries the affiliate semantics (a plain Button can't).
 */
export function VisitWebsiteButton({
  website,
  affiliateUrl,
  slug,
  label = "Visit website",
  variant = "secondary",
  size = "md",
  showIcon = true,
  className,
}: {
  website: string;
  affiliateUrl?: string;
  slug: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  showIcon?: boolean;
  className?: string;
}) {
  const href = affiliateUrl || website;
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener"
      onClick={() => trackEvent("visit_website", { processor: slug, sponsored: Boolean(affiliateUrl) })}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {label}
      {showIcon && <ExternalLink className="size-4" aria-hidden />}
    </a>
  );
}

export default VisitWebsiteButton;
