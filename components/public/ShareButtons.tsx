"use client";

import * as React from "react";
import { Check, Linkedin, Link2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Share row for a blog post (PRD §9.9). X / LinkedIn share intents + a
 * copy-link button with inline confirmation. Client-only: the share URLs are
 * built from the canonical post URL passed in by the (server) post page.
 */
export function ShareButtons({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy the link.");
    }
  };

  const linkClass =
    "inline-flex size-9 items-center justify-center rounded-lg border border-border text-ink-600 transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-ink-400";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="mr-1 text-label uppercase text-ink-500">Share</span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X / Twitter"
        className={linkClass}
      >
        <Twitter className="size-4" aria-hidden />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className={linkClass}
      >
        <Linkedin className="size-4" aria-hidden />
      </a>
      <button type="button" onClick={() => void copy()} aria-label="Copy link" className={linkClass}>
        {copied ? (
          <Check className="size-4 text-accent" aria-hidden />
        ) : (
          <Link2 className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export default ShareButtons;
