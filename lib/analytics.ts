/**
 * Lightweight client analytics (PRD §13 / TODO §3.1 — affiliate "Visit Website"
 * clicks, quote/CTA events).
 *
 * The real sink is Vercel Analytics, wired via `<Analytics />` in the root layout
 * (M6) — it defines `window.va`, which we call here. When it's absent (local dev
 * without the script, or an ad-blocker) this no-ops gracefully and still
 * dispatches a `CustomEvent` so any listener can pick events up. Analytics must
 * never break the UI.
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
    const va = (window as unknown as { va?: (event: "event", props: Record<string, unknown>) => void })
      .va;
    va?.("event", { name, ...props });
    window.dispatchEvent(new CustomEvent("paycompare:analytics", { detail: { name, ...props } }));
  } catch {
    /* swallow — analytics is best-effort */
  }
}
