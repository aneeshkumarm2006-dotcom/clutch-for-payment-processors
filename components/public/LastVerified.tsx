import Link from "next/link";
import { ShieldCheck, History } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Both halves of the stamp, derived from one UTC calendar day.
 *
 * The site-wide `formatDate` renders in the RENDER MACHINE's local timezone while
 * an ISO `datetime` attribute is UTC, and those two disagree for any timestamp in
 * the last hours of a UTC day: a listing edited at 2026-09-08T19:00Z shipped
 * `<time datetime="2026-09-08">Sep 9, 2026</time>` from a UTC+5:30 machine. A date
 * whose visible and machine-readable forms differ is worse than either alone,
 * because `lastReviewed` in the schema is a claim about a specific day.
 *
 * Pinning both to UTC also makes the stamp deterministic: the same document
 * renders the same day whether it is built locally or on a deploy runner.
 */
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * "Fees verified {date}" — the freshness stamp on a processor profile.
 *
 * TWO CLAIMS, NOT ONE, AND THE WORDING IS THE WHOLE POINT.
 *
 *   `verifiedAt` set   → "Fees verified {date}"  — an editor opened the provider's
 *                        pricing page on that day and checked the table against it.
 *   otherwise          → "Listing updated {date}" — the document was edited then.
 *                        True, weaker, and it claims nothing about anyone checking.
 *
 * Collapsing those two into one "Last updated" line would be the cheap version of
 * this feature and the dishonest one: every listing would appear freshly checked
 * the moment someone fixed a typo in its tagline. Rates on this site are quoted to
 * the basis point; a reader deciding on one is entitled to know whether the date
 * above it means "checked" or merely "touched".
 *
 * Renders a real `<time datetime>` so the date is machine-readable in the page
 * body as well as in the WebPage node's `lastReviewed` (see `webPageJsonLd`).
 */
export interface Freshness {
  /** True when an editor stamped a verification date. */
  verified: boolean;
  /** The day being claimed, `YYYY-MM-DD`, UTC. */
  day: string;
  /** Human form of the same day. */
  display: string;
  label: string;
  linkText: string;
  title: string;
}

/**
 * The whole decision, as a pure function — which of the two dates is being shown,
 * and therefore which claim the page makes. Exported so the rule can be tested
 * without rendering: it is the part that must not quietly change.
 *
 * Returns `null` when there is nothing honest to say, which the component renders
 * as nothing at all rather than as an empty row or a placeholder dash.
 */
export function resolveFreshness(
  verifiedAt?: string,
  updatedAt?: string,
): Freshness | null {
  const iso = verifiedAt || updatedAt;
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const verified = Boolean(verifiedAt);
  return {
    verified,
    day: date.toISOString().slice(0, 10),
    display: DAY_FORMAT.format(date),
    label: verified ? "Fees verified" : "Listing updated",
    linkText: verified ? "How we verify" : "How we keep listings current",
    title: verified
      ? "An editor checked these fees against the provider's published pricing on this date."
      : "The date this listing was last edited. It has not been through a fee verification pass.",
  };
}

export function LastVerified({
  verifiedAt,
  updatedAt,
  className,
  variant = "inline",
}: {
  /** ISO date an editor last checked the fees. */
  verifiedAt?: string;
  /** ISO timestamp of the last edit of any kind. */
  updatedAt?: string;
  className?: string;
  /** `inline` for the header meta row, `note` for the caption under the fee table. */
  variant?: "inline" | "note";
}) {
  const f = resolveFreshness(verifiedAt, updatedAt);
  if (!f) return null;

  const { verified, day, display, label, linkText, title } = f;
  const Icon = verified ? ShieldCheck : History;

  const stamp = (
    <>
      <Icon className={cn("size-4 shrink-0", verified && "text-accent")} aria-hidden />
      <span>
        {label}{" "}
        <time dateTime={day} className="font-medium text-foreground">
          {display}
        </time>
      </span>
    </>
  );

  if (variant === "note") {
    return (
      <p
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-small text-muted-foreground",
          className,
        )}
      >
        {stamp}
        <span aria-hidden>·</span>
        <Link href="/methodology" className="underline underline-offset-2 hover:text-accent">
          {linkText}
        </Link>
      </p>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-small text-muted-foreground", className)}
      title={title}
    >
      {stamp}
    </span>
  );
}

export default LastVerified;
