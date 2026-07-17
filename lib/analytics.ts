/**
 * Lightweight client analytics (PRD §13 / TODO §3.1 — affiliate "Visit Website"
 * clicks, quote/CTA events).
 *
 * The real sinks are Vercel Analytics and Google Analytics, both wired in the
 * root layout — they define `window.va` / `window.gtag`, which we call here.
 * When either is absent (local dev without the script, or an ad-blocker) this
 * no-ops gracefully and still dispatches a `CustomEvent` so any listener can
 * pick events up. Analytics must never break the UI.
 */

export type AnalyticsEvent =
  | "visit_website"
  | "get_quote"
  | "add_to_compare"
  | "remove_from_compare"
  | "directory_search"
  | "write_review_cta"
  | "lead_submit"
  | "submission_submit";

type AnalyticsProps = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as {
      va?: (event: "event", props: Record<string, unknown>) => void;
      gtag?: (command: "event", eventName: string, params: Record<string, unknown>) => void;
    };
    w.va?.("event", { name, ...props });
    w.gtag?.("event", name, props);
    window.dispatchEvent(new CustomEvent("paycompare:analytics", { detail: { name, ...props } }));
  } catch {
    /* swallow — analytics is best-effort */
  }
}
