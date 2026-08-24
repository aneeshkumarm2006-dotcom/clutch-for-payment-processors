"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, X } from "lucide-react";
import { OFFER_VOLUMES } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { HONEYPOT_FIELD } from "@/lib/rate-limit";
import { useSpamGuard } from "@/components/public/useSpamGuard";
import { useCompare } from "@/components/public/compare/CompareContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MIN_SCROLL_PX,
  OFFER_COPY,
  OFFER_KEY,
  REVEAL_DELAY_MS,
  SCROLL_TRIGGER,
  STORAGE_KEY,
  isSuppressed,
  offerPageType,
  type OfferRecord,
} from "@/config/offer-slidein";

/**
 * OfferSlideIn — the fee-sheet lead magnet.
 *
 * Fires at 60% scroll depth on comparison pages and blog posts, slides in from
 * the bottom-right on desktop and up as a bottom sheet on mobile, and captures
 * an email plus an optional volume bucket to `POST /api/offer-signups`.
 *
 * NON-MODAL, and that is the whole design. No backdrop, no focus trap, no
 * scroll lock: it appears beside what someone is reading, not on top of it, and
 * ignoring it costs nothing. The reason it can afford to fire on every eligible
 * page is precisely that it is cheap to ignore. Turn it into a modal and the
 * 21-day cooldown stops being anywhere near enough.
 *
 * ── Three couplings that are not obvious from the markup ────────────────────
 *
 * 1. IT MOUNTS AT PAGE LOAD AND ONLY BECOMES VISIBLE AT 60%. `useSpamGuard`
 *    stamps the moment it mounts, and the server scores a form submitted less
 *    than three seconds after that stamp as automation (weight 4, which lands
 *    it straight in quarantine and it is never emailed). This form is ONE
 *    FIELD. Lazy-mounting it at the trigger — the obvious optimization — would
 *    put every fast typist in the spam bin. Mounting early makes the stamp
 *    measure time on the page, which is what it is actually for.
 *
 * 2. IT STANDS DOWN WHILE THE COMPARE TRAY IS UP. `CompareBar` is fixed to the
 *    same bottom edge on `/compare*`, so the two would physically overlap.
 *    Someone mid-comparison is also doing a task rather than reading, and
 *    interrupting a task converts worse than interrupting a scroll. Crossing
 *    the threshold with the tray open therefore DEFERS the offer rather than
 *    consuming it: the impression is only spent when the panel is really shown
 *    (see the two-step trigger below), so a reader who never saw it does not
 *    quietly serve a 21-day cooldown for it.
 *
 * 3. FREQUENCY IS ENFORCED ON IMPRESSION, not on dismissal. The stamp is
 *    written the moment it becomes visible, so a visitor who ignores it does
 *    not meet it again on the next page. "Once per 21 days" has to mean once
 *    seen; enforcing on dismissal would mean once dismissed, which is a
 *    different and much more irritating promise.
 */

/** Matches the panel transition duration, so it unmounts after it has left. */
const EXIT_MS = 320;
/** How long the confirmation lingers before it shows itself out. */
const SUCCESS_LINGER_MS = 8_000;

/**
 * Storage that cannot throw. Safari in private mode and a full quota both
 * reject `setItem`, and a lead magnet must never take the page down with it.
 * A visitor whose storage is unavailable sees it once per page load, which is
 * the right degradation: mildly annoying at worst, never broken.
 */
function readRecord(): OfferRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as OfferRecord) : {};
  } catch {
    return {};
  }
}

function writeRecord(patch: OfferRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readRecord(), ...patch }));
  } catch {
    /* storage unavailable — frequency capping degrades to per-page-load */
  }
}

/** Progress through the scrollable range, plus the raw distance travelled. */
function scrollProgress(): { ratio: number; px: number } {
  const doc = document.documentElement;
  const px = window.scrollY || doc.scrollTop || 0;
  const range = (doc.scrollHeight || 0) - window.innerHeight;
  return { ratio: range > 0 ? px / range : 0, px };
}

/** The referrer, but only when it came from somewhere that is not us. */
function externalReferrer(): string | undefined {
  try {
    const ref = document.referrer;
    if (!ref) return undefined;
    return new URL(ref).host === window.location.host ? undefined : ref;
  } catch {
    return undefined;
  }
}

function readUtm(): { source?: string; medium?: string; campaign?: string } | undefined {
  try {
    const q = new URLSearchParams(window.location.search);
    const utm = {
      source: q.get("utm_source") ?? undefined,
      medium: q.get("utm_medium") ?? undefined,
      campaign: q.get("utm_campaign") ?? undefined,
    };
    return utm.source || utm.medium || utm.campaign ? utm : undefined;
  } catch {
    return undefined;
  }
}

export function OfferSlideIn() {
  const pathname = usePathname();
  const pageType = offerPageType(pathname);
  const { items: compareItems } = useCompare();
  const compareTrayOpen = compareItems.length > 0;

  // Mounted at page load so the stamp measures time on the page, NOT the time
  // spent filling in one input. See note 1 in the header comment.
  const spamGuard = useSpamGuard();

  /**
   * Two steps, and both are scoped to a PATH rather than to a boolean.
   *
   * The two steps: `armedFor` means the reader crossed 60% and is owed the
   * offer; `mountedFor` means it is really on screen. Collapsing them into one
   * flag burns an impression on somebody who never saw the panel because the
   * compare tray was covering its corner.
   *
   * The path: this component survives client-side navigation, so a plain
   * boolean stays true into the next page and is read by effects one render
   * BEFORE any reset can clear it — which shows the panel at the top of the new
   * page and spends a cooldown nobody earned. Comparing against the live
   * pathname makes stale state unusable by construction instead of relying on
   * reset ordering, and it also stops the old page's panel painting for a frame
   * on the new one.
   */
  const [armedFor, setArmedFor] = React.useState<string | null>(null);
  const [mountedFor, setMountedFor] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [volume, setVolume] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<null | { delivered: boolean }>(null);

  const headingId = React.useId();
  /** Stops the trigger re-arming on a page that has already had its turn. */
  const spentRef = React.useRef(false);

  const close = React.useCallback((reason: "dismiss" | "auto") => {
    setShown(false);
    if (reason === "dismiss") trackEvent("offer_dismiss", { offer: OFFER_KEY });
    window.setTimeout(() => setMountedFor(null), EXIT_MS);
  }, []);

  // --- Reset when the visitor navigates to another page ---------------------
  // The path comparisons above already make the old page's state inert; this
  // clears it so the next page starts from a genuinely blank form.
  React.useEffect(() => {
    spentRef.current = false;
    setArmedFor(null);
    setMountedFor(null);
    setShown(false);
    setDone(null);
    setError(null);
    setEmail("");
    setVolume("");
  }, [pathname]);

  // --- Arm the scroll trigger ----------------------------------------------
  React.useEffect(() => {
    if (!pageType) return;
    if (isSuppressed(readRecord(), Date.now())) return;

    let raf = 0;
    let revealTimer = 0;

    // Step one: the reader has earned the offer. Whether they can be shown it
    // yet is the next effect's problem.
    const arm = () => setArmedFor(pathname);

    const check = () => {
      raf = 0;
      const { ratio, px } = scrollProgress();
      // Both conditions have to hold: the ratio says "far enough through", the
      // pixel floor says "actually scrolled at all". A short page fails the
      // floor and simply never shows the offer.
      if (ratio < SCROLL_TRIGGER || px < MIN_SCROLL_PX) return;
      window.removeEventListener("scroll", onScroll);
      revealTimer = window.setTimeout(arm, REVEAL_DELAY_MS);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(check);
    };

    // Lenis drives the native scroll position, so a plain passive listener sees
    // its inertia frames without having to hook into Lenis itself.
    window.addEventListener("scroll", onScroll, { passive: true });
    // A restored scroll position on a back-navigation can already be past 60%.
    check();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [pageType, pathname]);

  // --- Step two: show it, once the corner is free --------------------------
  // Runs again when the compare tray empties, so an offer deferred by the tray
  // still lands rather than being silently lost along with its cooldown.
  React.useEffect(() => {
    if (armedFor !== pathname || compareTrayOpen || spentRef.current) return;
    spentRef.current = true;
    // Spent on IMPRESSION, not on dismissal, and not before the panel is real.
    // See note 3 in the header.
    writeRecord({ shownAt: Date.now() });
    setMountedFor(pathname);
    trackEvent("offer_view", { offer: OFFER_KEY, page_type: pageType ?? "", path: pathname });
    // Two frames: one to get the panel into the DOM in its offscreen state, one
    // for the browser to paint it there. Flipping the class in the same frame as
    // the mount skips the transition entirely and it just appears.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [armedFor, compareTrayOpen, pageType, pathname]);

  // --- Escape closes it -----------------------------------------------------
  React.useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("dismiss");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, close]);

  // --- Show itself out after a successful signup ---------------------------
  React.useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => close("auto"), SUCCESS_LINGER_MS);
    return () => clearTimeout(t);
  }, [done, close]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/offer-signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          volume: volume || undefined,
          offer: OFFER_KEY,
          pagePath: pathname,
          pageType,
          referrer: externalReferrer(),
          utm: readUtm(),
          [HONEYPOT_FIELD]: honeypot,
          ...spamGuard.fields(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not sign you up. Please try again.");
      }
      const data = (await res.json().catch(() => ({}))) as { delivered?: boolean };
      writeRecord({ convertedAt: Date.now() });
      trackEvent("offer_submit", {
        offer: OFFER_KEY,
        page_type: pageType ?? "",
        volume: volume || "not-given",
      });
      setDone({ delivered: Boolean(data.delivered) });
    } catch (err) {
      // Turnstile tokens are single-use: a retry with the same one always fails.
      spamGuard.reset();
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // Stands down while the compare tray owns the bottom edge (note 2). Checked
  // here at render rather than in the trigger effect, so an offer already on
  // screen gets out of the way the moment a processor is added to the tray.
  if (mountedFor !== pathname || compareTrayOpen) return null;

  return (
    <aside
      aria-labelledby={headingId}
      // Short enough that it never scrolls in practice; the cap and the Lenis
      // opt-out are for a small phone in landscape, where the sheet plus an open
      // keyboard can exceed the viewport.
      data-lenis-prevent
      className={cn(
        "fixed z-40 max-h-[85vh] overflow-y-auto border bg-card shadow-pop",
        // Mobile: full-width bottom sheet.
        "inset-x-0 bottom-0 rounded-t-lg p-5 pb-6",
        // Desktop: a card tucked into the bottom-right corner.
        "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:rounded-lg sm:pb-5",
        "transition-[transform,opacity] duration-300 ease-entrance motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0",
      )}
    >
      {/* Grab-handle affordance: sheet-shaped on mobile, meaningless on desktop. */}
      <div
        aria-hidden
        className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-ink-200 dark:bg-ink-800 sm:hidden"
      />

      <button
        type="button"
        onClick={() => close("dismiss")}
        aria-label={OFFER_COPY.dismiss}
        className="absolute right-3 top-3 rounded-sm p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-subtle dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <X className="size-4" />
      </button>

      {done ? (
        <div className="py-2 text-center" aria-live="polite">
          <CheckCircle2 className="mx-auto size-9 text-accent" aria-hidden />
          <p id={headingId} className="mt-3 text-h4 text-foreground">
            {done.delivered ? "Sent" : "You are on the list"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-small text-muted-foreground">
            {done.delivered ? OFFER_COPY.successSent : OFFER_COPY.successQueued}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 pr-6">
            <span
              aria-hidden
              className="mt-0.5 grid size-9 shrink-0 place-items-center rounded bg-accent-subtle text-accent-subtle-foreground"
            >
              <FileSpreadsheet className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <span className="text-label uppercase text-ink-500">{OFFER_COPY.eyebrow}</span>
              <h2 id={headingId} className="mt-1 text-h4 tracking-tighter2 text-foreground">
                {OFFER_COPY.heading}
              </h2>
              <p className="mt-1 text-small text-muted-foreground">{OFFER_COPY.body}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
            {error && (
              <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive">
                {error}
              </p>
            )}

            {/* Honeypot — off-screen, not announced. Bots fill it. */}
            <div
              aria-hidden
              className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden"
            >
              <label htmlFor={`offer-${HONEYPOT_FIELD}`}>Company website (leave blank)</label>
              <input
                id={`offer-${HONEYPOT_FIELD}`}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="offer-email">{OFFER_COPY.emailLabel}</Label>
              <Input
                id="offer-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={OFFER_COPY.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="offer-volume">{OFFER_COPY.volumeLabel}</Label>
                <span className="text-micro text-muted-foreground">{OFFER_COPY.volumeHint}</span>
              </div>
              <Select value={volume || undefined} onValueChange={setVolume}>
                <SelectTrigger id="offer-volume">
                  <SelectValue placeholder={OFFER_COPY.volumePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_VOLUMES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <spamGuard.Widget />

            <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? OFFER_COPY.submitting : OFFER_COPY.submit}
            </Button>
            <p className="text-center text-micro text-muted-foreground">{OFFER_COPY.privacy}</p>
          </form>
        </>
      )}
    </aside>
  );
}

export default OfferSlideIn;
